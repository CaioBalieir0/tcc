const { generateLogData } = require('./data/dataGenerator');
const { setupDatabases } = require('./setup/setupDatabases');
const {
  insertPostgres,
  insertMongoDB,
  insertRedis,
} = require('./benchmarks/insertBenchmarks');
const {
  selectPostgres,
  selectMongoDB,
  selectRedis,
} = require('./benchmarks/selectBenchmarks');
const {
  monitorStatsDuringOperation,
  containerMap,
} = require('./utils/dockerMonitor');
const fs = require('fs');
const path = require('path');

// Função para salvar resultados incrementalmente
const saveResults = (results) => {
  // Usar process.cwd() que sempre aponta para o diretório de trabalho atual
  const resultsPath = path.join(process.cwd(), 'results.json');

  try {
    console.log(`[DEBUG] Tentando salvar em: ${resultsPath}`);
    console.log(`[DEBUG] __dirname: ${__dirname}`);
    console.log(`[DEBUG] process.cwd(): ${process.cwd()}`);
    console.log(
      `[DEBUG] Diretório existe: ${fs.existsSync(path.dirname(resultsPath))}`
    );

    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`✓ Resultados salvos em: ${resultsPath}`);
  } catch (error) {
    console.error('✗ Erro ao salvar resultados:', error);
    console.error('✗ Stack:', error.stack);
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

const runBenchmark = async () => {
  const dataVolumes = [100000, 1000000];
  const results = {};

  // Inicializar estrutura de resultados
  for (const volume of dataVolumes) {
    results[volume] = {
      postgresql: { insert: null, select: null },
      cockroachdb: { insert: null, select: null },
      mongodb: { insert: null, select: null },
      redis: { insert: null, select: null },
    };
  }

  // Salvar estrutura inicial
  saveResults(results);

  const { pgPool, cockroachPool, mongoDb, redisClient, mongoClient } =
    await setupDatabases();

  // Mapeamento de containers
  const dbContainers = {
    postgresql: 'tcc_postgres',
    cockroachdb: 'tcc_cockroach',
    mongodb: 'tcc_mongo',
    redis: 'tcc_redis',
  };

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
    console.log(`\n--- Inserções para ${volume} registros ---`);
    const { data } = volumesData[volume];

    // PostgreSQL - Insert
    const pgInsertResult = await runOperationWithStats(
      'tcc_postgres',
      'Inserindo',
      async () => ({ time: await insertPostgres(pgPool, data) })
    );
    results[volume].postgresql.insert = {
      time: pgInsertResult.time,
      stats: pgInsertResult.stats,
    };
    saveResults(results);

    // CockroachDB - Insert
    const cockroachInsertResult = await runOperationWithStats(
      'tcc_cockroach',
      'Inserindo',
      async () => ({ time: await insertPostgres(cockroachPool, data) })
    );
    results[volume].cockroachdb.insert = {
      time: cockroachInsertResult.time,
      stats: cockroachInsertResult.stats,
    };
    saveResults(results);

    // MongoDB - Insert
    const mongoInsertResult = await runOperationWithStats(
      'tcc_mongo',
      'Inserindo',
      async () => ({ time: await insertMongoDB(mongoDb, data) })
    );
    results[volume].mongodb.insert = {
      time: mongoInsertResult.time,
      stats: mongoInsertResult.stats,
    };
    saveResults(results);

    // Redis - Insert
    const redisInsertResult = await runOperationWithStats(
      'tcc_redis',
      'Inserindo',
      async () => ({ time: await insertRedis(redisClient, data) })
    );
    results[volume].redis.insert = {
      time: redisInsertResult.time,
      stats: redisInsertResult.stats,
    };
    saveResults(results);
  }

  console.log('\n--- Executando TODAS as seleções agora ---');

  // SEGUNDO: Executar TODAS as seleções para todos os volumes
  for (const volume of dataVolumes) {
    console.log(`\n--- Seleções para ${volume} registros ---`);
    const { sampleId } = volumesData[volume];

    // PostgreSQL - Select
    const pgSelectResult = await runOperationWithStats(
      'tcc_postgres',
      'Selecionando',
      async () => await selectPostgres(pgPool, sampleId)
    );
    results[volume].postgresql.select = {
      time: pgSelectResult.time,
      stats: pgSelectResult.stats,
    };
    saveResults(results);

    // CockroachDB - Select
    const cockroachSelectResult = await runOperationWithStats(
      'tcc_cockroach',
      'Selecionando',
      async () => await selectPostgres(cockroachPool, sampleId)
    );
    results[volume].cockroachdb.select = {
      time: cockroachSelectResult.time,
      stats: cockroachSelectResult.stats,
    };
    saveResults(results);

    // MongoDB - Select
    const mongoSelectResult = await runOperationWithStats(
      'tcc_mongo',
      'Selecionando',
      async () => await selectMongoDB(mongoDb, sampleId)
    );
    results[volume].mongodb.select = {
      time: mongoSelectResult.time,
      stats: mongoSelectResult.stats,
    };
    saveResults(results);

    // Redis - Select
    const redisSelectResult = await runOperationWithStats(
      'tcc_redis',
      'Selecionando',
      async () => await selectRedis(redisClient, sampleId)
    );
    results[volume].redis.select = {
      time: redisSelectResult.time,
      stats: redisSelectResult.stats,
    };
    saveResults(results);
  }

  console.log('\n--- Resultados Finais do Benchmark ---');
  console.table(results);

  // Salvar resultados finais antes de fechar conexões
  saveResults(results);
  console.log('✓ Resultados finais salvos em results.json');

  // Fechar conexões
  await pgPool.end();
  await cockroachPool.end();
  await mongoClient.close();
  await redisClient.quit();
  console.log('Conexoes fechadas');

  return results;
};

// Exportar a função para uso em outros módulos
module.exports = { runBenchmark };

// Se executado diretamente, rodar o benchmark
if (require.main === module) {
  runBenchmark().catch(console.error);
}
