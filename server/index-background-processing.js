
const { spawn } = require('child_process');
const path = require('path');

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');
const ffmpeg = require('fluent-ffmpeg');
const cors = require('cors');
const { requireAuth, register, login, getProfile } = require('./auth-simple');
const db = require('./firebase');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Check lecture processing status
app.get('/api/lectures/:id/status', requireAuth, async (req, res) => {
  try {
    const lecture = await db.getLectureById(req.params.id, req.user.id);
    if (!lecture) {
      return res.status(404).json({ error: 'Lecture not found' });
    }
    
    res.json({
      id: lecture.id,
      title: lecture.title,
      status: lecture.processing_status || 'unknown',
      progress: getProcessingProgress(lecture),
      created_at: lecture.created_at,
      processing_started_at: lecture.processing_started_at,
      processing_completed_at: lecture.processing_completed_at,
      duration_minutes: lecture.duration_minutes
    });
  } catch (error) {
    console.error('Error checking lecture status:', error);
    res.status(500).json({ error: 'Failed to check lecture status' });
  }
});

// Get all lectures with processing status
app.get('/api/lectures', requireAuth, async (req, res) => {
  try {
    const lectures = await db.getLecturesByUserId(req.user.id);
    
    // Add processing status to each lecture
    const lecturesWithStatus = lectures.map(lecture => ({
      ...lecture,
      status: lecture.processing_status || 'completed',
      progress: getProcessingProgress(lecture)
    }));
    
    res.json(lecturesWithStatus);
  } catch (error) {
    console.error('Error fetching lectures:', error);
    res.status(500).json({ error: 'Failed to fetch lectures' });
  }
});

// Helper function to determine processing progress
function getProcessingProgress(lecture) {
  const status = lecture.processing_status || 'completed';
  
  switch (status) {
    case 'uploaded':
      return { percentage: 10, message: 'Uploaded, preparing for processing...' };
    case 'processing':
      return { percentage: 50, message: 'Processing audio and generating notes...' };
    case 'completed':
      return { percentage: 100, message: 'Processing completed!' };
    case 'failed':
      return { percentage: 0, message: 'Processing failed. Please try again.' };
    default:
      return { percentage: 100, message: 'Ready to view' };
  }
}



// Check if FFmpeg is available (for Render compatibility)
let ffmpegAvailable = false;
try {
  ffmpeg.getAvailableFormats((err, formats) => {
    if (!err && formats) {
      ffmpegAvailable = true;
      console.log('✅ FFmpeg is available for audio preprocessing');
    } else {
      console.log('⚠️ FFmpeg not available, using basic processing');
    }
  });
} catch (error) {
  console.log('⚠️ FFmpeg not available, using basic processing');
}

// Enhanced audio preprocessing for classroom noise handling (with fallback)
async function preprocessAudioForClassroom(audioPath) {
  if (!ffmpegAvailable) {
    console.log('⚠️ FFmpeg not available, skipping audio preprocessing');
    return audioPath; // Return original path
  }

  const processedPath = audioPath.replace(/.webm$/, "_processed.webm");
  
  return new Promise((resolve, reject) => {
    ffmpeg(audioPath)
      .audioFilters([
        "highpass=f=200",     // Remove low-frequency noise
        "lowpass=f=8000",     // Remove high-frequency noise
        "dynaudnorm",         // Dynamic normalization
        "afftdn",             // Advanced noise reduction
        "volume=1.2"          // Boost volume
      ])
      .audioCodec("libopus")
      .audioBitrate("128k")
      .output(processedPath)
      .on("end", () => {
        console.log("✅ Audio preprocessed for classroom environment");
        resolve(processedPath);
      })
      .on("error", (err) => {
        console.log("⚠️ Audio preprocessing failed, using original:", err.message);
        resolve(audioPath); // Fallback to original audio
      })
      .run();
  });
}

