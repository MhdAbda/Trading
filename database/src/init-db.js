import pg from 'pg';
import { dbConfig, dbConfigNoDatabase } from './config.js';
import { allSchemas } from './schema.js';

const { Client } = pg;

/**
 * Create database if it doesn't exist
 */
async function createDatabase() {
  const client = new Client(dbConfigNoDatabase);
  
  try {
    await client.connect();
    console.log('Connected to PostgreSQL server');
    
    // Check if database exists
    const result = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbConfig.database]
    );
    
    if (result.rows.length === 0) {
      // Database doesn't exist, create it
      await client.query(`CREATE DATABASE ${dbConfig.database}`);
      console.log(`✓ Database '${dbConfig.database}' created successfully`);
    } else {
      console.log(`✓ Database '${dbConfig.database}' already exists`);
    }
  } catch (error) {
    console.error('Error creating database:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Create tables and schema
 */
async function createTables() {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    console.log(`Connected to database '${dbConfig.database}'`);
    
    // Execute all schema SQL statements
    for (const schema of allSchemas) {
      await client.query(schema);
    }
    
    console.log('✓ All tables and triggers created successfully');
    
    // Verify tables were created
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\nCreated tables:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
  } catch (error) {
    console.error('Error creating tables:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Main initialization function
 */
async function initializeDatabase() {
  console.log('Starting database initialization...\n');
  console.log('Configuration:');
  console.log(`  Host: ${dbConfig.host}`);
  console.log(`  Port: ${dbConfig.port}`);
  console.log(`  User: ${dbConfig.user}`);
  console.log(`  Database: ${dbConfig.database}\n`);
  
  try {
    // Step 1: Create database
    await createDatabase();
    
    // Step 2: Create tables
    await createTables();
    
    console.log('\n✓ Database initialization completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Database initialization failed:', error.message);
    process.exit(1);
  }
}

// Run initialization
initializeDatabase();
