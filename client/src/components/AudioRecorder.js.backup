import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Mic, Square, Upload, Play, Pause, Trash2 } from 'lucide-react';

const AudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [title, setTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');

  const mediaRecorderRef = useRef(null);
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const chunksRef = useRef([]);

  const navigate = useNavigate();

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/wav' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Unable to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const playAudio = () => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const deleteRecording = () => {
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setRecordingTime(0);
    setIsPlaying(false);
  };

  const uploadAndProcess = async () => {
    if (!audioBlob) return;

    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');
    formData.append('title', title || 'Untitled Lecture');

    setIsProcessing(true);
    setProcessingStep('Uploading audio...');

    try {
      setProcessingStep('Transcribing with AI...');
      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          if (progress < 100) {
            setProcessingStep(`Uploading audio... ${progress}%`);
          }
        },
      });

      setProcessingStep('Generating summary and notes...');
      
      // Navigate to the lecture view
      navigate(`/lecture/${response.data.id}`);
      
    } catch (error) {
      console.error('Error processing audio:', error);
      alert('Failed to process audio. Please try again.');
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isProcessing) {
    return (
      <div className="max-w-2xl mx-auto px-2 sm:px-0">
        <div className="bg-white rounded-lg shadow-sm border p-6 sm:p-8 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto mb-6"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Processing Your Lecture</h2>
          <p className="text-gray-600 mb-4">{processingStep}</p>
          <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
            <div className="bg-primary-600 h-2 rounded-full animate-pulse"></div>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            This may take a few minutes depending on the length of your recording.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-2 sm:px-0">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Record Lecture</h1>
        <p className="text-sm sm:text-base text-gray-600">
          Record your lecture audio and let AI generate notes and summaries for you.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="mb-6">
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
            Lecture Title
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter lecture title (optional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="text-center">
          {!audioBlob ? (
            <div className="py-12">
              <div className="mb-6">
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`mx-auto flex items-center justify-center w-24 h-24 rounded-full text-white transition-all ${
                    isRecording
                      ? 'bg-red-600 hover:bg-red-700 animate-pulse'
                      : 'bg-primary-600 hover:bg-primary-700'
                  }`}
                >
                  {isRecording ? (
                    <Square className="h-8 w-8" />
                  ) : (
                    <Mic className="h-8 w-8" />
                  )}
                </button>
              </div>
              
              <div className="text-2xl font-mono text-gray-900 mb-2">
                {formatTime(recordingTime)}
              </div>
              
              <p className="text-gray-600">
                {isRecording ? 'Recording in progress...' : 'Click to start recording'}
              </p>
            </div>
          ) : (
            <div className="py-8">
              <div className="mb-6">
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  onEnded={() => setIsPlaying(false)}
                  className="w-full mb-4"
                  controls
                />
                
                <div className="flex items-center justify-center space-x-4">
                  <button
                    onClick={isPlaying ? pauseAudio : playAudio}
                    className="flex items-center justify-center w-12 h-12 rounded-full bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                  >
                    {isPlaying ? (
                      <Pause className="h-5 w-5" />
                    ) : (
                      <Play className="h-5 w-5 ml-1" />
                    )}
                  </button>
                  
                  <button
                    onClick={deleteRecording}
                    className="flex items-center justify-center w-12 h-12 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              <div className="text-lg font-mono text-gray-900 mb-4">
                Recording: {formatTime(recordingTime)}
              </div>
              
                             <button
                 onClick={uploadAndProcess}
                 className="bg-green-600 text-white px-6 sm:px-8 py-2 sm:py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 mx-auto text-sm sm:text-base w-full sm:w-auto max-w-xs"
               >
                 <Upload className="h-4 w-4 sm:h-5 sm:w-5" />
                 <span>Process with AI</span>
               </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-50 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">How it works:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Click the microphone to start recording your lecture</li>
          <li>• AI will transcribe the audio using OpenAI Whisper</li>
          <li>• GPT will generate a summary and structured notes</li>
          <li>• Review and manage your notes in the dashboard</li>
        </ul>
      </div>
    </div>
  );
};

export default AudioRecorder; 