const { Pool } = require('pg');
const { MongoClient } = require('mongodb');
const { createClient } = require('redis');
const { exec } = require('child_process');
const { promisify } = require('util');
const {
  connectPostgres,
  connectCockroach,
  connectCockroachCluster,
  connectMongoDB,
  connectRedis,
  cockroachConfig,
  cockroachClusterConfig
} = require('../config/dbConnectors');

const execAsync = promisify(exec);

const createPgTable = async (pool) => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id VARCHAR(255) PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL,
        user_id INTEGER NOT NULL,
        action VARCHAR(255) NOT NULL,
        device VARCHAR(255) NOT NULL,
        details JSONB
      );
    `);
    console.log('Tabela logs criada/verificada no PostgreSQL/CockroachDB.');
  } finally {
    client.release();
  }
};

const createMongoCollection = async (db) => {
  try {
    await db.createCollection('logs');
    console.log('Coleção logs criada/verificada no MongoDB.');
  } catch (error) {
    if (error.codeName === 'NamespaceExists') {
      console.log('Coleção logs já existe no MongoDB.');
    } else {
      throw error;
    }
  }
};

const setupDatabases = async () => {
  const pgPool = await connectPostgres();
  await createPgTable(pgPool);

  // Conectar a uma base de dados padrão para criar a base de dados tcc_bench no CockroachDB
  const tempCockroachPool = await connectCockroach({ ...cockroachConfig, database: 'defaultdb' });
  const tempClient = await tempCockroachPool.connect();
  try {
    // CockroachDB não suporta IF NOT EXISTS em CREATE DATABASE, então tentamos criar e ignoramos erro se já existir
    try {
      await tempClient.query(`CREATE DATABASE tcc_bench;`);
      console.log('Banco de dados tcc_bench criado no CockroachDB.');
    } catch (createError) {
      if (createError.message && createError.message.includes('already exists')) {
        console.log('Banco de dados tcc_bench já existe no CockroachDB.');
      } else {
        throw createError;
      }
    }
  } finally {
    tempClient.release();
    await tempCockroachPool.end();
  }

  const cockroachPool = await connectCockroach();
  await createPgTable(cockroachPool);

  const mongoClient = await connectMongoDB(); // Agora retorna o MongoClient
  const mongoDb = mongoClient.db('tcc_bench'); // Obter o Db a partir do MongoClient
  await createMongoCollection(mongoDb);

  const redisClient = await connectRedis();

  console.log('Configuração de esquemas de banco de dados concluída.');

  return { pgPool, cockroachPool, mongoDb, redisClient, mongoClient }; // Retornar o mongoClient
};

const setupComparisonDatabases = async () => {
  // Setup CockroachDB Single Node
  const tempCockroachPool = await connectCockroach({ ...cockroachConfig, database: 'defaultdb' });
  const tempClient = await tempCockroachPool.connect();
  try {
    // CockroachDB não suporta IF NOT EXISTS em CREATE DATABASE, então tentamos criar e ignoramos erro se já existir
    try {
      await tempClient.query(`CREATE DATABASE tcc_bench;`);
      console.log('Banco de dados tcc_bench criado no CockroachDB Single Node.');
    } catch (createError) {
      if (createError.message && createError.message.includes('already exists')) {
        console.log('Banco de dados tcc_bench já existe no CockroachDB Single Node.');
      } else {
        throw createError;
      }
    }
  } finally {
    tempClient.release();
    await tempCockroachPool.end();
  }

  const cockroachSinglePool = await connectCockroach();
  await createPgTable(cockroachSinglePool);

  // Setup CockroachDB Cluster (3 nodes)
  // NOTA: O cluster de 3 nodes está em docker-compose-comparison.yml separado
  // Certifique-se de que está rodando: docker-compose -f docker-compose-comparison.yml up -d
  // Aguardar um pouco para o cluster inicializar
  console.log('Aguardando cluster CockroachDB inicializar...');
  await new Promise(resolve => setTimeout(resolve, 10000)); // Aguardar 10 segundos
  
  // Tentar inicializar o cluster se necessário
  try {
    console.log('Verificando se o cluster precisa ser inicializado...');
    const { stdout, stderr } = await execAsync('docker exec tcc_cockroach_cluster_node1 cockroach init --insecure --host=cockroach-cluster-node1 2>&1');
    if (stdout && stdout.includes('Cluster successfully initialized')) {
      console.log('Cluster inicializado com sucesso.');
    }
  } catch (error) {
    // Se já estiver inicializado, o comando retorna erro, mas isso é OK
    const output = error.stdout || error.stderr || error.message || '';
    if (output.includes('Cluster successfully initialized')) {
      console.log('Cluster inicializado com sucesso.');
    } else if (output.includes('cluster has already been initialized') || output.includes('ERROR: cluster has already been initialized')) {
      console.log('Cluster já estava inicializado. Continuando...');
    } else {
      console.log(`Aviso ao verificar inicialização do cluster: ${output.substring(0, 100)}. Continuando...`);
    }
  }
  
  // Tentar conectar ao cluster com retry
  let tempClusterPool = null;
  let retries = 5;
  while (retries > 0) {
    try {
      tempClusterPool = await connectCockroachCluster({ ...cockroachClusterConfig, database: 'defaultdb' });
      const tempClusterClient = await tempClusterPool.connect();
      try {
        // CockroachDB não suporta IF NOT EXISTS em CREATE DATABASE, então tentamos criar e ignoramos erro se já existir
        try {
          await tempClusterClient.query(`CREATE DATABASE tcc_bench;`);
          console.log('Banco de dados tcc_bench criado no CockroachDB Cluster.');
        } catch (createError) {
          if (createError.message && createError.message.includes('already exists')) {
            console.log('Banco de dados tcc_bench já existe no CockroachDB Cluster.');
          } else {
            throw createError;
          }
        }
        tempClusterClient.release();
        break;
      } catch (error) {
        tempClusterClient.release();
        throw error;
      }
    } catch (error) {
      console.log(`Tentativa de conexão ao cluster falhou: ${error.message}. Tentativas restantes: ${retries - 1}`);
      retries--;
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Aguardar 5 segundos antes de tentar novamente
      } else {
        throw new Error(`Não foi possível conectar ao cluster CockroachDB após várias tentativas: ${error.message}`);
      }
    }
  }

  if (tempClusterPool) {
    await tempClusterPool.end();
  }

  const cockroachClusterPool = await connectCockroachCluster();
  await createPgTable(cockroachClusterPool);

  console.log('Configuração de bancos de comparação concluída.');

  return { cockroachSinglePool, cockroachClusterPool };
};

module.exports = { setupDatabases, setupComparisonDatabases, createPgTable, createMongoCollection };
