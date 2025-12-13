const { Pool } = require('pg');
const { MongoClient } = require('mongodb');
const { createClient } = require('redis');
const {
  connectPostgres,
  connectCockroach,
  connectMongoDB,
  connectRedis,
  cockroachConfig
} = require('../config/dbConnectors');

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
    await tempClient.query(`CREATE DATABASE IF NOT EXISTS tcc_bench;`);
    console.log('Banco de dados tcc_bench criado/verificado no CockroachDB.');
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

module.exports = { setupDatabases, createPgTable, createMongoCollection };
