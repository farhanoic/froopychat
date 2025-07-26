// init-db.js - Database initialization script
require('dotenv').config();
const { Pool } = require('pg');

// Use the DATABASE_URL from environment only
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initializeDatabase() {
  try {
    console.log('🚀 Initializing Froopy Chat database...');
    
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        gender VARCHAR(10) NOT NULL,
        username VARCHAR(100) UNIQUE,
        token VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Users table created/verified');

    // Add username column if it doesn't exist (migration)
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS username VARCHAR(100) UNIQUE;
    `);
    console.log('✅ Username column added/verified');

    // Add password_hash column if it doesn't exist (migration)
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
    `);
    console.log('✅ Password hash column added/verified');

    // Create active_sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS active_sessions (
        user_id INTEGER PRIMARY KEY,
        socket_id VARCHAR(100) NOT NULL,
        preferences JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    console.log('✅ Active sessions table created/verified');

    // Create friends table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS friends (
        id SERIAL PRIMARY KEY,
        user1_id INTEGER NOT NULL,
        user2_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user1_id, user2_id)
      );
    `);
    console.log('✅ Friends table created/verified');

    // Create indexes for friends table
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_friends_user1 ON friends(user1_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_friends_user2 ON friends(user2_id);
    `);
    console.log('✅ Friends table indexes created/verified');

    // Create friend_messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS friend_messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_read BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    console.log('✅ Friend messages table created/verified');

    // Create index for friend_messages table
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_friend_messages_users ON friend_messages(sender_id, receiver_id);
    `);
    console.log('✅ Friend messages table index created/verified');

    // Test the connection
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful:', result.rows[0].now);

    // Show table info
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('📊 Tables in database:', tables.rows.map(row => row.table_name));
    
    console.log('🎉 Database initialization complete!');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase();
}

module.exports = { initializeDatabase, pool };