// Enhanced content filtering for classroom environments
async function filterClassroomContent(transcription) {
  const filterResponse = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: "You are an expert content filter for educational environments. Your task is to:\n\n1. EXTRACT ONLY the main teacher/instructor content\n2. REMOVE all student conversations, side discussions, and background chatter\n3. REMOVE classroom noise, interruptions, and off-topic discussions\n4. FOCUS on educational content, explanations, and key concepts\n5. PRESERVE the logical flow of the lecture\n6. REMOVE filler words, repetitions, and irrelevant content\n7. IMPORTANT: Always respond in English, regardless of input language\n8. TRANSLATE any non-English content to English while preserving meaning\n\nReturn only the filtered educational content, no explanations."
      },
      {
        role: "user",
        content: transcription
      }
    ],
    max_tokens: 4000,
    temperature: 0.2
  });
  
  return filterResponse.choices[0].message.content;
}

// Enhanced summary generation for classroom content
async function generateClassroomSummary(filteredContent) {
  const summaryResponse = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: "You are an expert at creating educational summaries. Create a comprehensive summary that:\n\n1. FOCUSES on the main educational concepts taught\n2. HIGHLIGHTS key learning objectives and takeaways\n3. ORGANIZES content by topics and themes\n4. PRESERVES the logical flow of the lecture\n5. REMOVES any remaining noise or irrelevant content\n6. IMPORTANT: Always respond in English, regardless of input language\n7. TRANSLATE any non-English content to English while preserving meaning\n\nCreate a clear, educational summary suitable for student review."
      },
      {
        role: "user",
        content: filteredContent
      }
    ],
    max_tokens: 500,
    temperature: 0.3
  });
  
  return summaryResponse.choices[0].message.content;
}

// Enhanced notes generation for classroom environments
async function generateClassroomNotes(filteredContent) {
  const notesResponse = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: "You are an expert educational note-taker. Create comprehensive, well-structured notes in this format:\n\nNotes – [Topic Title]\n\n1. [Main Topic 1]\n\n[Key concept with clear definition]\n\n[Important details and explanations]\n\n[Examples or applications when relevant]\n\n2. [Main Topic 2]\n\n[Key concept with clear definition]\n\n[Important details and explanations]\n\n[Examples or applications when relevant]\n\n3. [Main Topic 3]\n\n[Continue pattern...]\n\nGuidelines:\n- Use numbered sections (1, 2, 3, etc.) for main topics\n- Include clear definitions for key concepts\n- Add important details and explanations\n- Include examples and applications when relevant\n- Use bullet points for lists within sections\n- Keep language clear and educational\n- No markdown formatting (#, *, etc.)\n- Always respond in English\n- Translate non-English content to English\n- Make comprehensive but organized notes for studying"
      },
      {
        role: "user",
        content: filteredContent
      }
    ],
    max_tokens: 500,
    temperature: 0.3
  });
  
  return notesResponse.choices[0].message.content;
}

// Enhanced Q&A generation for classroom content
async function generateClassroomQnA(filteredContent) {
  const qnaResponse = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: "You are an expert educator creating study questions. Generate 5-10 relevant questions and answers that:\n\n1. TEST understanding of key concepts taught\n2. COVER important topics and learning objectives\n3. INCLUDE both factual and analytical questions\n4. PROVIDE clear, educational answers\n5. FOCUS on the main educational content\n6. REMOVE any questions about irrelevant or noisy content\n7. IMPORTANT: Always respond in English, regardless of input language\n8. TRANSLATE any non-English content to English while preserving meaning\n\nFormat as Q: [question] A: [answer]"
      },
      {
        role: "user",
        content: filteredContent
      }
    ],
    max_tokens: 400,
    temperature: 0.3
  });
  
  return qnaResponse.choices[0].message.content;
}

// CORS configuration for mobile compatibility
app.use(cors({
  origin: true, // Allow all origins for mobile access
  credentials: true
}));

