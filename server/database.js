const sqlite3 = require('sqlite3').verbose();

// Initialize database
const db = new sqlite3.Database('notetaker.db');

// Create tables
db.serialize(() => {
  // Users table - supports both Google OAuth and simple auth
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

  console.log('✅ Database tables created successfully');
});

module.exports = { db };
