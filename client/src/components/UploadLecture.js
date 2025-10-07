import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextSimple';
import { Upload, File, Trash2, CheckCircle, AlertCircle, Play } from 'lucide-react';
import axios from 'axios';
import API_BASE_URL from "../config";

const UploadLecture = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [title, setTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);
  const navigate = useNavigate();
  const { getAuthHeaders } = useAuth();

  // Supported audio formats
  const supportedFormats = ['.mp3', '.wav', '.m4a', '.ogg', '.webm', '.aac'];
  const maxFileSize = 100 * 1024 * 1024; // 100MB limit

  // Validate file
  const validateFile = (file) => {
    const errors = [];
    
    // Check file type
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    if (!supportedFormats.includes(fileExtension)) {
      errors.push(`Unsupported format. Supported: ${supportedFormats.join(', ')}`);
    }
    
    // Check file size
    if (file.size > maxFileSize) {
      errors.push(`File too large. Maximum size: ${maxFileSize / (1024 * 1024)}MB`);
    }
    
    return errors;
  };

  // Handle file selection
  const handleFileSelect = (file) => {
    const errors = validateFile(file);
    
    if (errors.length > 0) {
      alert('File validation failed:\n' + errors.join('\n'));
      return;
    }
    
    setSelectedFile(file);
    
    // Auto-generate title from filename
    if (!title) {
      const nameWithoutExtension = file.name.replace(/\.[^/.]+$/, "");
      setTitle(nameWithoutExtension);
    }
  };

  // Handle drag and drop
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Handle file input change
  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  // Remove selected file
  const removeFile = () => {
    setSelectedFile(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Upload and process file
  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setIsProcessing(true);
    setProcessingStep('Uploading audio file...');
    setUploadProgress(0);
    
    try {
      const formData = new FormData();
      formData.append('audio', selectedFile);
      formData.append('title', title || selectedFile.name);
      
      const response = await axios.post(`${API_BASE_URL}/api/upload`, formData, {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
          if (percentCompleted < 100) {
            setProcessingStep(`Uploading... ${percentCompleted}%`);
          } else {
            setProcessingStep('Processing audio with AI...');
          }
        },
      });

      // If server returns processing status, persist pending lectureId for background polling
      const { id, status } = response.data || {};
      if (id && status === 'processing') {
        const pending = JSON.parse(localStorage.getItem('pendingLectures') || '[]');
        if (!pending.includes(id)) {
          pending.push(id);
          localStorage.setItem('pendingLectures', JSON.stringify(pending));
        }
        setProcessingStep('Processing in background. You can leave this page.');
        setTimeout(() => navigate('/dashboard'), 800);
      } else {
        setProcessingStep('Processing complete!');
        setTimeout(() => navigate('/dashboard'), 800);
      }
      
    } catch (error) {
      console.error('Upload error:', error);
      setProcessingStep('Upload failed. Please try again.');
      setTimeout(() => {
        setIsProcessing(false);
        setProcessingStep('');
        setUploadProgress(0);
      }, 3000);
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
            Upload Audio Lecture
          </h1>
          
          {/* File Upload Area */}
          <div
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive 
                ? 'border-blue-500 bg-blue-50' 
                : selectedFile 
                ? 'border-green-500 bg-green-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={supportedFormats.join(',')}
              onChange={handleFileInputChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isProcessing}
            />
            
            {!selectedFile ? (
              <div>
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-700 mb-2">
                  Drop your audio file here or click to browse
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Supported formats: {supportedFormats.join(', ')}
                </p>
                <p className="text-xs text-gray-400">
                  Maximum file size: {maxFileSize / (1024 * 1024)}MB
                </p>
              </div>
            ) : (
              <div>
                <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
                <p className="text-lg font-medium text-green-700 mb-2">
                  File Selected
                </p>
              </div>
            )}
          </div>

          {/* Selected File Info */}
          {selectedFile && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <File className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="font-medium text-gray-800">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                </div>
                {!isProcessing && (
                  <button
                    onClick={removeFile}
                    className="text-red-500 hover:text-red-700 transition-colors"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Title Input */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lecture Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter lecture title..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isProcessing}
            />
          </div>

          {/* Processing Status */}
          {isProcessing && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
                <span className="text-blue-800">{processingStep}</span>
              </div>
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="mt-3 w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              )}
            </div>
          )}

          {/* Upload Button */}
          <div className="mt-8 flex justify-center">
            <button
              onClick={handleUpload}
              disabled={!selectedFile || isProcessing}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center"
            >
              <Upload className="mr-2" size={20} />
              {isProcessing ? 'Processing...' : 'Process Audio'}
            </button>
          </div>

          {/* Instructions */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-2">How to Use:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Drag and drop your audio file or click to browse</li>
              <li>• Supported formats: MP3, WAV, M4A, OGG, WebM, AAC</li>
              <li>• Maximum file size: 100MB</li>
              <li>• Enter a descriptive title for your lecture</li>
              <li>• Click "Process Audio" to generate AI notes</li>
              <li>• Perfect for pre-recorded lectures, podcasts, meetings</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadLecture;
