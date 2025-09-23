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

// CORS configuration
app.use(cors({
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
  origin: true, // Allow all origins for mobile access
  credentials: true
}));

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
    const chunkPaths = [];
    let currentChunk = 0;
    
    ffmpeg(inputPath)
      .on('end', () => {
        resolve(chunkPaths);
      })
      .on('error', (err) => {
        reject(err);
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          console.log(`Processing: ${Math.round(progress.percent)}% done`);
        }
      })
      .on('codecData', (data) => {
        console.log(`Input audio: ${data.audio} audio, ${data.video} video`);
      })
      .on('start', (commandLine) => {
        console.log('Spawned FFmpeg with command: ' + commandLine);
      })
      .on('stderr', (stderrLine) => {
        console.log('FFmpeg stderr: ' + stderrLine);
      })
      .on('error', (err) => {
        console.error('FFmpeg error: ' + err.message);
        reject(err);
      })
      .on('end', () => {
        console.log('Audio splitting completed');
        resolve(chunkPaths);
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

// Get specific lecture (user must own it)
app.get('/api/lectures/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const lecture = await db.getLectureById(id, req.user.id);
    
    if (!lecture) {
      return res.status(404).json({ error: 'Lecture not found' });
    }
    
    res.json(lecture);
  } catch (error) {
    console.error('Error fetching lecture:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update lecture endpoint
app.put('/api/lectures/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const success = await db.updateLecture(id, req.user.id, { title: title.trim() });
    
    if (!success) {
      return res.status(404).json({ error: 'Lecture not found' });
    }
    
    res.json({ message: 'Lecture updated successfully', title: title.trim() });
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

    // Get audio duration
    const duration = await getAudioDuration(audioPath);
    console.log(`Audio duration: ${Math.floor(duration / 60)} minutes`);

    let transcription;
    let filteredContent;

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
