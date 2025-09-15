// Load environment variables first
require('dotenv').config({ path: '../.env' });

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

// Configure multer for file uploads
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
    fileSize: 25 * 1024 * 1024 // 25MB limit
  }
});

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
      
      // Successful authentication
      const redirectUrl = process.env.NODE_ENV === 'production' 
        ? 'https://ai-notetaker-platform.onrender.com' 
        : 'http://localhost:3000';
      
      console.log('Redirecting to:', redirectUrl);
      res.redirect(redirectUrl);
    });
  }
);

app.post('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

app.get('/auth/user', (req, res) => {
  console.log('Auth check - Session ID:', req.sessionID);
  console.log('Auth check - Cookies:', req.headers.cookie);
  console.log('Auth check - Session:', req.session);
  console.log('Auth check - isAuthenticated:', req.isAuthenticated());
  console.log('Auth check - user:', req.user);
  
  if (req.isAuthenticated()) {
    res.json({ user: req.user });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    authenticated: req.isAuthenticated(),
    user: req.user ? req.user.name : null,
    oauth_configured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  });
});

// Test cookie endpoint
app.get('/api/test-cookie', (req, res) => {
  console.log('Test cookie - Session ID:', req.sessionID);
  console.log('Test cookie - Cookies:', req.headers.cookie);
  
  req.session.testData = 'Hello from session!';
  res.cookie('testCookie', 'testValue', { 
    httpOnly: false, 
    secure: false, 
    sameSite: 'lax',
    maxAge: 60000 
  });
  
  res.json({ 
    message: 'Cookie set',
    sessionId: req.sessionID,
    cookies: req.headers.cookie
  });
});

// Get user's lectures only
app.get('/api/lectures', requireAuth, async (req, res) => {
  try {
    const lectures = await db.getLectures(req.user.id);
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
});// Upload and process audio (user must be authenticated)
app.post('/api/upload', requireAuth, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    const { title } = req.body;
    const lectureId = uuidv4();
    const audioPath = req.file.path;

    console.log('Processing audio file:', audioPath);

    // Step 1: Transcribe audio using OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: "whisper-1",
      language: "en"
    });

    console.log('Transcription completed');

    // Step 2: Filter and clean the transcription for academic content
    const filterResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert academic content filter. Your job is to extract ONLY the educational and academic content from lecture transcriptions. Remove all non-academic elements including: jokes, casual conversations, off-topic discussions, personal anecdotes unrelated to the subject, administrative announcements, technical difficulties, informal banter, and any content that doesn't contribute to learning the subject matter. Preserve the educational flow and maintain context, but focus strictly on academic concepts, explanations, examples, definitions, theories, and educational discussions. Keep the language formal and academic while preserving the core educational message."
        },
        {
          role: "user",
          content: `Please filter this lecture transcription to contain ONLY academic and educational content, removing all jokes, casual remarks, and non-educational material:\n\n${transcription.text}`
        }
      ],
      max_tokens: 2000,
      temperature: 0.2
    });

    const filteredContent = filterResponse.choices[0].message.content;
    console.log('Content filtering completed');

    // Step 3: Generate summary using filtered content
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

    // Step 4: Generate structured academic notes using filtered content
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

    const summary = summaryResponse.choices[0].message.content;
    const notes = notesResponse.choices[0].message.content;

    // Step 5: Generate Q&A using filtered content
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

    const qna = qaResponse.choices[0].message.content;
    console.log('Q&A generation completed');

    // Step 6: Save to database with user ID (including filtered content and Q&A)
    // Step 6: Save to database with user ID (including filtered content and Q&A)
    const newLecture = {
      id: lectureId,
      user_id: req.user.id,
      title: title || 'Untitled Lecture',
      transcription: transcription.text,
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

    res.json(newLecture);          notes,
          qna
        });
      }
    );
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
    } else if (error.message.includes('rate_limit')) {
      errorMessage = 'API rate limit exceeded. Please wait a moment and try again.';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update lecture (user must own it)
app.put('/api/lectures/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const success = await db.updateLectureTitle(id, req.user.id, title.trim());
    if (!success) {
      res.status(404).json({ error: 'Lecture not found or unauthorized' });
      return;
    }
    res.json({ message: 'Lecture updated successfully', title: title.trim() });
  } catch (error) {
    console.error('Error updating lecture:', error);
    res.status(500).json({ error: error.message });
  }
});});

// Delete lecture (user must own it)
app.delete('/api/lectures/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const success = await db.deleteLecture(id, req.user.id);
    if (!success) {
      res.status(404).json({ error: 'Lecture not found or unauthorized' });
      return;
    }
    res.json({ message: 'Lecture deleted successfully' });
  } catch (error) {
    console.error('Error deleting lecture:', error);
    res.status(500).json({ error: error.message });
  }
});  });
});

// Merge multiple audio chunks into a single lecture (user must be authenticated)
app.post('/api/merge-lecture', requireAuth, async (req, res) => {
  try {
    const { title, chunks, mergedTranscription } = req.body;
    
    if (!chunks || chunks.length === 0) {
      return res.status(400).json({ error: 'No chunks provided' });
    }

    console.log(`Merging ${chunks.length} chunks for lecture: ${title}`);

    // Create comprehensive summary from merged transcription
    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert at creating comprehensive summaries of lecture transcriptions. This transcription comes from multiple audio chunks of a single lecture. Create a cohesive summary that captures the main topics, key concepts, and important details from the entire lecture."
        },
        {
          role: "user",
          content: `Please create a comprehensive summary of this complete lecture transcription:\n\n${mergedTranscription}`
        }
      ],
      max_tokens: 1500,
      temperature: 0.3
    });

    // Create detailed notes from merged transcription
    const notesResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert note-taker. Create clear, readable notes from this complete lecture transcription using simple text formatting. Use dashes (-) for lists, plain text for section titles (no symbols), simple line breaks for organization, and standard punctuation. No markdown formatting whatsoever - no asterisks, hashtags, underscores, or any special symbols for formatting. Write in a clean, student-friendly format with key concepts, definitions, examples, and important details. This transcription comes from multiple audio segments of a single lecture session."
        },
        {
          role: "user",
          content: `Please create detailed, well-structured notes from this complete lecture transcription:\n\n${mergedTranscription}`
        }
      ],
      max_tokens: 2000,
      temperature: 0.3
    });

    const summary = summaryResponse.choices[0].message.content;
    const notes = notesResponse.choices[0].message.content;
    const lectureId = uuidv4();

    // Store the merged lecture in database with user ID
    db.run(
      'INSERT INTO lectures (id, user_id, title, transcription, summary, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [lectureId, req.user.id, title, mergedTranscription, summary, notes],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          res.status(500).json({ error: 'Failed to save merged lecture' });
          return;
        }

        console.log('Merged lecture saved successfully');
        res.json({
          id: lectureId,
          title,
          transcription: mergedTranscription,
          summary,
          notes,
          chunks: chunks.length
        });
      }
    );

  } catch (error) {
    console.error('Error merging lecture chunks:', error);
    
    let errorMessage = 'Failed to merge lecture chunks';
    if (error.message.includes('timeout')) {
      errorMessage = 'Lecture merging timed out. Please try again.';
    } else if (error.message.includes('API key')) {
      errorMessage = 'API configuration error. Please contact support.';
    } else if (error.message.includes('rate_limit')) {
      errorMessage = 'API rate limit exceeded. Please wait a moment and try again.';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 25MB.' });
    }
  }
  res.status(500).json({ error: error.message });
});

// Handle React routing, return all requests to React app
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Google OAuth: http://localhost:${PORT}/auth/google`);
});