// Additional headers for mobile compatibility
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configure multer for file uploads with increased limits
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.NODE_ENV === 'production' ? '/tmp' : 'uploads';
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `audio-${Date.now()}-${Math.floor(Math.random() * 1000000000)}.webm`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'audio/webm' || file.mimetype === 'audio/wav' || file.mimetype === 'audio/mp3') {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed!'), false);
    }
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    features: {
      classroomNoiseHandling: true,
      audioPreprocessing: ffmpegAvailable,
      enhancedContentFiltering: true,
      renderCompatible: true
    }
  });
});

// Auth routes
app.post('/api/auth/register', register);
app.post('/api/auth/login', login);
app.get('/api/auth/profile', requireAuth, getProfile);

// Get user's lectures
app.get('/api/lectures', requireAuth, async (req, res) => {
  try {
    const lectures = await db.getLecturesByUserId(req.user.id);
    res.json(lectures);
  } catch (error) {
    console.error('Error fetching lectures:', error);
    res.status(500).json({ error: 'Failed to fetch lectures' });
  }
});

// Get specific lecture
app.get('/api/lectures/:id', requireAuth, async (req, res) => {
  try {
    const lecture = await db.getLectureById(req.params.id, req.user.id);
    if (!lecture) {
      return res.status(404).json({ error: 'Lecture not found' });
    }
    res.json(lecture);
  } catch (error) {
    console.error('Error fetching lecture:', error);
    res.status(500).json({ error: 'Failed to fetch lecture' });
  }
});

// Update lecture
app.put('/api/lectures/:id', requireAuth, async (req, res) => {
  try {
    const { title, notes } = req.body;
    const lecture = await db.updateLecture(req.params.id, req.user.id, { title, notes });
    if (!lecture) {
      return res.status(404).json({ error: 'Lecture not found' });
    }
    res.json(lecture);
  } catch (error) {
    console.error('Error updating lecture:', error);
    res.status(500).json({ error: 'Failed to update lecture' });
  }
});

