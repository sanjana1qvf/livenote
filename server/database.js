const sqlite3 = require('sqlite3').verbose();

// Initialize database
const db = new sqlite3.Database('notetaker.db');

// Create tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
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
});

module.exports = { db };
