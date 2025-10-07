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
        startEnhancedRecording(false); // Start recording, not paused
      } else if (data.isRecording && data.isPaused) {
        setIsRecording(true);
        setIsPaused(true);
        setRecordingTime(data.recordingTime || 0);
        setTitle(data.title || '');
        setShowBackgroundAlert(true);
        startEnhancedRecording(true); // Start recording but then pause immediately
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
  const startEnhancedRecording = async (shouldStartPaused = false) => {
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

      if (shouldStartPaused) {
        // If we should start paused, pause immediately after starting
        setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.pause();
          }
        }, 100);
      }

      setIsRecording(true);
      setIsPaused(shouldStartPaused);
      setShowBackgroundAlert(true);

      // Start timer only if not paused
      if (!shouldStartPaused) {
        intervalRef.current = setInterval(() => {
          setRecordingTime(prev => {
            const newTime = prev + 1;
            saveRecordingState();
            return newTime;
          });
        }, 1000);
      }

      saveRecordingState();

    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Error accessing microphone. Please check permissions.');
    }
  };

  // Pause recording
  const pauseRecording = () => {
    console.log('Pause clicked - MediaRecorder state:', mediaRecorderRef.current?.state);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      saveRecordingState();
      console.log('Recording paused successfully');
    } else {
      console.log('Cannot pause - MediaRecorder not in recording state');
    }
  };

  // Resume recording
  const resumeRecording = () => {
    console.log('Resume clicked - MediaRecorder state:', mediaRecorderRef.current?.state);
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
      console.log('Recording resumed successfully');
    } else {
      console.log('Cannot resume - MediaRecorder not in paused state');
    }
  };

  // Stop recording
  const stopRecording = () => {
    console.log('Stop clicked - MediaRecorder state:', mediaRecorderRef.current?.state);
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      localStorage.removeItem('backgroundRecording');
      console.log('Recording stopped successfully');
    } else {
      console.log('Cannot stop - MediaRecorder not available');
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
          {/* Beta Version Notice */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-blue-800">
                  <strong>Beta Version:</strong> This is a beta version of our final product. You won't be charged for anything.
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  If you have any issues, please email us at: <a href="mailto:shahakkshatt@gmail.com" className="underline hover:text-blue-800">shahakkshatt@gmail.com</a>
                </p>
              </div>
            </div>
          </div>

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

          {/* ChatGPT-style Recording UI */}
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
              <div className="space-y-8">
                {/* Circular Recording Indicator */}
                <div className="flex justify-center">
                  <div className="relative">
                    {/* Outer pulsing circle */}
                    <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isPaused
                        ? 'bg-gray-200 border-4 border-gray-400'
                        : 'bg-gradient-to-br from-blue-400 to-blue-600 border-4 border-blue-300 animate-pulse'
                    }`}>
                      {/* Inner circle with icon */}
                      <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
                        isPaused ? 'bg-gray-300' : 'bg-white'
                      }`}>
                        {isPaused ? (
                          <Play className="w-8 h-8 text-gray-600" />
                        ) : (
                          <div className="w-6 h-6 bg-red-500 rounded-full animate-pulse"></div>
                        )}
                      </div>
                    </div>

                    {/* Recording waves animation */}
                    {!isPaused && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-40 h-40 border-2 border-blue-400 rounded-full animate-ping opacity-20"></div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Timer */}
                <div className="text-3xl font-mono text-gray-800 mb-6">
                  {formatTime(recordingTime)}
                </div>

                {/* Control Buttons - ChatGPT Style */}
                <div className="flex justify-center space-x-6">
                  {/* Pause/Resume Button */}
                  <button
                    onClick={isPaused ? resumeRecording : pauseRecording}
                    className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 ${
                      isPaused
                        ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg hover:shadow-xl'
                        : 'bg-yellow-500 hover:bg-yellow-600 text-white shadow-lg hover:shadow-xl'
                    }`}
                  >
                    {isPaused ? (
                      <Play className="w-6 h-6" />
                    ) : (
                      <Pause className="w-6 h-6" />
                    )}
                  </button>

                  {/* Stop Button */}
                  <button
                    onClick={stopRecording}
                    className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    <Square className="w-6 h-6" />
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
              <li>• The blue circle shows recording is active</li>
              <li>• Use the <strong>Pause/Resume</strong> button (yellow/green) to control recording</li>
              <li>• Use the <strong>Stop</strong> button (red) to finish recording</li>
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