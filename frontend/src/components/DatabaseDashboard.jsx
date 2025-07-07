import React, { useState, useEffect } from 'react';
import { ClientDatabaseService } from '../database/client-api.js';
import DMDFFileService from '../services/DMDFFileService.js';

const DatabaseDashboard = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState('naps');
  const [naps, setNaps] = useState([]);
  const [digitMaps, setDigitMaps] = useState([]);
  const [dialFormats, setDialFormats] = useState([]);
  const [fileMappings, setFileMappings] = useState([]);
  const [prosbcFiles, setProsbcFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState(null);

  const dbService = new ClientDatabaseService();
  const fileService = new DMDFFileService(dbService);

  useEffect(() => {
    loadData();
  }, [statusFilter, activeTab]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      switch (activeTab) {
        case 'naps':
          await loadNapData();
          break;
        case 'digitMaps':
          await loadDigitMaps();
          break;
        case 'dialFormats':
          await loadDialFormats();
          break;
        case 'mappings':
          await loadFileMappings();
          break;
        case 'prosbcFiles':
          await loadProsbcFiles();
          break;
        default:
          await loadNapData();
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Error loading data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadNapData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get all NAPs from the database
      const napsResult = await dbService.listNaps(
        statusFilter !== 'all' ? { status: statusFilter } : {}, 
        1, 
        100 // Load more NAPs to display
      );

      if (napsResult.success) {
        setNaps(napsResult.naps || []);
      } else {
        setError('Failed to load NAP data');
      }
    } catch (error) {
      console.error('Error loading NAP data:', error);
      setError('Error loading NAP data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadDigitMaps = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await dbService.listDigitMaps(
        statusFilter !== 'all' ? { status: statusFilter } : {},
        1,
        100
      );

      if (result.success) {
        setDigitMaps(result.digitMaps || []);
      } else {
        setError('Failed to load Digit Map data');
      }
    } catch (error) {
      console.error('Error loading Digit Map data:', error);
      setError('Error loading Digit Map data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadDialFormats = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await dbService.listDialFormats(
        statusFilter !== 'all' ? { status: statusFilter } : {},
        1,
        100
      );

      if (result.success) {
        setDialFormats(result.dialFormats || []);
      } else {
        setError('Failed to load Dial Format data');
      }
    } catch (error) {
      console.error('Error loading Dial Format data:', error);
      setError('Error loading Dial Format data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadFileMappings = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await dbService.listFileMappings(
        statusFilter !== 'all' ? { status: statusFilter } : {},
        1,
        100
      );

      if (result.success) {
        setFileMappings(result.mappings || []);
      } else {
        setError('Failed to load File Mapping data');
      }
    } catch (error) {
      console.error('Error loading File Mapping data:', error);
      setError('Error loading File Mapping data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadProsbcFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      // Simulate fetching ProSBC files - this would normally call a real ProSBC API
      const result = await dbService.fetchProsbcFiles();
      
      if (result.success) {
        setProsbcFiles(result.files || []);
      } else {
        setError('Failed to fetch ProSBC files');
      }
    } catch (error) {
      console.error('Error fetching ProSBC files:', error);
      setError('Error fetching ProSBC files: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncProsbcFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      // Sync all ProSBC files to local database
      const result = await dbService.syncProsbcFiles();
      
      if (result.success) {
        setError(null);
        // Show success message
        const successMessage = `Successfully synced ${result.synced || 0} files from ProSBC`;
        setError(successMessage); // Using error state to show success message
        setTimeout(() => setError(null), 5000); // Clear message after 5 seconds
        
        // Reload ProSBC files to show updated data
        await loadProsbcFiles();
      } else {
        setError('Failed to sync ProSBC files: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error syncing ProSBC files:', error);
      setError('Error syncing ProSBC files: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadData();
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const results = await dbService.search(searchQuery, { type: getSearchType() });
      
      if (results.success && results.results) {
        switch (activeTab) {
          case 'naps':
            setNaps(results.results.naps || []);
            break;
          case 'digitMaps':
            setDigitMaps(results.results.digitMaps || []);
            break;
          case 'dialFormats':
            setDialFormats(results.results.dialFormats || []);
            break;
          case 'mappings':
            setFileMappings(results.results.mappings || []);
            break;
          case 'prosbcFiles':
            setProsbcFiles(results.results.prosbcFiles || []);
            break;
        }
      } else {
        setError('No search results found');
        switch (activeTab) {
          case 'naps':
            setNaps([]);
            break;
          case 'digitMaps':
            setDigitMaps([]);
            break;
          case 'dialFormats':
            setDialFormats([]);
            break;
          case 'mappings':
            setFileMappings([]);
            break;
          case 'prosbcFiles':
            setProsbcFiles([]);
            break;
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      setError('Search error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getSearchType = () => {
    switch (activeTab) {
      case 'naps': return 'naps';
      case 'digitMaps': return 'digitMaps';
      case 'dialFormats': return 'dialFormats';
      case 'mappings': return 'mappings';
      case 'prosbcFiles': return 'prosbcFiles';
      default: return 'naps';
    }
  };

  const handleViewJson = (item) => {
    setSelectedItem(item);
    setShowJsonModal(true);
  };

  const closeJsonModal = () => {
    setSelectedItem(null);
    setShowJsonModal(false);
  };

  const handleUpload = () => {
    setShowUploadModal(true);
  };

  const closeUploadModal = () => {
    setShowUploadModal(false);
    // Reset upload state when closing modal
    setError(null);
  };

  const handleCreateMapping = () => {
    setShowMappingModal(true);
  };

  const closeMappingModal = () => {
    setShowMappingModal(false);
    // Reset error state when closing modal
    setError(null);
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'created':
        return '📝';
      case 'mapped':
        return '🗺️';
      case 'activated':
        return '✅';
      case 'active':
        return '✅';
      case 'inactive':
        return '⏸️';
      case 'error':
        return '❌';
      default:
        return '📋';
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'created':
        return 'bg-blue-500';
      case 'mapped':
        return 'bg-yellow-500';
      case 'activated':
      case 'active':
        return 'bg-green-500';
      case 'uploaded':
        return 'bg-purple-500';
      case 'validated':
        return 'bg-teal-500';
      case 'pending':
        return 'bg-orange-500';
      case 'inactive':
        return 'bg-gray-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString() + ' ' + new Date(dateString).toLocaleTimeString();
  };

  const getCurrentData = () => {
    switch (activeTab) {
      case 'naps': return naps;
      case 'digitMaps': return digitMaps;
      case 'dialFormats': return dialFormats;
      case 'mappings': return fileMappings;
      case 'prosbcFiles': return prosbcFiles;
      default: return naps;
    }
  };

  const getFilteredData = () => {
    const currentData = getCurrentData();
    return currentData.filter(item => {
      const matchesSearch = !searchQuery || 
        item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.nap_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.napName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.filename?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.routeset_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.created_by?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.uploaded_by?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  };

  const filteredData = getFilteredData();

  const JsonModal = () => {
    if (!showJsonModal || !selectedItem) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-60">
        <div className="bg-gray-800 rounded-lg w-full max-w-4xl mx-4 max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <h3 className="text-xl font-bold text-white">
              {activeTab === 'naps' ? 'NAP Configuration' : 
               activeTab === 'digitMaps' ? 'Digit Map File' : 
               activeTab === 'dialFormats' ? 'Dial Format File' : 
               activeTab === 'prosbcFiles' ? 'ProSBC File' :
               'File Mapping'}: {selectedItem.name || selectedItem.nap_id || selectedItem.filename || selectedItem.napName}
            </h3>
            <button
              onClick={closeJsonModal}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6">
            <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap font-mono">
              {JSON.stringify(selectedItem, null, 2)}
            </pre>
          </div>
          
          <div className="p-6 border-t border-gray-700 flex justify-end space-x-3">
            <button
              onClick={() => navigator.clipboard.writeText(JSON.stringify(selectedItem, null, 2))}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Copy JSON
            </button>
            <button
              onClick={closeJsonModal}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Upload Modal Component
  const UploadModal = () => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadData, setUploadData] = useState({
      nap_id: '',
      routeset_name: '',
      comments: ''
    });
    const [uploadProgress, setUploadProgress] = useState(null);
    const [validationResult, setValidationResult] = useState(null);

    // Reset modal state when modal opens/closes
    useEffect(() => {
      if (!showUploadModal) {
        setSelectedFile(null);
        setUploadData({
          nap_id: '',
          routeset_name: '',
          comments: ''
        });
        setUploadProgress(null);
        setValidationResult(null);
      }
    }, [showUploadModal]);

    if (!showUploadModal) return null;

    const handleFileSelect = async (event) => {
      const file = event.target.files[0];
      setSelectedFile(file);
      setValidationResult(null);

      if (file) {
        // Preview validation
        try {
          const content = await fileService.readFileContent(file);
          const fileType = activeTab === 'digitMaps' ? 'dm' : 'df';
          const parsedContent = fileService.parseCSVContent(content, fileType);
          const validation = fileService.validateFile(parsedContent, fileType);
          setValidationResult({ validation, parsedContent });
        } catch (error) {
          setValidationResult({ 
            validation: { isValid: false, errors: [error.message], warnings: [] },
            parsedContent: null
          });
        }
      }
    };

    const handleUploadSubmit = async () => {
      if (!selectedFile) {
        setError('Please select a file to upload');
        return;
      }

      setUploadProgress('uploading');
      
      try {
        const fileType = activeTab === 'digitMaps' ? 'dm' : 'df';
        const result = await fileService.uploadFile(selectedFile, fileType, {
          ...uploadData,
          uploaded_by: 'admin',
          source: 'gui'
        });

        if (result.success) {
          setUploadProgress('success');
          setTimeout(() => {
            closeUploadModal();
            loadData();
          }, 1500);
        } else {
          setUploadProgress('error');
          setError('Upload failed: ' + (result.error || 'Unknown error'));
        }
      } catch (error) {
        setUploadProgress('error');
        setError('Upload error: ' + error.message);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-60">
        <div className="bg-gray-800 rounded-lg w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <h3 className="text-xl font-bold text-white">
              Upload {activeTab === 'digitMaps' ? 'Digit Map (DM)' : 'Dial Format (DF)'} File
            </h3>
            <button onClick={closeUploadModal} className="text-gray-400 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Upload Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Select CSV File *
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {selectedFile && (
                    <div className="mt-2 text-sm text-gray-400">
                      Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    NAP ID
                  </label>
                  <input
                    type="text"
                    value={uploadData.nap_id}
                    onChange={(e) => setUploadData({ ...uploadData, nap_id: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter NAP ID"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Routeset Name
                  </label>
                  <input
                    type="text"
                    value={uploadData.routeset_name}
                    onChange={(e) => setUploadData({ ...uploadData, routeset_name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter Routeset Name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Comments
                  </label>
                  <textarea
                    value={uploadData.comments}
                    onChange={(e) => setUploadData({ ...uploadData, comments: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="3"
                    placeholder="Enter comments (optional)"
                  />
                </div>

                {/* Upload Progress */}
                {uploadProgress && (
                  <div className="p-4 rounded-lg">
                    {uploadProgress === 'uploading' && (
                      <div className="flex items-center space-x-2 text-blue-400">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                        <span>Uploading and processing file...</span>
                      </div>
                    )}
                    {uploadProgress === 'success' && (
                      <div className="flex items-center space-x-2 text-green-400">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span>File uploaded successfully!</span>
                      </div>
                    )}
                    {uploadProgress === 'error' && (
                      <div className="flex items-center space-x-2 text-red-400">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span>Upload failed. Please try again.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* File Preview & Validation */}
              {validationResult && (
                <div className="space-y-4">
                  <h4 className="text-lg font-medium text-white">File Preview & Validation</h4>
                  
                  {/* Validation Status */}
                  <div className={`p-4 rounded-lg border ${
                    validationResult.validation.isValid 
                      ? 'bg-green-900 border-green-600' 
                      : 'bg-red-900 border-red-600'
                  }`}>
                    <div className="flex items-center space-x-2">
                      {validationResult.validation.isValid ? (
                        <>
                          <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span className="text-green-400 font-medium">Valid File</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          <span className="text-red-400 font-medium">Validation Issues</span>
                        </>
                      )}
                      <span className="text-gray-300">Score: {validationResult.validation.score}/100</span>
                    </div>
                  </div>

                  {/* File Metadata */}
                  {validationResult.parsedContent && (
                    <div className="bg-gray-700 p-4 rounded-lg">
                      <h5 className="font-medium text-white mb-2">File Information</h5>
                      <div className="text-sm text-gray-300 space-y-1">
                        <div>Rows: {validationResult.parsedContent.rowCount}</div>
                        <div>Headers: {validationResult.parsedContent.headers.join(', ')}</div>
                        {validationResult.parsedContent.metadata.routesetNames && (
                          <div>Routesets: {validationResult.parsedContent.metadata.routesetNames.join(', ')}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Validation Errors */}
                  {validationResult.validation.errors.length > 0 && (
                    <div className="bg-red-900 p-4 rounded-lg">
                      <h5 className="font-medium text-red-400 mb-2">Errors</h5>
                      <ul className="text-sm text-red-300 space-y-1">
                        {validationResult.validation.errors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Validation Warnings */}
                  {validationResult.validation.warnings.length > 0 && (
                    <div className="bg-yellow-900 p-4 rounded-lg">
                      <h5 className="font-medium text-yellow-400 mb-2">Warnings</h5>
                      <ul className="text-sm text-yellow-300 space-y-1">
                        {validationResult.validation.warnings.map((warning, index) => (
                          <li key={index}>• {warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="p-6 border-t border-gray-700 flex justify-end space-x-3">
            <button
              onClick={closeUploadModal}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              disabled={uploadProgress === 'uploading'}
            >
              Cancel
            </button>
            <button
              onClick={handleUploadSubmit}
              disabled={!selectedFile || uploadProgress === 'uploading'}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {uploadProgress === 'uploading' ? 'Uploading...' : 'Upload File'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Mapping Modal Component
  const MappingModal = () => {
    const [mappingData, setMappingData] = useState({
      nap_id: '',
      digitmap_file_id: '',
      dialformat_file_id: '',
      mapped_by: 'admin'
    });
    const [suggestions, setSuggestions] = useState([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);

    // Reset modal state when modal opens/closes
    useEffect(() => {
      if (!showMappingModal) {
        setMappingData({
          nap_id: '',
          digitmap_file_id: '',
          dialformat_file_id: '',
          mapped_by: 'admin'
        });
        setSuggestions([]);
        setLoadingSuggestions(false);
      }
    }, [showMappingModal]);

    if (!showMappingModal) return null;

    const loadMappingSuggestions = async (napId) => {
      if (!napId) {
        setSuggestions([]);
        return;
      }
      
      setLoadingSuggestions(true);
      try {
        const result = await fileService.generateMappingSuggestions(napId);
        if (result.success) {
          setSuggestions(result.suggestions);
        } else {
          setSuggestions([]);
        }
      } catch (error) {
        console.error('Error loading suggestions:', error);
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    };

    const handleNapIdChange = (napId) => {
      setMappingData({ ...mappingData, nap_id: napId });
      loadMappingSuggestions(napId);
    };

    const applySuggestion = (suggestion) => {
      setMappingData({
        ...mappingData,
        digitmap_file_id: suggestion.digitmap_file_id,
        dialformat_file_id: suggestion.dialformat_file_id
      });
    };

    const handleMappingSubmit = async () => {
      if (!mappingData.nap_id || !mappingData.digitmap_file_id || !mappingData.dialformat_file_id) {
        setError('Please fill in all required fields');
        return;
      }

      try {
        const result = await dbService.createFileMapping(mappingData);
        if (result.success) {
          closeMappingModal();
          loadData();
        } else {
          setError('Mapping creation failed: ' + (result.error || 'Unknown error'));
        }
      } catch (error) {
        setError('Mapping error: ' + error.message);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-60">
        <div className="bg-gray-800 rounded-lg w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <h3 className="text-xl font-bold text-white">Create File Mapping</h3>
            <button onClick={closeMappingModal} className="text-gray-400 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Mapping Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    NAP ID *
                  </label>
                  <input
                    type="text"
                    value={mappingData.nap_id}
                    onChange={(e) => handleNapIdChange(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter NAP ID"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Digit Map File ID *
                  </label>
                  <input
                    type="text"
                    value={mappingData.digitmap_file_id}
                    onChange={(e) => setMappingData({ ...mappingData, digitmap_file_id: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter DM File ID"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Dial Format File ID *
                  </label>
                  <input
                    type="text"
                    value={mappingData.dialformat_file_id}
                    onChange={(e) => setMappingData({ ...mappingData, dialformat_file_id: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter DF File ID"
                  />
                </div>
              </div>

              {/* Mapping Suggestions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-medium text-white">Mapping Suggestions</h4>
                  {loadingSuggestions && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                  )}
                </div>
                
                {suggestions.length === 0 && !loadingSuggestions && mappingData.nap_id && (
                  <div className="text-center text-gray-400 py-4">
                    <p>No mapping suggestions available for this NAP ID.</p>
                    <p className="text-sm">Make sure DM and DF files are uploaded first.</p>
                  </div>
                )}

                {suggestions.length === 0 && !mappingData.nap_id && (
                  <div className="text-center text-gray-400 py-4">
                    <p>Enter a NAP ID to see mapping suggestions.</p>
                  </div>
                )}
                
                {suggestions.length > 0 && (
                  <div className="space-y-3">
                    {suggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className="bg-gray-700 p-4 rounded-lg border border-gray-600 hover:border-blue-500 transition-colors cursor-pointer"
                        onClick={() => applySuggestion(suggestion)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-white">
                            Suggestion {index + 1}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            suggestion.confidence >= 80 
                              ? 'bg-green-600 text-white' 
                              : suggestion.confidence >= 60 
                              ? 'bg-yellow-600 text-white'
                              : 'bg-red-600 text-white'
                          }`}>
                            {suggestion.confidence.toFixed(0)}% confidence
                          </span>
                        </div>
                        
                        <div className="text-sm text-gray-300 space-y-1">
                          <div><strong>DM File:</strong> {suggestion.dm_filename}</div>
                          <div><strong>DF File:</strong> {suggestion.df_filename}</div>
                          {suggestion.shared_routesets.length > 0 && (
                            <div><strong>Shared Routesets:</strong> {suggestion.shared_routesets.join(', ')}</div>
                          )}
                        </div>
                        
                        <div className="mt-2 text-xs text-blue-400">
                          Click to apply this suggestion
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="p-6 border-t border-gray-700 flex justify-end space-x-3">
            <button
              onClick={closeMappingModal}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleMappingSubmit}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Create Mapping
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDataTable = () => {
    if (filteredData.length === 0) return null;

    switch (activeTab) {
      case 'naps':
        return renderNapTable();
      case 'digitMaps':
        return renderDigitMapTable();
      case 'dialFormats':
        return renderDialFormatTable();
      case 'mappings':
        return renderMappingTable();
      case 'prosbcFiles':
        return renderProsbcFilesTable();
      default:
        return renderNapTable();
    }
  };

  const renderNapTable = () => (
    <div className="bg-gray-700 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-600">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                NAP ID / Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Created By
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Created Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Last Modified
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-600">
            {filteredData.map((nap, index) => (
              <tr key={nap.nap_id || nap.id || index} className="hover:bg-gray-600 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col">
                    <div className="text-sm font-medium text-white">
                      {nap.name || nap.napName || nap.nap_id || 'Unnamed NAP'}
                    </div>
                    {nap.name && nap.nap_id && (
                      <div className="text-xs text-gray-400">ID: {nap.nap_id}</div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${getStatusColor(nap.status)}`}>
                    <span className="mr-1">{getStatusIcon(nap.status)}</span>
                    {(nap.status || 'Unknown').charAt(0).toUpperCase() + (nap.status || 'unknown').slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {nap.created_by || 'System'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {formatDate(nap.created_at || nap.createdAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {formatDate(nap.updated_at || nap.modified_at)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleViewJson(nap)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-400 hover:text-blue-300 hover:bg-blue-400 hover:bg-opacity-10 transition-colors"
                    >
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      View JSON
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderDigitMapTable = () => (
    <div className="bg-gray-700 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-600">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Filename
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Routeset Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                NAP ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                File Size
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Upload Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-600">
            {filteredData.map((dm, index) => (
              <tr key={dm.id || index} className="hover:bg-gray-600 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col">
                    <div className="text-sm font-medium text-white">{dm.filename}</div>
                    <div className="text-xs text-gray-400">{dm.original_filename}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {dm.routeset_name || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {dm.nap_id || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${getStatusColor(dm.status)}`}>
                    <span className="mr-1">{getStatusIcon(dm.status)}</span>
                    {(dm.status || 'Unknown').charAt(0).toUpperCase() + (dm.status || 'unknown').slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {dm.file_size ? `${(dm.file_size / 1024).toFixed(1)} KB` : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {formatDate(dm.upload_time)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleViewJson(dm)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-400 hover:text-blue-300 hover:bg-blue-400 hover:bg-opacity-10 transition-colors"
                    >
                      View Details
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderDialFormatTable = () => (
    <div className="bg-gray-700 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-600">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Filename
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Routeset Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                NAP ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                File Size
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Upload Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-600">
            {filteredData.map((df, index) => (
              <tr key={df.id || index} className="hover:bg-gray-600 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col">
                    <div className="text-sm font-medium text-white">{df.filename}</div>
                    <div className="text-xs text-gray-400">{df.original_filename}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {df.routeset_name || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {df.nap_id || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${getStatusColor(df.status)}`}>
                    <span className="mr-1">{getStatusIcon(df.status)}</span>
                    {(df.status || 'Unknown').charAt(0).toUpperCase() + (df.status || 'unknown').slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {df.file_size ? `${(df.file_size / 1024).toFixed(1)} KB` : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {formatDate(df.upload_time)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleViewJson(df)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-400 hover:text-blue-300 hover:bg-blue-400 hover:bg-opacity-10 transition-colors"
                    >
                      View Details
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderMappingTable = () => (
    <div className="bg-gray-700 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-600">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                NAP ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                DM File
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                DF File
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Generation Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Activation Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-600">
            {filteredData.map((mapping, index) => (
              <tr key={mapping.id || index} className="hover:bg-gray-600 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                  {mapping.nap_id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {mapping.digitmap_file_id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {mapping.dialformat_file_id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${getStatusColor(mapping.status)}`}>
                    <span className="mr-1">{getStatusIcon(mapping.status)}</span>
                    {(mapping.status || 'Unknown').charAt(0).toUpperCase() + (mapping.status || 'unknown').slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${getStatusColor(mapping.generation_status)}`}>
                    {mapping.generation_status === 'success' ? '✅' : mapping.generation_status === 'failed' ? '❌' : '⏳'}
                    {(mapping.generation_status || 'pending').charAt(0).toUpperCase() + (mapping.generation_status || 'pending').slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${getStatusColor(mapping.activation_status)}`}>
                    {mapping.activation_status === 'success' ? '✅' : mapping.activation_status === 'failed' ? '❌' : '⏳'}
                    {(mapping.activation_status || 'pending').charAt(0).toUpperCase() + (mapping.activation_status || 'pending').slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleViewJson(mapping)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-400 hover:text-blue-300 hover:bg-blue-400 hover:bg-opacity-10 transition-colors"
                    >
                      View Details
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderProsbcFilesTable = () => (
    <div className="bg-gray-700 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-600">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Filename
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                File Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                NAP ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                File Size
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Last Modified
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Source
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-600">
            {filteredData.map((file, index) => (
              <tr key={file.id || index} className="hover:bg-gray-600 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col">
                    <div className="text-sm font-medium text-white">{file.filename}</div>
                    <div className="text-xs text-gray-400">{file.original_filename}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${
                    file.file_type === 'dm' ? 'bg-blue-600' : 'bg-purple-600'
                  }`}>
                    {file.file_type === 'dm' ? '📊 DM' : '📞 DF'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {file.nap_id || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${getStatusColor(file.status)}`}>
                    <span className="mr-1">{getStatusIcon(file.status)}</span>
                    {(file.status || 'Unknown').charAt(0).toUpperCase() + (file.status || 'unknown').slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {file.file_size ? `${(file.file_size / 1024).toFixed(1)} KB` : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {formatDate(file.last_modified || file.upload_time)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${
                    file.source === 'prosbc' ? 'bg-orange-600' : 'bg-green-600'
                  }`}>
                    {file.source === 'prosbc' ? '🏭 ProSBC' : '📱 GUI'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleViewJson(file)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-400 hover:text-blue-300 hover:bg-blue-400 hover:bg-opacity-10 transition-colors"
                    >
                      View Details
                    </button>
                    {file.source === 'prosbc' && (
                      <button
                        onClick={() => handleImportProsbcFile(file)}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-green-400 hover:text-green-300 hover:bg-green-400 hover:bg-opacity-10 transition-colors"
                      >
                        Import
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const handleImportProsbcFile = async (file) => {
    setLoading(true);
    setError(null);
    try {
      const result = await dbService.importProsbcFile(file.id);
      
      if (result.success) {
        setError(`Successfully imported ${file.filename} to local database`);
        setTimeout(() => setError(null), 5000);
        // Refresh the current tab to show imported file
        loadData();
      } else {
        setError('Failed to import file: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error importing ProSBC file:', error);
      setError('Error importing file: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-7xl mx-4 h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-4">
            <h2 className="text-2xl font-bold text-white">Database Management</h2>
            {loading && (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="created">Created</option>
              <option value="mapped">Mapped</option>
              <option value="activated">Activated</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="uploaded">Uploaded</option>
              <option value="validated">Validated</option>
              <option value="pending">Pending</option>
              <option value="error">Error</option>
            </select>
            
            {/* Search */}
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Search
              </button>
            </div>
            
            {/* Upload Button for DM/DF tabs */}
            {(activeTab === 'digitMaps' || activeTab === 'dialFormats') && (
              <button
                onClick={handleUpload}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Upload {activeTab === 'digitMaps' ? 'DM' : 'DF'} File
              </button>
            )}
            
            {/* Create Mapping Button */}
            {activeTab === 'mappings' && (
              <button
                onClick={handleCreateMapping}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Create Mapping
              </button>
            )}
            
            {/* Sync ProSBC Files Button */}
            {activeTab === 'prosbcFiles' && (
              <button
                onClick={handleSyncProsbcFiles}
                disabled={loading}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
              >
                Sync ProSBC Files
              </button>
            )}
            
            <button
              onClick={loadData}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              Refresh
            </button>
            
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-700 bg-gray-750">
          {[
            { id: 'naps', label: 'NAPs', icon: '🏠' },
            { id: 'digitMaps', label: 'Digit Maps (DM)', icon: '📊' },
            { id: 'dialFormats', label: 'Dial Formats (DF)', icon: '📞' },
            { id: 'mappings', label: 'File Mappings', icon: '🔗' },
            { id: 'prosbcFiles', label: 'ProSBC Files', icon: '🏭' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'text-blue-400 border-blue-400 bg-gray-800'
                  : 'text-gray-400 border-transparent hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Stats Bar */}
        <div className="px-6 py-4 bg-gray-750 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="text-sm text-gray-300">
                <span className="font-medium text-white">{filteredData.length}</span> {activeTab}
                {statusFilter !== 'all' && (
                  <span className="ml-2 text-gray-400">({statusFilter})</span>
                )}
              </div>
              
              <div className="flex items-center space-x-4 text-sm">
                {['created', 'mapped', 'activated', 'active', 'uploaded', 'validated', 'pending'].map(status => {
                  const count = getCurrentData().filter(item => item.status?.toLowerCase() === status).length;
                  if (count > 0) {
                    return (
                      <div key={status} className="flex items-center space-x-1">
                        <span className={`w-2 h-2 rounded-full ${getStatusColor(status)}`}></span>
                        <span className="text-gray-300 capitalize">{status}: {count}</span>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="p-4 mx-6 mt-4 bg-red-600 bg-opacity-20 border border-red-600 rounded-lg">
              <p className="text-red-400">{error}</p>
            </div>
          )}
          
          {!loading && filteredData.length === 0 && !error && (
            <div className="text-center text-gray-400 py-12">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-300 mb-2">No {activeTab} Found</h3>
              <p className="text-gray-500">
                {searchQuery ? `No ${activeTab} match your search criteria.` : `No ${activeTab} have been created yet.`}
              </p>
            </div>
          )}
          
          {renderDataTable()}
        </div>
      </div>
      
      <JsonModal />
      <UploadModal />
      <MappingModal />
    </div>
  );
};

export default DatabaseDashboard;
