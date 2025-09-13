import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Calendar, Clock, FileText, Trash2, Plus, Edit3, Check, X } from 'lucide-react';

const Dashboard = () => {
  const [lectures, setLectures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  useEffect(() => {
    fetchLectures();
  }, []);

  const fetchLectures = async () => {
    try {
      const response = await axios.get('/api/lectures');
      setLectures(response.data);
    } catch (err) {
      setError('Failed to fetch lectures');
      console.error('Error fetching lectures:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteLecture = async (id) => {
    if (!window.confirm('Are you sure you want to delete this lecture?')) {
      return;
    }

    try {
      await axios.delete(`/api/lectures/${id}`);
      setLectures(lectures.filter(lecture => lecture.id !== id));
    } catch (err) {
      console.error('Error deleting lecture:', err);
      alert('Failed to delete lecture');
    }
  };

  const startEditing = (lecture) => {
    setEditingId(lecture.id);
    setEditTitle(lecture.title);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const saveTitle = async (id) => {
    if (!editTitle.trim()) {
      alert('Title cannot be empty');
      return;
    }

    try {
      await axios.put(`/api/lectures/${id}`, { title: editTitle.trim() });
      setLectures(lectures.map(lecture => 
        lecture.id === id ? { ...lecture, title: editTitle.trim() } : lecture
      ));
      setEditingId(null);
      setEditTitle('');
    } catch (err) {
      console.error('Error updating lecture title:', err);
      alert('Failed to update lecture title');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">{error}</div>
        <button
          onClick={fetchLectures}
          className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 space-y-4 sm:space-y-0">
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Your Lectures</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">
            Manage and review your recorded lectures and AI-generated notes
          </p>
        </div>
        
        <Link
          to="/record"
          className="bg-primary-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center space-x-2 text-sm sm:text-base w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
          <span>New Recording</span>
        </Link>
      </div>

      {lectures.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No lectures yet</h3>
          <p className="text-gray-600 mb-6">
            Start by recording your first lecture to generate AI-powered notes
          </p>
          <Link
            to="/record"
            className="bg-primary-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-primary-700 transition-colors inline-flex items-center justify-center space-x-2 text-sm sm:text-base w-full sm:w-auto max-w-xs mx-auto"
          >
            <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
            <span>Record Your First Lecture</span>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {lectures.map((lecture) => (
            <div
              key={lecture.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
            >
                                            <div className="p-4 sm:p-6">
                 <div className="flex items-start justify-between mb-3 sm:mb-4">
                   {editingId === lecture.id ? (
                     <div className="flex-1 mr-2">
                       <input
                         type="text"
                         value={editTitle}
                         onChange={(e) => setEditTitle(e.target.value)}
                         className="w-full px-2 py-1 text-base sm:text-lg font-semibold border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                         onKeyPress={(e) => {
                           if (e.key === 'Enter') {
                             saveTitle(lecture.id);
                           } else if (e.key === 'Escape') {
                             cancelEditing();
                           }
                         }}
                         autoFocus
                       />
                     </div>
                   ) : (
                     <h3 className="text-base sm:text-lg font-semibold text-gray-900 line-clamp-2 flex-1 break-words">
                       {lecture.title}
                     </h3>
                   )}
                   <div className="flex items-center space-x-1 flex-shrink-0">
                     {editingId === lecture.id ? (
                       <>
                         <button
                           onClick={() => saveTitle(lecture.id)}
                           className="text-green-600 hover:text-green-700 transition-colors p-1"
                         >
                           <Check className="h-4 w-4" />
                         </button>
                         <button
                           onClick={cancelEditing}
                           className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                         >
                           <X className="h-4 w-4" />
                         </button>
                       </>
                     ) : (
                       <>
                         <button
                           onClick={() => startEditing(lecture)}
                           className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                           title="Edit title"
                         >
                           <Edit3 className="h-4 w-4" />
                         </button>
                         <button
                           onClick={() => deleteLecture(lecture.id)}
                           className="text-gray-400 hover:text-red-600 transition-colors p-1"
                         >
                           <Trash2 className="h-4 w-4" />
                         </button>
                       </>
                     )}
                   </div>
                 </div>
                 
                 <div className="flex flex-col xs:flex-row xs:items-center xs:space-x-4 space-y-1 xs:space-y-0 text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                   <div className="flex items-center space-x-1">
                     <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                     <span>{formatDate(lecture.created_at)}</span>
                   </div>
                   <div className="flex items-center space-x-1">
                     <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                     <span>{formatTime(lecture.created_at)}</span>
                   </div>
                 </div>
                
                                 {lecture.summary && (
                   <p className="text-gray-700 text-xs sm:text-sm line-clamp-3 mb-3 sm:mb-4">
                     {lecture.summary.substring(0, 100)}...
                   </p>
                 )}
                 
                 <Link
                   to={`/lecture/${lecture.id}`}
                   className="block w-full bg-primary-50 text-primary-700 text-center py-2 rounded-md hover:bg-primary-100 transition-colors text-sm"
                 >
                   View Details
                 </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard; 