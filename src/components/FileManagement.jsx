import React, { useState, useEffect } from 'react';
import { prosbcFileAPI } from '../utils/prosbcFileApi';

function FileManagement({ onAuthError }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  
  // File lists
  const [dfFiles, setDfFiles] = useState([]);
  const [dmFiles, setDmFiles] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  
  // Edit modal state
  const [editModal, setEditModal] = useState({
    isOpen: false,
    fileType: '',
    fileId: '',
    fileName: '',
    content: ''
  });

  // Load files on component mount
  useEffect(() => {
    loadFiles();
  }, []);

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

  // Open edit modal
  const handleEdit = async (fileType, fileId, fileName) => {
    setIsLoading(true);
    setMessage(`🔄 Loading ${fileName} for editing...`);
    
    try {
      const result = await prosbcFileAPI.getFileContent(fileType, fileId);
      if (result.success) {
        setEditModal({
          isOpen: true,
          fileType,
          fileId,
          fileName,
          content: result.content || ''
        });
        setMessage("");
      }
    } catch (error) {
      console.error('Edit load error:', error);
      setMessage(`❌ Failed to load file for editing: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Save file changes
  const handleSaveEdit = async () => {
    setIsLoading(true);
    setMessage(`� Updating ${editModal.fileName}...`);
    
    try {
      const result = await prosbcFileAPI.updateFile(
        editModal.fileType, 
        editModal.fileId, 
        editModal.content, 
        editModal.fileName
      );
      
      if (result.success) {
        setMessage(`✅ ${result.message}`);
        setEditModal({ isOpen: false, fileType: '', fileId: '', fileName: '', content: '' });
        // Refresh file lists
        setTimeout(() => loadFiles(), 1000);
      }
    } catch (error) {
      console.error('Update error:', error);
      setMessage(`❌ Update failed: ${error.message}`);
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
                        onClick={() => handleEdit(file.type, file.id, file.name)}
                        disabled={isLoading}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                          isLoading 
                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            : `bg-${colorClass}-600 text-white hover:bg-${colorClass}-700`
                        }`}
                        title="Edit file content"
                      >
                        ✏️ Update
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
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Manage, update, export, and delete Definition Files (DF) and Digit Map Files (DM)
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl mb-8 backdrop-blur-sm">
          <div className="flex border-b border-gray-700">
            {[
              { id: 'overview', label: '📊 Overview', icon: '📊' },
              { id: 'df-files', label: '📄 DF Files', icon: '📄' },
              { id: 'dm-files', label: '🗺️ DM Files', icon: '🗺️' },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`flex-1 px-6 py-4 text-lg font-semibold transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                } ${tab.id === 'overview' ? 'rounded-tl-2xl' : ''} ${tab.id === 'management' ? 'rounded-tr-2xl' : ''}`}
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

        {/* Edit Modal */}
        {editModal.isOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-gray-700">
              <div className="p-6 border-b border-gray-700">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-white">
                    Edit File: {editModal.fileName}
                  </h3>
                  <button
                    onClick={() => setEditModal({ isOpen: false, fileType: '', fileId: '', fileName: '', content: '' })}
                    className="text-gray-400 hover:text-white text-2xl"
                  >
                    ✕
                  </button>
                </div>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <textarea
                  value={editModal.content}
                  onChange={(e) => setEditModal({ ...editModal, content: e.target.value })}
                  className="w-full h-96 p-4 bg-gray-900 border border-gray-700 rounded-lg font-mono text-sm text-gray-200 resize-vertical"
                  placeholder="File content..."
                />
              </div>
              
              <div className="p-6 border-t border-gray-700 flex justify-end space-x-3">
                <button
                  onClick={() => setEditModal({ isOpen: false, fileType: '', fileId: '', fileName: '', content: '' })}
                  className="px-6 py-3 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isLoading}
                  className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                    isLoading
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700'
                  }`}
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FileManagement;
