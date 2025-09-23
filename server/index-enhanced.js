// Load environment variables first
require('dotenv').config({ path: './.env' });

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const OpenAI = require('openai');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const session = require('express-session');
const { passport, requireAuth } = require('./auth');
const db = require('./firebase'); // Use Firebase/SQLite interface
const ffmpeg = require('fluent-ffmpeg');

const app = express();
const PORT = process.env.PORT || 5000;

console.log('Environment check:');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET');
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: true,
  saveUninitialized: true,
  name: 'connect.sid',
  cookie: {
    secure: false, // Temporarily disable secure for testing
    httpOnly: false, // Allow JavaScript access for debugging
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax' // Use lax instead of none
  }
}));

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

// Middleware
// CORS configuration
if (process.env.NODE_ENV === 'production') {
  app.use(cors({
    origin: ['https://ai-notetaker-platform.onrender.com'],
    credentials: true,
    optionsSuccessStatus: 200
  }));
} else {
  // More permissive CORS for development
  app.use(cors({
    origin: true, // Allow all origins in development
    credentials: true,
    optionsSuccessStatus: 200
  }));
}
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

// Auth Routes
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    console.log('OAuth callback successful, user:', req.user);
    console.log('Session ID:', req.sessionID);
    console.log('Session:', req.session);
    
    // Force session save
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
      } else {
        console.log('Session saved successfully');
      }
      res.redirect('http://localhost:3000');
    });
  }
);

// Logout route
app.get('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
      }
      res.redirect('http://localhost:3000');
    });
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Get user profile
app.get('/api/profile', requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    picture: req.user.picture
  });
});

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

