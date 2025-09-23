import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextSimple';
import { Calendar, Clock, FileText, Trash2, Plus, Edit3, Check, X } from 'lucide-react';

// Dynamic API URL - works for both local and production
const API_BASE_URL = process.env.NODE_ENV === "production" ? "" : "http://localhost:5000";

const Dashboard = () => {
  const [lectures, setLectures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const { getAuthHeaders, isAuthenticated, user } = useAuth();

  const fetchLectures = useCallback(async () => {
    // Only fetch if user is authenticated and we have a valid token
    if (!user || !isAuthenticated()) {
      setLoading(false);
      setError('Please log in to view your lectures');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/lectures`, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setLectures(data);
        setError(null);
      } else if (response.status === 401) {
        // User is not authenticated, redirect to login
        setError('Please log in to view your lectures');
      } else {
        setError('Failed to fetch lectures');
      }
    } catch (err) {
      setError('Failed to fetch lectures');
      console.error('Error fetching lectures:', err);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, isAuthenticated, user]);

  useEffect(() => {
    // Only fetch lectures if user is authenticated
    if (user && isAuthenticated()) {
      fetchLectures();
    } else {
      setLoading(false);
    }
  }, [fetchLectures, user, isAuthenticated]);

  const deleteLecture = async (id) => {
    if (!window.confirm('Are you sure you want to delete this lecture?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/lectures/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
      });
      
      if (response.ok) {
        setLectures(lectures.filter(lecture => lecture.id !== id));
      } else {
        alert('Failed to delete lecture');
      }
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

  const saveEdit = async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/lectures/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ title: editTitle })
      });
      
      if (response.ok) {
        const updatedLecture = await response.json();
        setLectures(lectures.map(lecture => 
          lecture.id === id ? updatedLecture : lecture
        ));
        setEditingId(null);
        setEditTitle('');
      } else {
        alert('Failed to update lecture');
      }
    } catch (err) {
      console.error('Error updating lecture:', err);
      alert('Failed to update lecture');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "No date";
    
    // Handle Firebase timestamp format
    if (dateString && typeof dateString === 'object' && dateString._seconds) {
      const date = new Date(dateString._seconds * 1000);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    // Handle ISO string format
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid date";
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Your Lectures</h1>
        <Link
          to="/record"
          className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Lecture</span>
        </Link>
      </div>

      {lectures.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No lectures yet</h3>
          <p className="text-gray-500 mb-6">Start by recording your first lecture</p>
          <Link
            to="/record"
            className="bg-primary-600 text-white px-6 py-3 rounded-md hover:bg-primary-700 inline-flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Record Lecture</span>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {lectures.map((lecture) => (
            <div key={lecture.id} className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                {editingId === lecture.id ? (
                  <div className="flex-1 mr-2">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      onKeyPress={(e) => e.key === 'Enter' && saveEdit(lecture.id)}
                    />
                  </div>
                ) : (
                  <h3 className="text-lg font-semibold text-gray-900 flex-1 mr-2">
                    {lecture.title}
                  </h3>
                )}
                
                <div className="flex items-center space-x-1">
                  {editingId === lecture.id ? (
                    <>
                      <button
                        onClick={() => saveEdit(lecture.id)}
                        className="p-1 text-green-600 hover:text-green-700"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="p-1 text-red-600 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEditing(lecture)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteLecture(lecture.id)}
                        className="p-1 text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center text-sm text-gray-500 mb-4">
                <Calendar className="w-4 h-4 mr-2" />
                <span>{formatDate(lecture.created_at)}</span>
              </div>

              <div className="flex items-center text-sm text-gray-500 mb-4">
                <Clock className="w-4 h-4 mr-2" />
                <span>Processed</span>
              </div>

              <Link
                to={`/lecture/${lecture.id}`}
                className="block w-full bg-primary-50 text-primary-700 text-center py-2 px-4 rounded-md hover:bg-primary-100 transition-colors"
              >
                View Details
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
