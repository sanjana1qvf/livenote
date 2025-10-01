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
    model: "gpt-4",
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
    model: "gpt-4",
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
    model: "gpt-4",
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
    max_tokens: 800,
    temperature: 0.3
  });
  
  return notesResponse.choices[0].message.content;
}

// Enhanced Q&A generation for classroom content
async function generateClassroomQnA(filteredContent) {
  const qnaResponse = await openai.chat.completions.create({
    model: "gpt-4",
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
    max_tokens: 600,
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

// Enhanced upload and process audio with classroom noise handling
app.post('/api/upload', requireAuth, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const audioPath = req.file.path;
    const title = req.body.title || 'Untitled Lecture';
    const lectureId = uuidv4();

    console.log(`Processing audio file: ${audioPath}`);

    // Enhanced audio preprocessing for classroom environments (with fallback)
    let processedAudioPath = audioPath;
    if (ffmpegAvailable) {
      console.log("🔧 Preprocessing audio for classroom noise reduction...");
      processedAudioPath = await preprocessAudioForClassroom(audioPath);
    } else {
      console.log("⚠️ Skipping audio preprocessing (FFmpeg not available)");
    }

    // Get audio duration using ffmpeg (use processed audio)
    const duration = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(processedAudioPath, (err, metadata) => {
        if (err) {
          console.log("⚠️ FFprobe failed, using default duration");
          resolve(300); // Default to 5 minutes
        } else {
          resolve(Math.floor(metadata.format.duration));
        }
      });
    });

    console.log(`Audio duration: ${Math.floor(duration / 60)} minutes`);

    let transcription;
    let filteredContent;

    if (duration > 600) { // Long lecture (more than 10 minutes)
      console.log('Long lecture detected, using chunking...');
      
      // Create chunks directory
      const chunksDir = process.env.NODE_ENV === 'production' ? '/tmp/chunks' : path.join(__dirname, 'chunks');
      await fs.ensureDir(chunksDir);
      
      // Split audio into 10-minute chunks
      const chunkDuration = 600; // 10 minutes in seconds
      const totalChunks = Math.ceil(duration / chunkDuration);
      
      console.log(`Splitting into ${totalChunks} chunks...`);
      
      const chunkPromises = [];
      for (let i = 0; i < totalChunks; i++) {
        const startTime = i * chunkDuration;
        const chunkPath = path.join(chunksDir, `chunk_${i}.webm`);
        
        const chunkPromise = new Promise((resolve, reject) => {
          ffmpeg(processedAudioPath)
            .seekInput(startTime)
            .duration(chunkDuration)
            .output(chunkPath)
            .on('end', () => resolve({ path: chunkPath, index: i }))
            .on('error', (err) => {
              console.log(`⚠️ Chunk ${i} creation failed:`, err.message);
              resolve({ path: null, index: i }); // Continue with other chunks
            })
            .run();
        });
        
        chunkPromises.push(chunkPromise);
      }
      
      const chunks = await Promise.all(chunkPromises);
      console.log(`Created ${chunks.length} chunks`);
      
      // Process each chunk
      const chunkResults = [];
      for (const chunk of chunks) {
        if (!chunk.path) {
          console.log(`⚠️ Skipping chunk ${chunk.index + 1} (creation failed)`);
          chunkResults.push({
            index: chunk.index,
            transcription: ''
          });
          continue;
        }
        
        console.log(`Processing chunk ${chunk.index + 1}/${chunks.length}...`);
        
        try {
          const transcriptionResult = await openai.audio.transcriptions.create({
            file: fs.createReadStream(chunk.path),
            model: 'whisper-1',
          });
          
          chunkResults.push({
            index: chunk.index,
            transcription: transcriptionResult.text
          });
          
          console.log(`Chunk ${chunk.index + 1} transcribed successfully`);
        } catch (error) {
          console.error(`Error processing chunk ${chunk.index + 1}:`, error);
          chunkResults.push({
            index: chunk.index,
            transcription: ''
          });
        }
      }
      
      // Combine all transcriptions
      const sortedResults = chunkResults.sort((a, b) => a.index - b.index);
      const fullTranscription = sortedResults.map(r => r.transcription).join(' ');
      
      console.log('Full transcription completed');
      
      // Enhanced classroom content filtering for the full transcription
      console.log("🎓 Applying enhanced classroom content filtering...");
      filteredContent = await filterClassroomContent(fullTranscription);
      console.log("Enhanced classroom content filtering completed");
      
      transcription = fullTranscription;
      
      // Clean up chunks
      try {
        await fs.remove(chunksDir);
      } catch (error) {
        console.log("⚠️ Failed to clean up chunks:", error.message);
      }
      
    } else { // Short lecture
      console.log('Short lecture, using standard processing...');
      
      // Transcribe processed audio
      const transcriptionResult = await openai.audio.transcriptions.create({
        file: fs.createReadStream(processedAudioPath),
        model: 'whisper-1',
      });
      
      transcription = transcriptionResult.text;
      console.log('Transcription completed');
      
      // Enhanced classroom content filtering
      console.log("🎓 Applying enhanced classroom content filtering...");
      filteredContent = await filterClassroomContent(transcription);
      console.log("Enhanced classroom content filtering completed");
    }

    // Generate enhanced classroom summary
    console.log("📝 Generating enhanced classroom summary...");
    const summary = await generateClassroomSummary(filteredContent);
    console.log('Enhanced classroom summary generation completed');

    // Generate enhanced classroom notes
    console.log("📚 Generating enhanced classroom notes...");
    const notes = await generateClassroomNotes(filteredContent);
    console.log('Enhanced classroom notes generation completed');

    // Generate enhanced classroom Q&A
    console.log("❓ Generating enhanced classroom Q&A...");
    const qna = await generateClassroomQnA(filteredContent);
    console.log('Enhanced classroom Q&A generation completed');

    // Save to database
    const newLecture = {
      id: lectureId,
      user_id: req.user.id,
      title: title,
      transcription: transcription,
      filtered_content: filteredContent,
      summary: summary,
      notes: notes,
      qna: qna,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await db.createLecture(newLecture);
    console.log('Lecture saved to database successfully');

    // Clean up processed audio file
    if (processedAudioPath !== audioPath) {
      try {
        await fs.remove(processedAudioPath);
      } catch (error) {
        console.log("⚠️ Failed to clean up processed audio:", error.message);
      }
    }

    res.json({
      id: lectureId,
      title: title,
      message: 'Audio processed successfully with enhanced classroom noise handling',
      features: {
        audioPreprocessing: ffmpegAvailable,
        classroomNoiseFiltering: true,
        enhancedContentExtraction: true,
        renderCompatible: true
      }
    });

  } catch (error) {
    console.error('Error processing audio:', error);
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
