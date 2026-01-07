/**
 * Database connection utility
 * Creates and manages PostgreSQL connection pool
 */

const { Pool } = require('pg');
const config = require('../config/env');
const logger = require('./logger');

// Create connection pool
const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.name,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Pool event handlers
pool.on('connect', () => {
});

pool.on('error', (err) => {
  process.exit(-1);
});

/**
 * Execute a query with parameters
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    return result;
  } catch (error) {
    throw error;
  }
};

/**
 * Get a client from the pool for transactions
 * Remember to release the client when done!
 * @returns {Promise<Object>} Database client
 */
const getClient = async () => {
  const client = await pool.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);
  
  // Set a timeout of 5 seconds, after which we will log this client's last query
  const timeout = setTimeout(() => {
  }, 5000);
  
  // Monkey patch the client release to clear the timeout
  client.release = () => {
    clearTimeout(timeout);
    client.release = release;
    return release();
  };
  
  return client;
};

/**
 * Test database connection
 * @returns {Promise<boolean>} True if connection is successful
 */
const testConnection = async () => {
  try {
    const result = await query('SELECT NOW()');
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Close all database connections
 */
const closePool = async () => {
  await pool.end();
};

module.exports = {
  query,
  getClient,
  testConnection,
  closePool,
  pool
};
