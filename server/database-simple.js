const sqlite3 = require('sqlite3').verbose();

// Initialize database
const db = new sqlite3.Database('notetaker.db');

// Create tables
db.serialize(() => {
  // Users table - updated to support both Google OAuth and simple auth
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id TEXT UNIQUE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password TEXT,
    picture TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Lectures table with user relationship
  db.run(`CREATE TABLE IF NOT EXISTS lectures (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    transcription TEXT,
    filtered_content TEXT,
    summary TEXT,
    notes TEXT,
    qna TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Add filtered_content column to existing tables (migration)
  db.run(`ALTER TABLE lectures ADD COLUMN filtered_content TEXT`, (err) => {
    if (err && err.message.includes('duplicate column name')) {
      // Column already exists, ignore error
      console.log('Column filtered_content already exists');
    } else if (err) {
      console.error('Error adding filtered_content column:', err);
    } else {
      console.log('Added filtered_content column to lectures table');
    }
  });

  // Add qna column to existing tables (migration)
  db.run(`ALTER TABLE lectures ADD COLUMN qna TEXT`, (err) => {
    if (err && err.message.includes('duplicate column name')) {
      // Column already exists, ignore error
      console.log('Column qna already exists');
    } else if (err) {
      console.error('Error adding qna column:', err);
    } else {
      console.log('Added qna column to lectures table');
    }
  });

  // Add password column to existing users table (migration)
  db.run(`ALTER TABLE users ADD COLUMN password TEXT`, (err) => {
    if (err && err.message.includes('duplicate column name')) {
      // Column already exists, ignore error
      console.log('Column password already exists');
    } else if (err) {
      console.error('Error adding password column:', err);
    } else {
      console.log('Added password column to users table');
    }
  });

  // Make google_id nullable for simple auth users
  db.run(`UPDATE users SET google_id = NULL WHERE google_id = ''`, (err) => {
    if (err) {
      console.error('Error updating google_id:', err);
    } else {
      console.log('Updated google_id for simple auth users');
    }
  });
});

module.exports = { db };
