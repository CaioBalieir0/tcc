const { Pool } = require('pg');
const { MongoClient } = require('mongodb');
const { createClient } = require('redis');
const { generateLogData } = require('../data/dataGenerator');
const {
  connectPostgres,
  connectCockroach,
  connectMongoDB,
  connectRedis,
} = require('../config/dbConnectors');

const insertPostgres = async (pool, data) => {
  const client = await pool.connect();
  try {
    const start = process.hrtime.bigint();
    for (const log of data) {
      await client.query(
        `INSERT INTO logs (id, timestamp, user_id, action, device, details) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          log.id,
          log.timestamp,
          log.user_id,
          log.action,
          log.device,
          log.details,
        ]
      );
    }
    const end = process.hrtime.bigint();
    return Number(end - start) / 1_000_000; // ms
  } finally {
    client.release();
  }
};

const insertMongoDB = async (db, data) => {
  const documents = data.map((log) => ({
    id: log.id,
    timestamp: new Date(log.timestamp),
    user_id: log.user_id,
    action: log.action,
    device: log.device,
    details: log.details,
  }));

  const batchSize = 1000; // Define o tamanho do lote
  const start = process.hrtime.bigint();

  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    await db.command({
      insert: 'logs',
      documents: batch,
      ordered: false,
    });
  }

  const end = process.hrtime.bigint();
  return Number(end - start) / 1_000_000; // ms
};

const insertRedis = async (client, data) => {
  const start = process.hrtime.bigint();
  for (const log of data) {
    await client.set(`log:${log.id}`, JSON.stringify(log));
  }
  const end = process.hrtime.bigint();
  return Number(end - start) / 1_000_000; // ms
};

module.exports = { insertPostgres, insertMongoDB, insertRedis };
