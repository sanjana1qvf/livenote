// Load environment variables
require('dotenv').config({ path: '../.env' });

const admin = require('firebase-admin');
const sqlite3 = require('sqlite3').verbose();

// Initialize Firebase Admin SDK
let db = null;
let isFirebaseEnabled = false;

if (process.env.NODE_ENV === 'production') {
  try {
    // For production, use service account key from environment variable
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      : null;
    
    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID || 'ai-notetaker-platform'
      });
      db = admin.firestore();
      isFirebaseEnabled = true;
      console.log('✅ Firebase Firestore initialized for production');
    } else {
      console.log('⚠️ Firebase credentials not found, falling back to SQLite');
    }
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    console.log('⚠️ Falling back to SQLite');
  }
} else {
  // For development, try to use Firebase if credentials are available
  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      : null;
    
    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID || 'ai-notetaker-platform'
      });
      db = admin.firestore();
      isFirebaseEnabled = true;
      console.log('✅ Firebase Firestore initialized for development');
    } else {
      console.log('📱 Using SQLite for development (no Firebase credentials)');
    }
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    console.log('⚠️ Falling back to SQLite');
  }
}

// Initialize SQLite database
const sqliteDb = new sqlite3.Database('notetaker.db');

// Database interface class
class DatabaseInterface {
  constructor() {
    this.isFirebase = isFirebaseEnabled;
    this.db = db;
    this.sqliteDb = sqliteDb;
  }

