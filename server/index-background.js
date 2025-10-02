// Load environment variables first
require('dotenv').config({ path: './.env' });

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const OpenAI = require('openai');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const db = require('./firebase'); // Use Firebase/SQLite interface
const ffmpeg = require('fluent-ffmpeg');
const { requireAuth, register, login, getProfile } = require('./auth-simple');

const app = express();

// Background processing for long lectures - allows user to minimize browser
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
    
    if (duration > 1800) { // More than 30 minutes
      console.log('📚 Long lecture detected, using chunked processing...');
      
      // Create chunks directory
      const chunksDir = process.env.NODE_ENV === 'production' ? '/tmp/chunks' : path.join(__dirname, 'chunks');
      await fs.ensureDir(chunksDir);
      
      // Split into 10-minute chunks
      const chunkDuration = 600; // 10 minutes
      const totalChunks = Math.ceil(duration / chunkDuration);
      
      console.log(`📦 Splitting into ${totalChunks} chunks...`);
      
      // Create chunks
      const chunkPaths = [];
      for (let i = 0; i < totalChunks; i++) {
        const startTime = i * chunkDuration;
        const chunkPath = path.join(chunksDir, `chunk_${i}.webm`);
        
        await new Promise((resolve, reject) => {
          ffmpeg(audioPath)
            .seekInput(startTime)
            .duration(chunkDuration)
            .output(chunkPath)
            .on('end', () => resolve())
            .on('error', (err) => {
              console.log(`⚠️ Chunk ${i} creation failed:`, err.message);
              resolve(); // Continue with other chunks
            })
            .run();
        });
        
        chunkPaths.push({ path: chunkPath, index: i });
      }
      
      // Process chunks in parallel
      const chunkTranscriptions = [];
      for (const chunk of chunkPaths) {
        if (chunk.path) {
          try {
            const result = await openai.audio.transcriptions.create({
              file: fs.createReadStream(chunk.path),
              model: 'whisper-1',
            });
            chunkTranscriptions.push({ index: chunk.index, text: result.text });
          } catch (error) {
            console.error(`Error processing chunk ${chunk.index}:`, error);
            chunkTranscriptions.push({ index: chunk.index, text: '' });
          }
        }
      }
      
      // Combine transcriptions
      const sortedTranscriptions = chunkTranscriptions.sort((a, b) => a.index - b.index);
      transcription = sortedTranscriptions.map(t => t.text).join(' ');
      
      // Clean up chunks
      try {
        await fs.remove(chunksDir);
      } catch (error) {
        console.log("⚠️ Failed to clean up chunks:", error.message);
      }
      
    } else {
      // Short lecture - process normally
      console.log('📝 Short lecture, using standard processing...');
      
      const transcriptionResult = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: 'whisper-1',
      });
      
      transcription = transcriptionResult.text;
    }

    // Apply content filtering
    console.log("🎓 Applying content filtering...");
    filteredContent = await filterClassroomContent(transcription);
    
    // Optimize content for faster processing
    const maxWords = 2000;
    const words = filteredContent.split(' ');
    if (words.length > maxWords) {
      console.log(`📝 Truncating content from ${words.length} to ${maxWords} words`);
      filteredContent = words.slice(0, maxWords).join(' ');
    }

    // Generate AI content in parallel
    console.log("🚀 Generating AI content...");
    const [summary, notes, qna] = await Promise.all([
      generateClassroomSummary(filteredContent),
      generateClassroomNotes(filteredContent),
      generateClassroomQnA(filteredContent)
    ]);

    // Update lecture with results
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
    console.log('✅ Background processing completed');

    // Clean up audio file
    try {
      await fs.remove(audioPath);
    } catch (error) {
      console.log("⚠️ Failed to clean up audio:", error.message);
    }

  } catch (error) {
    console.error(`❌ Background processing failed:`, error);
    
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
      status: lecture.processing_status || 'completed',
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


const PORT = process.env.PORT || 5000;

console.log('Environment check:');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Merge lecture endpoint for combining multiple audio chunks
// Middleware
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true,
  optionsSuccessStatus: 200
}));
app.use(express.json());

// Serve uploads directory (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.use('/uploads', express.static('uploads'));
}

// Serve static files from React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
}

// Ensure uploads directory exists (only in development)
if (process.env.NODE_ENV !== 'production') {
  fs.ensureDirSync('uploads');
}

// Configure multer for file uploads with increased limits for long lectures
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.NODE_ENV === 'production' ? '/tmp' : 'uploads/';
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Merge lecture endpoint for combining multiple audio chunks
const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 200 * 1024 * 1024 // 200MB limit for long lectures
  }
});

// Merge lecture endpoint for combining multiple audio chunks
// Helper function to get audio duration
function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve(metadata.format.duration);
      }
    });
  });
}

