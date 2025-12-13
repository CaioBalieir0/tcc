const { Pool } = require('pg');
const { MongoClient } = require('mongodb');
const { createClient } = require('redis');

const pgConfig = {
  user: 'admin',
  host: 'localhost',
  database: 'tcc_bench',
  password: 'password123',
  port: 5432,
};

const cockroachConfig = {
  user: 'root',
  host: 'localhost',
  database: 'tcc_bench',
  password: '',
  port: 26257,
};

const cockroachClusterConfig = {
  user: 'root',
  host: 'localhost',
  database: 'tcc_bench',
  password: '',
  port: 26258, // Porta do primeiro node do cluster
};

const mongoConfig = {
  url: `mongodb://${process.env.MONGO_INITDB_ROOT_USERNAME || 'admin'}:${process.env.MONGO_INITDB_ROOT_PASSWORD || 'password123'}@localhost:27017`,
  dbName: 'tcc_bench',
};

const redisConfig = {
  url: 'redis://localhost:6379',
};

const connectPostgres = async () => {
  const pool = new Pool(pgConfig);
  try {
    await pool.query('SELECT 1');
    console.log('Conectado ao PostgreSQL');
    return pool;
  } catch (error) {
    console.error('Erro ao conectar ao PostgreSQL:', error.message);
    throw error;
  }
};

const connectCockroach = async (config = cockroachConfig) => {
  const pool = new Pool(config);
  try {
    await pool.query('SELECT 1');
    console.log(`Conectado ao CockroachDB (${config.database || 'defaultdb'})`);
    return pool;
  } catch (error) {
    console.error(`Erro ao conectar ao CockroachDB (${config.database || 'defaultdb'}):`, error.message);
    throw error;
  }
};

const connectMongoDB = async () => {
  const client = new MongoClient(mongoConfig.url);
  try {
    await client.connect();
    console.log('Conectado ao MongoDB');
    return client; // Retorna o MongoClient completo
  } catch (error) {
    console.error('Erro ao conectar ao MongoDB:', error.message);
    throw error;
  }
};

const connectRedis = async () => {
  const client = createClient(redisConfig);
  client.on('error', (err) => console.error('Redis Client Error', err));
  try {
    await client.connect();
    console.log('Conectado ao Redis');
    return client;
  } catch (error) {
    console.error('Erro ao conectar ao Redis:', error.message);
    throw error;
  }
};

const connectCockroachCluster = async (config = cockroachClusterConfig) => {
  const pool = new Pool(config);
  try {
    await pool.query('SELECT 1');
    console.log(`Conectado ao CockroachDB Cluster (${config.database || 'defaultdb'})`);
    return pool;
  } catch (error) {
    console.error(`Erro ao conectar ao CockroachDB Cluster (${config.database || 'defaultdb'}):`, error.message);
    throw error;
  }
};

module.exports = {
  connectPostgres,
  connectCockroach,
  connectCockroachCluster,
  connectMongoDB,
  connectRedis,
  pgConfig,
  cockroachConfig,
  cockroachClusterConfig,
  mongoConfig,
  redisConfig
};
