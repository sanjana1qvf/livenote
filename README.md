# AI Notetaker Platform

An AI-powered notetaker platform that allows students to record live lectures and automatically generate transcriptions, summaries, and structured notes using OpenAI's advanced AI models.

## Features

- 🎤 **Live Audio Recording**: Record lectures directly in the browser using Web Audio API
- 🤖 **AI Transcription**: Automatic speech-to-text using OpenAI Whisper
- 📝 **Smart Summaries**: AI-generated lecture summaries highlighting key points
- 📋 **Structured Notes**: Organized, detailed notes with bullet points and headers
- 💾 **Persistent Storage**: SQLite database to store all lectures and notes
- 📱 **Responsive Design**: Modern, mobile-friendly interface built with Tailwind CSS
- 📥 **Export Options**: Download notes as text files or copy to clipboard
- 🔍 **Easy Management**: Dashboard to view, search, and manage all lectures

## Technology Stack

### Backend
- **Node.js** with Express.js
- **OpenAI API** (Whisper for transcription, GPT for summarization)
- **SQLite** database
- **Multer** for file uploads

### Frontend
- **React 18** with functional components and hooks
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Axios** for API calls
- **Lucide React** for icons

## Installation

1. **Install dependencies**
   ```bash
   npm run install-all
   ```

2. **Set up environment variables**
   ```bash
   # Copy the example environment file
   cp server/.env.example server/.env
   
   # Edit the .env file and add your OpenAI API key
   # OPENAI_API_KEY=your_openai_api_key_here
   ```

3. **Start the development servers**
   ```bash
   npm run dev
   ```

This will start both the backend server (port 5000) and frontend development server (port 3000).

## 🚀 Deploy Online

### Quick Deploy to Heroku
[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

### Other Deployment Options
- **Vercel**: `vercel --prod`
- **Railway**: One-click deploy from GitHub
- **Render**: Connect repository and deploy

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

### Required Environment Variable
- `OPENAI_API_KEY`: Your OpenAI API key (already configured in the code)

## Usage

### Recording a Lecture

1. Navigate to the "Record Lecture" page
2. Enter an optional title for your lecture
3. Click the microphone button to start recording
4. Speak or play your lecture audio
5. Click the stop button when finished
6. Review the recording and click "Process with AI"
7. Wait for AI processing (transcription, summary, and note generation)
8. View your generated notes in the lecture details page

### Managing Lectures

- **Dashboard**: View all your recorded lectures
- **Lecture View**: See transcription, summary, and structured notes
- **Export**: Copy text to clipboard or download as files
- **Delete**: Remove lectures you no longer need

## Scripts

- `npm run dev`: Start both frontend and backend in development mode
- `npm run server`: Start only the backend server
- `npm run client`: Start only the frontend development server
- `npm run install-all`: Install dependencies for both frontend and backend
- `npm run build`: Build the frontend for production
- `npm start`: Start the production server 