// Helper function to split audio into chunks
function splitAudioIntoChunks(inputPath, outputDir, chunkDurationMinutes = 10) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let currentChunk = 0;
    const chunkDurationSeconds = chunkDurationMinutes * 60;
    
    ffmpeg(inputPath)
      .on('end', () => {
        resolve(chunks);
      })
      .on('error', (err) => {
        reject(err);
      })
      .on('progress', (progress) => {
        console.log(`Processing chunk ${currentChunk + 1}: ${progress.percent}% done`);
      })
      .outputOptions([
        `-f segment`,
        `-segment_time ${chunkDurationSeconds}`,
        `-c copy`,
        `-reset_timestamps 1`
      ])
      .output(`${outputDir}/chunk_%03d.wav`)
      .on('start', (commandLine) => {
        console.log('Spawned Ffmpeg with command: ' + commandLine);
      })
      .on('end', () => {
        // Get list of generated chunks
        fs.readdir(outputDir)
          .then(files => {
            const chunkFiles = files
              .filter(file => file.startsWith('chunk_') && file.endsWith('.wav'))
              .sort();
            resolve(chunkFiles.map(file => path.join(outputDir, file)));
          })
          .catch(reject);
      })
      .run();
  });
}

// Helper function to process audio chunks
async function processAudioChunks(chunkPaths, lectureId) {
  const allTranscriptions = [];
  const allFilteredContent = [];
  
  console.log(`Processing ${chunkPaths.length} audio chunks...`);
  
  for (let i = 0; i < chunkPaths.length; i++) {
    const chunkPath = chunkPaths[i];
    console.log(`Processing chunk ${i + 1}/${chunkPaths.length}: ${chunkPath}`);
    
    try {
      // Transcribe chunk
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(chunkPath),
        model: "whisper-1",
        language: "en"
      });
      
      allTranscriptions.push(transcription.text);
      
      // Filter content for this chunk
      const filterResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are an expert academic content filter. Extract ONLY educational and academic content from lecture transcriptions. Remove jokes, casual conversations, off-topic discussions, personal anecdotes, administrative announcements, technical difficulties, and informal banter. Preserve educational flow and maintain context, focusing on academic concepts, explanations, examples, definitions, theories, and educational discussions."
          },
          {
            role: "user",
            content: `Please filter this lecture transcription segment to contain ONLY academic and educational content:\n\n${transcription.text}`
          }
        ],
        max_tokens: 2000,
        temperature: 0.2
      });
      
      allFilteredContent.push(filterResponse.choices[0].message.content);
      
      // Clean up chunk file
      fs.remove(chunkPath).catch(console.error);
      
    } catch (error) {
      console.error(`Error processing chunk ${i + 1}:`, error);
      // Continue with other chunks even if one fails
    }
  }
  
  return {
    fullTranscription: allTranscriptions.join('\n\n'),
    fullFilteredContent: allFilteredContent.join('\n\n')
  };
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Merge lecture endpoint for combining multiple audio chunks
// Authentication routes
app.post('/api/auth/register', register);
app.post('/api/auth/login', login);
app.get('/api/auth/profile', requireAuth, getProfile);

// Get all lectures for authenticated user
app.get('/api/lectures', requireAuth, async (req, res) => {
  try {
    const lectures = await db.getLecturesByUserId(req.user.id);
    res.json(lectures);
  } catch (error) {
    console.error('Error fetching lectures:', error);
    res.status(500).json({ error: error.message });
  }
});

// Merge lecture endpoint for combining multiple audio chunks
// Get specific lecture (user must own it)
app.get('/api/lectures/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const lecture = await db.getLectureById(id, req.user.id);
    if (!lecture) {
      res.status(404).json({ error: 'Lecture not found' });
      return;
    }
    res.json(lecture);
  } catch (error) {
    console.error('Error fetching lecture:', error);
    res.status(500).json({ error: error.message });
  }
});

