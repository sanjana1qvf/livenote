import React from 'react';
import { Chrome } from 'lucide-react';

const Login = () => {
  const handleGoogleLogin = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Google login clicked - redirecting to OAuth...');
    // Use environment-based URL
    const backendUrl = process.env.NODE_ENV === 'production' 
      ? 'https://ai-notetaker-platform.onrender.com'
      : 'http://localhost:5000';
    
    console.log('Redirecting to:', `${backendUrl}/auth/google`);
    
    // Force a full page redirect to bypass React Router
    setTimeout(() => {
      window.location.href = `${backendUrl}/auth/google`;
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">AI Notetaker</h1>
          <p className="text-lg text-gray-600">
            Record lectures, get AI-powered notes
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Sign in to continue</h2>
            <p className="mt-2 text-sm text-gray-600">
              Use your Google account to access your personal lecture notes
            </p>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full flex justify-center items-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-gray-700 hover:bg-gray-50 transition-colors font-medium"
          >
            <Chrome className="h-5 w-5 mr-3 text-blue-500" />
            Continue with Google
          </button>

          <div className="mt-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">Why sign in?</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Your lectures stay private and secure</li>
                <li>• Access your notes from any device</li>
                <li>• Organize lectures by subject or class</li>
                <li>• Never lose your study materials</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center">
        <p className="text-xs text-gray-500">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
};

export default Login;
