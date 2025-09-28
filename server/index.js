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
    const uploadDir = 'uploads';
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
    fileSize: 200 * 1024 * 1024, // 200MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed!'), false);
    }
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Auth routes
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
    
    // Check if user owns this lecture
    if (lecture.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(lecture);
  } catch (error) {
    console.error('Error fetching lecture:', error);
    res.status(500).json({ error: 'Failed to fetch lecture' });
  }
});

// Update lecture title
app.put('/api/lectures/:id', requireAuth, async (req, res) => {
  try {
    const { title } = req.body;
    const lecture = await db.getLectureById(req.params.id, req.user.id);
    
    if (!lecture) {
      return res.status(404).json({ error: 'Lecture not found' });
    }
    
    // Check if user owns this lecture
    if (lecture.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const updatedLecture = await db.updateLecture(req.params.id, { title });
    res.json(updatedLecture);
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
    
    await db.deleteLecture(req.params.id);
    res.json({ message: 'Lecture deleted successfully' });
  } catch (error) {
    console.error('Error deleting lecture:', error);
    res.status(500).json({ error: 'Failed to delete lecture' });
  }
});

// Upload and process audio
app.post('/api/upload', requireAuth, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const audioPath = req.file.path;
    const title = req.body.title || 'Untitled Lecture';
    const lectureId = uuidv4();

    console.log(`Processing audio file: ${audioPath}`);

    // Get audio duration using ffmpeg
    const duration = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) reject(err);
        else resolve(Math.floor(metadata.format.duration));
      });
    });

    console.log(`Audio duration: ${Math.floor(duration / 60)} minutes`);

    let transcription;
    let filteredContent;

    if (duration > 600) { // Long lecture (more than 10 minutes)
      console.log('Long lecture detected, using chunking...');
      
      // Create chunks directory
      const chunksDir = path.join(__dirname, 'chunks');
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
          ffmpeg(audioPath)
            .seekInput(startTime)
            .duration(chunkDuration)
            .output(chunkPath)
            .on('end', () => resolve({ path: chunkPath, index: i }))
            .on('error', reject)
            .run();
        });
        
        chunkPromises.push(chunkPromise);
      }
      
      const chunks = await Promise.all(chunkPromises);
      console.log(`Created ${chunks.length} chunks`);
      
      // Process each chunk
      const chunkResults = [];
      for (const chunk of chunks) {
        console.log(`Processing chunk ${chunk.index + 1}/${chunks.length}...`);
        
        try {
          const audioBuffer = await fs.readFile(chunk.path);
          const transcriptionResult = await openai.audio.transcriptions.create({
            file: new File([audioBuffer], `chunk_${chunk.index}.webm`, { type: 'audio/webm' }),
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
      
      // Filter content for the full transcription
      const filterResponse = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a content filter. Remove any irrelevant content, filler words, repetitions, and non-lecture content. Keep only the essential educational content. IMPORTANT: Always respond in English, regardless of the input language. Translate any non-English content to English while preserving the meaning. Return only the filtered content in English, no explanations.'
          },
          {
            role: 'user',
            content: fullTranscription
          }
        ],
        max_tokens: 4000,
        temperature: 0.3
      });
      
      transcription = fullTranscription;
      filteredContent = filterResponse.choices[0].message.content;
      
      console.log('Content filtering completed');
      
      // Clean up chunks
      await fs.remove(chunksDir);
      
    } else { // Short lecture
      console.log('Short lecture, using standard processing...');
      
      // Transcribe audio
      const audioBuffer = await fs.readFile(audioPath);
      const transcriptionResult = await openai.audio.transcriptions.create({
        file: new File([audioBuffer], req.file.filename, { type: 'audio/webm' }),
        model: 'whisper-1',
      });
      
      transcription = transcriptionResult.text;
      console.log('Transcription completed');
      
      // Filter content
      const filterResponse = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a content filter. Remove any irrelevant content, filler words, repetitions, and non-lecture content. Keep only the essential educational content. IMPORTANT: Always respond in English, regardless of the input language. Translate any non-English content to English while preserving the meaning. Return only the filtered content in English, no explanations.'
          },
          {
            role: 'user',
            content: transcription
          }
        ],
        max_tokens: 4000,
        temperature: 0.3
      });
      
      filteredContent = filterResponse.choices[0].message.content;
      console.log('Content filtering completed');
    }

    // Generate summary
    const summaryResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at creating concise, informative summaries. Create a comprehensive summary of the lecture content. IMPORTANT: Always respond in English, regardless of the input language. Translate any non-English content to English while preserving the meaning.'
        },
        {
          role: 'user',
          content: filteredContent
        }
      ],
      max_tokens: 1000,
      temperature: 0.3
    });
    
    const summary = summaryResponse.choices[0].message.content;
    console.log('Summary generation completed');

    // Generate notes
    const notesResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert note-taker. Create well-structured, comprehensive notes from the lecture content. Organize them with clear headings and bullet points. IMPORTANT: Always respond in English, regardless of the input language. Translate any non-English content to English while preserving the meaning.'
        },
        {
          role: 'user',
          content: filteredContent
        }
      ],
      max_tokens: 2000,
      temperature: 0.3
    });
    
    const notes = notesResponse.choices[0].message.content;
    console.log('Notes generation completed');

    // Generate Q&A
    const qnaResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert educator. Create 5-10 relevant questions and answers based on the lecture content. Format as Q: [question] A: [answer]. IMPORTANT: Always respond in English, regardless of the input language. Translate any non-English content to English while preserving the meaning.'
        },
        {
          role: 'user',
          content: filteredContent
        }
      ],
      max_tokens: 1500,
      temperature: 0.3
    });
    
    const qna = qnaResponse.choices[0].message.content;
    console.log('Q&A generation completed');

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

    // Clean up uploaded file
    fs.remove(audioPath).catch(console.error);

    res.json(newLecture);

  } catch (error) {
    console.error('Error processing audio:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      fs.remove(req.file.path).catch(console.error);
    }
    
    let errorMessage = 'Failed to process audio. Please try again.';
    
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

// Serve static files from React build
app.use(express.static(path.join(__dirname, "../client/build")));

// Serve React app for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Register: http://localhost:${PORT}/api/auth/register`);
  console.log(`Login: http://localhost:${PORT}/api/auth/login`);
});

module.exports = app;
