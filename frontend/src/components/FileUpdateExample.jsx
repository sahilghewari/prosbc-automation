// Example: File Update Component
// Demonstrates how to use the file update service in a React component
import React, { useState, useRef } from 'react';
import { fileUpdateService, updateFile, testConnection, getUpdateStatus, getUpdateHistory } from '../utils/fileUpdateService.js';

const FileUpdateExample = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateMessage, setUpdateMessage] = useState('');
  const [updateResult, setUpdateResult] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [updateHistory, setUpdateHistory] = useState([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const fileInputRef = useRef(null);

  // Handle file selection
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
      const result = await testConnection();
      setConnectionStatus(result);
      console.log('Connection test result:', result);
    } catch (error) {
      setConnectionStatus({
        success: false,
        error: error.message
      });
    }
  };

  // Handle file update
  const handleFileUpdate = async () => {
    if (!selectedFile) {
      alert('Please select a file first');
      return;
    }

    setIsUpdating(true);
    setUpdateProgress(0);
    setUpdateMessage('Starting update...');
    setUpdateResult(null);

    try {
      const result = await updateFile(selectedFile, {
        fileDbId: 1,
        routesetId: 1,
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
        
        // Refresh update history
        const history = getUpdateHistory();
        setUpdateHistory(history);
        
        // Clear file selection
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setUpdateMessage(`Update failed: ${result.error}`);
      }

    } catch (error) {
      console.error('Update error:', error);
      setUpdateResult({
        success: false,
        error: error.message
      });
      setUpdateMessage(`Update failed: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Load update history
  const loadUpdateHistory = () => {
    const history = getUpdateHistory();
    setUpdateHistory(history);
  };

  // Clear update history
  const clearHistory = () => {
    fileUpdateService.clearUpdateHistory();
    setUpdateHistory([]);
  };

  // Get status info
  const getStatusInfo = () => {
    const status = getUpdateStatus();
    console.log('Current status:', status);
    return status;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">ProSBC File Update</h2>
      
      {/* Connection Test Section */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">Connection Test</h3>
        <button
          onClick={handleTestConnection}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mr-3"
          disabled={connectionStatus?.testing}
        >
          {connectionStatus?.testing ? 'Testing...' : 'Test Connection'}
        </button>
        
        {connectionStatus && !connectionStatus.testing && (
          <div className={`mt-2 p-2 rounded ${
            connectionStatus.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {connectionStatus.success ? 
              `✓ ${connectionStatus.message}` : 
              `✗ ${connectionStatus.error}`
            }
          </div>
        )}
      </div>

      {/* File Selection Section */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">Select File to Update</h3>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt,.json"
          onChange={handleFileSelect}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        
        {selectedFile && (
          <div className="mt-3 p-3 bg-blue-50 rounded">
            <p><strong>Selected File:</strong> {selectedFile.name}</p>
            <p><strong>Size:</strong> {(selectedFile.size / 1024).toFixed(2)} KB</p>
            <p><strong>Type:</strong> {selectedFile.type || 'Unknown'}</p>
          </div>
        )}
      </div>

      {/* Update Section */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">Update File</h3>
        
        <button
          onClick={handleFileUpdate}
          disabled={!selectedFile || isUpdating}
          className={`px-6 py-3 rounded-lg font-semibold ${
            !selectedFile || isUpdating
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-green-500 text-white hover:bg-green-600'
          }`}
        >
          {isUpdating ? 'Updating...' : 'Update File'}
        </button>

        {/* Progress Bar */}
        {isUpdating && (
          <div className="mt-4">
            <div className="bg-gray-200 rounded-full h-4 overflow-hidden">
              <div
                className="bg-blue-500 h-full transition-all duration-300"
                style={{ width: `${updateProgress}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-gray-600">{updateMessage}</p>
          </div>
        )}

        {/* Update Result */}
        {updateResult && (
          <div className={`mt-4 p-3 rounded ${
            updateResult.success 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {updateResult.success ? (
              <div>
                <p className="font-semibold">✓ Update Successful!</p>
                <p className="text-sm">Attempts: {updateResult.attempts}</p>
                {updateResult.result?.redirectUrl && (
                  <p className="text-sm">Redirect URL: {updateResult.result.redirectUrl}</p>
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
      </div>

      {/* Status Section */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">Status</h3>
        <button
          onClick={getStatusInfo}
          className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 mr-3"
        >
          Get Status
        </button>
        
        <div className="mt-2 text-sm text-gray-600">
          <p>Currently updating: {isUpdating ? 'Yes' : 'No'}</p>
          <p>Progress: {updateProgress}%</p>
          <p>Message: {updateMessage || 'None'}</p>
        </div>
      </div>

      {/* Update History Section */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">Update History</h3>
        
        <div className="mb-3">
          <button
            onClick={loadUpdateHistory}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 mr-3"
          >
            Load History
          </button>
          <button
            onClick={clearHistory}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Clear History
          </button>
        </div>

        {updateHistory.length > 0 ? (
          <div className="space-y-2">
            {updateHistory.map((entry, index) => (
              <div key={index} className={`p-2 rounded text-sm ${
                entry.success ? 'bg-green-100' : 'bg-red-100'
              }`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{entry.fileName}</p>
                    <p className="text-xs text-gray-600">
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${
                      entry.success ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {entry.success ? '✓ Success' : '✗ Failed'}
                    </p>
                    <p className="text-xs">Attempts: {entry.attempts}</p>
                  </div>
                </div>
                {entry.error && (
                  <p className="text-xs text-red-600 mt-1">{entry.error}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No update history available</p>
        )}
      </div>
    </div>
  );
};

export default FileUpdateExample;