// Merge lecture endpoint for combining multiple audio chunks
// Enhanced upload and process audio for long lectures
app.post('/api/upload', requireAuth, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const audioPath = req.file.path;
    const title = req.body.title || 'Untitled Lecture';
    const lectureId = uuidv4();

    console.log(`📁 Processing audio file: ${audioPath}`);

    // Get audio duration first
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

    // Create initial lecture record
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

    // Determine processing strategy
    if (duration > 1800) { // More than 30 minutes - background processing
      console.log('🚀 Long lecture detected - starting background processing');
      
      // Start background processing (non-blocking)
      processLectureInBackground(lectureId, audioPath, title, req.user.id, duration)
        .catch(error => {
          console.error('❌ Background processing failed:', error);
        });
      
      // Return immediately with warning
      res.json({
        id: lectureId,
        title: title,
        status: 'processing',
        message: `Your ${Math.floor(duration / 60)}-minute lecture is being processed in the background. You can minimize this tab, use Instagram, YouTube, or any other app, and come back later to find your notes ready!`,
        estimated_time: `${Math.floor(duration / 60) * 2} minutes`,
        warning: "✅ You can minimize this tab and use other apps - your notes will be ready when you return!",
        features: {
          backgroundProcessing: true,
          userCanMinimize: true,
          userCanUseOtherApps: true,
          userCanCloseBrowser: false
        }
      });
      
    } else { // Short lecture - process immediately
      console.log('⚡ Short lecture - processing immediately');
      
      // Process immediately
      await processLectureInBackground(lectureId, audioPath, title, req.user.id, duration);
      
      res.json({
        id: lectureId,
        title: title,
        status: 'completed',
        message: 'Audio processed successfully',
        features: {
          immediateProcessing: true
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
}););

// Merge lecture endpoint for combining multiple audio chunks
// Update lecture endpoint
// Merge lecture endpoint for combining multiple audio chunks
app.post('/api/merge-lecture', requireAuth, async (req, res) => {
  try {
    const { title, chunks, mergedTranscription } = req.body;
    
    if (!title || !chunks || !Array.isArray(chunks) || chunks.length === 0) {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    const lectureId = uuidv4();
    console.log(`Merging ${chunks.length} chunks into lecture: ${lectureId}`);

    // Combine all transcriptions
    const fullTranscription = chunks
      .map(chunk => chunk.transcription)
      .join('\n\n');

    // Combine all filtered content
    const fullFilteredContent = chunks
      .map(chunk => chunk.filtered_content)
      .join('\n\n');

    // Generate summary using merged content
    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert at creating concise, informative summaries of academic lectures. Create a professional summary that captures the main educational topics, key academic concepts, theories, and important learning objectives. Focus on what students need to understand and remember for their studies."
        },
        {
          role: "user",
          content: `Please create a comprehensive academic summary of this merged lecture content:\n\n${fullFilteredContent}`
        }
      ],
      max_tokens: 1000,
      temperature: 0.3
    });

    // Generate structured academic notes using merged content
    const notesResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert academic note-taker specializing in creating study-ready notes for students. Create clear, well-organized academic notes using simple text formatting. Use dashes (-) for lists, plain text for section titles, simple line breaks for organization, and standard punctuation. No markdown formatting whatsoever. Focus on key academic concepts, definitions, theories, formulas, examples, and important details that students need for studying and exams. Structure the notes logically with main topics, subtopics, and supporting details."
        },
        {
          role: "user",
          content: `Please create detailed, well-structured academic notes from this merged lecture content:\n\n${fullFilteredContent}`
        }
      ],
      max_tokens: 1500,
      temperature: 0.3
    });

    // Generate Q&A using merged content
    const qaResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert educator who creates comprehensive study questions and answers from academic content. Generate important questions that test understanding of key concepts, definitions, theories, and practical applications. Format each Q&A as 'Q: [question]' followed by 'A: [detailed answer]' on the next line. Create questions that would help students prepare for exams, covering main topics, important details, and critical thinking aspects. Include different types of questions: factual, conceptual, analytical, and application-based. Make answers detailed and educational."
        },
        {
          role: "user",
          content: `Please create comprehensive study questions and answers from this merged lecture content. Generate 8-12 important questions that cover the main topics and key concepts:\n\n${fullFilteredContent}`
        }
      ],
      max_tokens: 2000,
      temperature: 0.3
    });

    const summary = summaryResponse.choices[0].message.content;
    const notes = notesResponse.choices[0].message.content;
    const qna = qaResponse.choices[0].message.content;

    console.log('Merged lecture processing completed');

    // Save merged lecture to database
    const mergedLecture = {
      id: lectureId,
      user_id: req.user.id,
      title: title,
      transcription: fullTranscription,
      filtered_content: fullFilteredContent,
      summary,
      notes,
      qna,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await db.createLecture(mergedLecture);
    console.log('Merged lecture saved to database successfully');

    res.json(mergedLecture);
  } catch (error) {
    console.error('Error merging lecture:', error);
    
    let errorMessage = 'Failed to merge lecture';
    if (error.message.includes('timeout')) {
      errorMessage = 'Lecture merging timed out. Please try again.';
    } else if (error.message.includes('API key')) {
      errorMessage = 'API configuration error. Please contact support.';
    }
    
    res.status(500).json({ error: errorMessage });
  }
});app.put('/api/lectures/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, summary, notes } = req.body;
    
    const updatedLecture = await db.updateLecture(id, req.user.id, {
      title,
      summary,
      notes,
      updated_at: new Date().toISOString()
    });
    
    if (!updatedLecture) {
      return res.status(404).json({ error: 'Lecture not found' });
    }
    
    res.json(updatedLecture);
  } catch (error) {
    console.error('Error updating lecture:', error);
    res.status(500).json({ error: error.message });
  }
});

// Merge lecture endpoint for combining multiple audio chunks
// Delete lecture endpoint
app.delete('/api/lectures/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const success = await db.deleteLecture(id, req.user.id);
    
    if (!success) {
      return res.status(404).json({ error: 'Lecture not found' });
    }
    
    res.json({ message: 'Lecture deleted successfully' });
  } catch (error) {
    console.error('Error deleting lecture:', error);
    res.status(500).json({ error: error.message });
  }
});

// Merge lecture endpoint for combining multiple audio chunks
// Serve React app for all other routes (SPA)
app.get('*', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  } else {
    res.redirect('http://localhost:3000');
  }
});

// Merge lecture endpoint for combining multiple audio chunks
// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Register: http://localhost:${PORT}/api/auth/register`);
  console.log(`Login: http://localhost:${PORT}/api/auth/login`);
});

// Merge lecture endpoint for combining multiple audio chunks
