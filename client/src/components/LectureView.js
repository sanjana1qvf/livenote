import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextSimple';
import { ArrowLeft, Calendar, Clock, FileText, Download, Copy, Check, Edit3, X, FileDown, ChevronDown } from 'lucide-react';
import jsPDF from 'jspdf';

// Dynamic API URL - works for both local and production
const API_BASE_URL = process.env.NODE_ENV === "production" ? "" : "http://localhost:5000";

const LectureView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getAuthHeaders, isAuthenticated } = useAuth();
  const [lecture, setLecture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
  const [copiedStates, setCopiedStates] = useState({});
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [showFiltered, setShowFiltered] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(null);

  useEffect(() => {
    if (isAuthenticated()) {
      fetchLecture();
    } else {
      setError('Please log in to view this lecture');
      setLoading(false);
    }
  }, [id, isAuthenticated]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownOpen && !event.target.closest('.relative')) {
        setDropdownOpen(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  const fetchLecture = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/lectures/${id}`, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
      });

      if (response.ok) {
        const data = await response.json();
        setLecture(data);
        setEditTitle(data.title);
        setError(null);
      } else if (response.status === 401) {
        setError('Please log in to view this lecture');
      } else {
        setError('Failed to fetch lecture');
      }
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
      const response = await fetch(`${API_BASE_URL}/api/lectures/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ title: editTitle.trim() })
      });

      if (response.ok) {
        const updatedLecture = await response.json();
        setLecture(updatedLecture);
        setIsEditingTitle(false);
      } else {
        alert('Failed to update lecture title');
      }
    } catch (err) {
      console.error('Error updating lecture title:', err);
      alert('Failed to update lecture title');
    }
  };

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStates({ ...copiedStates, [type]: true });
      setTimeout(() => {
        setCopiedStates({ ...copiedStates, [type]: false });
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const exportToPDF = () => {
    if (!lecture) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    const maxWidth = pageWidth - 2 * margin;
    
    let yPosition = margin;

    // Title
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    const titleLines = doc.splitTextToSize(lecture.title, maxWidth);
    doc.text(titleLines, margin, yPosition);
    yPosition += titleLines.length * 7 + 10;

    // Date
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text(`Created: ${formatDate(lecture.created_at)}`, margin, yPosition);
    yPosition += 20;

    // Summary
    if (lecture.summary) {
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text('Summary', margin, yPosition);
      yPosition += 10;
      
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      const summaryLines = doc.splitTextToSize(lecture.summary, maxWidth);
      doc.text(summaryLines, margin, yPosition);
      yPosition += summaryLines.length * 4 + 15;
    }

    // Notes
    if (lecture.notes) {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = margin;
      }
      
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text('Notes', margin, yPosition);
      yPosition += 10;
      
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      const notesLines = doc.splitTextToSize(lecture.notes, maxWidth);
      doc.text(notesLines, margin, yPosition);
    }

    doc.save(`${lecture.title}.pdf`);
  };

  const downloadContent = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
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
        <Link
          to="/"
          className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  if (!lecture) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600 mb-4">Lecture not found</div>
        <Link
          to="/"
          className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link
          to="/"
          className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Dashboard
        </Link>
        
        <div className="flex items-center gap-4">
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FileDown className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Lecture Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-2xl font-bold text-gray-900 border-b-2 border-primary-500 bg-transparent focus:outline-none flex-1"
                  onKeyPress={(e) => e.key === 'Enter' && saveTitle()}
                />
                <button
                  onClick={saveTitle}
                  className="p-1 text-green-600 hover:text-green-700"
                >
                  <Check className="w-5 h-5" />
                </button>
                <button
                  onClick={cancelEditingTitle}
                  className="p-1 text-red-600 hover:text-red-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{lecture.title}</h1>
                <button
                  onClick={startEditingTitle}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center text-sm text-gray-500 gap-6">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>{formatDate(lecture.created_at)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>Processed</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex">
            {[
              { id: 'summary', label: 'Summary', icon: FileText },
              { id: 'notes', label: 'Notes', icon: FileText },
              { id: 'transcription', label: 'Transcription', icon: FileText },
              { id: 'qna', label: 'Q&A', icon: FileText }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'summary' && lecture.summary && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Summary</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(lecture.summary, 'summary')}
                    className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:border-gray-400 transition-colors"
                  >
                    {copiedStates.summary ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedStates.summary ? 'Copied!' : 'Copy'}
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setDropdownOpen(dropdownOpen === 'summary' ? null : 'summary')}
                      className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:border-gray-400 transition-colors"
                    >
                      <FileDown className="w-4 h-4" />
                      Download
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    {dropdownOpen === 'summary' && (
                      <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                        <button
                          onClick={() => {
                            downloadContent(lecture.summary, `${lecture.title}_summary.txt`, 'text/plain');
                            setDropdownOpen(null);
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          Download as TXT
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="prose max-w-none">
                <p className="whitespace-pre-wrap text-gray-700">{lecture.summary}</p>
              </div>
            </div>
          )}

          {activeTab === 'notes' && lecture.notes && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Notes</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(lecture.notes, 'notes')}
                    className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:border-gray-400 transition-colors"
                  >
                    {copiedStates.notes ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedStates.notes ? 'Copied!' : 'Copy'}
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setDropdownOpen(dropdownOpen === 'notes' ? null : 'notes')}
                      className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:border-gray-400 transition-colors"
                    >
                      <FileDown className="w-4 h-4" />
                      Download
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    {dropdownOpen === 'notes' && (
                      <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                        <button
                          onClick={() => {
                            downloadContent(lecture.notes, `${lecture.title}_notes.txt`, 'text/plain');
                            setDropdownOpen(null);
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          Download as TXT
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="prose max-w-none">
                <div className="whitespace-pre-wrap text-gray-700">{lecture.notes}</div>
              </div>
            </div>
          )}

          {activeTab === 'transcription' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Transcription</h3>
                <div className="flex items-center gap-2">
                  {lecture.filtered_content && (
                    <button
                      onClick={() => setShowFiltered(!showFiltered)}
                      className={`px-3 py-1 text-sm border rounded transition-colors ${
                        showFiltered
                          ? 'bg-primary-100 text-primary-700 border-primary-300'
                          : 'text-gray-600 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {showFiltered ? 'Show Original' : 'Show Filtered'}
                    </button>
                  )}
                  <button
                    onClick={() => copyToClipboard(
                      showFiltered && lecture.filtered_content ? lecture.filtered_content : lecture.transcription, 
                      'transcription'
                    )}
                    className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:border-gray-400 transition-colors"
                  >
                    {copiedStates.transcription ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedStates.transcription ? 'Copied!' : 'Copy'}
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setDropdownOpen(dropdownOpen === 'transcription' ? null : 'transcription')}
                      className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:border-gray-400 transition-colors"
                    >
                      <FileDown className="w-4 h-4" />
                      Download
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    {dropdownOpen === 'transcription' && (
                      <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                        <button
                          onClick={() => {
                            const content = showFiltered && lecture.filtered_content ? lecture.filtered_content : lecture.transcription;
                            const filename = showFiltered && lecture.filtered_content 
                              ? `${lecture.title}_filtered_transcription.txt`
                              : `${lecture.title}_transcription.txt`;
                            downloadContent(content, filename, 'text/plain');
                            setDropdownOpen(null);
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          Download as TXT
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="prose max-w-none">
                <p className="whitespace-pre-wrap text-gray-700">
                  {showFiltered && lecture.filtered_content ? lecture.filtered_content : lecture.transcription}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'qna' && lecture.qna && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Questions & Answers</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(lecture.qna, 'qna')}
                    className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:border-gray-400 transition-colors"
                  >
                    {copiedStates.qna ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedStates.qna ? 'Copied!' : 'Copy'}
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setDropdownOpen(dropdownOpen === 'qna' ? null : 'qna')}
                      className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:border-gray-400 transition-colors"
                    >
                      <FileDown className="w-4 h-4" />
                      Download
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    {dropdownOpen === 'qna' && (
                      <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                        <button
                          onClick={() => {
                            downloadContent(lecture.qna, `${lecture.title}_qna.txt`, 'text/plain');
                            setDropdownOpen(null);
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          Download as TXT
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="prose max-w-none">
                <div className="whitespace-pre-wrap text-gray-700">{lecture.qna}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LectureView;
