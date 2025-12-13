const { Pool } = require('pg');
const { MongoClient } = require('mongodb');
const { createClient } = require('redis');
const {
  connectPostgres,
  connectCockroach,
  connectMongoDB,
  connectRedis,
} = require('../config/dbConnectors');

const selectPostgres = async (pool, id) => {
  const client = await pool.connect();
  try {
    const start = process.hrtime.bigint();
    const result = await client.query(`SELECT * FROM logs WHERE id = $1`, [id]);
    const end = process.hrtime.bigint();
    return { time: Number(end - start) / 1_000_000, result: result.rows[0] }; // ms
  } finally {
    client.release();
  }
};

const selectMongoDB = async (db, id) => {
  const start = process.hrtime.bigint();
  const result = await db.command({
    find: 'logs',
    filter: { id: id },
    limit: 1,
  });
  const end = process.hrtime.bigint();
  return {
    time: Number(end - start) / 1_000_000,
    result: result.cursor.firstBatch[0],
  }; // ms
};

const selectRedis = async (client, id) => {
  const start = process.hrtime.bigint();
  const result = await client.get(`log:${id}`);
  const end = process.hrtime.bigint();
  return { time: Number(end - start) / 1_000_000, result: JSON.parse(result) }; // ms
};

module.exports = { selectPostgres, selectMongoDB, selectRedis };
