const multer = require('multer');
const OpenAI = require('openai');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: '/tmp',
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
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

// API handler
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    // Use multer middleware
    await new Promise((resolve, reject) => {
      upload.single('audio')(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

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
          content: "You are an expert note-taker. Create well-structured, detailed notes from lecture transcriptions. Use bullet points, headers, and clear organization. Include key concepts, definitions, examples, and important details that students should remember."
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

    // Clean up uploaded file
    fs.remove(audioPath).catch(console.error);

    res.json({
      id: lectureId,
      title: title || 'Untitled Lecture',
      transcription: transcription.text,
      summary,
      notes
    });

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
} 