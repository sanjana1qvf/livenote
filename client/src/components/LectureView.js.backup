import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Calendar, Clock, FileText, Download, Copy, Check, Edit3, X, FileDown, ChevronDown } from 'lucide-react';
import jsPDF from 'jspdf';

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
  const [dropdownOpen, setDropdownOpen] = useState(null);

  useEffect(() => {
    fetchLecture();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const generateComprehensivePDF = () => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - 2 * margin;
    let currentY = margin;

    // Helper function to add text with word wrapping
    const addWrappedText = (text, fontSize = 11, isBold = false, isTitle = false) => {
      if (isTitle) {
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
      } else if (isBold) {
        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', 'bold');
      } else {
        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', 'normal');
      }

      const lines = pdf.splitTextToSize(text, maxWidth);
      
      // Check if we need a new page
      if (currentY + (lines.length * (fontSize * 0.3)) > pageHeight - margin) {
        pdf.addPage();
        currentY = margin;
      }

      lines.forEach(line => {
        pdf.text(line, margin, currentY);
        currentY += fontSize * 0.3;
      });
      
      currentY += isTitle ? 10 : 5; // Extra spacing after titles
    };

    // Header
    pdf.setFillColor(59, 130, 246); // Blue color
    pdf.rect(0, 0, pageWidth, 25, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('AI NOTETAKER PLATFORM', margin, 17);
    
    currentY = 40;
    pdf.setTextColor(0, 0, 0);

    // Lecture Title
    addWrappedText(lecture.title, 18, true, true);

    // Lecture Info
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Date: ${formatDate(lecture.created_at)}`, margin, currentY);
    pdf.text(`Time: ${formatTime(lecture.created_at)}`, margin + 100, currentY);
    currentY += 15;

    // Divider line
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 15;

    pdf.setTextColor(0, 0, 0);

    // Summary Section
    addWrappedText('LECTURE SUMMARY', 14, true, true);
    addWrappedText(lecture.summary, 11);
    currentY += 10;

    // Notes Section
    addWrappedText('STRUCTURED NOTES', 14, true, true);
    addWrappedText(lecture.notes, 11);
    currentY += 10;

    // Academic Content Section (if available)
    if (lecture.filtered_content) {
      addWrappedText('ACADEMIC CONTENT', 14, true, true);
      addWrappedText(lecture.filtered_content, 10);
      currentY += 10;
    }

    // Full Transcript Section
    addWrappedText('FULL TRANSCRIPT', 14, true, true);
    addWrappedText(lecture.transcription, 9);

    // Footer on last page
    const totalPages = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Generated by AI Notetaker Platform - Page ${i} of ${totalPages}`, margin, pageHeight - 10);
      pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, pageWidth - margin - 80, pageHeight - 10);
    }

    // Download the PDF
    pdf.save(`${lecture.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_lecture_notes.pdf`);
  };

  const generateSectionPDF = (content, sectionTitle, filename) => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - 2 * margin;
    let currentY = margin;

    // Header
    pdf.setFillColor(59, 130, 246);
    pdf.rect(0, 0, pageWidth, 25, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('AI NOTETAKER PLATFORM', margin, 17);
    
    currentY = 40;
    pdf.setTextColor(0, 0, 0);

    // Lecture Title
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    const titleLines = pdf.splitTextToSize(lecture.title, maxWidth);
    titleLines.forEach(line => {
      pdf.text(line, margin, currentY);
      currentY += 6;
    });
    currentY += 5;

    // Section Title
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text(sectionTitle.toUpperCase(), margin, currentY);
    currentY += 10;

    // Date info
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 100, 100);
    pdf.text(`${formatDate(lecture.created_at)} at ${formatTime(lecture.created_at)}`, margin, currentY);
    currentY += 15;

    // Divider
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 15;

    // Content
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    
    const contentLines = pdf.splitTextToSize(content, maxWidth);
    contentLines.forEach(line => {
      if (currentY > pageHeight - margin) {
        pdf.addPage();
        currentY = margin;
      }
      pdf.text(line, margin, currentY);
      currentY += 5;
    });

    // Footer
    const totalPages = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Generated by AI Notetaker Platform - Page ${i} of ${totalPages}`, margin, pageHeight - 10);
      pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, pageWidth - margin - 80, pageHeight - 10);
    }

    pdf.save(filename);
  };

  // Download dropdown component
  const DownloadDropdown = ({ content, sectionTitle, baseFilename, dropdownId }) => {
    const isOpen = dropdownOpen === dropdownId;
    
    return (
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(isOpen ? null : dropdownId)}
          className="flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 border rounded-md hover:bg-gray-50"
        >
          <Download className="h-4 w-4" />
          <span>Download</span>
          <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        
        {isOpen && (
          <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-10">
            <button
              onClick={() => {
                generateSectionPDF(content, sectionTitle, `${baseFilename}.pdf`);
                setDropdownOpen(null);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center space-x-2"
            >
              <FileDown className="h-4 w-4" />
              <span>PDF Format</span>
            </button>
            <button
              onClick={() => {
                downloadAsText(content, `${baseFilename}.txt`);
                setDropdownOpen(null);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center space-x-2"
            >
              <FileText className="h-4 w-4" />
              <span>Text Format</span>
            </button>
          </div>
        )}
      </div>
    );
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
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
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
          
          {/* Comprehensive PDF Download Button */}
          <button
            onClick={generateComprehensivePDF}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <FileDown className="h-4 w-4" />
            <span className="font-medium">Download Complete PDF</span>
          </button>
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
                <DownloadDropdown 
                  content={lecture.summary}
                  sectionTitle="Summary"
                  baseFilename={`${lecture.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_summary`}
                  dropdownId="summary"
                />
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
                <DownloadDropdown 
                  content={lecture.notes}
                  sectionTitle="Notes"
                  baseFilename={`${lecture.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_notes`}
                  dropdownId="notes"
                />
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
                                                  <DownloadDropdown 
                   content={lecture.filtered_content || lecture.transcription}
                   sectionTitle="Academic Content"
                   baseFilename={`${lecture.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_academic_content`}
                   dropdownId="academic"
                 />
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
                <DownloadDropdown 
                  content={showFiltered && lecture.filtered_content ? lecture.filtered_content : lecture.transcription}
                  sectionTitle={showFiltered ? 'Academic Transcript' : 'Full Transcript'}
                  baseFilename={`${lecture.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${showFiltered ? 'academic_' : ''}transcript`}
                  dropdownId="transcript"
                />
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