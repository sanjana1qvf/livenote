import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextSimple';
import { Mic, Square, Trash2, Upload, Minimize2 } from 'lucide-react';
import axios from 'axios';
import API_BASE_URL from "../config";

const AudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [title, setTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [isBackgroundMode, setIsBackgroundMode] = useState(false);
  const [showBackgroundAlert, setShowBackgroundAlert] = useState(false);
  const [recordingChunks, setRecordingChunks] = useState([]);
  
  const mediaRecorderRef = useRef(null);
  const audioRef = useRef(null);
  const intervalRef = useRef(null);
  const navigate = useNavigate();
  const { getAuthHeaders } = useAuth();

  // Enhanced background recording with chunked audio
  useEffect(() => {
    const savedRecording = localStorage.getItem('backgroundRecording');
    if (savedRecording) {
      const data = JSON.parse(savedRecording);
      if (data.isRecording) {
        setIsRecording(true);
        setRecordingTime(data.recordingTime || 0);
        setTitle(data.title || '');
        setShowBackgroundAlert(true);
        startEnhancedRecording();
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const saveRecordingState = (recordingData) => {
    localStorage.setItem('backgroundRecording', JSON.stringify(recordingData));
  };

  const clearRecordingState = () => {
    localStorage.removeItem('backgroundRecording');
  };

  // Enhanced recording with chunked audio for better background support
  const startEnhancedRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000
      });
      
      mediaRecorderRef.current = mediaRecorder;
      const audioChunks = [];
      setRecordingChunks([]);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
          setRecordingChunks(prev => [...prev, event.data]);
          // Save chunks to localStorage for persistence
          const chunkData = {
            chunks: [...audioChunks],
            timestamp: Date.now()
          };
          localStorage.setItem('recordingChunks', JSON.stringify(chunkData));
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        setAudioUrl(URL.createObjectURL(audioBlob));
        stream.getTracks().forEach(track => track.stop());
        clearRecordingState();
        localStorage.removeItem('recordingChunks');
      };

      // Start recording with smaller time slices for better background support
      mediaRecorder.start(1000); // Record in 1-second chunks
      setIsRecording(true);
      setRecordingTime(0);
      
      saveRecordingState({
        isRecording: true,
        recordingTime: 0,
        title: title
      });
      
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          if (newTime % 10 === 0) { // Save every 10 seconds
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
    await startEnhancedRecording();
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
    setRecordingChunks([]);
    clearRecordingState();
    localStorage.removeItem('recordingChunks');
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

  // Enhanced visibility change handling
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (isRecording) {
        if (document.hidden) {
          setIsBackgroundMode(true);
          // Show browser notification for background recording
          if (Notification.permission === 'granted') {
            new Notification('Recording in Background', {
              body: 'Your lecture is being recorded. You can use other apps.',
              icon: '/logo.png'
            });
          }
        } else {
          setIsBackgroundMode(false);
        }
      }
    };

    // Request notification permission
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

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

        {/* Enhanced Background Recording Alert */}
        {showBackgroundAlert && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">
                  🎙️ Enhanced Background Recording Active
                </h3>
                <p className="text-sm text-green-700 mt-1">
                  Recording continues even when browser is minimized. You can use other apps!
                </p>
                <p className="text-xs text-green-600 mt-1">
                  💡 Tip: Keep the browser tab open for best results
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
                  <span>Recording continues in background!</span>
                </div>
              )}
              <div className="text-xs text-gray-500">
                Chunks saved: {recordingChunks.length}
              </div>
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
          <h3 className="font-semibold text-blue-900 mb-2">Enhanced Background Recording:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Click microphone to start recording</li>
            <li>• Recording continues when browser is minimized</li>
            <li>• Audio is saved in chunks for better reliability</li>
            <li>• You'll get notifications when recording in background</li>
            <li>• Perfect for long lectures (1-2 hours)</li>
            <li>• Click square to stop recording</li>
            <li>• AI will generate accurate notes from your recording</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AudioRecorder;
