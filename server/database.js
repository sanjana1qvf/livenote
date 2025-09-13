const sqlite3 = require('sqlite3').verbose();
const path = require('path');

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

  // Update lectures table to include user_id
  db.run(`CREATE TABLE IF NOT EXISTS lectures_new (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    transcription TEXT,
    summary TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Migrate existing lectures (if any) - assign to a default user
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='lectures'", (err, table) => {
    if (table) {
      // Create a default user for existing lectures
      db.run(
        "INSERT OR IGNORE INTO users (google_id, email, name, picture) VALUES (?, ?, ?, ?)",
        ['default-user', 'default@example.com', 'Default User', ''],
        function() {
          const defaultUserId = this.lastID || 1;
          
          // Copy existing lectures to new table
          db.run(`INSERT INTO lectures_new (id, user_id, title, transcription, summary, notes, created_at, updated_at)
                  SELECT id, ?, title, transcription, summary, notes, created_at, updated_at 
                  FROM lectures`, [defaultUserId]);
          
          // Drop old table and rename new one
          db.run("DROP TABLE IF EXISTS lectures");
          db.run("ALTER TABLE lectures_new RENAME TO lectures");
        }
      );
    } else {
      // No existing lectures table, just rename the new one
      db.run("ALTER TABLE lectures_new RENAME TO lectures");
    }
  });
});

module.exports = { db };
