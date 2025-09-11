  // Helper to get auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('dashboard_token');
    return token ? { 'Authorization': 'Bearer ' + token } : {};
  };
import React, { useState, useEffect } from 'react';
import { prosbcFileAPI } from '../utils/prosbcFileApi';
import { csvFileUpdateService } from '../utils/csvFileUpdateService';
import { fileManagementService } from '../utils/fileManagementService';
import CSVEditorTable from './CSVEditorTable';

const CSVFileEditor = ({ onClose, onAuthError, selectedFile: preSelectedFile, onSave }) => {
  const [currentView, setCurrentView] = useState('select'); 
  const [availableFiles, setAvailableFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [csvContent, setCsvContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [backupFiles, setBackupFiles] = useState([]);
  const [showBackups, setShowBackups] = useState(false);

  // Load available files on component mount
  useEffect(() => {
    loadAvailableFiles();
    loadBackupFiles();
    
    // If a file is pre-selected, load it directly
    if (preSelectedFile) {
      handlePreSelectedFile(preSelectedFile);
    }
  }, [preSelectedFile]);

  // Handle pre-selected file
  const handlePreSelectedFile = async (file) => {
    try {
      setIsLoading(true);
      setMessage('Loading selected file...');
      
      console.log('🎯 Processing pre-selected file:', file);
      console.log('📋       cd "c:\Users\anant\OneDrive\Dokumen\prosbc\prosbc-automation\frontend"; npm run dev file properties:', {
        id: file.id,
        prosbcId: file.prosbcId,
        name: file.name,
        fileName: file.fileName,
        type: file.type,
        fileType: file.fileType,
        source: file.source,
        hasContent: file.hasContent,
        fileDbId: file.fileDbId,
        routesetId: file.routesetId
      });
      
      // Convert the file to the format expected by the editor
      const fileForEditor = {
        id: file.id || file.prosbcId,
        name: file.name || file.fileName,
        type: file.type || file.fileType,
        fileType: file.fileType || file.type,
        prosbcId: file.prosbcId || file.id,
        fileDbId: file.fileDbId || 1,
        routesetId: file.routesetId || file.prosbcId || file.id,
        source: file.source || (file.prosbcId ? 'database' : 'prosbc'),
        hasContent: file.hasContent || file.content,
        // Preserve all original properties for debugging
        ...file
      };
      
      console.log('🔄 Converted file for editor:', fileForEditor);
      console.log('🧩 Key properties check:', {
        fileType: fileForEditor.fileType,
        isDigitMap: fileForEditor.fileType === 'routesets_digitmaps',
        routesetId: fileForEditor.routesetId,
        prosbcId: fileForEditor.prosbcId,
        id: fileForEditor.id
      });
      
      // Use the existing file selection logic
      await handleFileSelect(fileForEditor);
      
    } catch (error) {
      console.error('Error loading pre-selected file:', error);
      setError('Failed to load the selected file');
      setIsLoading(false);
    }
  };

  // Load available files from database and ProSBC
  const loadAvailableFiles = async () => {
    setIsLoading(true);
    try {
      setMessage('Loading available files...');
      
      // Get files from local database
      const storedResult = await fileManagementService.getStoredFiles();
      
      // Get files from ProSBC
      const [dfResult, dmResult] = await Promise.all([
        prosbcFileAPI.listDfFiles(getAuthHeaders()),
        prosbcFileAPI.listDmFiles(getAuthHeaders())
      ]);
      
      const allFiles = [];
      
      // Add stored files
      if (storedResult.success) {
        storedResult.files.forEach(file => {
          allFiles.push({
            id: file.id,
            name: file.fileName,
            type: file.fileType,
            source: 'database',
            prosbcId: file.prosbcId,
            fileDbId: 1,
            routesetId: file.prosbcId,
            fileType: file.fileType,
            hasContent: !!file.content,
            lastModified: file.lastModified,
            metadata: file.metadata
          });
        });
      }
      
      // Add ProSBC files
      if (dfResult.success) {
        dfResult.files.forEach(file => {
          const existingFile = allFiles.find(f => f.prosbcId === file.id);
          if (!existingFile) {
            allFiles.push({
              id: file.id,
              name: file.name,
              type: file.type,
              source: 'prosbc',
              prosbcId: file.id,
              fileDbId: 1,
              routesetId: file.id,
              fileType: 'routesets_definitions',
              hasContent: false,
              updateUrl: file.updateUrl,
              exportUrl: file.exportUrl,
              deleteUrl: file.deleteUrl
            });
          }
        });
      }
      
      if (dmResult.success) {
        dmResult.files.forEach(file => {
          const existingFile = allFiles.find(f => f.prosbcId === file.id);
          if (!existingFile) {
            allFiles.push({
              id: file.id,
              name: file.name,
              type: file.type,
              source: 'prosbc',
              prosbcId: file.id,
              fileDbId: 1,
              routesetId: file.id,
              fileType: 'routesets_digitmaps',
              hasContent: false,
              updateUrl: file.updateUrl,
              exportUrl: file.exportUrl,
              deleteUrl: file.deleteUrl
            });
          }
        });
      }
      
      setAvailableFiles(allFiles);
      setMessage(`Found ${allFiles.length} files available for editing`);
      
    } catch (error) {
      console.error('Error loading files:', error);
      setError(`Failed to load files: ${error.message}`);
      
      if (error.message.includes('401') || error.message.includes('authentication')) {
        onAuthError?.();
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Load backup files
  const loadBackupFiles = () => {
    try {
      const backups = csvFileUpdateService.getBackupFiles();
      setBackupFiles(backups);
    } catch (error) {
      console.error('Error loading backup files:', error);
    }
  };

  // Handle file selection
  const handleFileSelect = async (file) => {
    setIsLoading(true);
    setError('');
    setMessage('');
    
    try {
      setMessage(`Loading file: ${file.name}`);
      setSelectedFile(file);
      
      let content = '';
      
      // Check if content is already provided in the file object
      if (file.content) {
        console.log('[CSVEditor] Using pre-loaded content');
        content = file.content;
      } else if (file.hasContent && file.source === 'database') {
        // Get content from database
        const storedFiles = await fileManagementService.getStoredFiles();
        if (storedFiles.success) {
          const storedFile = storedFiles.files.find(f => f.id === file.id);
          if (storedFile && storedFile.content) {
            content = storedFile.content;
          }
        }
      }
      
      // If no content from database or pre-loaded, try to get from backend API
      if (!content) {
        setMessage('Fetching file content from backend...');
        try {
          const res = await fetch(`/backend/api/prosbc-files/content?fileType=${encodeURIComponent(file.fileType)}&fileId=${encodeURIComponent(file.prosbcId)}`, { headers: getAuthHeaders() });
          const result = await res.json();
          if (result.success && result.content) {
            content = result.content;
          } else {
            throw new Error(result.message || 'Failed to get file content from backend');
          }
        } catch (err) {
          throw new Error('Failed to get file content from backend: ' + err.message);
        }
      }
      
      // Validate that it's CSV content
      if (!content || !content.trim()) {
        throw new Error('File appears to be empty');
      }
      
      // Basic CSV validation
      const lines = content.trim().split('\n');
      if (lines.length < 2) {
        throw new Error('File must have at least a header row and one data row');
      }
      
      setCsvContent(content);
      setCurrentView('edit');
      setMessage('File loaded successfully');
      
    } catch (error) {
      console.error('Error loading file:', error);
      setError(`Failed to load file: ${error.message}`);
      setSelectedFile(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.includes('csv') && !file.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('Reading uploaded file...');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        
        // Basic validation
        if (!content || !content.trim()) {
          throw new Error('File is empty');
        }
        
        const lines = content.trim().split('\n');
        if (lines.length < 2) {
          throw new Error('File must have at least a header row and one data row');
        }
        
        setCsvContent(content);
        setUploadedFile({
          name: file.name,
          size: file.size,
          type: 'uploaded',
          isNew: true
        });
        setCurrentView('edit');
        setMessage('File uploaded successfully');
        
      } catch (error) {
        console.error('Error reading file:', error);
        setError(`Failed to read file: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    reader.onerror = () => {
      setError('Failed to read file');
      setIsLoading(false);
    };
    
    reader.readAsText(file);
  };

  // Handle CSV save
  const handleCSVSave = async (updatedCsvContent, result) => {
    setIsLoading(true);
    setError('');
    setMessage('Saving file...');
    try {
      // Determine file info
      const fileInfo = selectedFile || uploadedFile;
      if (!fileInfo) throw new Error('No file selected for update');

      // If a custom onSave callback is provided, use it
      if (onSave && typeof onSave === 'function') {
        console.log('[CSVEditor] Using custom save callback');
        await onSave(updatedCsvContent, fileInfo);
        setMessage('✅ File saved successfully!');
        // Go back to select view
        setCurrentView('select');
        setSelectedFile(null);
        setCsvContent('');
        setUploadedFile(null);
        return;
      }

      // Otherwise, use the default save method
      console.log('[CSVEditor] Using default save method');
      
      // Prepare FormData
      const formData = new FormData();
      // Create a Blob from the updated CSV content
      const blob = new Blob([updatedCsvContent], { type: 'text/csv' });
      const fileName = fileInfo.name || fileInfo.fileName || `updated_${Date.now()}.csv`;
      formData.append('file', blob, fileName);
      formData.append('fileType', fileInfo.fileType || fileInfo.type);
      formData.append('fileId', fileInfo.prosbcId || fileInfo.id);
      // Send to backend
      const res = await fetch('/backend/api/prosbc-files/update', {
        method: 'POST',
        body: formData,
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setMessage('✅ File updated successfully!');
        // Refresh available files
        await loadAvailableFiles();
        // Go back to select view
        setCurrentView('select');
        setSelectedFile(null);
        setCsvContent('');
        setUploadedFile(null);
      } else {
        throw new Error(data.message || 'Update failed');
      }
    } catch (error) {
      console.error('Error updating file:', error);
      setError(`Update failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle CSV cancel
  const handleCSVCancel = () => {
    if (confirm('Are you sure you want to cancel? Any unsaved changes will be lost.')) {
      setCurrentView('select');
      setSelectedFile(null);
      setCsvContent('');
      setUploadedFile(null);
      setError('');
      setMessage('');
    }
  };

  // Handle progress updates
  const handleProgress = (percent, statusMessage) => {
    setProgress(percent);
    setMessage(statusMessage);
  };

  // Handle backup restore
  const handleBackupRestore = async (backup) => {
    try {
      const backupData = csvFileUpdateService.restoreFromBackup(backup.key);
      
      setCsvContent(backupData.content);
      setSelectedFile(backupData.originalFile);
      setCurrentView('edit');
      setMessage(`Backup restored: ${backup.originalFile.name}`);
      setShowBackups(false);
      
    } catch (error) {
      console.error('Error restoring backup:', error);
      setError(`Failed to restore backup: ${error.message}`);
    }
  };

  // Handle backup delete
  const handleBackupDelete = (backupKey) => {
    if (confirm('Are you sure you want to delete this backup?')) {
      csvFileUpdateService.deleteBackup(backupKey);
      loadBackupFiles();
      setMessage('Backup deleted');
    }
  };

  // Filter files by type
  const filterFilesByType = (type) => {
    if (type === 'all') return availableFiles;
    return availableFiles.filter(file => 
      file.fileType === type || file.type === type
    );
  };

  // Render file selection view
  const renderFileSelection = () => (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="text-center">
        <div className="bg-blue-600 w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">CSV File Editor</h2>
        <p className="text-gray-300">Select a CSV file to edit or upload a new one</p>
      </div>

      {/* Upload Section */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <div className="flex items-center mb-4">
          <div className="bg-green-600 p-2 rounded-lg mr-3">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white">Upload New CSV File</h3>
        </div>
        
        <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-blue-500 transition-colors duration-200">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            disabled={isLoading}
            className="hidden"
            id="csv-upload"
          />
          <label 
            htmlFor="csv-upload" 
            className={`cursor-pointer block ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span className="text-gray-300 text-lg font-medium">Click to select a CSV file</span>
            <p className="text-gray-500 text-sm mt-2">or drag and drop your file here</p>
          </label>
        </div>
      </div>

      {/* Available Files Section */}
      <div className="bg-gray-800 rounded-xl border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="bg-blue-600 p-2 rounded-lg mr-3">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white">Available Files</h3>
            </div>
            <button 
              onClick={loadAvailableFiles}
              disabled={isLoading}
              className="inline-flex items-center px-3 py-2 border border-gray-600 rounded-lg text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 hover:text-white transition-colors duration-200 disabled:opacity-50"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>

          {/* File Type Filter */}
          <div className="mt-4">
            <select 
              onChange={(e) => setCurrentView(e.target.value)} 
              value="select"
              className="block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="select">All Files</option>
              <option value="routesets_definitions">Definition Files</option>
              <option value="routesets_digitmaps">Digit Map Files</option>
            </select>
          </div>
        </div>

        {/* Files List */}
        <div className="p-6">
          {availableFiles.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-16 h-16 text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-400 text-lg">No files available</p>
              <p className="text-gray-500 text-sm">Upload a file or sync from ProSBC</p>
            </div>
          ) : (
            <div className="space-y-3">
              {availableFiles.map(file => (
                <div key={`${file.source}-${file.id}`} className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center mb-2">
                        <svg className="w-5 h-5 text-blue-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h4 className="text-white font-medium truncate">{file.name}</h4>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          file.fileType === 'routesets_definitions' 
                            ? 'bg-blue-900 text-blue-200' 
                            : 'bg-purple-900 text-purple-200'
                        }`}>
                          {file.fileType === 'routesets_definitions' ? 'Definition' : 'Digit Map'}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          file.source === 'database' 
                            ? 'bg-green-900 text-green-200' 
                            : 'bg-orange-900 text-orange-200'
                        }`}>
                          {file.source === 'database' ? 'Local' : 'ProSBC'}
                        </span>
                        {file.lastModified && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-600 text-gray-200">
                            {new Date(file.lastModified).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleFileSelect(file)}
                      disabled={isLoading}
                      className="ml-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 flex-shrink-0"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Backup Files Section */}
      <div className="bg-gray-800 rounded-xl border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="bg-yellow-600 p-2 rounded-lg mr-3">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white">Backup Files</h3>
            </div>
            <button 
              onClick={() => setShowBackups(!showBackups)}
              className="inline-flex items-center px-3 py-2 border border-gray-600 rounded-lg text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 hover:text-white transition-colors duration-200"
            >
              <svg className={`w-4 h-4 mr-2 transform transition-transform duration-200 ${showBackups ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              {backupFiles.length} backups
            </button>
          </div>
        </div>

        {showBackups && (
          <div className="p-6">
            {backupFiles.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No backup files found</p>
            ) : (
              <div className="space-y-3">
                {backupFiles.map(backup => (
                  <div key={backup.key} className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center mb-2">
                          <svg className="w-5 h-5 text-yellow-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <h4 className="text-white font-medium truncate">{backup.originalFile.name}</h4>
                        </div>
                        <p className="text-gray-400 text-sm">
                          Created: {new Date(backup.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => handleBackupRestore(backup)}
                          className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors duration-200"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Restore
                        </button>
                        <button
                          onClick={() => handleBackupDelete(backup.key)}
                          className="inline-flex items-center px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors duration-200"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Render CSV editor view
  const renderCSVEditor = () => (
    <div className="h-full flex flex-col">
      {/* Editor Header */}
      <div className="bg-gray-800 px-6 py-4 border-b border-gray-700 flex-shrink-0 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button 
              onClick={handleCSVCancel}
              className="inline-flex items-center px-3 py-2 border border-gray-600 rounded-lg text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 hover:text-white transition-colors duration-200 mr-4"
              disabled={isLoading}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Files
            </button>
            <div>
              <h2 className="text-xl font-bold text-white">
                {selectedFile?.name || uploadedFile?.name}
              </h2>
              <p className="text-gray-400 text-sm">
                Editing CSV file content
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="text-sm text-gray-400">
              Ready for editing
            </div>
          </div>
        </div>
      </div>

      {/* CSV Editor Table - Takes remaining height */}
      <div className="flex-1 min-h-0 bg-gray-900 rounded-b-xl overflow-hidden">
        <CSVEditorTable
          csvData={csvContent}
          onSave={handleCSVSave}
          onCancel={handleCSVCancel}
          isLoading={isLoading}
          fileInfo={selectedFile || uploadedFile}
          onProgress={handleProgress}
        />
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-gray-900/95 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-white">CSV File Editor</h1>
            </div>
            <button 
              onClick={onClose} 
              className="inline-flex items-center px-4 py-2 border border-gray-600 rounded-lg text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 hover:text-white transition-colors duration-200"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {isLoading && (
        <div className="flex-shrink-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="w-full bg-gray-700 rounded-full h-2 mb-3">
              <div 
                className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all duration-300 ease-out" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-center text-gray-300 text-sm font-medium">{message}</p>
          </div>
        </div>
      )}

      {/* Status Messages */}
      <div className="flex-shrink-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-4 bg-red-900/20 border border-red-600 text-red-300 px-4 py-3 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <strong className="font-medium">Error:</strong> <span className="ml-1">{error}</span>
            </div>
          </div>
        )}

        {message && !error && !isLoading && (
          <div className="mb-4 bg-green-900/20 border border-green-600 text-green-300 px-4 py-3 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {message}
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentView === 'select' && renderFileSelection()}
        {currentView === 'edit' && renderCSVEditor()}
      </div>
    </div>
  );
};

export default CSVFileEditor;
