import pg from 'pg';
import bcrypt from 'bcryptjs';
import { dbConfig } from './config.js';

const { Client } = pg;

/**
 * Create a default user for development/demo
 */
async function createDefaultUser() {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    console.log('Creating default user...');
    
    // Check if user already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE username = $1',
      ['demo_user']
    );
    
    if (existingUser.rows.length > 0) {
      console.log('✓ Default user already exists (id: ' + existingUser.rows[0].id + ')');
      return;
    }
    
    // Hash password
    const password = 'demo_password_123';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    // Create default user
    const result = await client.query(
      `INSERT INTO users (username, email, password_hash, phone_number) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, username, email`,
      ['demo_user', 'demo@trading-bot.local', passwordHash, '+1-555-0100']
    );
    
    const user = result.rows[0];
    console.log(`✓ Default user created (id: ${user.id}, username: ${user.username})`);
    
  } catch (error) {
    console.error('Error creating default user:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

// Run if called directly
createDefaultUser()
  .then(() => {
    console.log('Default user setup complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('Failed to create default user:', err);
    process.exit(1);
  });

export { createDefaultUser };
