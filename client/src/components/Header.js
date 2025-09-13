import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Mic, Home } from 'lucide-react';

const Header = () => {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <Link to="/" className="flex items-center space-x-2">
            <BookOpen className="h-6 w-6 sm:h-8 sm:w-8 text-primary-600" />
            <span className="text-lg sm:text-xl font-bold text-gray-900 hidden xs:block">AI Notetaker</span>
            <span className="text-lg sm:text-xl font-bold text-gray-900 block xs:hidden">AI Notes</span>
          </Link>
          
          <nav className="flex items-center space-x-1 sm:space-x-6">
            <Link
              to="/"
              className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                isActive('/')
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Home className="h-4 w-4" />
              <span className="hidden sm:block">Dashboard</span>
              <span className="block sm:hidden">Home</span>
            </Link>
            
            <Link
              to="/record"
              className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                isActive('/record')
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Mic className="h-4 w-4" />
              <span className="hidden sm:block">Record Lecture</span>
              <span className="block sm:hidden">Record</span>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header; 