import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Mic, Square, Upload, Play, Pause, Trash2, Clock, HardDrive } from 'lucide-react';

const AudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [title, setTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  
  // Auto-chunking states
  const [chunks, setChunks] = useState([]);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [autoChunkEnabled, setAutoChunkEnabled] = useState(true);
  const [estimatedSize, setEstimatedSize] = useState(0);
  const [processedChunks, setProcessedChunks] = useState([]);

  const mediaRecorderRef = useRef(null);
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const chunksRef = useRef([]);
  const chunkTimerRef = useRef(null);

  const navigate = useNavigate();

  // Auto-chunking settings
  const CHUNK_DURATION = 15 * 60; // 15 minutes per chunk (in seconds)
  const ESTIMATED_SIZE_PER_SECOND = 1024; // ~1KB per second (rough estimate)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (chunkTimerRef.current) {
        clearInterval(chunkTimerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Update estimated file size
  useEffect(() => {
    setEstimatedSize(recordingTime * ESTIMATED_SIZE_PER_SECOND);
  }, [recordingTime]);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getEstimatedTimeRemaining = () => {
    const currentChunkTime = recordingTime % CHUNK_DURATION;
    const timeUntilNextChunk = CHUNK_DURATION - currentChunkTime;
    return timeUntilNextChunk;
  };

  const createChunk = async () => {
    if (mediaRecorderRef.current && isRecording) {
      // Stop current recording to create chunk
      mediaRecorderRef.current.stop();
      
      // Wait a moment for the chunk to be processed
      setTimeout(async () => {
        if (isRecording) {
          // Start new chunk
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
            setChunks(prev => [...prev, {
              blob,
              chunkNumber: currentChunk + 1,
              startTime: currentChunk * CHUNK_DURATION,
              endTime: recordingTime
            }]);
            setCurrentChunk(prev => prev + 1);
            
            // If this is the final chunk, set audioBlob for playback
            if (!isRecording) {
              setAudioBlob(blob);
              setAudioUrl(URL.createObjectURL(blob));
            }
            
            stream.getTracks().forEach(track => track.stop());
          };

          mediaRecorderRef.current.start();
        }
      }, 100);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      setChunks([]);
      setCurrentChunk(0);
      setProcessedChunks([]);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/wav' });
        
        if (autoChunkEnabled && isRecording) {
          // This is an auto-chunk, add to chunks array
          setChunks(prev => [...prev, {
            blob,
            chunkNumber: currentChunk + 1,
            startTime: currentChunk * CHUNK_DURATION,
            endTime: recordingTime
          }]);
          setCurrentChunk(prev => prev + 1);
        } else {
          // This is the final recording
          if (chunks.length > 0) {
            // Add final chunk
            setChunks(prev => [...prev, {
              blob,
              chunkNumber: currentChunk + 1,
              startTime: currentChunk * CHUNK_DURATION,
              endTime: recordingTime
            }]);
          } else {
            // Single recording
            setAudioBlob(blob);
            setAudioUrl(URL.createObjectURL(blob));
          }
        }
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      // Auto-chunking timer
      if (autoChunkEnabled) {
        chunkTimerRef.current = setInterval(() => {
          if (recordingTime > 0 && recordingTime % CHUNK_DURATION === 0) {
            createChunk();
          }
        }, 1000);
      }

    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Unable to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      setIsRecording(false);
      mediaRecorderRef.current.stop();
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (chunkTimerRef.current) {
        clearInterval(chunkTimerRef.current);
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
    setChunks([]);
    setProcessedChunks([]);
    setCurrentChunk(0);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setRecordingTime(0);
  };

  const processChunks = async () => {
    if (chunks.length === 0 && !audioBlob) return;

    setIsProcessing(true);
    setProcessingStep('Preparing audio chunks...');

    try {
      const chunksToProcess = chunks.length > 0 ? chunks : [{ blob: audioBlob, chunkNumber: 1 }];
      const processedResults = [];

      for (let i = 0; i < chunksToProcess.length; i++) {
        const chunk = chunksToProcess[i];
        setProcessingStep(`Processing chunk ${i + 1} of ${chunksToProcess.length}...`);
        
        const formData = new FormData();
        formData.append('audio', chunk.blob, `chunk-${chunk.chunkNumber}.wav`);
        formData.append('title', `${title || 'Untitled Lecture'} - Part ${chunk.chunkNumber}`);

        const response = await axios.post('/api/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        processedResults.push({
          ...response.data,
          chunkNumber: chunk.chunkNumber,
          startTime: chunk.startTime || 0,
          endTime: chunk.endTime || recordingTime
        });

        setProcessedChunks(prev => [...prev, response.data]);
      }

      if (processedResults.length > 1) {
        // Merge multiple chunks
        setProcessingStep('Merging transcriptions and generating final notes...');
        
        const mergedTranscription = processedResults
          .map(result => result.transcription)
          .join('\n\n');

        const mergedSummaryResponse = await axios.post('/api/merge-lecture', {
          title: title || 'Untitled Lecture',
          chunks: processedResults,
          mergedTranscription
        });

        navigate(`/lecture/${mergedSummaryResponse.data.id}`);
      } else {
        // Single chunk or single recording
        navigate(`/lecture/${processedResults[0].id}`);
      }

    } catch (error) {
      console.error('Error processing audio:', error);
      setIsProcessing(false);
      alert(error.response?.data?.error || 'Failed to process audio. Please try again.');
    }
  };

  const uploadAndProcess = () => {
    processChunks();
  };

  if (isProcessing) {
    return (
      <div className="max-w-2xl mx-auto px-2 sm:px-0">
        <div className="bg-white rounded-lg shadow-sm border p-6 sm:p-8 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto mb-6"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Processing Your Lecture</h2>
          <p className="text-gray-600 mb-4">{processingStep}</p>
          
          {processedChunks.length > 0 && (
            <div className="mb-4">
              <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(processedChunks.length / (chunks.length || 1)) * 100}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Processed {processedChunks.length} of {chunks.length || 1} chunks
              </p>
            </div>
          )}
          
          <p className="text-sm text-gray-500 mt-4">
            This may take a few minutes depending on the length of your recording.
          </p>
        </div>
      </div>
    );
  }

  const hasRecording = audioBlob || chunks.length > 0;
  const totalChunks = chunks.length + (audioBlob && chunks.length === 0 ? 1 : 0);

  return (
    <div className="max-w-2xl mx-auto px-2 sm:px-0">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Record Lecture</h1>
        <p className="text-sm sm:text-base text-gray-600">
          Record lectures up to 60+ minutes. Auto-chunking ensures seamless processing.
        </p>
      </div>

      {/* Recording Stats */}
      {isRecording && (
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="text-blue-800">Duration: {formatTime(recordingTime)}</span>
            </div>
            <div className="flex items-center space-x-2">
              <HardDrive className="h-4 w-4 text-blue-600" />
              <span className="text-blue-800">Size: ~{formatFileSize(estimatedSize)}</span>
            </div>
          </div>
          {autoChunkEnabled && recordingTime > 0 && (
            <div className="mt-2 text-xs text-blue-700">
              Next auto-chunk in: {formatTime(getEstimatedTimeRemaining())}
              {chunks.length > 0 && <span className="ml-2">• Chunks created: {chunks.length}</span>}
            </div>
          )}
        </div>
      )}

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

        {/* Auto-chunking toggle */}
        <div className="mb-6">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={autoChunkEnabled}
              onChange={(e) => setAutoChunkEnabled(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              disabled={isRecording}
            />
            <span className="text-sm text-gray-700">
              Enable auto-chunking for lectures longer than 15 minutes
            </span>
          </label>
        </div>

        <div className="text-center">
          {!hasRecording ? (
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
              {audioBlob && (
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
              )}
              
              <div className="text-lg font-mono text-gray-900 mb-4">
                Total Recording: {formatTime(recordingTime)}
                {totalChunks > 1 && <span className="text-sm text-gray-600 block">({totalChunks} chunks)</span>}
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

      <div className="bg-green-50 rounded-lg p-4">
        <h3 className="font-medium text-green-900 mb-2">Perfect for Long Lectures:</h3>
        <ul className="text-sm text-green-800 space-y-1">
          <li>• Record lectures up to 60+ minutes continuously</li>
          <li>• Auto-chunking processes in background (no interruption)</li>
          <li>• AI merges all chunks into one cohesive set of notes</li>
          <li>• Simply press record, put phone away, and stop when done</li>
        </ul>
      </div>
    </div>
  );
};

export default AudioRecorder;
