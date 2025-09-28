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

// Enhanced CORS configuration for classroom environments
app.use(cors({
  origin: true,
  credentials: true
}));

// Enhanced headers for mobile and classroom access
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  next();
});

app.use(express.json());

// Enhanced audio preprocessing for classroom noise
async function preprocessAudioForClassroom(audioPath) {
  const processedPath = audioPath.replace('.webm', '_processed.webm');
  
  return new Promise((resolve, reject) => {
    ffmpeg(audioPath)
      // Noise reduction and audio enhancement
      .audioFilters([
        // Reduce background noise
        'highpass=f=200',  // Remove low-frequency noise
        'lowpass=f=8000',   // Remove high-frequency noise
        'dynaudnorm',       // Dynamic audio normalization
        'afftdn',           // Advanced noise reduction
        'volume=1.5'         // Boost volume for clarity
      ])
      .audioCodec('libopus')
      .audioBitrate('128k')
      .output(processedPath)
      .on('end', () => {
        console.log('✅ Audio preprocessed for classroom environment');
        resolve(processedPath);
      })
      .on('error', (err) => {
        console.log('⚠️ Audio preprocessing failed, using original:', err.message);
        resolve(audioPath); // Fallback to original
      })
      .run();
  });
}

// Enhanced content filtering for classroom environments
async function filterClassroomContent(transcription) {
  const filterResponse = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: `You are an expert content filter for educational environments. Your task is to:

1. EXTRACT ONLY the main teacher/instructor's content
2. REMOVE all student conversations, side discussions, and background chatter
3. REMOVE classroom noise, interruptions, and off-topic discussions
4. FOCUS on educational content, explanations, and key concepts
5. PRESERVE the logical flow of the lecture
6. REMOVE filler words, repetitions, and irrelevant content
7. IMPORTANT: Always respond in English, regardless of input language
8. TRANSLATE any non-English content to English while preserving meaning

Return only the filtered educational content, no explanations.`
      },
      {
        role: 'user',
        content: transcription
      }
    ],
    max_tokens: 4000,
    temperature: 0.2  // Lower temperature for more consistent filtering
  });
  
  return filterResponse.choices[0].message.content;
}

// Enhanced summary generation for classroom content
async function generateClassroomSummary(filteredContent) {
  const summaryResponse = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: `You are an expert at creating educational summaries. Create a comprehensive summary that:

1. FOCUSES on the main educational concepts taught
2. HIGHLIGHTS key learning objectives and takeaways
3. ORGANIZES content by topics and themes
4. PRESERVES the logical flow of the lecture
5. REMOVES any remaining noise or irrelevant content
6. IMPORTANT: Always respond in English, regardless of input language
7. TRANSLATE any non-English content to English while preserving meaning

Create a clear, educational summary suitable for student review.`
      },
      {
        role: 'user',
        content: filteredContent
      }
    ],
    max_tokens: 1000,
    temperature: 0.3
  });
  
  return summaryResponse.choices[0].message.content;
}

// Enhanced notes generation for classroom environments
async function generateClassroomNotes(filteredContent) {
  const notesResponse = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: `You are an expert note-taker for educational content. Create comprehensive, well-structured notes that:

1. ORGANIZE content by main topics and subtopics
2. HIGHLIGHT key concepts, definitions, and important points
3. INCLUDE examples, explanations, and clarifications
4. STRUCTURE with clear headings and bullet points
5. FOCUS on educational value and learning outcomes
6. REMOVE any remaining noise or irrelevant content
7. IMPORTANT: Always respond in English, regardless of input language
8. TRANSLATE any non-English content to English while preserving meaning

Create notes that students can use for effective studying and review.`
      },
      {
        role: 'user',
        content: filteredContent
      }
    ],
    max_tokens: 2000,
    temperature: 0.3
  });
  
  return notesResponse.choices[0].message.content;
}

// Enhanced Q&A generation for classroom content
async function generateClassroomQnA(filteredContent) {
  const qnaResponse = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: `You are an expert educator creating study questions. Generate 5-10 relevant questions and answers that:

1. TEST understanding of key concepts taught
2. COVER important topics and learning objectives
3. INCLUDE both factual and analytical questions
4. PROVIDE clear, educational answers
5. FOCUS on the main educational content
6. REMOVE any questions about irrelevant or noisy content
7. IMPORTANT: Always respond in English, regardless of input language
8. TRANSLATE any non-English content to English while preserving meaning

Format as Q: [question] A: [answer]`
      },
      {
        role: 'user',
        content: filteredContent
      }
    ],
    max_tokens: 1500,
    temperature: 0.3
  });
  
  return qnaResponse.choices[0].message.content;
}

// Rest of the server code would continue here...
// (This is a partial implementation showing the enhanced noise handling)

module.exports = app;