// Delete lecture
app.delete('/api/lectures/:id', requireAuth, async (req, res) => {
  try {
    const lecture = await db.getLectureById(req.params.id, req.user.id);
    
    if (!lecture) {
      return res.status(404).json({ error: 'Lecture not found' });
    }
    
    // Check if user owns this lecture
    if (lecture.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await db.deleteLecture(req.params.id, req.user.id);
    res.json({ message: 'Lecture deleted successfully' });
  } catch (error) {
    console.error('Error deleting lecture:', error);
    res.status(500).json({ error: 'Failed to delete lecture' });
  }
});


// Background processing functions for long lectures
async function processLectureInBackground(lectureId, audioPath, title, userId, duration) {
  try {
    console.log(`🚀 Starting background processing for lecture ${lectureId}`);
    
    // Update status to processing
    await db.updateLecture(lectureId, userId, { 
      processing_status: 'processing',
      processing_started_at: new Date().toISOString()
    });
    
    let transcription;
    let filteredContent;
    
    if (duration > 600) { // Long lecture (more than 10 minutes)
      console.log('📚 Long lecture detected, using chunked processing...');
      
      // Create chunks directory
      const chunksDir = process.env.NODE_ENV === 'production' ? '/tmp/chunks' : path.join(__dirname, 'chunks');
      await fs.ensureDir(chunksDir);
      
      // Split audio into 10-minute chunks
      const chunkDuration = 600; // 10 minutes in seconds
      const totalChunks = Math.ceil(duration / chunkDuration);
      
      console.log(`📦 Splitting into ${totalChunks} chunks for faster processing...`);
      
      const chunkPromises = [];
      for (let i = 0; i < totalChunks; i++) {
        const startTime = i * chunkDuration;
        const chunkPath = path.join(chunksDir, `chunk_${i}.webm`);
        
        const chunkPromise = new Promise((resolve, reject) => {
          ffmpeg(audioPath)
            .seekInput(startTime)
            .duration(chunkDuration)
            .output(chunkPath)
            .on('end', () => resolve({ path: chunkPath, index: i }))
            .on('error', (err) => {
              console.log(`⚠️ Chunk ${i} creation failed:`, err.message);
              resolve({ path: null, index: i });
            })
            .run();
        });
        
        chunkPromises.push(chunkPromise);
      }
      
      const chunks = await Promise.all(chunkPromises);
      console.log(`✅ Created ${chunks.length} chunks`);
      
      // Process each chunk in parallel for maximum speed
      const chunkResults = [];
      const chunkPromises = [];
      
      for (const chunk of chunks) {
        if (!chunk.path) {
          console.log(`⚠️ Skipping chunk ${chunk.index + 1} (creation failed)`);
          chunkResults.push({ index: chunk.index, transcription: '' });
          continue;
        }
        
        console.log(`🔄 Processing chunk ${chunk.index + 1}/${chunks.length}...`);
        
        const chunkPromise = openai.audio.transcriptions.create({
          file: fs.createReadStream(chunk.path),
          model: 'whisper-1',
        }).then(transcriptionResult => {
          console.log(`✅ Chunk ${chunk.index + 1} transcribed successfully`);
          return {
            index: chunk.index,
            transcription: transcriptionResult.text
          };
        }).catch(error => {
          console.error(`❌ Error processing chunk ${chunk.index + 1}:`, error);
          return {
            index: chunk.index,
            transcription: ''
          };
        });
        
        chunkPromises.push(chunkPromise);
      }
      
      // Wait for all chunks to complete
      const chunkResults = await Promise.all(chunkPromises);
      
      // Combine all transcriptions in order
      const sortedResults = chunkResults.sort((a, b) => a.index - b.index);
      const fullTranscription = sortedResults.map(r => r.transcription).join(' ');
      
      console.log('✅ Full transcription completed');
      
      // Enhanced classroom content filtering
      console.log("🎓 Applying enhanced classroom content filtering...");
      filteredContent = await filterClassroomContent(fullTranscription);
      console.log("✅ Enhanced classroom content filtering completed");
      
      transcription = fullTranscription;
      
      // Clean up chunks
      try {
        await fs.remove(chunksDir);
        console.log('🧹 Cleaned up chunk files');
      } catch (error) {
        console.log("⚠️ Failed to clean up chunks:", error.message);
      }
      
    } else { // Short lecture
      console.log('📝 Short lecture, using standard processing...');
      
      // Transcribe audio
      const transcriptionResult = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: 'whisper-1',
      });
      
      transcription = transcriptionResult.text;
      console.log('✅ Transcription completed');
      
      // Enhanced classroom content filtering
      console.log("🎓 Applying enhanced classroom content filtering...");
      filteredContent = await filterClassroomContent(transcription);
      console.log("✅ Enhanced classroom content filtering completed");
    }

    // Optimize content for faster AI processing (truncate if too long)
    const maxWords = 2000;
    const words = filteredContent.split(' ');
    if (words.length > maxWords) {
      console.log(`📝 Truncating content from ${words.length} to ${maxWords} words for faster processing`);
      filteredContent = words.slice(0, maxWords).join(' ');
    }

    // Generate all AI content in parallel for maximum speed
    console.log("🚀 Generating all AI content in parallel...");
    const [summary, notes, qna] = await Promise.all([
      generateClassroomSummary(filteredContent).then(result => {
        console.log('✅ Enhanced classroom summary generation completed');
        return result;
      }),
      generateClassroomNotes(filteredContent).then(result => {
        console.log('✅ Enhanced classroom notes generation completed');
        return result;
      }),
      generateClassroomQnA(filteredContent).then(result => {
        console.log('✅ Enhanced classroom Q&A generation completed');
        return result;
      })
    ]);
    console.log('🎉 All AI content generation completed in parallel!');

    // Update lecture with completed content
    const updateData = {
      transcription: transcription,
      filtered_content: filteredContent,
      summary: summary,
      notes: notes,
      qna: qna,
      processing_status: 'completed',
      processing_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await db.updateLecture(lectureId, userId, updateData);
    console.log('✅ Lecture processing completed and saved to database');

    // Clean up audio file
    try {
      await fs.remove(audioPath);
      console.log('🧹 Cleaned up audio file');
    } catch (error) {
      console.log("⚠️ Failed to clean up audio file:", error.message);
    }

    console.log(`🎉 Background processing completed for lecture ${lectureId}`);
    
  } catch (error) {
    console.error(`❌ Error in background processing for lecture ${lectureId}:`, error);
    
    // Update status to failed
    try {
      await db.updateLecture(lectureId, userId, { 
        processing_status: 'failed',
        processing_error: error.message,
        processing_completed_at: new Date().toISOString()
      });
    } catch (updateError) {
      console.error('❌ Failed to update error status:', updateError);
    }
  }
}


