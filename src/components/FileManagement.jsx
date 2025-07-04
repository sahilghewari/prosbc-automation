import React, { useState, useEffect, useRef } from 'react';
import { prosbcFileAPI } from '../utils/prosbcFileApi';
import { fileManagementService } from '../utils/fileManagementService';
import { fileDatabase } from '../utils/fileDatabase';
//import { fileExportService } from '../utils/fileExportService';
import { enhancedFileStorageService } from '../utils/enhancedFileStorageService';
import { updateFile, updateMultipleFiles, testConnection, getUpdateStatus, getUpdateHistory } from '../utils/fileUpdateService';
import FileEditor from './FileEditor';
import CSVFileEditor from './CSVFileEditor';
import DatabaseStatus from './DatabaseStatus';

function FileManagement({ onAuthError }) {
  const [activeTab, setActiveTab] = useState('database');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  
  // File lists (ProSBC direct)
  const [dfFiles, setDfFiles] = useState([]);
  const [dmFiles, setDmFiles] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  
  // Database files
  const [storedFiles, setStoredFiles] = useState([]);
  const [databaseStats, setDatabaseStats] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFileType, setSelectedFileType] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // File update functionality
  const [selectedFile, setSelectedFile] = useState(null);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateMessage, setUpdateMessage] = useState('');
  const [updateResult, setUpdateResult] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [updateHistory, setUpdateHistory] = useState([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateTarget, setUpdateTarget] = useState(null); // { fileDbId, routesetId, fileName, fileType }
  const fileInputRef = useRef(null);

  // File editor functionality
  const [showFileEditor, setShowFileEditor] = useState(false);
  const [editingFile, setEditingFile] = useState(null);

  // CSV file editor functionality
  const [showCSVEditor, setShowCSVEditor] = useState(false);
  const [selectedCSVFile, setSelectedCSVFile] = useState(null);

  // Load files on component mount
  useEffect(() => {
    loadFiles();
    loadStoredFiles();
    loadDatabaseStats();
    loadUpdateHistory();
  }, []);

  // Load stored files when search term or file type changes
  useEffect(() => {
    loadStoredFiles();
  }, [searchTerm, selectedFileType, selectedCategory]);

  // Load all files
  const loadFiles = async () => {
    setRefreshing(true);
    try {
      const [dfResult, dmResult] = await Promise.all([
        prosbcFileAPI.listDfFiles(),
        prosbcFileAPI.listDmFiles()
      ]);
      
      if (dfResult.success) {
        setDfFiles(dfResult.files);
      }
      
      if (dmResult.success) {
        setDmFiles(dmResult.files);
      }
      
      setMessage("✅ File lists refreshed successfully!");
      setTimeout(() => setMessage(""), 3000);
      
    } catch (error) {
      console.error('Load files error:', error);
      setMessage(`❌ Failed to load files: ${error.message}`);
      if (error.message.includes('401') || error.message.includes('authentication')) {
        onAuthError?.();
      }
    } finally {
      setRefreshing(false);
    }
  };

  // Export file
  const handleExport = async (fileType, fileId, fileName) => {
    setIsLoading(true);
    setMessage(`🔄 Exporting ${fileName}...`);
    
    try {
      const result = await prosbcFileAPI.exportFile(fileType, fileId, fileName);
      if (result.success) {
        setMessage(`✅ ${result.message}`);
      }
    } catch (error) {
      console.error('Export error:', error);
      setMessage(`❌ Export failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete file
  const handleDelete = async (fileType, fileId, fileName) => {
    if (!window.confirm(`Are you sure you want to delete '${fileName}'?\n\nThis action cannot be undone.`)) {
      return;
    }
    
    setIsLoading(true);
    setMessage(`🔄 Deleting ${fileName}...`);
    
    try {
      const result = await prosbcFileAPI.deleteFile(fileType, fileId, fileName);
      if (result.success) {
        setMessage(`✅ ${result.message}`);
        // Refresh file lists after successful deletion
        setTimeout(() => loadFiles(), 1000);
      }
    } catch (error) {
      console.error('Delete error:', error);
      let errorMessage = error.message;
      
      // Provide more specific error messages
      if (error.message.includes('CSRF token')) {
        errorMessage = 'Authentication failed. Please refresh the page and try again.';
      } else if (error.message.includes('401') || error.message.includes('authentication')) {
        errorMessage = 'Your session has expired. Please log in again.';
        onAuthError?.();
      } else if (error.message.includes('404')) {
        errorMessage = 'File not found. It may have been already deleted.';
        // Refresh file list to update state
        setTimeout(() => loadFiles(), 1000);
      } else if (error.message.includes('403')) {
        errorMessage = 'Permission denied. You may not have rights to delete this file.';
      }
      
      setMessage(`❌ Delete failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };





  // Check system status
  const handleSystemStatusCheck = async () => {
    setIsLoading(true);
    setMessage("🔄 Checking ProSBC system status...");
    
    try {
      const result = await prosbcFileAPI.getSystemStatus();
      if (result.isOnline) {
        setMessage(`✅ ProSBC system is online and accessible (Status: ${result.status})`);
      } else {
        setMessage(`❌ ProSBC system check failed (Status: ${result.status}, Code: ${result.statusCode})`);
        if (result.statusCode === 401) {
          onAuthError?.();
        }
      }
    } catch (error) {
      console.error('System status check error:', error);
      setMessage(`❌ System status check failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Load stored files from database
  const loadStoredFiles = async () => {
    try {
      let result;
      
      if (searchTerm) {
        // Search files
        const fileType = selectedFileType === 'all' ? null : selectedFileType;
        result = await fileManagementService.searchStoredFiles(searchTerm, fileType);
      } else if (selectedFileType === 'all') {
        // Get all files
        result = await fileManagementService.getStoredFiles();
      } else {
        // Get files by type
        result = await fileManagementService.getStoredFilesByType(selectedFileType);
      }
      
      if (result.success) {
        let files = result.files;
        
        // Filter by category if selected
        if (selectedCategory !== 'all') {
          files = files.filter(file => {
            if (file.fileType === 'routesets_definitions' && file.dfSpecific) {
              return enhancedFileStorageService.categorizeDfFile(file) === selectedCategory;
            } else if (file.fileType === 'routesets_digitmaps' && file.dmSpecific) {
              return enhancedFileStorageService.categorizeDmFile(file) === selectedCategory;
            }
            return false;
          });
        }
        
        setStoredFiles(files);
      }
    } catch (error) {
      console.error('Load stored files error:', error);
      setMessage(`❌ Failed to load stored files: ${error.message}`);
    }
  };

  // Load database statistics
  const loadDatabaseStats = async () => {
    try {
      const result = await fileManagementService.getDatabaseStats();
      if (result.success) {
        setDatabaseStats(result.stats);
      }
    } catch (error) {
      console.error('Load database stats error:', error);
    }
  };

  // Fetch and store files from ProSBC
  const fetchAndStoreFiles = async () => {
    setIsLoading(true);
    setMessage("🔄 Fetching files from ProSBC with enhanced separation...");
    
    try {
      const result = await enhancedFileStorageService.fetchAndStoreFilesSeparately((progress, status) => {
        setMessage(`🔄 ${status} (${Math.round(progress)}%)`);
      });
      
      if (result.success) {
        setMessage(`✅ Fetched and stored ${result.summary.stats.totalFiles} files successfully! (${result.summary.stats.dfFiles} DF, ${result.summary.stats.dmFiles} DM)`);
        if (result.summary.stats.errors > 0) {
          setMessage(prev => prev + ` (${result.summary.stats.errors} errors)`);
        }
        
        // Refresh both lists
        loadStoredFiles();
        loadDatabaseStats();
        loadFiles();
      }
    } catch (error) {
      console.error('Fetch and store files error:', error);
      setMessage(`❌ Failed to fetch files: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Sync file to ProSBC
  const syncFileToProSBC = async (fileId, fileName) => {
    setIsLoading(true);
    setMessage(`🔄 Syncing ${fileName} to ProSBC...`);
    
    try {
      const result = await fileManagementService.syncFileToProSBC(fileId, (progress, status) => {
        setMessage(`🔄 ${status} (${Math.round(progress)}%)`);
      });
      
      if (result.success) {
        setMessage(`✅ ${result.message}`);
        loadStoredFiles();
        loadDatabaseStats();
      }
    } catch (error) {
      console.error('Sync file error:', error);
      setMessage(`❌ Sync failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Sync all pending files
  const syncAllPendingFiles = async () => {
    setIsLoading(true);
    setMessage("🔄 Syncing all pending files...");
    
    try {
      const result = await fileManagementService.syncAllPendingFiles((progress, status) => {
        setMessage(`🔄 ${status} (${Math.round(progress)}%)`);
      });
      
      if (result.success) {
        setMessage(`✅ ${result.message}`);
        loadStoredFiles();
        loadDatabaseStats();
      }
    } catch (error) {
      console.error('Sync all files error:', error);
      setMessage(`❌ Sync failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete stored file
  const deleteStoredFile = async (fileId, fileName) => {
    if (!window.confirm(`Are you sure you want to delete '${fileName}' from local database?\n\nThis will not delete the file from ProSBC.`)) {
      return;
    }
    
    setIsLoading(true);
    setMessage(`🔄 Deleting ${fileName} from database...`);
    
    try {
      const result = await fileManagementService.deleteStoredFile(fileId);
      if (result.success) {
        setMessage(`✅ ${result.message}`);
        loadStoredFiles();
        loadDatabaseStats();
      }
    } catch (error) {
      console.error('Delete stored file error:', error);
      setMessage(`❌ Delete failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Edit stored file
  const editStoredFile = async (file) => {
    setIsLoading(true);
    setMessage(`🔄 Loading ${file.fileName} for editing...`);
    
    try {
      setEditingFile(file);
      setShowFileEditor(true);
      setMessage("");
    } catch (error) {
      console.error('Edit stored file error:', error);
      setMessage(`❌ Failed to load file for editing: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle file editor save
  const handleFileEditorSave = async (result) => {
    setMessage(`✅ File saved successfully!`);
    setTimeout(() => setMessage(""), 3000);
    
    // Refresh the stored files to show updates
    await loadStoredFiles();
    
    // Close the editor
    setShowFileEditor(false);
    setEditingFile(null);
  };

  // Handle file editor cancel
  const handleFileEditorCancel = () => {
    setShowFileEditor(false);
    setEditingFile(null);
  };

  // Handle file editor error
  const handleFileEditorError = (error) => {
    setMessage(`❌ Error: ${error}`);
    setTimeout(() => setMessage(""), 5000);
  };

  // Clear database
  const clearDatabase = async () => {
    if (!window.confirm('Are you sure you want to clear the entire database?\n\nThis will delete all stored files and cannot be undone.')) {
      return;
    }
    
    setIsLoading(true);
    setMessage("🔄 Clearing database...");
    
    try {
      const result = await fileManagementService.clearDatabase();
      if (result.success) {
        setMessage(`✅ ${result.message}`);
        setStoredFiles([]);
        setDatabaseStats(null);
      }
    } catch (error) {
      console.error('Clear database error:', error);
      setMessage(`❌ Clear failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Export stored file to download
  const exportStoredFile = async (file) => {
    setIsLoading(true);
    setMessage(`🔄 Exporting ${file.fileName}...`);
    
    try {
      const result = await fileExportService.exportFileToDownload(file, true);
      if (result.success) {
        setMessage(`✅ File exported: ${result.filename} (${(result.size / 1024).toFixed(2)} KB)`);
      }
    } catch (error) {
      console.error('Export stored file error:', error);
      setMessage(`❌ Export failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Export all stored files
  const exportAllStoredFiles = async () => {
    if (storedFiles.length === 0) {
      setMessage('❌ No files to export');
      return;
    }

    setIsLoading(true);
    setMessage(`🔄 Exporting ${storedFiles.length} files...`);
    
    try {
      const result = await fileExportService.exportMultipleFilesAsZip(storedFiles);
      if (result.success) {
        setMessage(`✅ Exported ${result.fileCount} files as ${result.filename} (${(result.size / 1024 / 1024).toFixed(2)} MB)`);
      }
    } catch (error) {
      console.error('Export all files error:', error);
      setMessage(`❌ Export failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Export files by type
  const exportFilesByType = async () => {
    if (storedFiles.length === 0) {
      setMessage('❌ No files to export');
      return;
    }

    setIsLoading(true);
    setMessage(`🔄 Exporting files by type...`);
    
    try {
      const result = await fileExportService.exportFilesByType(storedFiles, true);
      if (result.success) {
        setMessage(`✅ ${result.message}`);
      }
    } catch (error) {
      console.error('Export by type error:', error);
      setMessage(`❌ Export failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Export database backup
  const exportDatabaseBackup = async () => {
    if (storedFiles.length === 0) {
      setMessage('❌ No files to backup');
      return;
    }

    setIsLoading(true);
    setMessage(`🔄 Creating database backup...`);
    
    try {
      const result = await fileExportService.exportDatabaseBackup(storedFiles);
      if (result.success) {
        setMessage(`✅ ${result.message} (${result.fileCount} files)`);
      }
    } catch (error) {
      console.error('Export database backup error:', error);
      setMessage(`❌ Backup failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // File update functionality
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setUpdateResult(null);
      setUpdateProgress(0);
      setUpdateMessage('');
      console.log('File selected:', file.name, 'Size:', file.size, 'Type:', file.type);
    }
  };

  // Test connection to ProSBC
  const handleTestConnection = async () => {
    try {
      setConnectionStatus({ testing: true });
      
      // Use the updateTarget fileType if available, otherwise default to DF
      const fileType = updateTarget?.fileType || 'routesets_definitions';
      const result = await testConnection(fileType);
      setConnectionStatus(result);
      console.log('Connection test result:', result);
    } catch (error) {
      setConnectionStatus({
        success: false,
        error: error.message
      });
    }
  };

  // Show update modal for a specific file
  const showUpdateFileModal = (fileType, fileId, fileName) => {
    const fileDbId = 1; // Default file database ID
    const routesetId = fileId; // Use file ID as routeset ID
    
    setUpdateTarget({
      fileDbId,
      routesetId,
      fileName,
      fileType
    });
    setShowUpdateModal(true);
    setSelectedFile(null);
    setUpdateResult(null);
    setUpdateProgress(0);
    setUpdateMessage('');
    
    console.log('Update target set:', {
      fileDbId,
      routesetId,
      fileName,
      fileType
    });
  };

  // Handle file update
  const handleFileUpdate = async () => {
    if (!selectedFile || !updateTarget) {
      setMessage('❌ Please select a file first');
      return;
    }

    setIsUpdating(true);
    setUpdateProgress(0);
    setUpdateMessage('Starting update...');
    setUpdateResult(null);
    setMessage(`🔄 Updating ${updateTarget.fileName} with ${selectedFile.name}...`);

    try {
      const result = await updateFile(selectedFile, {
        fileDbId: updateTarget.fileDbId,
        routesetId: updateTarget.routesetId,
        fileType: updateTarget.fileType,
        onProgress: (progress, message) => {
          setUpdateProgress(Math.round(progress));
          setUpdateMessage(message);
          console.log(`Progress: ${progress}% - ${message}`);
        },
        validateBeforeUpdate: true,
        retryOnSessionExpired: true,
        maxRetries: 3
      });

      setUpdateResult(result);
      
      if (result.success) {
        setUpdateMessage('File updated successfully!');
        setUpdateProgress(100);
        setMessage(`✅ Successfully updated ${updateTarget.fileName}`);
        
        // Refresh update history
        const history = getUpdateHistory();
        setUpdateHistory(history);
        
        // Close modal and refresh file lists
        setShowUpdateModal(false);
        setUpdateTarget(null);
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        // Refresh both ProSBC and database files
        setTimeout(() => {
          loadFiles();
          loadStoredFiles();
        }, 1000);
        
      } else {
        setUpdateMessage(`Update failed: ${result.error}`);
        setMessage(`❌ Update failed: ${result.error}`);
      }

    } catch (error) {
      console.error('Update error:', error);
      setUpdateResult({
        success: false,
        error: error.message
      });
      setUpdateMessage(`Update failed: ${error.message}`);
      setMessage(`❌ Update failed: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Cancel update modal
  const cancelUpdate = () => {
    setShowUpdateModal(false);
    setUpdateTarget(null);
    setSelectedFile(null);
    setUpdateResult(null);
    setUpdateProgress(0);
    setUpdateMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Load update history
  const loadUpdateHistory = () => {
    const history = getUpdateHistory();
    setUpdateHistory(history);
  };

  // Handle CSV editor for specific file
  const handleCSVEditor = (file) => {
    // Set the file to be edited in the CSV editor
    setShowCSVEditor(true);
    // Store the selected file details for the CSV editor
    setSelectedCSVFile(file);
  };

  // Utility functions
  const getFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getMessageClasses = () => {
    if (message.includes("✅") || message.includes("success")) {
      return "bg-green-900/30 text-green-300 border-green-700 border-l-4 border-l-green-500";
    } else if (message.includes("❌") || message.includes("Failed")) {
      return "bg-red-900/30 text-red-300 border-red-700 border-l-4 border-l-red-500";
    } else if (message.includes("🔄") || message.includes("Uploading")) {
      return "bg-blue-900/30 text-blue-300 border-blue-700 border-l-4 border-l-blue-500";
    } else if (message.includes("📊")) {
      return "bg-yellow-900/30 text-yellow-300 border-yellow-700 border-l-4 border-l-yellow-500";
    }
    return "bg-gray-700 text-gray-300 border-gray-600 border-l-4 border-l-gray-500";
  };

  // Render file table
  const renderFileTable = (files, fileType, typeLabel, colorClass) => (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <span className="text-3xl mr-3">{fileType === 'routesets_definitions' ? '📄' : '🗺️'}</span>
          <h3 className="text-xl font-bold text-white">{typeLabel} Files</h3>
        </div>
        <span className="text-sm text-gray-300">{files.length} file(s)</span>
      </div>

      {files.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <div className="text-4xl mb-2">📂</div>
          <p>No {typeLabel.toLowerCase()} files found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-600">
                <th className="text-left py-3 px-4 font-semibold text-gray-300">File Name</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                  <td className="py-4 px-4">
                    <div className="flex items-center">
                      <span className="text-xl mr-3">{fileType === 'routesets_definitions' ? '📄' : '🗺️'}</span>
                      <span className="font-medium text-white">{file.name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex justify-center space-x-2">
                      <button
                        onClick={() => handleCSVEditor(file)}
                        disabled={isLoading}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                          isLoading 
                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            : 'bg-purple-600 text-white hover:bg-purple-700'
                        }`}
                        title="View & Edit CSV file"
                      >
                        📝 View & Edit
                      </button>
                      
                      <button
                        onClick={() => showUpdateFileModal(file.type, file.id, file.name)}
                        disabled={isLoading}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                          isLoading 
                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                        title="Update file"
                      >
                        📤 Update
                      </button>
                      
                      <button
                        onClick={() => handleExport(file.type, file.id, file.name)}
                        disabled={isLoading}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                          isLoading 
                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                        title="Export file"
                      >
                        💾 Export
                      </button>
                      
                      <button
                        onClick={() => handleDelete(file.type, file.id, file.name)}
                        disabled={isLoading}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                          isLoading 
                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            : 'bg-red-600 text-white hover:bg-red-700'
                        }`}
                        title="Delete file"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent mb-4">
            🗂️ ProSBC File Management Center
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-6">
            Manage, update, export, and delete Definition Files (DF) and Digit Map Files (DM)
          </p>
          
          {/* Database Status */}
          <div className="flex justify-center">
            <DatabaseStatus showDetails={false} className="inline-flex" />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl mb-8 backdrop-blur-sm">
          <div className="flex border-b border-gray-700">
            {[
              { id: 'database', label: '💾 Database', icon: '💾' },
              { id: 'overview', label: '📊 ProSBC Files', icon: '📊' },
              { id: 'df-files', label: '📄 DF Files', icon: '📄' },
              { id: 'dm-files', label: '🗺️ DM Files', icon: '🗺️' },
              { id: 'file-update', label: '📤 File Updates', icon: '📤' },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`flex-1 px-6 py-4 text-lg font-semibold transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                } ${tab.id === 'database' ? 'rounded-tl-2xl' : ''} ${tab.id === 'file-update' ? 'rounded-tr-2xl' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-xl">{tab.icon}</span>
                  <span>{tab.label}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-8">
            
            {/* Database Tab */}
            {activeTab === 'database' && (
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-white">📾 File Database</h2>
                  <div className="flex space-x-4">
                    <button
                      onClick={fetchAndStoreFiles}
                      disabled={isLoading}
                      className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 ${
                        isLoading
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-green-600 to-teal-600 text-white hover:from-green-700 hover:to-teal-700'
                      }`}
                    >
                      <span className="text-lg">{isLoading ? '⏳' : '📥'}</span>
                      <span>{isLoading ? 'Fetching...' : 'Fetch from ProSBC'}</span>
                    </button>
                    <button
                      onClick={loadStoredFiles}
                      disabled={isLoading}
                      className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 ${
                        isLoading
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700'
                      }`}
                    >
                      <span className="text-lg">🔄</span>
                      <span>Refresh Database</span>
                    </button>
                  </div>
                </div>

                {/* Database Statistics */}
                {databaseStats && (
                  <div className="bg-gray-700 border border-gray-600 rounded-xl p-6 backdrop-blur-sm">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                      <span className="text-2xl mr-2">📊</span>
                      Database Statistics
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="bg-gray-800 rounded-lg p-4">
                        <div className="text-2xl font-bold text-blue-300">{databaseStats.totalFiles}</div>
                        <div className="text-sm text-gray-400">Total Files</div>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-4">
                        <div className="text-2xl font-bold text-purple-300">{databaseStats.dfFiles}</div>
                        <div className="text-sm text-gray-400">DF Files</div>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-4">
                        <div className="text-2xl font-bold text-pink-300">{databaseStats.dmFiles}</div>
                        <div className="text-sm text-gray-400">DM Files</div>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-4">
                        <div className="text-2xl font-bold text-orange-300">{databaseStats.modifiedFiles}</div>
                        <div className="text-sm text-gray-400">Modified</div>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-4">
                        <div className="text-2xl font-bold text-green-300">{getFileSize(databaseStats.totalSize)}</div>
                        <div className="text-sm text-gray-400">Total Size</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Enhanced File Statistics */}
                {databaseStats && (
                  <div className="bg-gray-700 border border-gray-600 rounded-xl p-6 backdrop-blur-sm">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                      <span className="text-2xl mr-2">📈</span>
                      Enhanced File Analysis
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* DF Files Analysis */}
                      <div className="bg-gray-800 rounded-lg p-4">
                        <div className="text-lg font-semibold text-purple-300 mb-2">
                          📄 Definition Files (DF)
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Total:</span>
                            <span className="text-white">{databaseStats.dfFiles}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Simple:</span>
                            <span className="text-green-300">{storedFiles.filter(f => f.fileType === 'routesets_definitions' && f.dfSpecific && enhancedFileStorageService.categorizeDfFile(f) === 'simple').length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Moderate:</span>
                            <span className="text-yellow-300">{storedFiles.filter(f => f.fileType === 'routesets_definitions' && f.dfSpecific && enhancedFileStorageService.categorizeDfFile(f) === 'moderate').length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Complex:</span>
                            <span className="text-red-300">{storedFiles.filter(f => f.fileType === 'routesets_definitions' && f.dfSpecific && enhancedFileStorageService.categorizeDfFile(f) === 'complex').length}</span>
                          </div>
                        </div>
                      </div>

                      {/* DM Files Analysis */}
                      <div className="bg-gray-800 rounded-lg p-4">
                        <div className="text-lg font-semibold text-pink-300 mb-2">
                          🗺️ Digit Maps (DM)
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Total:</span>
                            <span className="text-white">{databaseStats.dmFiles}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Simple:</span>
                            <span className="text-green-300">{storedFiles.filter(f => f.fileType === 'routesets_digitmaps' && f.dmSpecific && enhancedFileStorageService.categorizeDmFile(f) === 'simple').length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Moderate:</span>
                            <span className="text-yellow-300">{storedFiles.filter(f => f.fileType === 'routesets_digitmaps' && f.dmSpecific && enhancedFileStorageService.categorizeDmFile(f) === 'moderate').length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Complex:</span>
                            <span className="text-red-300">{storedFiles.filter(f => f.fileType === 'routesets_digitmaps' && f.dmSpecific && enhancedFileStorageService.categorizeDmFile(f) === 'complex').length}</span>
                          </div>
                        </div>
                      </div>

                      {/* Storage Distribution */}
                      <div className="bg-gray-800 rounded-lg p-4">
                        <div className="text-lg font-semibold text-blue-300 mb-2">
                          💾 Storage Distribution
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">DF Size:</span>
                            <span className="text-white">{getFileSize(storedFiles.filter(f => f.fileType === 'routesets_definitions').reduce((sum, f) => sum + (f.metadata?.size || 0), 0))}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">DM Size:</span>
                            <span className="text-white">{getFileSize(storedFiles.filter(f => f.fileType === 'routesets_digitmaps').reduce((sum, f) => sum + (f.metadata?.size || 0), 0))}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Avg DF Size:</span>
                            <span className="text-white">{getFileSize(databaseStats.dfFiles > 0 ? storedFiles.filter(f => f.fileType === 'routesets_definitions').reduce((sum, f) => sum + (f.metadata?.size || 0), 0) / databaseStats.dfFiles : 0)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Avg DM Size:</span>
                            <span className="text-white">{getFileSize(databaseStats.dmFiles > 0 ? storedFiles.filter(f => f.fileType === 'routesets_digitmaps').reduce((sum, f) => sum + (f.metadata?.size || 0), 0) / databaseStats.dmFiles : 0)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Search and Filter */}
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 backdrop-blur-sm">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                    <div className="flex-1 md:mr-4">
                      <input
                        type="text"
                        placeholder="Search files by name or content..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex space-x-4">
                      <select
                        value={selectedFileType}
                        onChange={(e) => setSelectedFileType(e.target.value)}
                        className="px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All Files</option>
                        <option value="routesets_definitions">DF Files</option>
                        <option value="routesets_digitmaps">DM Files</option>
                      </select>
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All Categories</option>
                        <option value="simple">Simple</option>
                        <option value="moderate">Moderate</option>
                        <option value="complex">Complex</option>
                        <option value="multi_routeset">Multi-Routeset</option>
                        <option value="multi_pattern">Multi-Pattern</option>
                      </select>
                      <button
                        onClick={syncAllPendingFiles}
                        disabled={isLoading}
                        className={`px-4 py-3 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 ${
                          isLoading
                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-orange-600 to-red-600 text-white hover:from-orange-700 hover:to-red-700'
                        }`}
                      >
                        <span className="text-lg">⚡</span>
                        <span>Sync All</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Export Actions */}
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 backdrop-blur-sm">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                    <span className="text-2xl mr-2">📤</span>
                    Export Options
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <button
                      onClick={exportAllStoredFiles}
                      disabled={isLoading || storedFiles.length === 0}
                      className={`p-4 rounded-xl font-medium transition-all duration-200 flex flex-col items-center space-y-2 ${
                        isLoading || storedFiles.length === 0
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700'
                      }`}
                    >
                      <span className="text-2xl">📦</span>
                      <span className="text-sm">Export All as ZIP</span>
                    </button>
                    <button
                      onClick={exportFilesByType}
                      disabled={isLoading || storedFiles.length === 0}
                      className={`p-4 rounded-xl font-medium transition-all duration-200 flex flex-col items-center space-y-2 ${
                        isLoading || storedFiles.length === 0
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700'
                      }`}
                    >
                      <span className="text-2xl">🗂️</span>
                      <span className="text-sm">Export by Type</span>
                    </button>
                    <button
                      onClick={exportDatabaseBackup}
                      disabled={isLoading || storedFiles.length === 0}
                      className={`p-4 rounded-xl font-medium transition-all duration-200 flex flex-col items-center space-y-2 ${
                        isLoading || storedFiles.length === 0
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700'
                      }`}
                    >
                      <span className="text-2xl">💾</span>
                      <span className="text-sm">Database Backup</span>
                    </button>
                    <button
                      onClick={clearDatabase}
                      disabled={isLoading || storedFiles.length === 0}
                      className={`p-4 rounded-xl font-medium transition-all duration-200 flex flex-col items-center space-y-2 ${
                        isLoading || storedFiles.length === 0
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-red-600 to-pink-600 text-white hover:from-red-700 hover:to-pink-700'
                      }`}
                    >
                      <span className="text-2xl">🗑️</span>
                      <span className="text-sm">Clear Database</span>
                    </button>
                  </div>
                </div>

                {/* Stored Files Table */}
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white">Stored Files</h3>
                    <span className="text-sm text-gray-300">{storedFiles.length} file(s)</span>
                  </div>

                  {storedFiles.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <div className="text-6xl mb-4">📁</div>
                      <p className="text-xl mb-2">No files in database</p>
                      <p className="text-sm">Click "Fetch from ProSBC" to load files</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-600">
                            <th className="text-left py-3 px-4 font-semibold text-gray-300">File Name</th>
                            <th className="text-center py-3 px-4 font-semibold text-gray-300">Type</th>
                            <th className="text-center py-3 px-4 font-semibold text-gray-300">Status</th>
                            <th className="text-center py-3 px-4 font-semibold text-gray-300">Size</th>
                            <th className="text-center py-3 px-4 font-semibold text-gray-300">Last Modified</th>
                            <th className="text-center py-3 px-4 font-semibold text-gray-300">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {storedFiles.map((file) => (
                            <tr key={file.id} className="border-b border-gray-700 hover:bg-gray-750">
                              <td className="py-4 px-4">
                                <div className="flex items-center">
                                  <span className="text-2xl mr-3">
                                    {file.fileType === 'routesets_definitions' ? '📄' : '🗺️'}
                                  </span>
                                  <div>
                                    <div className="font-medium text-white">{file.fileName}</div>
                                    <div className="text-sm text-gray-400">
                                      {file.fileType === 'routesets_definitions' && file.dfSpecific && (
                                        <span>
                                          {file.dfSpecific.routesetCount} routesets • 
                                          {file.dfSpecific.priorityLevels?.length || 0} priorities • 
                                          Complexity: {file.dfSpecific.complexity || 0}
                                        </span>
                                      )}
                                      {file.fileType === 'routesets_digitmaps' && file.dmSpecific && (
                                        <span>
                                          {file.dmSpecific.numberPatterns?.length || 0} patterns • 
                                          {Object.keys(file.dmSpecific.routesetMappings || {}).length} mappings • 
                                          Complexity: {file.dmSpecific.complexity || 0}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-4 text-center">
                                <div className="flex flex-col items-center space-y-1">
                                  <span className={`px-2 py-1 rounded-full text-xs ${
                                    file.fileType === 'routesets_definitions' 
                                      ? 'bg-purple-900/30 text-purple-300' 
                                      : 'bg-pink-900/30 text-pink-300'
                                  }`}>
                                    {file.fileType === 'routesets_definitions' ? 'DF' : 'DM'}
                                  </span>
                                  {(file.dfSpecific || file.dmSpecific) && (
                                    <span className={`px-2 py-1 rounded-full text-xs ${
                                      file.fileType === 'routesets_definitions' 
                                        ? enhancedFileStorageService.categorizeDfFile(file) === 'complex' ? 'bg-red-900/30 text-red-300' :
                                          enhancedFileStorageService.categorizeDfFile(file) === 'moderate' ? 'bg-yellow-900/30 text-yellow-300' :
                                          'bg-green-900/30 text-green-300'
                                        : enhancedFileStorageService.categorizeDmFile(file) === 'complex' ? 'bg-red-900/30 text-red-300' :
                                          enhancedFileStorageService.categorizeDmFile(file) === 'moderate' ? 'bg-yellow-900/30 text-yellow-300' :
                                          'bg-green-900/30 text-green-300'
                                    }`}>
                                      {file.fileType === 'routesets_definitions' 
                                        ? enhancedFileStorageService.categorizeDfFile(file) 
                                        : enhancedFileStorageService.categorizeDmFile(file)
                                      }
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 px-4 text-center">
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  file.status === 'synced' ? 'bg-green-900/30 text-green-300' :
                                  file.status === 'modified' ? 'bg-orange-900/30 text-orange-300' :
                                  'bg-gray-900/30 text-gray-300'
                                }`}>
                                  {file.status}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-center text-gray-300">
                                {getFileSize(file.metadata?.size || 0)}
                              </td>
                              <td className="py-4 px-4 text-center text-gray-300">
                                {new Date(file.lastModified).toLocaleDateString()}
                              </td>
                              <td className="py-4 px-4">
                                <div className="flex justify-center space-x-2">
                                  <button
                                    onClick={() => handleCSVEditor(file)}
                                    disabled={isLoading}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                      isLoading 
                                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                        : 'bg-purple-600 text-white hover:bg-purple-700'
                                    }`}
                                    title="View & Edit CSV file"
                                  >
                                    📝 View & Edit
                                  </button>
                                  
                                  <button
                                    onClick={() => showUpdateFileModal(file.fileType, file.prosbcId, file.fileName)}
                                    disabled={isLoading}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                      isLoading 
                                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                        : 'bg-green-600 text-white hover:bg-green-700'
                                    }`}
                                    title="Update file on ProSBC"
                                  >
                                    📤 Update
                                  </button>
                                  
                                  <button
                                    onClick={() => editStoredFile(file)}
                                    disabled={isLoading}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                      isLoading 
                                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                    }`}
                                    title="Edit file"
                                  >
                                    ✏️ Edit
                                  </button>
                                  {file.status === 'modified' && (
                                    <button
                                      onClick={() => syncFileToProSBC(file.id, file.fileName)}
                                      disabled={isLoading}
                                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                        isLoading 
                                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                          : 'bg-orange-600 text-white hover:bg-orange-700'
                                      }`}
                                      title="Sync to ProSBC"
                                    >
                                      🔄 Sync
                                    </button>
                                  )}
                                  <button
                                    onClick={() => exportStoredFile(file)}
                                    disabled={isLoading}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                      isLoading 
                                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                        : 'bg-green-600 text-white hover:bg-green-700'
                                    }`}
                                    title="Export file"
                                  >
                                    📤 Export
                                  </button>
                                  <button
                                    onClick={() => deleteStoredFile(file.id, file.fileName)}
                                    disabled={isLoading}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                      isLoading 
                                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                        : 'bg-red-600 text-white hover:bg-red-700'
                                    }`}
                                    title="Delete from database"
                                  >
                                    🗑️ Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Database Actions */}
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 backdrop-blur-sm">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                    <span className="text-2xl mr-2">⚙️</span>
                    Database Actions
                  </h3>
                  <div className="flex flex-wrap gap-4">
                    <button
                      onClick={clearDatabase}
                      disabled={isLoading}
                      className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 ${
                        isLoading
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800'
                      }`}
                    >
                      <span className="text-lg">🧹</span>
                      <span>Clear Database</span>
                    </button>
                    <button
                      onClick={handleSystemStatusCheck}
                      disabled={isLoading}
                      className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 ${
                        isLoading
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-700 hover:to-blue-700'
                      }`}
                    >
                      <span className="text-lg">🔍</span>
                      <span>Check ProSBC Status</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-white">File Overview</h2>
                  <button
                    onClick={loadFiles}
                    disabled={refreshing}
                    className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 ${
                      refreshing
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700'
                    }`}
                  >
                    <span className="text-lg">{refreshing ? '⏳' : '🔄'}</span>
                    <span>{refreshing ? 'Refreshing...' : 'Refresh Files'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  
                  {/* DF Files Summary */}
                  <div className="bg-gray-700 border border-gray-600 rounded-xl p-6 backdrop-blur-sm">
                    <div className="flex items-center mb-4">
                      <span className="text-3xl mr-3">📄</span>
                      <h3 className="text-2xl font-bold text-purple-300">Definition Files (DF)</h3>
                    </div>
                    <div className="space-y-3">
                      <p className="text-purple-200 text-sm">
                        Configure routeset definitions for call routing through ProSBC
                      </p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-purple-300">Total Files:</span>
                          <span className="font-medium text-purple-200">{dfFiles.length}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-purple-300">Last Refresh:</span>
                          <span className="font-medium text-purple-200">
                            {refreshing ? 'Refreshing...' : 'Ready'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* DM Files Summary */}
                  <div className="bg-gray-700 border border-gray-600 rounded-xl p-6 backdrop-blur-sm">
                    <div className="flex items-center mb-4">
                      <span className="text-3xl mr-3">🗺️</span>
                      <h3 className="text-2xl font-bold text-pink-300">Digit Map Files (DM)</h3>
                    </div>
                    <div className="space-y-3">
                      <p className="text-pink-200 text-sm">
                        Define number translation rules and digit manipulation patterns
                      </p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-pink-300">Total Files:</span>
                          <span className="font-medium text-pink-200">{dmFiles.length}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-pink-300">Last Refresh:</span>
                          <span className="font-medium text-pink-200">
                            {refreshing ? 'Refreshing...' : 'Ready'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 backdrop-blur-sm">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                    <span className="text-2xl mr-2">⚡</span>
                    Quick Actions
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                      onClick={() => setActiveTab('df-files')}
                      className="p-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all duration-200 flex items-center space-x-2"
                    >
                      <span className="text-xl">📄</span>
                      <span>Manage DF Files</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('dm-files')}
                      className="p-4 bg-gradient-to-r from-pink-600 to-pink-700 text-white rounded-lg hover:from-pink-700 hover:to-pink-800 transition-all duration-200 flex items-center space-x-2"
                    >
                      <span className="text-xl">🗺️</span>
                      <span>Manage DM Files</span>
                    </button>
                    
                
                  </div>
                </div>
              </div>
            )}

            {/* DF Files Tab */}
            {activeTab === 'df-files' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-white">Definition Files (DF)</h2>
                  <button
                    onClick={loadFiles}
                    disabled={refreshing}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      refreshing
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-purple-600/20 text-purple-300 hover:bg-purple-600/40 border border-purple-600/30'
                    }`}
                  >
                    {refreshing ? '⏳ Refreshing...' : '🔄 Refresh'}
                  </button>
                </div>
                {renderFileTable(dfFiles, 'routesets_definitions', 'Definition', 'purple')}
              </div>
            )}

            {/* DM Files Tab */}
            {activeTab === 'dm-files' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-white">Digit Map Files (DM)</h2>
                  <button
                    onClick={loadFiles}
                    disabled={refreshing}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      refreshing
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-pink-600/20 text-pink-300 hover:bg-pink-600/40 border border-pink-600/30'
                    }`}
                  >
                    {refreshing ? '⏳ Refreshing...' : '🔄 Refresh'}
                  </button>
                </div>
                {renderFileTable(dmFiles, 'routesets_digitmaps', 'Digit Map', 'pink')}
              </div>
            )}

            {/* File Update Tab */}
            {activeTab === 'file-update' && (
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-white">📤 File Update Center</h2>
                  <button
                    onClick={handleTestConnection}
                    disabled={connectionStatus?.testing}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      connectionStatus?.testing
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600/20 text-blue-300 hover:bg-blue-600/40 border border-blue-600/30'
                    }`}
                  >
                    {connectionStatus?.testing ? '⏳ Testing...' : '🔗 Test Connection'}
                  </button>
                </div>

                {/* Connection Status */}
                {connectionStatus && !connectionStatus.testing && (
                  <div className={`p-4 rounded-lg ${
                    connectionStatus.success ? 'bg-green-900/30 text-green-300 border border-green-600' : 'bg-red-900/30 text-red-300 border border-red-600'
                  }`}>
                    {connectionStatus.success ? 
                      `✓ ${connectionStatus.message}` : 
                      `✗ ${connectionStatus.error}`
                    }
                  </div>
                )}

                {/* Update Instructions */}
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 backdrop-blur-sm">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                    <span className="text-2xl mr-2">📋</span>
                    How to Update Files
                  </h3>
                  <div className="space-y-4 text-gray-300">
                    <div className="flex items-start space-x-3">
                      <span className="text-blue-400 font-bold">1.</span>
                      <p>Navigate to the <strong>ProSBC Files</strong>, <strong>DF Files</strong>, or <strong>DM Files</strong> tab</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="text-blue-400 font-bold">2.</span>
                      <p>Find the file you want to update and click the <strong>📤 Update</strong> button</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="text-blue-400 font-bold">3.</span>
                      <p>Select a replacement file from your computer (CSV, TXT, or JSON)</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="text-blue-400 font-bold">4.</span>
                      <p>Click <strong>Update File</strong> to submit the changes to ProSBC</p>
                    </div>
                  </div>
                </div>

                {/* Update Statistics */}
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 backdrop-blur-sm">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                    <span className="text-2xl mr-2">📊</span>
                    Update Statistics
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-700 rounded-lg p-4">
                      <div className="text-2xl font-bold text-green-300">{updateHistory.filter(h => h.success).length}</div>
                      <div className="text-sm text-gray-400">Successful Updates</div>
                    </div>
                    <div className="bg-gray-700 rounded-lg p-4">
                      <div className="text-2xl font-bold text-red-300">{updateHistory.filter(h => !h.success).length}</div>
                      <div className="text-sm text-gray-400">Failed Updates</div>
                    </div>
                    <div className="bg-gray-700 rounded-lg p-4">
                      <div className="text-2xl font-bold text-blue-300">{updateHistory.length}</div>
                      <div className="text-sm text-gray-400">Total Attempts</div>
                    </div>
                  </div>
                </div>

                {/* Update History */}
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 backdrop-blur-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white flex items-center">
                      <span className="text-2xl mr-2">📝</span>
                      Update History
                    </h3>
                    <div className="flex space-x-2">
                      <button
                        onClick={loadUpdateHistory}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
                      >
                        🔄 Refresh
                      </button>
                      <button
                        onClick={() => {
                          import('../utils/fileUpdateService').then(({ clearUpdateHistory }) => {
                            clearUpdateHistory();
                            setUpdateHistory([]);
                          });
                        }}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm"
                        disabled={updateHistory.length === 0}
                      >
                        🗑️ Clear
                      </button>
                    </div>
                  </div>

                  {updateHistory.length > 0 ? (
                    <div className="space-y-2">
                      {updateHistory.map((entry, index) => (
                        <div key={index} className={`p-3 rounded-lg text-sm ${
                          entry.success ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'
                        }`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{entry.fileName}</p>
                              <p className="text-xs opacity-75">
                                {new Date(entry.timestamp).toLocaleString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`font-medium ${
                                entry.success ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {entry.success ? '✓ Success' : '✗ Failed'}
                              </p>
                              <p className="text-xs opacity-75">Attempts: {entry.attempts}</p>
                            </div>
                          </div>
                          {entry.error && (
                            <p className="text-xs mt-2 opacity-75">{entry.error}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <div className="text-4xl mb-2">📋</div>
                      <p>No update history available</p>
                      <p className="text-sm">Updates will appear here as you perform them</p>
                    </div>
                  )}
                </div>
              </div>
            )}


           
                  <button
                    onClick={() => setShowCSVEditor(true)}
                    className="px-6 py-3 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700"
                  >
                    <span className="text-lg">🚀</span>
                    <span>Open CSV Editor</span>
                  </button>
                </div>


          </div>
        </div>

        {/* Status Message */}
        {message && (
          <div className="bg-gray-800 rounded-2xl p-8 shadow-lg border border-gray-700 mb-8">
            <div className={`p-6 rounded-xl border font-mono text-sm leading-relaxed whitespace-pre-line ${getMessageClasses()}`}>
              {message}
            </div>
          </div>
        )}

        {/* File Update Modal */}
        {showUpdateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl p-8 shadow-2xl border border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">📤 Update File</h2>
                <button
                  onClick={cancelUpdate}
                  className="text-gray-400 hover:text-white transition-colors"
                  disabled={isUpdating}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {updateTarget && (
                <div className="mb-6 p-4 bg-gray-700 rounded-lg">
                  <h3 className="text-lg font-semibold text-white mb-2">Target File Information</h3>
                  <div className="text-sm text-gray-300 space-y-1">
                    <p><strong>File Name:</strong> {updateTarget.fileName}</p>
                    <p><strong>File Type:</strong> {updateTarget.fileType === 'routesets_definitions' ? 'Definition File (DF)' : 'Digit Map File (DM)'}</p>
                    <p><strong>File DB ID:</strong> {updateTarget.fileDbId}</p>
                    <p><strong>Routeset ID:</strong> {updateTarget.routesetId}</p>
                  </div>
                </div>
              )}

              {/* Connection Test */}
              <div className="mb-6 p-4 bg-gray-700 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-3">Connection Test</h3>
                <button
                  onClick={handleTestConnection}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 mr-3"
                  disabled={connectionStatus?.testing || isUpdating}
                >
                  {connectionStatus?.testing ? 'Testing...' : 'Test Connection'}
                </button>
                
                {connectionStatus && !connectionStatus.testing && (
                  <div className={`mt-3 p-3 rounded-lg ${
                    connectionStatus.success ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'
                  }`}>
                    {connectionStatus.success ? 
                      `✓ ${connectionStatus.message}` : 
                      `✗ ${connectionStatus.error}`
                    }
                  </div>
                )}
              </div>

              {/* File Selection */}
              <div className="mb-6 p-4 bg-gray-700 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-3">Select Replacement File</h3>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.json"
                  onChange={handleFileSelect}
                  disabled={isUpdating}
                  className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                />
                
                {selectedFile && (
                  <div className="mt-3 p-3 bg-gray-600 rounded-lg">
                    <p className="text-white"><strong>Selected:</strong> {selectedFile.name}</p>
                    <p className="text-gray-300"><strong>Size:</strong> {(selectedFile.size / 1024).toFixed(2)} KB</p>
                    <p className="text-gray-300"><strong>Type:</strong> {selectedFile.type || 'Unknown'}</p>
                  </div>
                )}
              </div>

              {/* Update Progress */}
              {isUpdating && (
                <div className="mb-6 p-4 bg-gray-700 rounded-lg">
                  <h3 className="text-lg font-semibold text-white mb-3">Update Progress</h3>
                  <div className="bg-gray-600 rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full transition-all duration-300"
                      style={{ width: `${updateProgress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-gray-300">{updateMessage}</p>
                </div>
              )}

              {/* Update Result */}
              {updateResult && (
                <div className={`mb-6 p-4 rounded-lg ${
                  updateResult.success 
                    ? 'bg-green-900/30 text-green-300' 
                    : 'bg-red-900/30 text-red-300'
                }`}>
                  {updateResult.success ? (
                    <div>
                      <p className="font-semibold">✓ Update Successful!</p>
                      <p className="text-sm">Attempts: {updateResult.attempts}</p>
                      {updateResult.result?.redirectUrl && (
                        <p className="text-sm mt-1">Redirect URL: {updateResult.result.redirectUrl}</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="font-semibold">✗ Update Failed</p>
                      <p className="text-sm">{updateResult.error}</p>
                      {updateResult.details && (
                        <p className="text-xs mt-1 opacity-75">{updateResult.details}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4">
                <button
                  onClick={cancelUpdate}
                  disabled={isUpdating}
                  className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                    isUpdating
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-600 text-white hover:bg-gray-700'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleFileUpdate}
                  disabled={!selectedFile || isUpdating}
                  className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                    !selectedFile || isUpdating
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {isUpdating ? 'Updating...' : 'Update File'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CSV Editor Modal */}
        {showCSVEditor && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-[98vw] h-[95vh] max-h-[95vh] overflow-hidden flex flex-col">
              <CSVFileEditor
                onClose={() => {
                  setShowCSVEditor(false);
                  setSelectedCSVFile(null);
                }}
                onAuthError={onAuthError}
                selectedFile={selectedCSVFile}
              />
            </div>
          </div>
        )}
      </div>
    
  );
}

export default FileManagement;