// Enhanced upload and process audio for long lectures
app.post('/api/upload', requireAuth, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    const { title } = req.body;
    const lectureId = uuidv4();
    const audioPath = req.file.path;

    console.log('Processing audio file:', audioPath);

    // Get audio duration
    const duration = await getAudioDuration(audioPath);
    console.log(`Audio duration: ${Math.round(duration / 60)} minutes`);

    let transcription, filteredContent;

    // Check if audio is longer than 10 minutes (600 seconds)
    if (duration > 600) {
      console.log('Long lecture detected, using chunking approach...');
      
      // Create temporary directory for chunks
      const chunksDir = path.join(path.dirname(audioPath), `chunks_${lectureId}`);
      await fs.ensureDir(chunksDir);
      
      try {
        // Split audio into 10-minute chunks
        const chunkPaths = await splitAudioIntoChunks(audioPath, chunksDir, 10);
        console.log(`Split into ${chunkPaths.length} chunks`);
        
        // Process all chunks
        const chunkResults = await processAudioChunks(chunkPaths, lectureId);
        transcription = chunkResults.fullTranscription;
        filteredContent = chunkResults.fullFilteredContent;
        
        // Clean up chunks directory
        fs.remove(chunksDir).catch(console.error);
        
      } catch (chunkError) {
        console.error('Error processing chunks:', chunkError);
        // Fallback to single file processing
        console.log('Falling back to single file processing...');
        
        const transcriptionResult = await openai.audio.transcriptions.create({
          file: fs.createReadStream(audioPath),
          model: "whisper-1",
          language: "en"
        });
        
        transcription = transcriptionResult.text;
        
        const filterResponse = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "You are an expert academic content filter. Extract ONLY educational and academic content from lecture transcriptions. Remove jokes, casual conversations, off-topic discussions, personal anecdotes, administrative announcements, technical difficulties, and informal banter. Preserve educational flow and maintain context, focusing on academic concepts, explanations, examples, definitions, theories, and educational discussions."
            },
            {
              role: "user",
              content: `Please filter this lecture transcription to contain ONLY academic and educational content:\n\n${transcription}`
            }
          ],
          max_tokens: 2000,
          temperature: 0.2
        });
        
        filteredContent = filterResponse.choices[0].message.content;
      }
    } else {
      console.log('Short lecture, using standard processing...');
      
      // Standard processing for shorter audio
      const transcriptionResult = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: "whisper-1",
        language: "en"
      });
      
      transcription = transcriptionResult.text;
      
      const filterResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are an expert academic content filter. Extract ONLY educational and academic content from lecture transcriptions. Remove jokes, casual conversations, off-topic discussions, personal anecdotes, administrative announcements, technical difficulties, and informal banter. Preserve educational flow and maintain context, focusing on academic concepts, explanations, examples, definitions, theories, and educational discussions."
          },
          {
            role: "user",
            content: `Please filter this lecture transcription to contain ONLY academic and educational content:\n\n${transcription}`
          }
        ],
        max_tokens: 2000,
        temperature: 0.2
      });
      
      filteredContent = filterResponse.choices[0].message.content;
    }

    console.log('Transcription completed');
    console.log('Content filtering completed');

    // Generate summary using filtered content
    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert at creating concise, informative summaries of academic lectures. Create a professional summary that captures the main educational topics, key academic concepts, theories, and important learning objectives. Focus on what students need to understand and remember for their studies."
        },
        {
          role: "user",
          content: `Please create a comprehensive academic summary of this filtered lecture content:\n\n${filteredContent}`
        }
      ],
      max_tokens: 1000,
      temperature: 0.3
    });

    // Generate structured academic notes using filtered content
    const notesResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert academic note-taker specializing in creating study-ready notes for students. Create clear, well-organized academic notes using simple text formatting. Use dashes (-) for lists, plain text for section titles, simple line breaks for organization, and standard punctuation. No markdown formatting whatsoever. Focus on key academic concepts, definitions, theories, formulas, examples, and important details that students need for studying and exams. Structure the notes logically with main topics, subtopics, and supporting details."
        },
        {
          role: "user",
          content: `Please create detailed, well-structured academic notes from this filtered lecture content:\n\n${filteredContent}`
        }
      ],
      max_tokens: 1500,
      temperature: 0.3
    });

    // Generate Q&A using filtered content
    const qaResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert educator who creates comprehensive study questions and answers from academic content. Generate important questions that test understanding of key concepts, definitions, theories, and practical applications. Format each Q&A as 'Q: [question]' followed by 'A: [detailed answer]' on the next line. Create questions that would help students prepare for exams, covering main topics, important details, and critical thinking aspects. Include different types of questions: factual, conceptual, analytical, and application-based. Make answers detailed and educational."
        },
        {
          role: "user",
          content: `Please create comprehensive study questions and answers from this lecture content. Generate 8-12 important questions that cover the main topics and key concepts:\n\n${filteredContent}`
        }
      ],
      max_tokens: 2000,
      temperature: 0.3
    });

    const summary = summaryResponse.choices[0].message.content;
    const notes = notesResponse.choices[0].message.content;
    const qna = qaResponse.choices[0].message.content;
    console.log('Q&A generation completed');

    // Save to database with user ID (including filtered content and Q&A)
    const newLecture = {
      id: lectureId,
      user_id: req.user.id,
      title: title || 'Untitled Lecture',
      transcription: transcription,
      filtered_content: filteredContent,
      summary,
      notes,
      qna,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await db.createLecture(newLecture);
    console.log('Lecture saved to database successfully');

    // Clean up uploaded file
    fs.remove(audioPath).catch(console.error);

    res.json(newLecture);
  } catch (error) {
    console.error('Error processing audio:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      fs.remove(req.file.path).catch(console.error);
    }
    
    // More specific error messages
    let errorMessage = 'Failed to process audio';
    if (error.message.includes('timeout')) {
      errorMessage = 'Audio processing timed out. Please try a shorter recording.';
    } else if (error.message.includes('API key')) {
      errorMessage = 'API configuration error. Please contact support.';
    } else if (error.message.includes('file size')) {
      errorMessage = 'File too large. Please compress your audio or use a shorter recording.';
    }
    
    res.status(500).json({ error: errorMessage });
  }
});

// Update lecture endpoint
app.put('/api/lectures/:id', requireAuth, async (req, res) => {
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

// Serve React app for all other routes (SPA)
app.get('*', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  } else {
    res.redirect('http://localhost:3000');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Google OAuth: http://localhost:${PORT}/auth/google`);
});
