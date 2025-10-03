import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextSimple';
import { Mic, Square, Trash2, Upload, Pause, Play } from 'lucide-react';
import axios from 'axios';
import API_BASE_URL from "../config";

const AudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [title, setTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [showBackgroundAlert, setShowBackgroundAlert] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioRef = useRef(null);
  const intervalRef = useRef(null);
  const navigate = useNavigate();
  const { getAuthHeaders } = useAuth();

  // Enhanced background recording with pause/resume support
  useEffect(() => {
    const savedRecording = localStorage.getItem('backgroundRecording');
    if (savedRecording) {
      const data = JSON.parse(savedRecording);
      if (data.isRecording && !data.isPaused) {
        setIsRecording(true);
        setRecordingTime(data.recordingTime || 0);
        setTitle(data.title || '');
        setShowBackgroundAlert(true);
        startEnhancedRecording();
      } else if (data.isRecording && data.isPaused) {
        setIsRecording(true);
        setIsPaused(true);
        setRecordingTime(data.recordingTime || 0);
        setTitle(data.title || '');
        setShowBackgroundAlert(true);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Save recording state to localStorage
  const saveRecordingState = () => {
    const state = {
      isRecording,
      isPaused,
      recordingTime,
      title,
      timestamp: Date.now()
    };
    localStorage.setItem('backgroundRecording', JSON.stringify(state));
  };

  // Enhanced recording with pause/resume support
  const startEnhancedRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      const chunks = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start(1000); // Record in 1-second chunks
      setIsRecording(true);
      setIsPaused(false);
      setShowBackgroundAlert(true);
      
      // Start timer
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          saveRecordingState();
          return newTime;
        });
      }, 1000);
      
      saveRecordingState();
      
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Error accessing microphone. Please check permissions.');
    }
  };

  // Pause recording
  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      saveRecordingState();
    }
  };

  // Resume recording
  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      
      // Resume timer
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          saveRecordingState();
          return newTime;
        });
      }, 1000);
      
      saveRecordingState();
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      localStorage.removeItem('backgroundRecording');
    }
  };

  // Start recording
  const startRecording = () => {
    setRecordingTime(0);
    startEnhancedRecording();
  };

  // Delete recording
  const deleteRecording = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsRecording(false);
    setIsPaused(false);
    localStorage.removeItem('backgroundRecording');
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  };

  // Format time display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Upload and process recording
  const handleUpload = async () => {
    if (!audioBlob) return;
    
    setIsProcessing(true);
    setProcessingStep('Uploading audio...');
    
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('title', title || 'Untitled Lecture');
      
      await axios.post(`${API_BASE_URL}/api/upload`, formData, {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProcessingStep(`Uploading... ${percentCompleted}%`);
        },
      });
      
      setProcessingStep('Processing complete!');
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
      
    } catch (error) {
      console.error('Upload error:', error);
      setProcessingStep('Upload failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-8">
            AI Lecture Recorder
          </h1>
          
          {/* Background Recording Alert */}
          {showBackgroundAlert && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Mic className="h-5 w-5 text-blue-500" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-blue-800">
                    {isPaused ? 'Recording Paused - You can minimize browser' : 'Background Recording Active - You can minimize browser'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Recording Controls */}
          <div className="text-center mb-8">
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-4 px-8 rounded-full text-lg transition-colors duration-200 flex items-center justify-center mx-auto"
              >
                <Mic className="mr-2" size={24} />
                Start Recording
              </button>
            ) : (
              <div className="space-y-4">
                {/* Recording Status */}
                <div className="text-2xl font-bold text-red-600 mb-4">
                  {isPaused ? 'PAUSED' : 'RECORDING'}
                </div>
                
                {/* Timer */}
                <div className="text-4xl font-mono text-gray-800 mb-6">
                  {formatTime(recordingTime)}
                </div>
                
                {/* Control Buttons */}
                <div className="flex justify-center space-x-4">
                  {!isPaused ? (
                    <button
                      onClick={pauseRecording}
                      className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-6 rounded-full transition-colors duration-200 flex items-center"
                    >
                      <Pause className="mr-2" size={20} />
                      Pause
                    </button>
                  ) : (
                    <button
                      onClick={resumeRecording}
                      className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-full transition-colors duration-200 flex items-center"
                    >
                      <Play className="mr-2" size={20} />
                      Resume
                    </button>
                  )}
                  
                  <button
                    onClick={stopRecording}
                    className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-full transition-colors duration-200 flex items-center"
                  >
                    <Square className="mr-2" size={20} />
                    Stop
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Title Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lecture Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter lecture title..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Audio Player */}
          {audioUrl && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Recording Preview</h3>
              <audio
                ref={audioRef}
                src={audioUrl}
                controls
                className="w-full"
              />
            </div>
          )}

          {/* Processing Status */}
          {isProcessing && (
            <div className="mb-6 p-4 bg-blue-100 border border-blue-400 rounded-lg">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
                <span className="text-blue-800">{processingStep}</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-center space-x-4">
            {audioBlob && (
              <button
                onClick={handleUpload}
                disabled={isProcessing}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center"
              >
                <Upload className="mr-2" size={20} />
                {isProcessing ? 'Processing...' : 'Process Notes'}
              </button>
            )}
            
            {audioBlob && (
              <button
                onClick={deleteRecording}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center"
              >
                <Trash2 className="mr-2" size={20} />
                Delete
              </button>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-2">How to Use:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Click <strong>Start Recording</strong> to begin</li>
              <li>• Use <strong>Pause</strong> to temporarily stop recording</li>
              <li>• Use <strong>Resume</strong> to continue recording</li>
              <li>• Click <strong>Stop</strong> when finished</li>
              <li>• You can minimize the browser while recording</li>
              <li>• Perfect for long lectures (1-2 hours)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioRecorder;