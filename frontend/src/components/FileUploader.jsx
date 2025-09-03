import React, { useState } from 'react';
import { useProSBCInstance } from '../contexts/ProSBCInstanceContext';
import { prosbcFileAPI } from '../utils/prosbcFileApi';
import { ClientDatabaseService } from '../services/apiClient.js';
import { useInstanceAPI } from '../hooks/useInstanceAPI.jsx';

function FileUploader({ onAuthError, configId }) {
  const { selectedInstance, hasSelectedInstance } = useProSBCInstance();
  const instanceAPI = useInstanceAPI();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState('df'); // 'df' or 'dm'
  
  // DF File Upload States
  const [dfFile, setDfFile] = useState(null);
  const [dfFileName, setDfFileName] = useState("");
  
  // DM File Upload States
  const [dmFile, setDmFile] = useState(null);
  const [dmFileName, setDmFileName] = useState("");

  // Helper to get auth headers with instance information
  const getAuthHeaders = () => {
    const token = localStorage.getItem('dashboard_token');
    return {
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...(selectedInstance?.id && { 'X-ProSBC-Instance-ID': selectedInstance.id.toString() })
    };
  };

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
        <p className="text-gray-300 mb-4">Please select a ProSBC instance to upload files.</p>
        <p className="text-sm text-gray-400">Use the instance selector at the top of the page to choose a ProSBC server.</p>
      </div>
    );
  }

  // Handle DF file selection
  const handleDfFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setDfFile(file);
      setDfFileName(file.name);
    }
  };

  // Handle DM file selection
  const handleDmFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setDmFile(file);
      setDmFileName(file.name);
    }
  };

  // Upload DF file
  const handleDfUpload = async () => {
    if (!dfFile) {
      setMessage("❌ Please select a DF file first");
      return;
    }

    if (!selectedInstance?.id) {
      setMessage("❌ No ProSBC instance selected");
      return;
    }

    if (!configId) {
      setMessage(`❌ No config selected. Please select a config from the sidebar first. Current instance: ${selectedInstance?.id || 'none'}`);
      return;
    }

    const instanceId = selectedInstance.id;
    // Use configId prop passed from App.jsx

    setIsLoading(true);
    setMessage("🔄 Uploading DF file...");

    try {
      // Upload DF file to instance-aware backend endpoint
      const formData = new FormData();
      formData.append('file', dfFile, dfFileName);
      
      const response = await fetch('/backend/api/prosbc-files/df/upload-form', {
        method: 'POST',
        headers: {
          'X-ProSBC-Instance-ID': String(instanceId),
          'X-Config-ID': String(configId),
          ...getAuthHeaders()
        },
        body: formData
      });

      let result = null;
      const contentType = response.headers.get('content-type') || '';
      if (response.ok && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        // Try to get text for debugging
        const text = await response.text();
        throw new Error(`Unexpected response from server. Status: ${response.status}. Body: ${text}`);
      }

      if (result.success) {
        let successMessage = `✅ DF file "${dfFileName}" uploaded successfully!`;
        if (result.note && result.note.includes('CORS')) {
          successMessage += '\n📌 Note: Upload completed but redirect confirmation was blocked by browser security.';
        }
        setMessage(successMessage);
        // Record file upload in database
        try {
          const dbService = new ClientDatabaseService();
          await dbService.saveFile({
            name: dfFileName,
            type: 'DF',
            size: dfFile.size,
            file: dfFile,
            originalFile: dfFile,
            prosbc_result: result
          });
          console.log('✅ DF file recorded in database');
          setDfFile(null);
          setDfFileName("");
          // Reset file input
          const fileInput = document.getElementById('df-file-input');
          if (fileInput) fileInput.value = '';
        } catch (dbError) {
          if (dbError.response && dbError.response.status === 409) {
            setMessage(`ℹ️ A file with identical content already exists (${dbError.response.data.existing_file}). No need to upload again.`);
          } else {
            console.error('Database recording error:', dbError);
            setMessage('✅ File uploaded successfully!');
          }
        }
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error) {
      console.error('DF Upload error:', error);
      setMessage(`❌ Failed to upload DF file: ${error.message}`);
      if (error.message.includes('401') || error.message.includes('authentication') || error.message.includes('login')) {
        onAuthError?.();
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Upload DM file
  const handleDmUpload = async () => {
    if (!dmFile) {
      setMessage("❌ Please select a DM file first");
      return;
    }

    if (!selectedInstance?.id) {
      setMessage("❌ No ProSBC instance selected");
      return;
    }

    if (!configId) {
      setMessage(`❌ No config selected. Please select a config from the sidebar first. Current instance: ${selectedInstance?.id || 'none'}`);
      return;
    }

    const instanceId = selectedInstance.id;
    // Use configId prop passed from App.jsx

    setIsLoading(true);
    setMessage("🔄 Uploading DM file...");

    try {
      // Upload DM file to instance-aware backend endpoint
      const formData = new FormData();
      formData.append('file', dmFile, dmFileName);
      
      const response = await fetch('/backend/api/prosbc-files/dm/upload-form', {
        method: 'POST',
        headers: {
          'X-ProSBC-Instance-ID': String(instanceId),
          'X-Config-ID': String(configId),
          ...getAuthHeaders()
        },
        body: formData
      });

      let result = null;
      const contentType = response.headers.get('content-type') || '';
      if (response.ok && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        // Try to get text for debugging
        const text = await response.text();
        throw new Error(`Unexpected response from server. Status: ${response.status}. Body: ${text}`);
      }

      if (result.success) {
        let successMessage = `✅ DM file "${dmFileName}" uploaded successfully!`;
        if (result.note && result.note.includes('CORS')) {
          successMessage += '\n📌 Note: Upload completed but redirect confirmation was blocked by browser security.';
        }
        setMessage(successMessage);
        // Record file upload in database
        try {
          const dbService = new ClientDatabaseService();
          await dbService.saveFile({
            name: dmFileName,
            type: 'DM',
            size: dmFile.size,
            file: dmFile,
            originalFile: dmFile,
            prosbc_result: result
          });
          console.log('✅ DM file recorded in database');
        } catch (dbError) {
          if (dbError.response && dbError.response.status === 409) {
            setMessage(`ℹ️ A file with identical content already exists (${dbError.response.data.existing_file}). No need to upload again.`);
          } else {
            console.error('Database recording error:', dbError);
            setMessage('✅ File uploaded successfully! ');
          }
        }
        setDmFile(null);
        setDmFileName("");
        // Reset file input
        const fileInput = document.getElementById('dm-file-input');
        if (fileInput) fileInput.value = '';
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error) {
      console.error('DM Upload error:', error);
      setMessage(`❌ Failed to upload DM file: ${error.message}`);
      if (error.message.includes('401') || error.message.includes('authentication') || error.message.includes('login')) {
        onAuthError?.();
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Upload DF file to all ProSBCs
  const handleDfUploadAll = async () => {
    if (!dfFile) {
      setMessage("❌ Please select a DF file first");
      return;
    }
    setIsLoading(true);
    setMessage("🔄 Uploading DF file to all ProSBCs...");
    try {
      const formData = new FormData();
      formData.append('file', dfFile, dfFileName);
      const response = await fetch('/backend/api/prosbc-upload/df/all', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData
      });
      const result = await response.json();
      if (result.success) {
        const details = result.results.map(r => {
          let msg = `${r.instance}: ${r.success ? 'Success' : 'Failed'}`;
          if (!r.success && r.error) msg += `\n  Error: ${r.error}`;
          if (r.details && r.details.status) msg += `\n  Status: ${r.details.status}`;
          if (r.details && r.details.data && typeof r.details.data === 'string') msg += `\n  Data: ${r.details.data.substring(0, 200)}`;
          return msg;
        }).join('\n\n');
        setMessage(`✅ DF file uploaded to all ProSBCs!\n\n${details}`);
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error) {
      setMessage(`❌ Failed to upload DF file to all: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Upload DM file to all ProSBCs
  const handleDmUploadAll = async () => {
    if (!dmFile) {
      setMessage("❌ Please select a DM file first");
      return;
    }
    setIsLoading(true);
    setMessage("🔄 Uploading DM file to all ProSBCs...");
    try {
      const formData = new FormData();
      formData.append('file', dmFile, dmFileName);
      const response = await fetch('/backend/api/prosbc-upload/dm/all', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData
      });
      const result = await response.json();
      if (result.success) {
        const details = result.results.map(r => {
          let msg = `${r.instance}: ${r.success ? 'Success' : 'Failed'}`;
          if (!r.success && r.error) msg += `\n  Error: ${r.error}`;
          if (r.details && r.details.status) msg += `\n  Status: ${r.details.status}`;
          if (r.details && r.details.data && typeof r.details.data === 'string') msg += `\n  Data: ${r.details.data.substring(0, 200)}`;
          return msg;
        }).join('\n\n');
        setMessage(`✅ DM file uploaded to all ProSBCs!\n\n${details}`);
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error) {
      setMessage(`❌ Failed to upload DM file to all: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Message styling function
  const getMessageClasses = () => {
    if (message.includes("✅") || message.includes("success")) {
      return "bg-green-900/20 text-green-300 border-green-700 border-l-4 border-l-green-500";
    } else if (message.includes("❌") || message.includes("Failed")) {
      return "bg-red-900/20 text-red-300 border-red-700 border-l-4 border-l-red-500";
    } else if (message.includes("🔄") || message.includes("Uploading")) {
      return "bg-blue-900/20 text-blue-300 border-blue-700 border-l-4 border-l-blue-500";
    }
    return "bg-gray-700/50 text-gray-300 border-gray-600 border-l-4 border-l-gray-500";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent mb-4">
            📁 ProSBC File Manager
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-6">
            Upload and manage DF (Definition Files) and DM (Digit Map) files to ProSBC
          </p>
          
          
        </div>

        {/* File Upload Info */}
        

        {/* Tab Navigation */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-700 mb-8">
          <div className="flex border-b border-gray-700">
            <button
              className={`flex-1 px-6 py-4 text-lg font-semibold transition-all duration-200 rounded-tl-2xl ${
                activeTab === 'df'
                  ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
              }`}
              onClick={() => setActiveTab('df')}
            >
              <div className="flex items-center justify-center space-x-2">
                <span className="text-2xl">📄</span>
                <span>DF Files (Definitions)</span>
              </div>
            </button>
            <button
              className={`flex-1 px-6 py-4 text-lg font-semibold transition-all duration-200 rounded-tr-2xl ${
                activeTab === 'dm'
                  ? 'bg-gradient-to-r from-pink-600 to-pink-700 text-white shadow-lg'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
              }`}
              onClick={() => setActiveTab('dm')}
            >
              <div className="flex items-center justify-center space-x-2">
                <span className="text-2xl">🗺️</span>
                <span>DM Files (Digit Maps)</span>
              </div>
            </button>
          </div>

          {/* DF File Upload Tab */}
          {activeTab === 'df' && (
            <div className="p-8">
              <div className="flex items-center mb-6">
                <span className="text-3xl mr-3">📄</span>
                <h2 className="text-2xl font-bold text-white">Upload Definition File (DF)</h2>
              </div>
              
              <div className="space-y-6">
                <div className="bg-purple-900/20 border border-purple-700 rounded-xl p-6 backdrop-blur-sm">
                  <h3 className="text-lg font-semibold text-purple-300 mb-3">What are DF Files?</h3>
                  <p className="text-purple-200 text-sm mb-3">
                    Definition Files (DF) contain routeset definitions that configure how calls are routed through the ProSBC system.
                  </p>
                  <div className="text-purple-300 text-sm">
                    <strong>Supported formats:</strong> XML, CSV files exported from ProSBC or compatible systems
                  </div>
                </div>

                {/* File Input */}
                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-gray-300">
                    Select DF File
                  </label>
                  <div className="flex items-center space-x-4">
                    <input
                      id="df-file-input"
                      type="file"
                      accept=".xml,.csv,.txt"
                      onChange={handleDfFileChange}
                      className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-900/30 file:text-purple-300 hover:file:bg-purple-800/50 file:cursor-pointer border border-gray-600 rounded-lg p-2 bg-gray-700/30"
                    />
                  </div>
                  
                  {dfFileName && (
                    <div className="flex items-center space-x-2 text-sm text-gray-300">
                      <span className="text-green-400">✓</span>
                      <span>Selected: <strong>{dfFileName}</strong></span>
                    </div>
                  )}
                </div>

                {/* Upload Button */}
                <div className="flex justify-center">
                  <button
                    onClick={handleDfUpload}
                    disabled={isLoading || !dfFile}
                    className={`px-8 py-4 rounded-xl font-semibold text-white transition-all duration-200 flex items-center space-x-3 ${
                      isLoading || !dfFile
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 transform hover:scale-105 shadow-lg hover:shadow-xl border border-purple-500/30'
                    }`}
                  >
                    <span className="text-xl">
                      {isLoading ? '⏳' : '📤'}
                    </span>
                    <span>
                      {isLoading ? 'Uploading DF File...' : 'Upload Definition File'}
                    </span>
                  </button>

                  {/* Upload to All ProSBCs Button (DF) */}
                  <button
                    onClick={handleDfUploadAll}
                    disabled={isLoading || !dfFile}
                    className="ml-4 px-8 py-4 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 flex items-center space-x-3"
                  >
                    <span className="text-xl">🌐</span>
                    <span>{isLoading ? 'Uploading to All...' : 'Upload to All ProSBCs'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* DM File Upload Tab */}
          {activeTab === 'dm' && (
            <div className="p-8">
              <div className="flex items-center mb-6">
                <span className="text-3xl mr-3">🗺️</span>
                <h2 className="text-2xl font-bold text-white">Upload Digit Map File (DM)</h2>
              </div>
              
              <div className="space-y-6">
                <div className="bg-pink-900/20 border border-pink-700 rounded-xl p-6 backdrop-blur-sm">
                  <h3 className="text-lg font-semibold text-pink-300 mb-3">What are DM Files?</h3>
                  <p className="text-pink-200 text-sm mb-3">
                    Digit Map Files (DM) contain number translation rules and digit manipulation patterns for call routing.
                  </p>
                  <div className="text-pink-300 text-sm">
                    <strong>Supported formats:</strong> XML, CSV files with digit mapping configurations
                  </div>
                </div>

                {/* File Input */}
                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-gray-300">
                    Select DM File
                  </label>
                  <div className="flex items-center space-x-4">
                    <input
                      id="dm-file-input"
                      type="file"
                      accept=".xml,.csv,.txt"
                      onChange={handleDmFileChange}
                      className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-pink-900/30 file:text-pink-300 hover:file:bg-pink-800/50 file:cursor-pointer border border-gray-600 rounded-lg p-2 bg-gray-700/30"
                    />
                  </div>
                  
                  {dmFileName && (
                    <div className="flex items-center space-x-2 text-sm text-gray-300">
                      <span className="text-green-400">✓</span>
                      <span>Selected: <strong>{dmFileName}</strong></span>
                    </div>
                  )}
                </div>

                {/* Upload Button */}
                <div className="flex justify-center">
                  <button
                    onClick={handleDmUpload}
                    disabled={isLoading || !dmFile}
                    className={`px-8 py-4 rounded-xl font-semibold text-white transition-all duration-200 flex items-center space-x-3 ${
                      isLoading || !dmFile
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-pink-600 to-pink-700 hover:from-pink-700 hover:to-pink-800 transform hover:scale-105 shadow-lg hover:shadow-xl border border-pink-500/30'
                    }`}
                  >
                    <span className="text-xl">
                      {isLoading ? '⏳' : '📤'}
                    </span>
                    <span>
                      {isLoading ? 'Uploading DM File...' : 'Upload Digit Map File'}
                    </span>
                  </button>

                  {/* Upload to All ProSBCs Button (DM) */}
                  <button
                    onClick={handleDmUploadAll}
                    disabled={isLoading || !dmFile}
                    className="ml-4 px-8 py-4 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 flex items-center space-x-3"
                  >
                    <span className="text-xl">🌐</span>
                    <span>{isLoading ? 'Uploading to All...' : 'Upload to All ProSBCs'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Status Message */}
        {message && (
          <div className="bg-gray-800 rounded-2xl p-8 shadow-lg border border-gray-700">
            <div className={`p-6 rounded-xl border font-mono text-sm leading-relaxed ${getMessageClasses()}`}>
              {message.split('\n').map((line, index) => (
                <div key={index} className={index > 0 ? 'mt-2' : ''}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        )}

      
      </div>
    </div>
  );
}

export default FileUploader;
