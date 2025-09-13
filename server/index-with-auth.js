const express = require('express');
const cors = require('cors');
const multer = require('multer');
const OpenAI = require('openai');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const session = require('express-session');
const { passport, requireAuth } = require('./auth');
const { db } = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://your-app.onrender.com'  // Update with your Render URL
    : 'http://localhost:3000',
  credentials: true
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
    // Successful authentication
    res.redirect(process.env.NODE_ENV === 'production' 
      ? 'https://your-app.onrender.com' 
      : 'http://localhost:3000'
    );
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
    user: req.user ? req.user.name : null
  });
});

// Get user's lectures only
app.get('/api/lectures', requireAuth, (req, res) => {
  db.all('SELECT * FROM lectures WHERE user_id = ? ORDER BY created_at DESC', [req.user.id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get specific lecture (user must own it)
app.get('/api/lectures/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM lectures WHERE id = ? AND user_id = ?', [id, req.user.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Lecture not found' });
      return;
    }
    res.json(row);
  });
});

// Upload and process audio (user must be authenticated)
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

    // Step 2: Generate summary using GPT
    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert at creating concise, informative summaries of lecture transcriptions. Create a summary that captures the main topics, key concepts, and important details."
        },
        {
          role: "user",
          content: `Please create a comprehensive summary of this lecture transcription:\n\n${transcription.text}`
        }
      ],
      max_tokens: 1000,
      temperature: 0.3
    });

    // Step 3: Generate structured notes using GPT
    const notesResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert note-taker. Create clear, readable notes from lecture transcriptions using simple text formatting. Use dashes (-) for lists, plain text for section titles (no symbols), simple line breaks for organization, and standard punctuation. No markdown formatting whatsoever - no asterisks, hashtags, underscores, or any special symbols for formatting. Write in a clean, student-friendly format with key concepts, definitions, examples, and important details."
        },
        {
          role: "user",
          content: `Please create detailed, well-structured notes from this lecture transcription:\n\n${transcription.text}`
        }
      ],
      max_tokens: 1500,
      temperature: 0.3
    });

    const summary = summaryResponse.choices[0].message.content;
    const notes = notesResponse.choices[0].message.content;

    // Step 4: Save to database with user ID
    db.run(
      'INSERT INTO lectures (id, user_id, title, transcription, summary, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [lectureId, req.user.id, title || 'Untitled Lecture', transcription.text, summary, notes],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        // Clean up uploaded file
        fs.remove(audioPath).catch(console.error);

        res.json({
          id: lectureId,
          title: title || 'Untitled Lecture',
          transcription: transcription.text,
          summary,
          notes
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
app.put('/api/lectures/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { title } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }

  db.run(
    'UPDATE lectures SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
    [title.trim(), id, req.user.id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Lecture not found or unauthorized' });
        return;
      }
      res.json({ message: 'Lecture updated successfully', title: title.trim() });
    }
  );
});

// Delete lecture (user must own it)
app.delete('/api/lectures/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM lectures WHERE id = ? AND user_id = ?', [id, req.user.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Lecture not found or unauthorized' });
      return;
    }
    res.json({ message: 'Lecture deleted successfully' });
  });
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