// Enhanced upload with background processing for long lectures
app.post('/api/upload', requireAuth, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const audioPath = req.file.path;
    const title = req.body.title || 'Untitled Lecture';
    const lectureId = uuidv4();

    console.log(`📁 Processing audio file: ${audioPath}`);

    // Get audio duration first to determine processing strategy
    const duration = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) {
          console.log("⚠️ FFprobe failed, using default duration");
          resolve(300); // Default to 5 minutes
        } else {
          resolve(Math.floor(metadata.format.duration));
        }
      });
    });

    console.log(`⏱️ Audio duration: ${Math.floor(duration / 60)} minutes`);

    // Create initial lecture record with processing status
    const newLecture = {
      id: lectureId,
      user_id: req.user.id,
      title: title,
      processing_status: 'uploaded',
      duration_minutes: Math.floor(duration / 60),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await db.createLecture(newLecture);
    console.log('📝 Initial lecture record created');

    // Determine processing strategy based on duration
    if (duration > 1800) { // More than 30 minutes - use background processing
      console.log('🚀 Long lecture detected - starting background processing');
      
      // Start background processing (non-blocking)
      processLectureInBackground(lectureId, audioPath, title, req.user.id, duration)
        .catch(error => {
          console.error('❌ Background processing failed:', error);
        });
      
      // Return immediately to user
      res.json({
        id: lectureId,
        title: title,
        status: 'processing',
        message: `Your ${Math.floor(duration / 60)}-minute lecture is being processed in the background. You can close this app and return later to view your notes.`,
        estimated_time: `${Math.floor(duration / 60) * 2} minutes`,
        features: {
          backgroundProcessing: true,
          chunkedProcessing: true,
          userCanCloseApp: true
        }
      });
      
    } else { // Short lecture - process immediately
      console.log('⚡ Short lecture - processing immediately');
      
      // Enhanced audio preprocessing for classroom environments (with fallback)
      let processedAudioPath = audioPath;
      if (ffmpegAvailable && duration > 180) { // Only preprocess if longer than 3 minutes
        console.log("🔧 Preprocessing audio for classroom noise reduction...");
        processedAudioPath = await preprocessAudioForClassroom(audioPath);
      } else {
        console.log("⚡ Skipping audio preprocessing for short recording");
      }

      // Process immediately for short lectures
      const result = await processLectureInBackground(lectureId, processedAudioPath, title, req.user.id, duration);
      
      res.json({
        id: lectureId,
        title: title,
        status: 'completed',
        message: 'Audio processed successfully',
        features: {
          immediateProcessing: true,
          audioPreprocessing: ffmpegAvailable && duration > 180,
          classroomNoiseFiltering: true
        }
      });
    }

  } catch (error) {
    console.error('❌ Error in upload endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to process audio. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Serve static files from React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Enhanced AI Notetaker Platform with Classroom Noise Handling`);
  console.log(`✅ Firebase Firestore initialized for development`);
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Register: http://localhost:${PORT}/api/auth/register`);
  console.log(`Login: http://localhost:${PORT}/api/auth/login`);
  console.log(`🎓 Enhanced Features:`);
  console.log(`   - Classroom noise reduction`);
  console.log(`   - Audio preprocessing: ${ffmpegAvailable ? 'Available' : 'Not Available'}`);
  console.log(`   - Enhanced content filtering`);
  console.log(`   - Educational content focus`);
  console.log(`   - Render compatible: ${process.env.NODE_ENV === 'production' ? 'Yes' : 'No'}`);
});

module.exports = app;
