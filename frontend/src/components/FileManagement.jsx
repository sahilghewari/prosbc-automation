import React, { useState, useEffect, useRef } from 'react';
//  ...existing code...
// import { fileManagementService } from '../utils/fileManagementService';
import { enhancedFileStorageService } from '../utils/enhancedFileStorageServiceNew';
import { updateFile, updateMultipleFiles, testConnection, getUpdateStatus, getUpdateHistory } from '../utils/fileUpdateService';
import CSVFileEditor from './CSVFileEditor';
import LoadingAnimation from './LoadingAnimation';
import InlineLoadingAnimation from './InlineLoadingAnimation';
import { useProSBCInstance } from '../contexts/ProSBCInstanceContext';
import { useInstanceAPI } from '../hooks/useInstanceAPI.jsx';
import { useInstanceRefresh } from '../hooks/useInstanceRefresh';

function FileManagement({ onAuthError, configId }) {
  const { selectedInstance, hasSelectedInstance, instances } = useProSBCInstance();
  const instanceAPI = useInstanceAPI();
  // Helper to get auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('dashboard_token');
    return token ? { 'Authorization': 'Bearer ' + token } : {};
  };
  const [activeTab, setActiveTab] = useState('dm-files'); // Default to DM files tab
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  
  // File lists (ProSBC direct)
  const [dfFiles, setDfFiles] = useState([]);
  const [dmFiles, setDmFiles] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingStartTime, setLoadingStartTime] = useState(null);
  const [switchingInstance, setSwitchingInstance] = useState(false);
  
  // Database files
  const [storedFiles, setStoredFiles] = useState([]);
  const [databaseStats, setDatabaseStats] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFileType, setSelectedFileType] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Search and sort states
  const [dfSearchTerm, setDfSearchTerm] = useState('');
  const [dmSearchTerm, setDmSearchTerm] = useState('');
  const [dfSortBy, setDfSortBy] = useState('name');
  const [dmSortBy, setDmSortBy] = useState('name');
  const [dfSortOrder, setDfSortOrder] = useState('asc');
  const [dmSortOrder, setDmSortOrder] = useState('asc');

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

  // Database number search functionality
  const [numberSearch, setNumberSearch] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);

  // Pagination state for search results
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Filter state for search results
  const [resultFilter, setResultFilter] = useState('all');

  // Replace all data functionality
  const [replacing, setReplacing] = useState(false);
  const [replaceResult, setReplaceResult] = useState(null);
  const [replaceProgress, setReplaceProgress] = useState({ current: 0, total: 0 });
  const [runInBackground, setRunInBackground] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Add instance refresh hook to automatically reload files when instance changes
  useInstanceRefresh(
    async (instance) => {
      console.log('[FileManagement] Refreshing files for instance:', instance?.id);
      // Clear old data immediately when instance changes
      setSwitchingInstance(true);
      setDfFiles([]);
      setDmFiles([]);
      setStoredFiles([]);
      setMessage('Switching to new ProSBC instance...');
      
      try {
        await loadFiles(instance);
        await loadStoredFiles(instance);
      } finally {
        setSwitchingInstance(false);
      }
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

  // Clear data immediately when selectedInstance changes
  useEffect(() => {
    if (selectedInstance) {
      console.log('[FileManagement] Instance changed, clearing old data:', selectedInstance.id);
      setSwitchingInstance(true);
      setDfFiles([]);
      setDmFiles([]);
      setStoredFiles([]);
      setMessage(`Loading files for ${selectedInstance.name}...`);
      
      // Set a timeout to clear the switching state if loadFiles doesn't get called
      const timeout = setTimeout(() => {
        setSwitchingInstance(false);
      }, 5000);
      
      return () => clearTimeout(timeout);
    }
  }, [selectedInstance?.id]);

  // Load stored files when search term or file type changes
  useEffect(() => {
    if (hasSelectedInstance) {
      loadStoredFiles();
    }
  }, [searchTerm, selectedFileType, selectedCategory, hasSelectedInstance]);

  // Database number search function
  const searchNumber = async () => {
    if (!numberSearch.trim()) return;

    setSearching(true);
    setSearchResult(null);
    setCurrentPage(1); // Reset to first page on new search
    setResultFilter('all'); // Reset filter to show all results on new search
    try {
      const token = localStorage.getItem('dashboard_token');
      // Split numbers by newlines, commas, or spaces and filter empty entries
      const numbersArray = numberSearch.split(/[\n\r,]+/).map(num => num.trim()).filter(num => num);

      const response = await fetch('/backend/api/dm-files/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          numbers: numbersArray,
          instanceId: selectedInstance?.id
        })
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json();
      setSearchResult(data);
    } catch (err) {
      setSearchResult({ success: false, error: err.message });
    } finally {
      setSearching(false);
    }
  };

  // Load all files
  const loadFiles = async (instance = null) => {
    const targetInstance = instance || selectedInstance;
    if (!targetInstance) return;
    
    // Clear existing data immediately to prevent showing old data
    setDfFiles([]);
    setDmFiles([]);
    setRefreshing(true);
    setLoadingStartTime(Date.now());
    
    try {
      // Use direct API calls since file API handles instances internally
      const token = localStorage.getItem('dashboard_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...(targetInstance?.id && { 'X-ProSBC-Instance-ID': targetInstance.id.toString() })
      };
      
      console.log('[FileManagement] Target instance:', targetInstance);
      console.log('[FileManagement] Target instance ID:', targetInstance?.id);
      console.log('[FileManagement] Headers being sent:', headers);
      
      console.log('[FileManagement] Loading files for instance:', targetInstance?.id);
      
      // Add artificial minimum delay to ensure animation is visible
      const [dfResponse, dmResponse] = await Promise.all([
        fetch(`/backend/api/prosbc-files/df/list?configId=${configId || ''}`, { headers }),
        fetch(`/backend/api/prosbc-files/dm/list?configId=${configId || ''}`, { headers }),
        new Promise(resolve => setTimeout(resolve, 800)) // Minimum 800ms delay
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
      // Add small delay before hiding animation to ensure smooth completion
      setTimeout(() => {
        setRefreshing(false);
        setSwitchingInstance(false);
        setLoadingStartTime(null);
      }, 300);
    }
  };

  // Export file using backend with proper authentication
  const handleExport = async (file) => {
    setIsLoading(true);
    setMessage(`🔄 Exporting ${file.name}...`);
    
    try {
      if (!selectedInstance) {
        setMessage('❌ No ProSBC instance selected');
        return;
      }

      if (!file.exportUrl) {
        setMessage('❌ Export URL not available for this file');
        return;
      }

      console.log('[Export] Using backend export with URL:', file.exportUrl);

      // Use the backend to handle export with proper authentication
      const res = await fetch('/backend/api/prosbc-files/export-direct', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
          'X-ProSBC-Instance-ID': selectedInstance.id.toString()
        },
        body: JSON.stringify({
          exportUrl: file.exportUrl,
          fileName: file.name,
          fileType: file.type,
          fileId: file.id,
          configId: file.configId
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Export failed: ${errorText}`);
      }

      // Check if the response is JSON (error) or binary (file)
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const result = await res.json();
        if (!result.success) {
          throw new Error(result.error || 'Export failed');
        }
      } else {
        // It's a file download
        const blob = await res.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
      }
      
      setMessage(`✅ Export completed for ${file.name}`);
    } catch (error) {
      console.error('Export error:', error);
      setMessage(`❌ Export failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete file using ProSBC REST API
  const handleDelete = async (file) => {
    if (!window.confirm(`Are you sure you want to delete '${file.name}'?\n\nThis action cannot be undone.`)) {
      return;
    }

    setIsLoading(true);
    setMessage(`🔄 Deleting ${file.name}...`);
    
    try {
      if (!selectedInstance) {
        setMessage('❌ No ProSBC instance selected');
        return;
      }

      // Use the backend REST API to delete the file
      const res = await fetch('/backend/api/prosbc-files/delete-direct', {
        method: 'POST',
        headers: { 
          ...getAuthHeaders(), 
          'Content-Type': 'application/json',
          'X-ProSBC-Instance-ID': selectedInstance.id.toString()
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileId: file.id,
          configId: file.configId
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
        setMessage(`✅ ${file.name} deleted successfully`);
        setTimeout(() => loadFiles(), 1000);
      } else {
        setMessage(`❌ Delete failed: ${result.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Delete error:', error);
      let errorMessage = error.message;
      if (error.message.includes('401') || error.message.includes('authentication') || error.message.includes('Authentication failed')) {
        errorMessage = 'Authentication failed. Please check ProSBC credentials.';
        onAuthError?.();
      } else if (error.message.includes('404') || error.message.includes('not found')) {
        errorMessage = 'File not found. It may have been already deleted.';
        setTimeout(() => loadFiles(), 1000);
      } else if (error.message.includes('403')) {
        errorMessage = 'Permission denied. You may not have rights to delete this file.';
      } else if (error.message.includes('configuration')) {
        errorMessage = 'Could not determine ProSBC configuration for this instance.';
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

  // Update file using ProSBC REST API (clean and reliable)
  const handleUpdateFileRestAPI = async (fileType, fileName, file, configId) => {
    setMessage("🔄 Updating file via REST API...");
    
    try {
      if (!selectedInstance) {
        setMessage('❌ No ProSBC instance selected');
        return;
      }

      const formData = new FormData();
      formData.append('fileName', fileName);
      formData.append('fileType', fileType);
      formData.append('file', file);
      formData.append('configId', configId || '');

      const res = await fetch('/backend/api/prosbc-files/update-rest-api', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'X-ProSBC-Instance-ID': selectedInstance.id.toString()
        },
        body: formData
      });

      let result;
      if (!res.ok) {
        let errorText;
        try {
          errorText = await res.text();
        } catch (e) {
          errorText = 'Unknown error';
        }
        setMessage(`❌ Update failed: ${errorText.substring(0, 300)}`);
        return;
      }

      try {
        result = await res.json();
      } catch (jsonErr) {
        const text = await res.text();
        setMessage(`❌ Update failed: Unexpected response from server.\n${text.substring(0, 300)}`);
        return;
      }

      if (result.success) {
        // Show success but also verify the file was actually updated
        let message = `✅ ${fileName} updated successfully via REST API`;
        
        // Check if there's verification info in the result
        if (result.verified === false) {
          message += '\n⚠️ Warning: Content verification failed - the file may not have been actually updated';
        } else if (result.verified === true) {
          message += '\n✅ Content verification passed';
        } else if (result.fallbackUsed) {
          message += '\n🔄 Fallback method was used for update';
        }
        
        setMessage(message);
        loadFiles();
        setShowUpdateModal(false);
        setUpdateTarget(null);
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setTimeout(() => loadFiles(), 1000);
      } else {
        setMessage(`❌ Update failed: ${result.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Update REST API error:', error);
      let errorMessage = error.message;
      if (error.message.includes('401') || error.message.includes('authentication') || error.message.includes('Authentication failed')) {
        errorMessage = 'Authentication failed. Please check ProSBC credentials.';
        onAuthError?.();
      } else if (error.message.includes('404') || error.message.includes('not found')) {
        errorMessage = 'File not found in ProSBC.';
      } else if (error.message.includes('403')) {
        errorMessage = 'Permission denied. You may not have rights to update this file.';
      } else if (error.message.includes('configuration')) {
        errorMessage = 'Could not determine ProSBC configuration for this instance.';
      }
      setMessage(`❌ Update failed: ${errorMessage}`);
    }
  };

  // Load stored files from database
  const loadStoredFiles = async (instance = null) => {
    // Note: This function is currently disabled as fileManagementService is not being used
    // The instance parameter is for consistency with the refresh hook
    return;
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

  // Show update modal for a specific file using direct ProSBC URL
  const showUpdateFileModal = (file) => {
    if (!selectedInstance) {
      setMessage('❌ No ProSBC instance selected');
      return;
    }

    if (!file.updateUrl) {
      setMessage('❌ Update URL not available for this file');
      return;
    }

    setUpdateTarget({
      file: file,
      updateUrl: file.updateUrl,
      fileName: file.name,
      fileType: file.type,
      fileId: file.id,
      configId: file.configId
    });
    setShowUpdateModal(true);
    setSelectedFile(null);
    setUpdateResult(null);
    setUpdateProgress(0);
    setUpdateMessage('');
    
    console.log('Update target set with direct URL:', {
      updateUrl: file.updateUrl,
      fileName: file.name,
      fileType: file.type,
      instance: selectedInstance.id
    });
  };

  // Handle file update using direct ProSBC URL
  const handleFileUpdate = async () => {
    if (!selectedFile || !updateTarget) {
      setMessage('❌ Please select a file first');
      return;
    }

    if (!selectedInstance) {
      setMessage('❌ No ProSBC instance selected');
      return;
    }

    setIsUpdating(true);
    setUpdateProgress(0);
    setUpdateMessage('Starting update...');
    setUpdateResult(null);
    setMessage(`🔄 Updating ${updateTarget.fileName} with ${selectedFile.name}...`);

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('updateUrl', updateTarget.updateUrl);
      formData.append('fileName', updateTarget.fileName);
      formData.append('fileType', updateTarget.fileType);
      formData.append('fileId', updateTarget.fileId);
      formData.append('configId', updateTarget.configId || '');
      formData.append('uploadFileName', selectedFile.name);

      // Use the backend to handle the update operation since it requires CSRF token
      const res = await fetch('/backend/api/prosbc-files/update-direct', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'X-ProSBC-Instance-ID': selectedInstance.id.toString()
        },
        body: formData
      });

      let result;
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Update failed: ${errorText}`);
      }

      try {
        result = await res.json();
      } catch (jsonErr) {
        const text = await res.text();
        throw new Error(`Unexpected response: ${text.substring(0, 300)}`);
      }

      setUpdateResult(result);
      
      if (result.success) {
        setUpdateMessage('File updated successfully!');
        setUpdateProgress(100);
        setMessage(`✅ Successfully updated ${updateTarget.fileName}`);
        
        // Close modal and refresh file lists
        setShowUpdateModal(false);
        setUpdateTarget(null);
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        // Refresh files
        setTimeout(() => {
          loadFiles();
        }, 1000);
        
      } else {
        setUpdateMessage(`Update failed: ${result.error || result.message}`);
        setMessage(`❌ Update failed: ${result.error || result.message}`);
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

  // Handle saving edited file content back to ProSBC
  const handleSaveEditedFile = async (editedContent, fileInfo) => {
    try {
      if (!selectedInstance) {
        throw new Error('No ProSBC instance selected');
      }

      console.log('[Save Edit] Saving edited file:', fileInfo.name);
      console.log('[Save Edit] File info:', fileInfo);
      console.log('[Save Edit] Database file ID:', fileInfo.databaseFileId);
      console.log('[Save Edit] Source:', fileInfo.source);

      // Always try to find the file in database first, even if we think we already have it
      let databaseFileId = fileInfo.databaseFileId;

      if (!databaseFileId) {
        console.log('[Save Edit] No database file ID, searching for existing file...');

        try {
          const dbResponse = await fetch(`/backend/api/dm-files?instanceId=${selectedInstance.id}`, {
            headers: {
              ...getAuthHeaders(),
              'Content-Type': 'application/json'
            }
          });

          if (dbResponse.ok) {
            const dbResult = await dbResponse.json();
            if (dbResult.success) {
              const dbFile = dbResult.files.find(dbFile =>
                dbFile.prosbc_file_id === fileInfo.prosbcFileId?.toString() ||
                (dbFile.file_name === fileInfo.name && dbFile.prosbc_instance_id === selectedInstance.id.toString())
              );

              if (dbFile) {
                databaseFileId = dbFile.id;
                console.log('[Save Edit] Found existing file in database:', databaseFileId);
              }
            }
          }
        } catch (dbError) {
          console.log('[Save Edit] Database lookup failed:', dbError.message);
        }
      }

      // If we still don't have a database file ID, try to sync/create
      if (!databaseFileId) {
        console.log('[Save Edit] File not found in database, attempting to sync/create...');

        try {
          // First, try to sync the file to database
          const syncRes = await fetch('/backend/api/dm-files/sync', {
            method: 'POST',
            headers: {
              ...getAuthHeaders(),
              'Content-Type': 'application/json',
              'X-ProSBC-Instance-ID': selectedInstance.id.toString()
            },
            body: JSON.stringify({
              configId: fileInfo.configId || configId
            })
          });

          if (syncRes.ok) {
            const syncResult = await syncRes.json();
            if (syncResult.success) {
              console.log('[Save Edit] Sync completed, looking for file in database...');

              // Now try to find the file in database again
              const dbResponse = await fetch(`/backend/api/dm-files?instanceId=${selectedInstance.id}`, {
                headers: {
                  ...getAuthHeaders(),
                  'Content-Type': 'application/json'
                }
              });

              if (dbResponse.ok) {
                const dbResult = await dbResponse.json();
                if (dbResult.success) {
                  const dbFile = dbResult.files.find(dbFile =>
                    dbFile.prosbc_file_id === fileInfo.prosbcFileId?.toString() ||
                    (dbFile.file_name === fileInfo.name && dbFile.prosbc_instance_id === selectedInstance.id.toString())
                  );

                  if (dbFile) {
                    databaseFileId = dbFile.id;
                    console.log('[Save Edit] Found file in database after sync:', databaseFileId);
                  }
                }
              }
            }
          }
        } catch (syncError) {
          console.log('[Save Edit] Sync failed, will create file directly:', syncError.message);
        }

        // If still no database file ID, create it directly
        if (!databaseFileId) {
          console.log('[Save Edit] Creating file entry in database...');

          try {
            const createRes = await fetch('/backend/api/dm-files', {
              method: 'POST',
              headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json',
                'X-ProSBC-Instance-ID': selectedInstance.id.toString()
              },
              body: JSON.stringify({
                file_name: fileInfo.name,
                prosbc_file_id: fileInfo.prosbcFileId?.toString(),
                file_content: editedContent,
                configId: fileInfo.configId || configId
              })
            });

            if (createRes.ok) {
              const createResult = await createRes.json();
              if (createResult.success && createResult.file) {
                databaseFileId = createResult.file.id;
                console.log('[Save Edit] Created file in database:', databaseFileId);
              }
            }
          } catch (createError) {
            console.log('[Save Edit] Direct creation failed:', createError.message);
          }
        }
      }

      // Now update using the database endpoint if we have a database file ID
      if (databaseFileId) {
        console.log('[Save Edit] Using database-backed update endpoint');

        const updateData = {
          file_content: editedContent,
          configId: fileInfo.configId || configId
        };

        const res = await fetch(`/backend/api/dm-files/${databaseFileId}/content`, {
          method: 'PUT',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json',
            'X-ProSBC-Instance-ID': selectedInstance.id.toString()
          },
          body: JSON.stringify(updateData)
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error('[Save Edit] Database update failed:', errorText);
          throw new Error(`Database update failed: ${errorText}`);
        }

        const result = await res.json();
        if (result.success) {
          setMessage(`✅ ${fileInfo.name} saved successfully in database and ProSBC!`);
          
          // Refresh the file list
          setTimeout(() => {
            loadFiles();
          }, 1000);
          
          return { success: true, message: 'File saved successfully' };
        } else {
          throw new Error(result.message || 'Database update failed');
        }
      }

      // Final fallback to the old method if all database operations failed
      console.log('[Save Edit] All database operations failed, using legacy ProSBC-only update method');      // Create a blob from the edited content
      const blob = new Blob([editedContent], { type: 'text/csv' });
      const file = new File([blob], fileInfo.name, { type: 'text/csv' });

      // Use the existing REST API update function
      const originalFile = fileInfo.originalFile || fileInfo;
      
      // Use the component's configId instead of file's configId for consistency
      // If component configId is empty string, prefer the file's configId
      const finalConfigId = (configId && configId !== '') ? configId : (originalFile.configId || '');
      console.log('[Save Edit] Using final configId:', finalConfigId);
      
      // Call the REST API update function
      const formData = new FormData();
      formData.append('fileName', originalFile.name);
      formData.append('fileType', originalFile.type);
      formData.append('file', file);
      formData.append('configId', finalConfigId);
      
      const res = await fetch('/backend/api/prosbc-files/update-rest-api', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'X-ProSBC-Instance-ID': selectedInstance.id.toString()
        },
        body: formData
      });

      let result;
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Update failed: ${errorText}`);
      }

      try {
        result = await res.json();
      } catch (jsonErr) {
        const text = await res.text();
        throw new Error(`Unexpected response: ${text.substring(0, 300)}`);
      }

      if (result.success) {
        setMessage(`✅ ${originalFile.name} saved successfully on ProSBC!`);
        
        // Refresh the file list
        setTimeout(() => {
          loadFiles();
        }, 1000);
        
        return { success: true, message: 'File saved successfully' };
      } else {
        throw new Error(result.message || 'Unknown error');
      }
      
    } catch (error) {
      console.error('Save edited file error:', error);
      const errorMessage = `❌ Failed to save file: ${error.message}`;
      setMessage(errorMessage);
      throw error;
    }
  };

  // Handle editing a file directly
  const handleEditFile = async (file) => {
    setIsLoading(true);
    setMessage(`🔄 Loading ${file.name} for editing...`);
    
    try {
      if (!selectedInstance) {
        setMessage('❌ No ProSBC instance selected');
        return;
      }

      if (!file.exportUrl) {
        setMessage('❌ Export URL not available for this file');
        return;
      }

      console.log('[Edit] Fetching file content for editing:', file.name);
      console.log('[Edit] Component configId prop:', configId);
      console.log('[Edit] File configId:', file.configId);
      console.log('[Edit] File object:', file);

      // First, try to get content from database using the prosbc file ID
      let fileContent = null;
      let databaseFileId = null;

      try {
        console.log('[Edit] Trying to get content from database first...');
        const dbResponse = await fetch(`/backend/api/dm-files?instanceId=${selectedInstance.id}`, {
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          }
        });

        if (dbResponse.ok) {
          const dbResult = await dbResponse.json();
          if (dbResult.success) {
            // Find the matching file in database by prosbc_file_id or file_name
            const dbFile = dbResult.files.find(dbFile => 
              dbFile.prosbc_file_id === file.id.toString() || 
              (dbFile.file_name === file.name && dbFile.prosbc_instance_id === selectedInstance.id.toString())
            );

            if (dbFile && dbFile.file_content) {
              console.log('[Edit] Found file content in database');
              fileContent = dbFile.file_content;
              databaseFileId = dbFile.id;
            }
          }
        }
      } catch (dbError) {
        console.log('[Edit] Database fetch failed, falling back to ProSBC:', dbError.message);
      }

      // If not found in database, fetch from ProSBC
      if (!fileContent) {
        console.log('[Edit] Fetching content from ProSBC...');
        if (!file.exportUrl) {
          setMessage('❌ Export URL not available for this file');
          return;
        }

        const res = await fetch('/backend/api/prosbc-files/export-direct', {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json',
            'X-ProSBC-Instance-ID': selectedInstance.id.toString()
          },
          body: JSON.stringify({
            exportUrl: file.exportUrl,
            fileName: file.name,
            fileType: file.type,
            fileId: file.id,
            configId: file.configId,
            returnContent: true
          })
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Failed to fetch file content: ${errorText}`);
        }

        const contentType = res.headers.get('content-type') || '';
        
        if (contentType.includes('application/json')) {
          const result = await res.json();
          if (result.success && result.content) {
            fileContent = result.content;
          } else {
            throw new Error(result.error || 'Failed to get file content');
          }
        } else {
          // It's the raw file content
          fileContent = await res.text();
        }
      }

      // Prepare the file object for the CSV editor
      const fileForEditor = {
        id: databaseFileId || file.id, // Use database ID if available, otherwise ProSBC ID
        name: file.name,
        fileName: file.name,
        type: file.type,
        fileType: file.type,
        configId: (configId && configId !== '') ? configId : (file.configId || ''), // Use file configId if component configId is empty
        source: databaseFileId ? 'database' : 'prosbc', // Track source for saving
        content: fileContent,
        originalFile: file, // Keep reference to original file for updates
        prosbcFileId: file.id, // Keep ProSBC ID for fallback
        databaseFileId: databaseFileId // Store database ID if available
      };

      setSelectedCSVFile(fileForEditor);
      setShowCSVEditor(true);
      setMessage(`✅ Loaded ${file.name} for editing`);
      
    } catch (error) {
      console.error('Edit file error:', error);
      setMessage(`❌ Failed to load file for editing: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
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

  // Filter and sort files
  const filterAndSortFiles = (files, searchTerm, sortBy, sortOrder) => {
    let filteredFiles = files;

    // Filter by search term
    if (searchTerm.trim()) {
      filteredFiles = files.filter(file =>
        file.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort files
    filteredFiles.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'type':
          aValue = a.type || '';
          bValue = b.type || '';
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filteredFiles;
  };

  const replaceDMFiles = async () => {
    if (!configId || instances.length === 0) return;

    setIsProcessing(true);
    if (!runInBackground) setReplacing(true);
    setReplaceResult(null);
    setReplaceProgress({ current: 0, total: instances.length });
    const results = { successes: [], failures: [] };

    try {
      const token = localStorage.getItem('dashboard_token');

      // Process all instances in parallel
      const processInstance = async (instance) => {
        try {
          // Clear existing data for this instance
          const clearResponse = await fetch('/backend/api/dm-files/clear', {
            method: 'DELETE',
            headers: {
              'Authorization': token ? `Bearer ${token}` : '',
              'X-ProSBC-Instance-ID': instance.id.toString()
            }
          });

          if (!clearResponse.ok) {
            throw new Error(`Clear failed for instance ${instance.id}: ${clearResponse.statusText}`);
          }

          // Sync new data for this instance
          const syncResponse = await fetch('/backend/api/dm-files/sync', {
            method: 'POST',
            headers: {
              'Authorization': token ? `Bearer ${token}` : '',
              'X-ProSBC-Instance-ID': instance.id.toString(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ configId })
          });

          if (!syncResponse.ok) {
            throw new Error(`Sync failed for instance ${instance.id}: ${syncResponse.statusText}`);
          }

          const data = await syncResponse.json();
          return { success: true, instanceId: instance.id, ...data };
        } catch (err) {
          return { success: false, instanceId: instance.id, error: err.message };
        }
      };

      const promises = instances.map(processInstance);
      const settledResults = await Promise.allSettled(promises);

      // Process results
      settledResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          const data = result.value;
          if (data.success) {
            results.successes.push(data);
          } else {
            results.failures.push(data);
          }
        } else {
          // This shouldn't happen with our error handling, but just in case
          results.failures.push({ instanceId: 'unknown', error: result.reason });
        }
        setReplaceProgress(prev => ({ ...prev, current: prev.current + 1 }));
      });

      // Aggregate final result
      const hasSuccesses = results.successes.length > 0;
      const hasFailures = results.failures.length > 0;
      setReplaceResult({
        success: hasSuccesses && !hasFailures, // Fully successful only if no failures
        message: hasSuccesses
          ? `Data replaced successfully for ${results.successes.length} instance(s). ${hasFailures ? `${results.failures.length} instance(s) failed.` : ''}`
          : 'All replacements failed.',
        successes: results.successes,
        failures: results.failures
      });
    } catch (err) {
      setReplaceResult({ success: false, error: err.message });
    } finally {
      setIsProcessing(false);
      if (!runInBackground) setReplacing(false);
      setReplaceProgress({ current: 0, total: 0 });
    }
  };

  // Render file table
  const renderFileTable = (files, fileType, typeLabel, colorClass) => {
    const totalFiles = fileType === 'routesets_definitions' ? dfFiles.length : dmFiles.length;
    const isFiltered = (fileType === 'routesets_definitions' ? dfSearchTerm : dmSearchTerm).trim() !== '';
    
    return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <span className="text-3xl mr-3">{fileType === 'routesets_definitions' ? '📄' : '🗺️'}</span>
          <span className="font-medium text-white">{typeLabel} Files</span>
        </div>
        <div className="text-right">
          <span className="text-sm text-gray-300">
            {isFiltered ? `${files.length} of ${totalFiles}` : files.length} file(s)
          </span>
          {isFiltered && (
            <div className="text-xs text-gray-400 mt-1">
              Filtered results
            </div>
          )}
        </div>
      </div>

      {files.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <div className="text-4xl mb-2">📂</div>
          <p>No {typeLabel.toLowerCase()} files found</p>
          {(fileType === 'routesets_definitions' ? dfSearchTerm : dmSearchTerm) && (
            <p className="text-sm mt-2">Try adjusting your search term</p>
          )}
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
                onClick={() => handleEditFile(file)}
                disabled={isLoading}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isLoading 
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
                title="Edit file content"
              >
                ✏️ Edit
              </button>
              
              <button
                onClick={() => showUpdateFileModal(file)}
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
                onClick={() => handleExport(file)}
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
                onClick={() => handleDelete(file)}
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
};

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
          
        </div>

        {/* Database Number Search - at the top */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl mb-8 p-6 backdrop-blur-sm">
          <h2 className="text-2xl font-bold text-white mb-4">🔍 Database Number Search</h2>
          <div className="flex gap-4">
            <div className="flex-1">
              <textarea
                placeholder="Enter the phone numbers"
                value={numberSearch}
                onChange={(e) => setNumberSearch(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
            <button
              onClick={searchNumber}
              disabled={searching || !numberSearch.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-3 rounded-lg font-medium transition-colors h-fit"
            >
              {searching ? 'Searching...' : 'Search Database'}
            </button>
          </div>
          <p className="text-gray-400 text-sm mt-2">
            Search for phone numbers in the stored DM files database. Shows which file and ProSBC instance each number belongs to.
          </p>
          {searchResult && (
            <div className="mt-4">
              {searchResult.success && searchResult.results ? (
                <div>
                  {(() => {
                    // Filter results based on selected filter
                    const filteredResults = searchResult.results.filter(result => {
                      switch (resultFilter) {
                        case 'found':
                          return result.found;
                        case 'not-found':
                          return !result.found;
                        default:
                          return true; // 'all'
                      }
                    });
                    
                    return (
                      <>
                        <div className="mb-4 flex justify-between items-center">
                          <div className="flex items-center gap-4">
                            <div className="text-gray-300">
                              Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredResults.length)} - {Math.min(currentPage * itemsPerPage, filteredResults.length)} of {filteredResults.length} results
                              {resultFilter !== 'all' && searchResult.results.length !== filteredResults.length && (
                                <span className="text-gray-500 ml-2">(filtered from {searchResult.results.length} total)</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-gray-300 text-sm">Filter:</label>
                              <select
                                value={resultFilter}
                                onChange={(e) => {
                                  setResultFilter(e.target.value);
                                  setCurrentPage(1); // Reset to first page when changing filter
                                }}
                                className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-white text-sm"
                              >
                                <option value="all">All Results</option>
                                <option value="found">Found Only</option>
                                <option value="not-found">Not Found Only</option>
                              </select>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-gray-300 text-sm">Items per page:</label>
                            <select
                              value={itemsPerPage}
                              onChange={(e) => {
                                setItemsPerPage(Number(e.target.value));
                                setCurrentPage(1); // Reset to first page when changing items per page
                              }}
                              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                            >
                              <option value={25}>25</option>
                              <option value={50}>50</option>
                              <option value={100}>100</option>
                              <option value={200}>200</option>
                            </select>
                          </div>
                        </div>
                        <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
                          <table className="w-full">
                            <thead className="bg-gray-700">
                              <tr>
                                <th className="px-4 py-3 text-left text-white font-semibold">Number</th>
                                <th className="px-4 py-3 text-left text-white font-semibold">Status</th>
                                <th className="px-4 py-3 text-left text-white font-semibold">Found In</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(() => {
                                const startIndex = (currentPage - 1) * itemsPerPage;
                                const endIndex = startIndex + itemsPerPage;
                                const currentResults = filteredResults.slice(startIndex, endIndex);
                                
                                return currentResults.map((result, index) => (
                                  <tr key={startIndex + index} className="border-t border-gray-600">
                                    <td className="px-4 py-3 text-white font-mono">{result.number}</td>
                                    <td className="px-4 py-3">
                                      {result.found ? (
                                        <span className="text-green-400 font-semibold">Found</span>
                                      ) : (
                                        <span className="text-red-400 font-semibold">Not Found</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-gray-300">
                                      {result.found && result.locations ? (
                                        <div className="space-y-1">
                                          {result.locations.map((location, locIndex) => (
                                            <div key={locIndex} className="text-sm">
                                              <span className="font-medium text-blue-400">{location.file_name}</span>
                                              <span className="text-gray-400"> in </span>
                                              <span className="font-medium text-purple-400">{location.prosbc_instance_name}</span>
                                              <span className="text-gray-500"> ({location.prosbc_instance_id})</span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        'N/A'
                                      )}
                                    </td>
                                  </tr>
                                ));
                              })()}
                            </tbody>
                          </table>
                        </div>
                        {/* Pagination Controls */}
                        {filteredResults.length > itemsPerPage && (
                          <div className="mt-4 flex justify-center items-center gap-4">
                            <button
                              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                              disabled={currentPage === 1}
                              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                            >
                              Previous
                            </button>
                            
                            <div className="flex items-center gap-2">
                              <span className="text-gray-300">Page</span>
                              <select
                                value={currentPage}
                                onChange={(e) => setCurrentPage(Number(e.target.value))}
                                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                              >
                                {Array.from({ length: Math.ceil(filteredResults.length / itemsPerPage) }, (_, i) => (
                                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                                ))}
                              </select>
                              <span className="text-gray-300">of {Math.ceil(filteredResults.length / itemsPerPage)}</span>
                            </div>
                            
                            <button
                              onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredResults.length / itemsPerPage), prev + 1))}
                              disabled={currentPage === Math.ceil(filteredResults.length / itemsPerPage)}
                              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="p-4 bg-gray-900 rounded-lg border border-red-700">
                  <div className="text-red-400">
                    {searchResult.error || 'Search failed'}
                  </div>
                </div>
              )}
            </div>
          )}
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
                    disabled={refreshing || switchingInstance}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      refreshing || switchingInstance
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-purple-600/20 text-purple-300 hover:bg-purple-600/40 border border-purple-600/30'
                    }`}
                  >
                    {refreshing ? '⏳ Refreshing...' : 
                     switchingInstance ? '🔄 Switching...' : 
                     '🔄 Refresh'}
                  </button>
                </div>

                {/* Search and Sort Controls for DF */}
                <div className="bg-gray-700/50 border border-gray-600 rounded-xl p-4">
                  <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <div className="flex-1 w-full sm:w-auto">
                      <label className="block text-sm font-medium text-gray-300 mb-2">Search Files</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search DF files..."
                          value={dfSearchTerm}
                          onChange={(e) => setDfSearchTerm(e.target.value)}
                          className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-10"
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center space-x-2">
                          {dfSearchTerm && (
                            <button
                              onClick={() => setDfSearchTerm('')}
                              className="text-gray-400 hover:text-white"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 items-end">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Sort By</label>
                        <select
                          value={dfSortBy}
                          onChange={(e) => setDfSortBy(e.target.value)}
                          className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="name">Name</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Order</label>
                        <button
                          onClick={() => setDfSortOrder(dfSortOrder === 'asc' ? 'desc' : 'asc')}
                          className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          {dfSortOrder === 'asc' ? '↑' : '↓'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                {(refreshing || switchingInstance) ? (
                  <InlineLoadingAnimation 
                    message={switchingInstance ? 
                      `Switching to ${selectedInstance?.name || 'new instance'}...` : 
                      "Loading Definition Files..."
                    }
                    isActive={refreshing || switchingInstance}
                    minDuration={loadingStartTime ? Math.max(1200, Date.now() - loadingStartTime) : 1200}
                    onComplete={() => {
                      console.log('DF files loading animation completed');
                    }}
                  />
                ) : (
                  renderFileTable(filterAndSortFiles(dfFiles, dfSearchTerm, dfSortBy, dfSortOrder), 'routesets_definitions', 'Definition', 'purple')
                )}
              </div>
            )}

            {/* DM Files Tab */}
            {activeTab === 'dm-files' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-white">Digit Map Files (DM)</h2>
                  <div className="flex gap-4 items-center">
                    <label className="flex items-center text-gray-300 text-sm">
                      <input
                        type="checkbox"
                        checked={runInBackground}
                        onChange={(e) => setRunInBackground(e.target.checked)}
                        className="mr-2"
                      />
                      Run in background
                    </label>
                    <button
                      onClick={loadFiles}
                      disabled={refreshing || switchingInstance}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        refreshing || switchingInstance
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : 'bg-pink-600/20 text-pink-300 hover:bg-pink-600/40 border border-pink-600/30'
                      }`}
                    >
                      {refreshing ? '⏳ Refreshing...' : 
                       switchingInstance ? '🔄 Switching...' : 
                       '🔄 Refresh'}
                    </button>
                    <button
                      onClick={replaceDMFiles}
                      disabled={replacing || !runInBackground && isProcessing}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        replacing || (!runInBackground && isProcessing)
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : 'bg-red-600/20 text-red-300 hover:bg-red-600/40 border border-red-600/30'
                      }`}
                    >
                      {replacing ? '🔄 Replacing...' : 'Replace All Data'}
                    </button>
                  </div>
                </div>

                {/* Replace Progress */}
                {isProcessing && replaceProgress.total > 0 && (
                  <div className="mb-4">
                    <div className="text-sm text-gray-300 mb-2">
                      Processing instances: {replaceProgress.current} / {replaceProgress.total}
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-red-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(replaceProgress.current / replaceProgress.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Replace Result */}
                {replaceResult && (
                  <div className="mb-4">
                    {replaceResult.success ? (
                      <div className="p-4 bg-green-900 border border-green-700 text-green-100 rounded-lg">
                        <div className="font-semibold mb-2">Replacement completed!</div>
                        <div className="text-sm">
                          {replaceResult.message}
                          {replaceResult.successes && replaceResult.successes.length > 0 && (
                            <div className="mt-2">
                              <div className="font-medium">Successful Instances:</div>
                              <ul className="list-disc list-inside mt-1">
                                {replaceResult.successes.map((success, index) => (
                                  <li key={index}>Instance {success.instanceId}: {success.message}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {replaceResult.failures && replaceResult.failures.length > 0 && (
                            <div className="mt-2">
                              <div className="font-medium text-red-300">Failed Instances:</div>
                              <ul className="list-disc list-inside mt-1">
                                {replaceResult.failures.map((failure, index) => (
                                  <li key={index}>Instance {failure.instanceId}: {failure.error}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-red-900 border border-red-700 text-red-100 rounded-lg">
                        <div className="font-semibold mb-2">Replacement failed!</div>
                        <div className="text-sm">{replaceResult.error || replaceResult.message}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Search and Sort Controls for DM */}
                <div className="bg-gray-700/50 border border-gray-600 rounded-xl p-4">
                  <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <div className="flex-1 w-full sm:w-auto">
                      <label className="block text-sm font-medium text-gray-300 mb-2">Search Files</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search DM files..."
                          value={dmSearchTerm}
                          onChange={(e) => setDmSearchTerm(e.target.value)}
                          className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent pr-10"
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center space-x-2">
                          {dmSearchTerm && (
                            <button
                              onClick={() => setDmSearchTerm('')}
                              className="text-gray-400 hover:text-white"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 items-end">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Sort By</label>
                        <select
                          value={dmSortBy}
                          onChange={(e) => setDmSortBy(e.target.value)}
                          className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                        >
                          <option value="name">Name</option>
                          <option value="type">Type</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Order</label>
                        <button
                          onClick={() => setDmSortOrder(dmSortOrder === 'asc' ? 'desc' : 'asc')}
                          className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                        >
                          {dmSortOrder === 'asc' ? '↑' : '↓'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                {(refreshing || switchingInstance) ? (
                  <InlineLoadingAnimation 
                    message={switchingInstance ? 
                      `Switching to ${selectedInstance?.name || 'new instance'}...` : 
                      "Loading Digit Map Files..."
                    }
                    isActive={refreshing || switchingInstance}
                    minDuration={loadingStartTime ? Math.max(1200, Date.now() - loadingStartTime) : 1200}
                    onComplete={() => {
                      console.log('DM files loading animation completed');
                    }}
                  />
                ) : (
                  renderFileTable(filterAndSortFiles(dmFiles, dmSearchTerm, dmSortBy, dmSortOrder), 'routesets_digitmaps', 'Digit Map', 'pink')
                )}
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
  onClick={async () => {
    if (!selectedFile || !updateTarget) {
      setMessage('❌ Please select a file first');
      return;
    }
    setIsUpdating(true);
    try {
      await handleUpdateFileRestAPI(updateTarget.fileType, updateTarget.fileName, selectedFile, updateTarget.configId);
    } catch (error) {
      console.error('Update error:', error);
      setMessage(`❌ Update failed: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  }}
  disabled={!selectedFile || isUpdating}
  className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
    !selectedFile || isUpdating
      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
      : 'bg-blue-600 text-white hover:bg-blue-700'
  }`}
  title="Update file using REST API (recommended)"
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
                onSave={handleSaveEditedFile}
              />
            </div>
          </div>
        )}
      </div>
    
  );
}

export default FileManagement;
