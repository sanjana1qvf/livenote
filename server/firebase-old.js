// Load environment variables
require('dotenv').config({ path: '../.env' });

const admin = require('firebase-admin');

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
    console.log('📱 Using SQLite for development');
  }
}

// Fallback to SQLite if Firebase is not available
const sqlite3 = require('sqlite3').verbose();
let sqliteDb = null;

if (!isFirebaseEnabled) {
  sqliteDb = new sqlite3.Database('notetaker.db');
  console.log('📱 SQLite database initialized');
}

// Database Interface Class
class DatabaseInterface {
  constructor() {
    this.isFirebase = isFirebaseEnabled;
    this.db = db;
    this.sqliteDb = sqliteDb;
  }

  // User operations
  async createUser(userData) {
    if (this.isFirebase) {
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

  async getLectures(userId) {
    if (this.isFirebase) {
      try {
        const lecturesSnapshot = await this.db.collection('lectures')
          .where('user_id', '==', userId)
          .orderBy('created_at', 'desc')
          .get();
        
        const lectures = [];
        lecturesSnapshot.forEach(doc => {
          lectures.push(doc.data());
        });
        
        const normalizeTimestampToIso = (value) => {
          if (!value) return null;
          if (typeof value.toDate === 'function') return value.toDate().toISOString();
          if (value.seconds !== undefined && value.nanoseconds !== undefined) {
            return new Date(value.seconds * 1000 + Math.floor(value.nanoseconds / 1e6)).toISOString();
          }
          const asDate = new Date(value);
          return isNaN(asDate.getTime()) ? null : asDate.toISOString();
        };
        
        return lectures.map(l => ({
          ...l,
          created_at: normalizeTimestampToIso(l.created_at) || l.created_at,
          updated_at: normalizeTimestampToIso(l.updated_at) || l.updated_at
        }));
      } catch (error) {
        const message = typeof error?.message === 'string' ? error.message : '';
        const details = typeof error?.details === 'string' ? error.details : '';
        const needsIndex = error?.code === 9 || message.includes('The query requires an index') || details.includes('The query requires an index');
        
        if (needsIndex) {
          // Fallback: fetch without orderBy and sort in memory
          const snapshot = await this.db.collection('lectures')
            .where('user_id', '==', userId)
            .get();

          const lectures = [];
          snapshot.forEach(doc => {
            lectures.push(doc.data());
          });

          const toMillis = (value) => {
            if (!value) return 0;
            if (typeof value.toDate === 'function') return value.toDate().getTime();
            if (value.seconds !== undefined && value.nanoseconds !== undefined) {
              return value.seconds * 1000 + Math.floor(value.nanoseconds / 1e6);
            }
            const t = new Date(value).getTime();
            return Number.isNaN(t) ? 0 : t;
          };

          lectures.sort((a, b) => toMillis(b.created_at) - toMillis(a.created_at));

          const normalizeTimestampToIso = (value) => {
            if (!value) return null;
            if (typeof value.toDate === 'function') return value.toDate().toISOString();
            if (value.seconds !== undefined && value.nanoseconds !== undefined) {
              return new Date(value.seconds * 1000 + Math.floor(value.nanoseconds / 1e6)).toISOString();
            }
            const asDate = new Date(value);
            return isNaN(asDate.getTime()) ? null : asDate.toISOString();
          };

          return lectures.map(l => ({
            ...l,
            created_at: normalizeTimestampToIso(l.created_at) || l.created_at,
            updated_at: normalizeTimestampToIso(l.updated_at) || l.updated_at
          }));
        }
        throw error;
      }
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
          return lectureData;
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

  async updateLectureTitle(lectureId, userId, newTitle) {
    if (this.isFirebase) {
      const lectureRef = this.db.collection('lectures').doc(lectureId);
      const lectureDoc = await lectureRef.get();
      
      if (lectureDoc.exists && lectureDoc.data().user_id === userId) {
        await lectureRef.update({
          title: newTitle,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
        return true;
      }
      return false;
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.run(
          'UPDATE lectures SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
          [newTitle, lectureId, userId],
          function(err) {
            if (err) reject(err);
            else resolve(this.changes > 0);
          }
        );
      });
    }
  }

  async deleteLecture(lectureId, userId) {
    if (this.isFirebase) {
      const lectureRef = this.db.collection('lectures').doc(lectureId);
      const lectureDoc = await lectureRef.get();
      
      if (lectureDoc.exists && lectureDoc.data().user_id === userId) {
        await lectureRef.delete();
        return true;
      }
      return false;
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
