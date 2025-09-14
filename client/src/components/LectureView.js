import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Calendar, Clock, FileText, Download, Copy, Check, Edit3, X } from 'lucide-react';

const LectureView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lecture, setLecture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
  const [copiedStates, setCopiedStates] = useState({});
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [showFiltered, setShowFiltered] = useState(false);

  useEffect(() => {
    fetchLecture();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchLecture = async () => {
    try {
      const response = await axios.get(`/api/lectures/${id}`);
      setLecture(response.data);
      setEditTitle(response.data.title);
    } catch (err) {
      setError('Failed to fetch lecture');
      console.error('Error fetching lecture:', err);
    } finally {
      setLoading(false);
    }
  };

  const startEditingTitle = () => {
    setIsEditingTitle(true);
    setEditTitle(lecture.title);
  };

  const cancelEditingTitle = () => {
    setIsEditingTitle(false);
    setEditTitle(lecture.title);
  };

  const saveTitle = async () => {
    if (!editTitle.trim()) {
      alert('Title cannot be empty');
      return;
    }

    try {
      await axios.put(`/api/lectures/${id}`, { title: editTitle.trim() });
      setLecture({ ...lecture, title: editTitle.trim() });
      setIsEditingTitle(false);
    } catch (err) {
      console.error('Error updating lecture title:', err);
      alert('Failed to update lecture title');
    }
  };

  const copyToClipboard = async (text, section) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStates(prev => ({ ...prev, [section]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [section]: false }));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const downloadAsText = (content, filename) => {
    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
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

  if (error || !lecture) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">{error || 'Lecture not found'}</div>
        <Link
          to="/"
          className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const tabs = [
    { id: 'summary', label: 'Summary', icon: FileText },
    { id: 'notes', label: 'Notes', icon: FileText },
    { id: 'academic', label: 'Academic Content', icon: FileText },
    { id: 'transcript', label: 'Full Transcript', icon: FileText },
  ];

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-0">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </button>
        </div>
        
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
          {isEditingTitle ? (
            <div className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="flex-1 text-xl sm:text-3xl font-bold border border-gray-300 rounded px-2 sm:px-3 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    saveTitle();
                  } else if (e.key === 'Escape') {
                    cancelEditingTitle();
                  }
                }}
                autoFocus
              />
              <button
                onClick={saveTitle}
                className="text-green-600 hover:text-green-700 transition-colors flex-shrink-0"
              >
                <Check className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
              <button
                onClick={cancelEditingTitle}
                className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
              >
                <X className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-xl sm:text-3xl font-bold text-gray-900 flex-1 break-words">{lecture.title}</h1>
              <button
                onClick={startEditingTitle}
                className="text-gray-400 hover:text-blue-600 transition-colors flex-shrink-0 self-start sm:self-center"
                title="Edit title"
              >
                <Edit3 className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            </>
          )}
        </div>
        
        <div className="flex items-center space-x-6 text-sm text-gray-600">
          <div className="flex items-center space-x-1">
            <Calendar className="h-4 w-4" />
            <span>{formatDate(lecture.created_at)}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Clock className="h-4 w-4" />
            <span>{formatTime(lecture.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-4 sm:mb-6">
        <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-1 sm:space-x-2 py-2 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden xs:block">{tab.label}</span>
                <span className="block xs:hidden">
                  {tab.id === 'summary' ? 'Summary' : 
                   tab.id === 'notes' ? 'Notes' : 
                   tab.id === 'academic' ? 'Academic' : 'Transcript'}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow-sm border">
        {/* Summary Tab */}
        {activeTab === 'summary' && (
          <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-2 sm:space-y-0">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Lecture Summary</h2>
              <div className="flex items-center space-x-2 self-start sm:self-auto">
                <button
                  onClick={() => copyToClipboard(lecture.summary, 'summary')}
                  className="flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 border rounded-md hover:bg-gray-50"
                >
                  {copiedStates.summary ? (
                    <>
                      <Check className="h-4 w-4 text-green-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => downloadAsText(lecture.summary, `${lecture.title}-summary.txt`)}
                  className="flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 border rounded-md hover:bg-gray-50"
                >
                  <Download className="h-4 w-4" />
                  <span>Download</span>
                </button>
              </div>
            </div>
            <div className="prose max-w-none">
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                {lecture.summary}
              </p>
            </div>
          </div>
        )}

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-2 sm:space-y-0">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Structured Notes</h2>
              <div className="flex items-center space-x-2 self-start sm:self-auto">
                <button
                  onClick={() => copyToClipboard(lecture.notes, 'notes')}
                  className="flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 border rounded-md hover:bg-gray-50"
                >
                  {copiedStates.notes ? (
                    <>
                      <Check className="h-4 w-4 text-green-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => downloadAsText(lecture.notes, `${lecture.title}-notes.txt`)}
                  className="flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 border rounded-md hover:bg-gray-50"
                >
                  <Download className="h-4 w-4" />
                  <span>Download</span>
                </button>
              </div>
            </div>
            <div className="prose max-w-none">
              <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                {lecture.notes}
              </div>
            </div>
          </div>
        )}

        {/* Academic Content Tab */}
        {activeTab === 'academic' && (
          <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-2 sm:space-y-0">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Academic Content</h2>
              <div className="flex items-center space-x-2 self-start sm:self-auto">
                <button
                  onClick={() => copyToClipboard(lecture.filtered_content || lecture.transcription, 'academic')}
                  className="flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 border rounded-md hover:bg-gray-50"
                >
                  {copiedStates.academic ? (
                    <>
                      <Check className="h-4 w-4 text-green-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => downloadAsText(lecture.filtered_content || lecture.transcription, `${lecture.title}-academic-content.txt`)}
                  className="flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 border rounded-md hover:bg-gray-50"
                >
                  <Download className="h-4 w-4" />
                  <span>Download</span>
                </button>
              </div>
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                This tab shows only the academic and educational content from the lecture, with casual remarks, jokes, and off-topic discussions filtered out.
              </p>
              {lecture.filtered_content ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800">
                    ✅ Academic content has been automatically filtered from the original transcript.
                  </p>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    ⚠️ This lecture was processed before the academic filtering feature was added. Showing original transcript.
                  </p>
                </div>
              )}
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-gray-700 leading-relaxed whitespace-pre-line font-mono text-sm">
                {lecture.filtered_content || lecture.transcription}
              </p>
            </div>
          </div>
        )}

        {/* Transcript Tab */}
        {activeTab === 'transcript' && (
          <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-2 sm:space-y-0">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Full Transcript</h2>
              <div className="flex items-center space-x-2 self-start sm:self-auto">
                {lecture.filtered_content && (
                  <label className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={showFiltered}
                      onChange={(e) => setShowFiltered(e.target.checked)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-gray-600">Show filtered only</span>
                  </label>
                )}
                <button
                  onClick={() => copyToClipboard(showFiltered && lecture.filtered_content ? lecture.filtered_content : lecture.transcription, 'transcript')}
                  className="flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 border rounded-md hover:bg-gray-50"
                >
                  {copiedStates.transcript ? (
                    <>
                      <Check className="h-4 w-4 text-green-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => downloadAsText(showFiltered && lecture.filtered_content ? lecture.filtered_content : lecture.transcription, `${lecture.title}-transcript.txt`)}
                  className="flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 border rounded-md hover:bg-gray-50"
                >
                  <Download className="h-4 w-4" />
                  <span>Download</span>
                </button>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="mb-2 text-xs text-gray-500">
                {showFiltered && lecture.filtered_content ? 
                  'Showing academic content only (filtered)' : 
                  'Showing complete original transcript'}
              </div>
              <p className="text-gray-700 leading-relaxed whitespace-pre-line font-mono text-sm">
                {showFiltered && lecture.filtered_content ? lecture.filtered_content : lecture.transcription}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LectureView; 