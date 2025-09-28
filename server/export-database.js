const admin = require('firebase-admin');
const fs = require('fs-extra');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '../.env' });

// Initialize Firebase Admin SDK
let db = null;
let isFirebaseEnabled = false;

try {
  // Try to use Firebase if credentials are available
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
    console.log('✅ Firebase Firestore initialized for export');
  } else {
    console.log('❌ Firebase credentials not found. Cannot export from Firestore.');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Firebase initialization failed:', error.message);
  process.exit(1);
}

async function exportDatabase() {
  try {
    console.log('🔄 Starting database export...');
    
    const exportData = {
      exportDate: new Date().toISOString(),
      users: [],
      lectures: []
    };

    // Export Users
    console.log('📊 Exporting users...');
    const usersSnapshot = await db.collection('users').get();
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      exportData.users.push({
        id: doc.id,
        ...userData
      });
    });
    console.log(`✅ Exported ${exportData.users.length} users`);

    // Export Lectures
    console.log('📊 Exporting lectures...');
    const lecturesSnapshot = await db.collection('lectures').get();
    lecturesSnapshot.forEach(doc => {
      const lectureData = doc.data();
      exportData.lectures.push({
        id: doc.id,
        ...lectureData
      });
    });
    console.log(`✅ Exported ${exportData.lectures.length} lectures`);

    // Create export directory
    const exportDir = path.join(__dirname, 'exports');
    await fs.ensureDir(exportDir);

    // Save to JSON file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `firestore-export-${timestamp}.json`;
    const filepath = path.join(exportDir, filename);
    
    await fs.writeJson(filepath, exportData, { spaces: 2 });
    
    console.log(`✅ Database exported successfully to: ${filepath}`);
    console.log(`📊 Export Summary:`);
    console.log(`   - Users: ${exportData.users.length}`);
    console.log(`   - Lectures: ${exportData.lectures.length}`);
    console.log(`   - Total size: ${(await fs.stat(filepath)).size} bytes`);

    // Also create a CSV export for lectures
    const csvFilename = `lectures-export-${timestamp}.csv`;
    const csvFilepath = path.join(exportDir, csvFilename);
    
    let csvContent = 'ID,User ID,Title,Created At,Updated At,Transcription Length,Summary Length,Notes Length,Q&A Length\n';
    
    exportData.lectures.forEach(lecture => {
      const created_at = lecture.created_at ? (lecture.created_at.toDate ? lecture.created_at.toDate().toISOString() : lecture.created_at) : 'N/A';
      const updated_at = lecture.updated_at ? (lecture.updated_at.toDate ? lecture.updated_at.toDate().toISOString() : lecture.updated_at) : 'N/A';
      const transcriptionLength = lecture.transcription ? lecture.transcription.length : 0;
      const summaryLength = lecture.summary ? lecture.summary.length : 0;
      const notesLength = lecture.notes ? lecture.notes.length : 0;
      const qnaLength = lecture.qna ? lecture.qna.length : 0;
      
      csvContent += `"${lecture.id}","${lecture.user_id}","${lecture.title}","${created_at}","${updated_at}",${transcriptionLength},${summaryLength},${notesLength},${qnaLength}\n`;
    });
    
    await fs.writeFile(csvFilepath, csvContent);
    console.log(`✅ CSV export created: ${csvFilepath}`);

  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  }
}

// Run the export
exportDatabase().then(() => {
  console.log('🎉 Export completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Export failed:', error);
  process.exit(1);
});
