import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import AudioRecorder from './components/AudioRecorder';
import LectureView from './components/LectureView';
import './index.css';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-4 sm:py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/record" element={<AudioRecorder />} />
            <Route path="/lecture/:id" element={<LectureView />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App; 