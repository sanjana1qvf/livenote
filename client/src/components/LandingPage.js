import React, { useState } from 'react';
import { Mic, Brain, FileText, Users, ArrowRight, CheckCircle, Star, Zap, Menu, X } from 'lucide-react';
import AuthModal from './AuthModal';

const LandingPage = ({ onAuthSuccess }) => {
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    {
      icon: <Mic className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />,
      title: "Smart Recording",
      description: "Record lectures with AI-powered noise reduction and classroom optimization"
    },
    {
      icon: <Brain className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" />,
      title: "AI Transcription",
      description: "Convert speech to text with 99% accuracy using advanced AI technology"
    },
    {
      icon: <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />,
      title: "Auto Notes",
      description: "Generate concise, structured notes automatically from your recordings"
    },
    {
      icon: <Users className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600" />,
      title: "Classroom Ready",
      description: "Optimized for noisy classroom environments with smart content filtering"
    }
  ];

  const benefits = [
    "Save 3+ hours per week on note-taking",
    "Never miss important concepts",
    "Focus on learning, not writing",
    "Access notes anywhere, anytime",
    "Perfect for exam preparation"
  ];

  const handleAuthSuccess = (user) => {
    onAuthSuccess(user);
    setShowAuth(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Navigation with White Background */}
      <nav className="px-4 sm:px-6 py-4 sticky top-0 bg-white/90 backdrop-blur-sm z-40">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg overflow-hidden">
              <img 
                src="/logo.png" 
                alt="AI Notetaker Logo" 
                className="w-full h-full object-contain"
              />
            </div>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex space-x-4">
            <button
              onClick={() => { setAuthMode('login'); setShowAuth(true); }}
              className="px-4 sm:px-6 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-sm sm:text-base"
            >
              Login
            </button>
            <button
              onClick={() => { setAuthMode('signup'); setShowAuth(true); }}
              className="px-4 sm:px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 text-sm sm:text-base"
            >
              Get Started
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-gray-600 hover:text-gray-900"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-4 py-4 border-t border-gray-200">
            <div className="flex flex-col space-y-3">
              <button
                onClick={() => { setAuthMode('login'); setShowAuth(true); setMobileMenuOpen(false); }}
                className="px-4 py-3 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-left"
              >
                Login
              </button>
              <button
                onClick={() => { setAuthMode('signup'); setShowAuth(true); setMobileMenuOpen(false); }}
                className="px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all text-left"
              >
                Get Started
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Mobile-Optimized Hero Section */}
      <section className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-7xl mx-auto text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-5xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 sm:mb-6 leading-tight">
              <div className="block sm:hidden">
                <div>Sleep During</div>
                <div>Lectures</div>
              </div>
              <div className="hidden sm:block">
                Sleep During
                <br />
                Lectures
              </div>
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 mb-6 sm:mb-8 max-w-2xl mx-auto px-4">
              Turn every lecture into the notes while you sleep, effortless, perfect, and exam-ready and much more
            </p>
            <div className="flex justify-center px-4">
              <button
                onClick={() => { setAuthMode('signup'); setShowAuth(true); }}
                className="px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 flex items-center justify-center space-x-2 text-base sm:text-lg font-semibold"
              >
                <span>Start Recording</span>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile-Optimized Features Section */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
              Powerful Features
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-2xl mx-auto px-4">
              Everything you need to capture, process, and organize your learning content
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {features.map((feature, index) => (
              <div key={index} className="text-center p-4 sm:p-6 rounded-xl hover:shadow-lg transition-shadow bg-gray-50 sm:bg-white">
                <div className="flex justify-center mb-3 sm:mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mobile-Optimized Benefits Section */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 items-center">
            <div className="text-center lg:text-left">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4 sm:mb-6">
                Why Choose AI Notetaker?
              </h2>
              <p className="text-base sm:text-lg md:text-xl text-blue-100 mb-6 sm:mb-8">
                Join thousands of students and professionals who have transformed their learning experience
              </p>
              <div className="space-y-3 sm:space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-400 flex-shrink-0" />
                    <span className="text-white text-base sm:text-lg">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-2xl">
              <div className="text-center">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <Zap className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">
                  Ready to Get Started?
                </h3>
                <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
                  Create your account and start recording your first lecture in minutes
                </p>
                <button
                  onClick={() => { setAuthMode('signup'); setShowAuth(true); }}
                  className="w-full px-4 sm:px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-semibold text-sm sm:text-base"
                >
                  Create Free Account
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile-Optimized Testimonial Section */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-8 sm:mb-12">
            Loved by Students Worldwide
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                name: "Vihaan Gupta",
                role: "BBA Student",
                content: "The AI-generated notes are incredibly accurate and well-structured. It's like having a personal assistant for every lecture.",
                rating: 5
              },
              {
                name: "Animesh Agarwal",
                role: "BMS Student",
                content: "Perfect for long lectures. The noise reduction works amazingly well in crowded lecture halls.",
                rating: 5
              },
              {
                name: "Girish Agarwal",
                role: "Medical Student",
                content: "This has been a game-changer for my medical studies. The AI perfectly captures complex medical terminology and concepts.",
                rating: 5
              }
            ].map((testimonial, index) => (
              <div key={index} className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
                <div className="flex justify-center mb-3 sm:mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4 italic leading-relaxed">
                  "{testimonial.content}"
                </p>
                <div>
                  <div className="font-semibold text-gray-900 text-sm sm:text-base">{testimonial.name}</div>
                  <div className="text-xs sm:text-sm text-gray-500">{testimonial.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 sm:px-6 py-8 sm:py-12 bg-gray-900">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-2 mb-3 sm:mb-4">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden">
              <img 
                src="/logo.png" 
                alt="AI Notetaker Logo" 
                className="w-full h-full object-contain"
              />
            </div>
            <span className="text-xl sm:text-2xl font-bold text-white">AI Notetaker</span>
          </div>
          <p className="text-gray-400 mb-4 sm:mb-6 text-sm sm:text-base">
            Transform your learning experience with AI-powered note-taking
          </p>
          <div className="flex flex-col sm:flex-row justify-center space-y-2 sm:space-y-0 sm:space-x-6">
            <button
              onClick={() => { setAuthMode('login'); setShowAuth(true); }}
              className="text-gray-400 hover:text-white transition-colors text-sm sm:text-base"
            >
              Login
            </button>
            <button
              onClick={() => { setAuthMode('signup'); setShowAuth(true); }}
              className="text-gray-400 hover:text-white transition-colors text-sm sm:text-base"
            >
              Sign Up
            </button>
          </div>
          <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-gray-800">
            <p className="text-gray-500 text-xs sm:text-sm">
              © 2024 AI Notetaker. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        mode={authMode}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
};

export default LandingPage;
