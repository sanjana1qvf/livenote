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
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    const { title } = req.body;
    const lectureId = uuidv4();
    const audioPath = req.file.path;

    console.log('Processing audio file:', audioPath);

    // Create placeholder record first so clients can poll
    await db.createLecture({
      id: lectureId,
      user_id: req.user.id,
      title: title || 'Untitled Lecture',
      processing_status: 'processing',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Start background processing (non-blocking)
    (async () => {
      try {
        // Get audio duration
        const duration = await getAudioDuration(audioPath).catch(() => 0);
        console.log(`Audio duration: ${Math.round((duration || 0) / 60)} minutes`);

        let transcription, filteredContent;

        // Process audio (chunk if long)
        if (duration && duration > 600) {
          console.log('Long lecture detected, using chunking approach...');
          const chunksDir = path.join(path.dirname(audioPath), `chunks_${lectureId}`);
          await fs.ensureDir(chunksDir);
          try {
            const chunkPaths = await splitAudioIntoChunks(audioPath, chunksDir, 10);
            const chunkResults = await processAudioChunks(chunkPaths, lectureId);
            transcription = chunkResults.fullTranscription;
            filteredContent = chunkResults.fullFilteredContent;
            fs.remove(chunksDir).catch(console.error);
          } catch (e) {
            console.warn('Chunking failed, falling back to single processing:', e.message);
          }
        }

        if (!transcription) {
          const transcriptionResult = await openai.audio.transcriptions.create({
            file: fs.createReadStream(audioPath),
            model: "whisper-1",
            language: "en"
          });
          transcription = transcriptionResult.text;
        }

        if (!filteredContent) {
          const filterResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
              { role: "system", content: "You are a content filter. Extract ONLY the educational content from the transcription. Remove jokes, casual conversations, off-topic discussions, personal anecdotes, administrative announcements, and technical difficulties. Do NOT add any external knowledge or information. Only include what was actually said that is educational in nature." },
              { role: "user", content: `Please filter this lecture transcription to contain ONLY the educational content that was actually spoken:\n\n${transcription}` }
            ],
            max_tokens: 2000,
            temperature: 0.1
          });
          filteredContent = filterResponse.choices[0].message.content;
        }

        const summaryResponse = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "You are a precise summarizer. Output clean, minimal Markdown (headings + bullet points). Most important rule: base the summary ONLY on the provided content. Do NOT add external knowledge, assumptions, or rephrase to include missing context." },
            { role: "user", content: `Summarize the following content in Markdown with clear bullets and short headings. Use only what is explicitly present. Do not add anything new.\n\n${filteredContent}` }
          ],
          max_tokens: 1000,
          temperature: 0.1
        });

        const notesResponse = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "You are a note organizer. Produce clean, minimal Markdown with headings and bullet points. Critically: base the notes ONLY on the provided content; do NOT add external knowledge, examples, or assumptions." },
            { role: "user", content: `Create notes in Markdown based ONLY on the following content. Use: \n\n# Title (if present)\n\n## Key Points\n- ...\n\n## Examples (only if explicitly present)\n- ...\n\nDo not invent anything beyond what is explicitly stated.\n\nCONTENT:\n\n${filteredContent}` }
          ],
          max_tokens: 2000,
          temperature: 0.1
        });

        const qaResponse = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "You are a question generator. Create questions and answers based ONLY on the content provided. Do NOT add any external knowledge or information not explicitly mentioned in the provided text. Generate questions that can be answered using only the information from the lecture. Format each Q&A as 'Q: [question]' followed by 'A: [answer based only on lecture content]' on the next line." },
            { role: "user", content: `Please create study questions and answers from this lecture content. Base all questions and answers ONLY on what was actually said in the lecture:\n\n${filteredContent}` }
          ],
          max_tokens: 2000,
          temperature: 0.1
        });

        const summary = summaryResponse.choices[0].message.content;
        const notes = notesResponse.choices[0].message.content;
        const qna = qaResponse.choices[0].message.content;

        await db.updateLecture(lectureId, req.user.id, {
          transcription,
          filtered_content: filteredContent,
          summary,
          notes,
          qna,
          processing_status: 'completed',
          processing_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        console.log('Lecture processed and updated successfully');
      } catch (e) {
        console.error('Background processing failed:', e);
        await db.updateLecture(lectureId, req.user.id, {
          processing_status: 'error',
          processing_error: e.message,
          updated_at: new Date().toISOString()
        }).catch(() => {});
      } finally {
        // Clean up uploaded file
        fs.remove(audioPath).catch(console.error);
      }
    })();

    // Respond immediately so client can background
    res.json({ id: lectureId, status: 'processing' });
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

// Processing status endpoint for polling
app.get('/api/lectures/:id/status', requireAuth, async (req, res) => {
  try {
    const lecture = await db.getLectureById(req.params.id, req.user.id);
    if (!lecture) return res.status(404).json({ error: 'Lecture not found' });
    res.json({ id: lecture.id, status: lecture.processing_status || 'completed', updated_at: lecture.updated_at });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

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
          content: "You are an expert academic note-taker specializing in creating comprehensive study-ready notes for students. Create detailed, well-organized academic notes that cover ALL important concepts, definitions, theories, formulas, examples, and applications. Use simple text formatting with dashes (-) for lists, plain text for section titles, and clear line breaks. No markdown formatting. Structure notes with:\n\n1. MAIN TOPICS (numbered sections)\n2. Key concepts with clear definitions\n3. Important theories and principles\n4. Practical examples and applications\n5. Formulas, equations, or key data points\n6. Important details students need for exams\n\nGuidelines:\n- Cover ALL important content from the lecture\n- Include specific examples to help understanding\n- Don't miss any key concepts or applications\n- Keep points concise but comprehensive\n- Ensure students won't miss critical information\n- Focus on exam-relevant material\n- Include both theoretical and practical aspects"
        },
        {
          role: "user",
          content: `Please create detailed, well-structured academic notes from this merged lecture content:\n\n${fullFilteredContent}`
        }
      ],
      max_tokens: 2000,
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
