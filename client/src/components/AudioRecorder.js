import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextSimple';
import { Mic, Square, Trash2, Upload, Minimize2, Maximize2 } from 'lucide-react';
import axios from 'axios';
import API_BASE_URL from "../config";

const AudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [title, setTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [isBackgroundMode, setIsBackgroundMode] = useState(false);
  const [showBackgroundAlert, setShowBackgroundAlert] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioRef = useRef(null);
  const intervalRef = useRef(null);
  const backgroundIntervalRef = useRef(null);
  const navigate = useNavigate();
  const { getAuthHeaders } = useAuth();

  // Load saved recording state on component mount
  useEffect(() => {
    const savedRecording = localStorage.getItem('backgroundRecording');
    if (savedRecording) {
      const data = JSON.parse(savedRecording);
      if (data.isRecording) {
        setIsRecording(true);
        setRecordingTime(data.recordingTime || 0);
        setTitle(data.title || '');
        setShowBackgroundAlert(true);
        // Continue recording in background
        startBackgroundRecording();
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (backgroundIntervalRef.current) {
        clearInterval(backgroundIntervalRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Save recording state to localStorage for background recording
  const saveRecordingState = (recordingData) => {
    localStorage.setItem('backgroundRecording', JSON.stringify(recordingData));
  };

  // Clear saved recording state
  const clearRecordingState = () => {
    localStorage.removeItem('backgroundRecording');
  };

  // Start background recording (continues when tab is minimized)
  const startBackgroundRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      mediaRecorderRef.current = mediaRecorder;
      const audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        setAudioUrl(URL.createObjectURL(audioBlob));
        stream.getTracks().forEach(track => track.stop());
        clearRecordingState();
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Save initial state
      saveRecordingState({
        isRecording: true,
        recordingTime: 0,
        title: title
      });
      
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          // Update saved state every 5 seconds
          if (newTime % 5 === 0) {
            saveRecordingState({
              isRecording: true,
              recordingTime: newTime,
              title: title
            });
          }
          return newTime;
        });
      }, 1000);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Error accessing microphone. Please check your permissions.');
    }
  };

  const startRecording = async () => {
    await startBackgroundRecording();
    setShowBackgroundAlert(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsBackgroundMode(false);
      setShowBackgroundAlert(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (backgroundIntervalRef.current) {
        clearInterval(backgroundIntervalRef.current);
      }
      clearRecordingState();
    }
  };

  const deleteRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    clearRecordingState();
  };

  const processAudio = async () => {
    if (!audioBlob) return;

    setIsProcessing(true);
    setProcessingStep('Processing audio...');

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('title', title || 'Untitled Lecture');

      const response = await axios.post(`${API_BASE_URL}/api/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...getAuthHeaders()
        }
      });

      console.log('Audio processed successfully:', response.data);
      navigate(`/lecture/${response.data.id}`);

    } catch (error) {
      console.error('Error processing audio:', error);
      setIsProcessing(false);
      alert(error.response?.data?.error || 'Failed to process audio. Please try again.');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle page visibility change (when user minimizes/maximizes browser)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (isRecording) {
        if (document.hidden) {
          setIsBackgroundMode(true);
        } else {
          setIsBackgroundMode(false);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isRecording]);

  if (isProcessing) {
    return (
      <div className="max-w-2xl mx-auto px-2 sm:px-0">
        <div className="bg-white rounded-lg shadow-sm border p-6 sm:p-8 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto mb-6"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Processing Your Lecture</h2>
          <p className="text-gray-600 mb-4">{processingStep}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-2 sm:px-0">
      <div className="bg-white rounded-lg shadow-sm border p-6 sm:p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Record Your Lecture</h1>
          <p className="text-gray-600">Click the microphone to start recording your lecture</p>
        </div>

        {/* Background Recording Alert */}
        {showBackgroundAlert && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">
                  🎙️ Background Recording Active
                </h3>
                <p className="text-sm text-green-700 mt-1">
                  You can minimize this browser or use other apps while recording continues!
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6">
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
            Lecture Title (Optional)
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter lecture title..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div className="text-center mb-8">
          {!isRecording && !audioBlob && (
            <button
              onClick={startRecording}
              className="bg-red-500 hover:bg-red-600 text-white rounded-full p-4 transition-colors duration-200 shadow-lg"
            >
              <Mic className="w-8 h-8" />
            </button>
          )}

          {isRecording && (
            <div className="flex flex-col items-center space-y-4">
              <div className="flex items-center space-x-4">
                <button
                  onClick={stopRecording}
                  className="bg-gray-500 hover:bg-gray-600 text-white rounded-full p-4 transition-colors duration-200 shadow-lg"
                >
                  <Square className="w-8 h-8" />
                </button>
              </div>
              <div className="text-2xl font-mono text-gray-700">
                {formatTime(recordingTime)}
              </div>
              <div className="flex items-center space-x-2 text-red-500">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">
                  {isBackgroundMode ? 'Recording in Background...' : 'Recording...'}
                </span>
              </div>
              {isBackgroundMode && (
                <div className="flex items-center space-x-2 text-blue-600 text-sm">
                  <Minimize2 className="w-4 h-4" />
                  <span>You can minimize this tab and use other apps!</span>
                </div>
              )}
            </div>
          )}

          {audioBlob && !isRecording && (
            <div className="space-y-4">
              <div className="text-2xl font-mono text-gray-700">
                {formatTime(recordingTime)}
              </div>
              
              <audio
                ref={audioRef}
                src={audioUrl}
                onEnded={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                className="w-full"
                controls
              />
              
              <div className="flex justify-center space-x-4">
                <button
                  onClick={processAudio}
                  className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2"
                >
                  <Upload className="w-5 h-5" />
                  <span>Process & Generate Notes</span>
                </button>
                
                <button
                  onClick={deleteRecording}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2"
                >
                  <Trash2 className="w-5 h-5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">How it works:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Click the microphone to start recording</li>
            <li>• You can minimize the browser and use other apps while recording!</li>
            <li>• Speak clearly and at a normal pace</li>
            <li>• Click the square to stop recording</li>
            <li>• Review your recording and click "Process & Generate Notes"</li>
            <li>• AI will transcribe, summarize, and create study notes</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AudioRecorder;
