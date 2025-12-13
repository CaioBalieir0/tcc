const { generateLogData } = require('./data/dataGenerator');
const { setupComparisonDatabases } = require('./setup/setupDatabases');
const {
  insertPostgres,
} = require('./benchmarks/insertBenchmarks');
const {
  selectPostgres,
} = require('./benchmarks/selectBenchmarks');
const {
  monitorStatsDuringOperation,
  containerMap,
} = require('./utils/dockerMonitor');
const fs = require('fs');
const path = require('path');

// Função para salvar resultados incrementalmente
const saveResults = (results) => {
  const resultsPath = path.join(process.cwd(), 'comparison-results.json');

  try {
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`✓ Resultados salvos em: ${resultsPath}`);
  } catch (error) {
    console.error('✗ Erro ao salvar resultados:', error);
    throw error;
  }
};

// Função para executar operação com monitoramento de stats
const runOperationWithStats = async (
  containerName,
  operationName,
  operationFn
) => {
  console.log(`${containerName}: ${operationName}...`);
  const result = await monitorStatsDuringOperation(containerName, operationFn);
  console.log(
    `${containerName} ${operationName}: ${
      result.time?.toFixed(2) || result.toFixed(2)
    } ms`
  );
  return result;
};

const runComparisonBenchmark = async () => {
  try {
    const dataVolumes = [10000, 100000];
    const results = {};

    // Inicializar estrutura de resultados
    for (const volume of dataVolumes) {
      results[volume] = {
        'cockroach-single': { insert: null, select: null },
        'cockroach-cluster': { insert: null, select: null },
      };
    }

    // Salvar estrutura inicial
    saveResults(results);

    console.log('Configurando bancos de dados...');
    const { cockroachSinglePool, cockroachClusterPool } =
      await setupComparisonDatabases();

  // Preparar dados para todos os volumes
  const volumesData = {};
  for (const volume of dataVolumes) {
    const data = generateLogData(volume);
    const sampleId = data[Math.floor(Math.random() * data.length)].id;
    volumesData[volume] = { data, sampleId };
  }

  console.log('\n--- Executando TODAS as inserções primeiro ---');

  // PRIMEIRO: Executar TODAS as inserções para todos os volumes
  for (const volume of dataVolumes) {
    try {
      console.log(`\n--- Inserções para ${volume} registros ---`);
      const { data } = volumesData[volume];

      // CockroachDB Single Node - Insert
      console.log(`Inserindo ${volume} registros no CockroachDB Single Node...`);
      const singleInsertResult = await runOperationWithStats(
        'tcc_cockroach',
        'Inserindo',
        async () => ({ time: await insertPostgres(cockroachSinglePool, data) })
      );
      results[volume]['cockroach-single'].insert = {
        time: singleInsertResult.time,
        stats: singleInsertResult.stats,
      };
      saveResults(results);

      // CockroachDB Cluster - Insert
      console.log(`Inserindo ${volume} registros no CockroachDB Cluster...`);
      const clusterInsertResult = await runOperationWithStats(
        'tcc_cockroach_cluster_node1',
        'Inserindo',
        async () => ({ time: await insertPostgres(cockroachClusterPool, data) })
      );
      results[volume]['cockroach-cluster'].insert = {
        time: clusterInsertResult.time,
        stats: clusterInsertResult.stats,
      };
      saveResults(results);
    } catch (error) {
      console.error(`Erro ao executar inserções para ${volume} registros:`, error);
      throw new Error(`Erro ao executar inserções para ${volume} registros: ${error.message}`);
    }
  }

  console.log('\n--- Executando TODAS as seleções agora ---');

  // SEGUNDO: Executar TODAS as seleções para todos os volumes
  for (const volume of dataVolumes) {
    try {
      console.log(`\n--- Seleções para ${volume} registros ---`);
      const { sampleId } = volumesData[volume];

      // CockroachDB Single Node - Select
      console.log(`Selecionando no CockroachDB Single Node...`);
      const singleSelectResult = await runOperationWithStats(
        'tcc_cockroach',
        'Selecionando',
        async () => await selectPostgres(cockroachSinglePool, sampleId)
      );
      results[volume]['cockroach-single'].select = {
        time: singleSelectResult.time,
        stats: singleSelectResult.stats,
      };
      saveResults(results);

      // CockroachDB Cluster - Select
      console.log(`Selecionando no CockroachDB Cluster...`);
      const clusterSelectResult = await runOperationWithStats(
        'tcc_cockroach_cluster_node1',
        'Selecionando',
        async () => await selectPostgres(cockroachClusterPool, sampleId)
      );
      results[volume]['cockroach-cluster'].select = {
        time: clusterSelectResult.time,
        stats: clusterSelectResult.stats,
      };
      saveResults(results);
    } catch (error) {
      console.error(`Erro ao executar seleções para ${volume} registros:`, error);
      throw new Error(`Erro ao executar seleções para ${volume} registros: ${error.message}`);
    }
  }

  console.log('\n--- Resultados Finais do Benchmark de Comparação ---');
  console.table(results);

  // Salvar resultados finais antes de fechar conexões
  saveResults(results);
  console.log('✓ Resultados finais salvos em comparison-results.json');

    // Fechar conexões
    await cockroachSinglePool.end();
    await cockroachClusterPool.end();
    console.log('Conexoes fechadas');

    return results;
  } catch (error) {
    console.error('Erro fatal no benchmark de comparação:', error);
    console.error('Stack:', error.stack);
    throw error; // Re-throw para que o servidor possa capturar
  }
};

// Exportar a função para uso em outros módulos
module.exports = { runComparisonBenchmark };

// Se executado diretamente, rodar o benchmark
if (require.main === module) {
  runComparisonBenchmark().catch(console.error);
}

