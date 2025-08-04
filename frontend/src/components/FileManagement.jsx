import React, { useState, useEffect, useRef } from 'react';
//  ...existing code...
// import { fileManagementService } from '../utils/fileManagementService';
import { enhancedFileStorageService } from '../utils/enhancedFileStorageServiceNew';
import { updateFile, updateMultipleFiles, testConnection, getUpdateStatus, getUpdateHistory } from '../utils/fileUpdateService';
import CSVFileEditor from './CSVFileEditor';
import { useProSBCInstance } from '../contexts/ProSBCInstanceContext';
import { useInstanceAPI } from '../hooks/useInstanceAPI.jsx';
import { useInstanceRefresh } from '../hooks/useInstanceRefresh';

import AddProSBCFilesButton from './AddProSBCFilesButton';
import DeleteAllFilesButton from './DeleteAllFilesButton';

function FileManagement({ onAuthError, configId }) {
  const { selectedInstance, hasSelectedInstance } = useProSBCInstance();
  const instanceAPI = useInstanceAPI();
  // Helper to get auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('dashboard_token');
    return token ? { 'Authorization': 'Bearer ' + token } : {};
  };
  const [activeTab, setActiveTab] = useState('df-files'); // Default to DF files tab
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

  // Add instance refresh hook to automatically reload files when instance changes
  useInstanceRefresh(
    async (instance) => {
      console.log('[FileManagement] Refreshing files for instance:', instance?.id);
      await loadFiles(instance);
      await loadStoredFiles(instance);
    },
    [configId], // Dependencies - reload when configId changes too
    {
      refreshOnMount: true,
      refreshOnInstanceChange: true
    }
  );

  // Instance check
  if (!hasSelectedInstance) {
    return (
      <div className="bg-gray-800 border border-yellow-600 rounded-lg p-6 text-center">
        <div className="text-yellow-400 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No ProSBC Instance Selected</h3>
        <p className="text-gray-300 mb-4">Please select a ProSBC instance to manage files.</p>
        <p className="text-sm text-gray-400">Use the instance selector at the top of the page to choose a ProSBC server.</p>
      </div>
    );
  }

  // Load files on component mount and when configId changes
  useEffect(() => {
    if (hasSelectedInstance) {
      loadFiles();
      loadStoredFiles();
      loadDatabaseStats();
      loadUpdateHistory();
    }
  }, [configId, hasSelectedInstance]);

  // Load stored files when search term or file type changes
  useEffect(() => {
    if (hasSelectedInstance) {
      loadStoredFiles();
    }
  }, [searchTerm, selectedFileType, selectedCategory, hasSelectedInstance]);

  // Load all files
  const loadFiles = async (instance = null) => {
    const targetInstance = instance || selectedInstance;
    if (!targetInstance) return;
    
    setRefreshing(true);
    try {
      // Use direct API calls since file API handles instances internally
      const token = localStorage.getItem('dashboard_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...(targetInstance?.id && { 'X-ProSBC-Instance-ID': targetInstance.id.toString() })
      };
      
      console.log('[FileManagement] Loading files for instance:', targetInstance?.id);
      
      const [dfResponse, dmResponse] = await Promise.all([
        fetch(`/backend/api/prosbc-files/df/list?configId=${configId || ''}`, { headers }),
        fetch(`/backend/api/prosbc-files/dm/list?configId=${configId || ''}`, { headers })
      ]);
      
      const dfRes = dfResponse.ok ? await dfResponse.json() : { success: false, message: `DF API failed: ${dfResponse.status}` };
      const dmRes = dmResponse.ok ? await dmResponse.json() : { success: false, message: `DM API failed: ${dmResponse.status}` };
      
      if (dfRes.success) setDfFiles(dfRes.files);
      if (dmRes.success) setDmFiles(dmRes.files);
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
  const handleExport = async (fileType, fileId, fileName, configId) => {
    setIsLoading(true);
    setMessage(`🔄 Exporting ${fileName}...`);
    try {
      // Use the working backend export endpoint
      const params = new URLSearchParams({
        fileType,
        fileId,
        fileName,
        configId: configId || ''
      });
      const url = `/backend/api/prosbc-files/export?${params.toString()}`;
      // Use fetch to support auth headers if needed, fallback to link for browser download
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Export failed: ' + (await res.text()));
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      setMessage(`✅ File download started.`);
    } catch (error) {
      console.error('Export error:', error);
      setMessage(`❌ Export failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete file
  const handleDelete = async (fileType, fileId, fileName, configId) => {
    if (!window.confirm(`Are you sure you want to delete '${fileName}'?\n\nThis action cannot be undone.`)) {
      return;
    }
    setIsLoading(true);
    setMessage(`🔄 Deleting ${fileName}...`);
    try {
      const res = await fetch('/backend/api/prosbc-files/delete', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileType,
          fileId,
          fileName,
          configId
        })
      });
      let result;
      if (!res.ok) {
        let errorText;
        try {
          errorText = await res.text();
        } catch (e) {
          errorText = 'Unknown error';
        }
        setMessage(`❌ Delete failed: ${errorText.substring(0, 300)}`);
        setIsLoading(false);
        return;
      }
      try {
        result = await res.json();
      } catch (jsonErr) {
        const text = await res.text();
        setMessage(`❌ Delete failed: Unexpected response from server.\n${text.substring(0, 300)}`);
        setIsLoading(false);
        return;
      }
      if (result.success) {
        let successMessage = `✅ ${result.message}`;
        if (result.note && result.note.includes('CORS')) {
          successMessage += '\n📌 Note: Delete completed but redirect confirmation was blocked by browser security.';
        }
        setMessage(successMessage);
        setTimeout(() => loadFiles(), 1000);
      } else {
        setMessage(`❌ Delete failed: ${result.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Delete error:', error);
      let errorMessage = error.message;
      if (error.message.includes('CSRF token')) {
        errorMessage = 'Authentication failed. Please refresh the page and try again.';
      } else if (error.message.includes('401') || error.message.includes('authentication')) {
        errorMessage = 'Your session has expired. Please log in again.';
        onAuthError?.();
      } else if (error.message.includes('404')) {
        errorMessage = 'File not found. It may have been already deleted.';
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
      const res = await fetch('/backend/api/prosbc-files/status', { headers: getAuthHeaders() });
      const result = await res.json();
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
  // Upload DF file
  const handleUploadDfFile = async (filePath) => {
    setIsLoading(true);
    setMessage("🔄 Uploading DF file...");
    try {
      const res = await fetch('/backend/api/prosbc-files/upload/df', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, configId })
      });
      const result = await res.json();
      if (result.success) {
        setMessage(`✅ ${result.message}`);
        loadFiles();
      }
    } catch (error) {
      console.error('Upload DF error:', error);
      setMessage(`❌ Upload DF failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Upload DM file
  const handleUploadDmFile = async (filePath) => {
    setIsLoading(true);
    setMessage("🔄 Uploading DM file...");
    try {
      const res = await fetch('/backend/api/prosbc-files/upload/dm', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, configId })
      });
      const result = await res.json();
      if (result.success) {
        setMessage(`✅ ${result.message}`);
        loadFiles();
      }
    } catch (error) {
      console.error('Upload DM error:', error);
      setMessage(`❌ Upload DM failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  // Get file content
  const handleGetFileContent = async (fileType, fileId, configId) => {
    setIsLoading(true);
    setMessage("🔄 Getting file content...");
    try {
      const res = await fetch(`/backend/api/prosbc-files/content?fileType=${encodeURIComponent(fileType)}&fileId=${encodeURIComponent(fileId)}&configId=${configId || ''}`, { headers: getAuthHeaders() });
      let result;
      try {
        result = await res.json();
      } catch (jsonErr) {
        const text = await res.text();
        throw new Error(`Get file content failed: Unexpected response from server.\n${text.substring(0, 300)}`);
      }
      if (result.success) {
        setMessage(`✅ File content loaded.`);
        // You can set state here to display content if needed
      } else {
        setMessage(`❌ Get file content failed: ${result.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Get file content error:', error);
      setMessage(`❌ Get file content failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Update file
  
  };
  const handleUpdateFileApi = async (fileType, fileId, file, configId) => {
    setIsLoading(true);
    setMessage("🔄 Updating file...");
    try {
      const formData = new FormData();
      formData.append('fileType', fileType);
      formData.append('fileId', fileId);
      formData.append('file', file); // file is a File object

      formData.append('configId', configId);
      const res = await fetch('/backend/api/prosbc-files/update', {
        method: 'POST',
        body: formData,
        headers: getAuthHeaders()
      });
      const result = await res.json();
      if (result.success) {
        setMessage(`✅ ${result.message}\nFile updated successfully!`);
        loadFiles();
        setShowUpdateModal(false);
        setUpdateTarget(null);
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setMessage(`❌ Update failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Update file error:', error);
      setMessage(`❌ Update file failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Load stored files from database
  const loadStoredFiles = async (instance = null) => {
    // Note: This function loads from local database, not instance-specific
    // The instance parameter is for consistency with the refresh hook
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

  // Handler to refresh files after adding ProSBC files
  const handleProSBCFilesAdded = (results) => {
    loadStoredFiles();
    loadDatabaseStats();
    loadFiles();
    setMessage('✅ ProSBC files added to database!');
    setTimeout(() => setMessage(''), 3000);
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
                onClick={() => handleExport(file.type, file.id, file.name, file.configId || file.config_id)}
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
                onClick={() => handleDelete(file.type, file.id, file.name, file.configId || file.config_id)}
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
           <div className="mb-6 flex flex-row items-center">
                  <AddProSBCFilesButton onComplete={handleProSBCFilesAdded} />
                  <DeleteAllFilesButton onComplete={loadFiles} />
                </div>
          
        </div>

        {/* Tab Navigation */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl mb-8 backdrop-blur-sm">
          <div className="flex border-b border-gray-700">
            {[
              { id: 'df-files', label: '📄 DF Files', icon: '📄' },
              { id: 'dm-files', label: '🗺️ DM Files', icon: '🗺️' },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`flex-1 px-6 py-4 text-lg font-semibold transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                } ${tab.id === 'df-files' ? 'rounded-tl-2xl' : ''} ${tab.id === 'file-update' ? 'rounded-tr-2xl' : ''}`}
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
  onClick={() => {
    if (!selectedFile || !updateTarget) {
      setMessage('❌ Please select a file first');
      return;
    }
    handleUpdateFileApi(updateTarget.fileType, updateTarget.routesetId, selectedFile);
  }}
  disabled={!selectedFile || isUpdating}
  className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
    !selectedFile || isUpdating
      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
      : 'bg-green-600 text-white hover:bg-green-700'
  }`}
>
  {isUpdating ? 'Updating...' : 'Update File'}
</button>
                <button
                  onClick={async () => {
                    if (!updateTarget) return;
                    try {
                      setUpdateMessage('Updating database...');
                      setUpdateProgress(10);
                      let fileType = updateTarget.fileType;
                      let fileId = updateTarget.routesetId;
                      // Fetch file content from ProSBC (export)
                      const contentResult = await prosbcFileAPI.getFileContent(fileType, fileId);
                      if (!contentResult.success) throw new Error('Failed to fetch file content');
                      // Create a File object from the content
                      const fileBlob = new Blob([contentResult.content], { type: 'text/csv' });
                      const fileName = updateTarget.fileName || `prosbc_update_${Date.now()}.csv`;
                      const file = new File([fileBlob], fileName, { type: 'text/csv' });
                      // Prepare FormData for upload
                      const formData = new FormData();
                      formData.append('file', file);
                      formData.append('name', fileName);
                      formData.append('uploaded_by', 'manual-db-update');
                      // Use correct endpoint
                      let uploadEndpoint = fileType === 'routesets_digitmaps'
                        ? '/backend/api/files/digit-maps/upload'
                        : '/backend/api/files/dial-formats/upload';
                      // POST to upload endpoint
                      const dbRes = await fetch(uploadEndpoint, {
                        method: 'POST',
                        body: formData
                      });
                      const dbJson = await dbRes.json();
                      if (dbRes.ok) {
                        setUpdateMessage('Database updated successfully!');
                        setUpdateProgress(100);
                      } else {
                        throw new Error(dbJson.message || 'Unknown error');
                      }
                    } catch (err) {
                      setUpdateMessage('DB update failed: ' + err.message);
                      setUpdateProgress(0);
                    }
                  }}
                  disabled={isUpdating}
                  className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                    isUpdating
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-yellow-600 text-white hover:bg-yellow-700'
                  }`}
                  title="Update only the database with the current file from ProSBC"
                >
                  Update to Database Only
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