  // User operations
  async createUser(userData) {
    if (this.isFirebase) {
      if (userData.google_id) {
        // Google OAuth user
        const userRef = this.db.collection('users').doc(userData.google_id);
        await userRef.set({
          google_id: userData.google_id,
          email: userData.email,
          name: userData.name,
          picture: userData.picture,
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        return { id: userData.google_id, ...userData };
      } else {
        // Simple auth user
        const userRef = this.db.collection('users').doc();
        await userRef.set({
          name: userData.name,
          email: userData.email,
          password: userData.password,
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        return { id: userRef.id, ...userData };
      }
    } else {
      if (userData.google_id) {
        // Google OAuth user
        return new Promise((resolve, reject) => {
          this.sqliteDb.run(
            'INSERT INTO users (google_id, email, name, picture) VALUES (?, ?, ?, ?)',
            [userData.google_id, userData.email, userData.name, userData.picture],
            function(err) {
              if (err) reject(err);
              else resolve({ id: this.lastID, ...userData });
            }
          );
        });
      } else {
        // Simple auth user
        return new Promise((resolve, reject) => {
          this.sqliteDb.run(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [userData.name, userData.email, userData.password],
            function(err) {
              if (err) reject(err);
              else resolve({ id: this.lastID, ...userData });
            }
          );
        });
      }
    }
  }

  async findUserByGoogleId(googleId) {
    if (this.isFirebase) {
      const userDoc = await this.db.collection('users').doc(googleId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        return { id: googleId, ...userData };
      }
      return null;
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.get(
          'SELECT * FROM users WHERE google_id = ?',
          [googleId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
    }
  }

  async findUserByEmail(email) {
    if (this.isFirebase) {
      const usersSnapshot = await this.db.collection('users').where('email', '==', email).get();
      if (!usersSnapshot.empty) {
        const userDoc = usersSnapshot.docs[0];
        const userData = userDoc.data();
        return { id: userDoc.id, ...userData };
      }
      return null;
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.get(
          'SELECT * FROM users WHERE email = ?',
          [email],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
    }
  }

  async findUserById(id) {
    if (this.isFirebase) {
      const userDoc = await this.db.collection('users').doc(id).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        return { id: userDoc.id, ...userData };
      }
      return null;
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.get(
          'SELECT * FROM users WHERE id = ?',
          [id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
    }
  }

  // Lecture operations
  async createLecture(lectureData) {
    if (this.isFirebase) {
      const lectureRef = this.db.collection('lectures').doc(lectureData.id);
      await lectureRef.set({
        id: lectureData.id,
        user_id: lectureData.user_id,
        title: lectureData.title,
        transcription: lectureData.transcription,
        filtered_content: lectureData.filtered_content,
        summary: lectureData.summary,
        notes: lectureData.notes,
        qna: lectureData.qna,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });
      return lectureData;
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.run(
          'INSERT INTO lectures (id, user_id, title, transcription, filtered_content, summary, notes, qna) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [lectureData.id, lectureData.user_id, lectureData.title, lectureData.transcription, lectureData.filtered_content, lectureData.summary, lectureData.notes, lectureData.qna],
          function(err) {
            if (err) reject(err);
            else resolve(lectureData);
          }
        );
      });
    }
  }

  async getLecturesByUserId(userId) {
    if (this.isFirebase) {
      const lecturesSnapshot = await this.db.collection('lectures').where('user_id', '==', userId).get();
      const lectures = [];
      lecturesSnapshot.forEach(doc => {
        lectures.push({ id: doc.id, ...doc.data() });
      });
      return lectures;
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.all(
          'SELECT * FROM lectures WHERE user_id = ? ORDER BY created_at DESC',
          [userId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });
    }
  }

  async getLectureById(lectureId, userId) {
    if (this.isFirebase) {
      const lectureDoc = await this.db.collection('lectures').doc(lectureId).get();
      if (lectureDoc.exists) {
        const lectureData = lectureDoc.data();
        if (lectureData.user_id === userId) {
          return { id: lectureDoc.id, ...lectureData };
        }
      }
      return null;
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.get(
          'SELECT * FROM lectures WHERE id = ? AND user_id = ?',
          [lectureId, userId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
    }
  }

  async updateLecture(lectureId, userId, updateData) {
    if (this.isFirebase) {
      const lectureRef = this.db.collection('lectures').doc(lectureId);
      const lectureDoc = await lectureRef.get();
      
      if (!lectureDoc.exists) {
        return null;
      }
      
      const lectureData = lectureDoc.data();
      if (lectureData.user_id !== userId) {
        return null;
      }
      
      // Filter out undefined values to prevent Firestore errors
      const filteredUpdateData = Object.fromEntries(
        Object.entries(updateData).filter(([key, value]) => value !== undefined)
      );
      
      await lectureRef.update({
        ...filteredUpdateData,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return { id: lectureId, ...lectureData, ...updateData };
    } else {
      return new Promise((resolve, reject) => {
        // First check if lecture exists and belongs to user
        this.sqliteDb.get(
          'SELECT * FROM lectures WHERE id = ? AND user_id = ?',
          [lectureId, userId],
          (err, row) => {
            if (err) {
              reject(err);
            } else if (!row) {
              resolve(null);
            } else {
              // Update the lecture
              const updateFields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
              const values = Object.values(updateData);
              values.push(lectureId, userId);
              
              this.sqliteDb.run(
                `UPDATE lectures SET ${updateFields} WHERE id = ? AND user_id = ?`,
                values,
                function(err) {
                  if (err) reject(err);
                  else resolve({ id: lectureId, ...row, ...updateData });
                }
              );
            }
          }
        );
      });
    }
  }

  async deleteLecture(lectureId, userId) {
    if (this.isFirebase) {
      const lectureRef = this.db.collection('lectures').doc(lectureId);
      const lectureDoc = await lectureRef.get();
      
      if (!lectureDoc.exists) {
        return false;
      }
      
      const lectureData = lectureDoc.data();
      if (lectureData.user_id !== userId) {
        return false;
      }
      
      await lectureRef.delete();
      return true;
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.run(
          'DELETE FROM lectures WHERE id = ? AND user_id = ?',
          [lectureId, userId],
          function(err) {
            if (err) reject(err);
            else resolve(this.changes > 0);
          }
        );
      });
    }
  }
}

// Export the database interface
module.exports = new DatabaseInterface();
