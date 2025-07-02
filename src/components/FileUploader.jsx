import React, { useState } from 'react';
import { prosbcFileAPI } from '../utils/prosbcFileApi';

function FileUploader({ onAuthError }) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState('df'); // 'df' or 'dm'
  
  // DF File Upload States
  const [dfFile, setDfFile] = useState(null);
  const [dfFileName, setDfFileName] = useState("");
  
  // DM File Upload States
  const [dmFile, setDmFile] = useState(null);
  const [dmFileName, setDmFileName] = useState("");

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

    setIsLoading(true);
    setMessage("🔄 Uploading DF file...");

    try {
      const result = await prosbcFileAPI.uploadDfFile(dfFile, (progress, statusMessage) => {
        setMessage(`🔄 ${statusMessage}`);
      });

      if (result.success) {
        setMessage(`✅ DF file "${dfFileName}" uploaded successfully!`);
        setDfFile(null);
        setDfFileName("");
        // Reset file input
        const fileInput = document.getElementById('df-file-input');
        if (fileInput) fileInput.value = '';
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

    setIsLoading(true);
    setMessage("🔄 Uploading DM file...");

    try {
      const result = await prosbcFileAPI.uploadDmFile(dmFile, (progress, statusMessage) => {
        setMessage(`🔄 ${statusMessage}`);
      });

      if (result.success) {
        setMessage(`✅ DM file "${dmFileName}" uploaded successfully!`);
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

  // Message styling function
  const getMessageClasses = () => {
    if (message.includes("✅") || message.includes("success")) {
      return "bg-green-50 text-green-800 border-green-200 border-l-4 border-l-green-500";
    } else if (message.includes("❌") || message.includes("Failed")) {
      return "bg-red-50 text-red-800 border-red-200 border-l-4 border-l-red-500";
    } else if (message.includes("🔄") || message.includes("Uploading")) {
      return "bg-blue-50 text-blue-800 border-blue-200 border-l-4 border-l-blue-500";
    }
    return "bg-gray-50 text-gray-800 border-gray-200 border-l-4 border-l-gray-500";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
            📁 ProSBC File Manager
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Upload and manage DF (Definition Files) and DM (Digit Map) files to ProSBC
          </p>
        </div>

        {/* File Upload Info */}
        

        {/* Tab Navigation */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 mb-8">
          <div className="flex border-b border-gray-200">
            <button
              className={`flex-1 px-6 py-4 text-lg font-semibold transition-all duration-200 rounded-tl-2xl ${
                activeTab === 'df'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
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
                  ? 'bg-pink-600 text-white shadow-lg'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
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
                <h2 className="text-2xl font-bold text-gray-800">Upload Definition File (DF)</h2>
              </div>
              
              <div className="space-y-6">
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-purple-800 mb-3">What are DF Files?</h3>
                  <p className="text-purple-700 text-sm mb-3">
                    Definition Files (DF) contain routeset definitions that configure how calls are routed through the ProSBC system.
                  </p>
                  <div className="text-purple-600 text-sm">
                    <strong>Supported formats:</strong> XML, CSV files exported from ProSBC or compatible systems
                  </div>
                </div>

                {/* File Input */}
                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-gray-700">
                    Select DF File
                  </label>
                  <div className="flex items-center space-x-4">
                    <input
                      id="df-file-input"
                      type="file"
                      accept=".xml,.csv,.txt"
                      onChange={handleDfFileChange}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 file:cursor-pointer border border-gray-300 rounded-lg p-2"
                    />
                  </div>
                  
                  {dfFileName && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <span className="text-green-600">✓</span>
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
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 transform hover:scale-105 shadow-lg hover:shadow-xl'
                    }`}
                  >
                    <span className="text-xl">
                      {isLoading ? '⏳' : '📤'}
                    </span>
                    <span>
                      {isLoading ? 'Uploading DF File...' : 'Upload Definition File'}
                    </span>
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
                <h2 className="text-2xl font-bold text-gray-800">Upload Digit Map File (DM)</h2>
              </div>
              
              <div className="space-y-6">
                <div className="bg-pink-50 border border-pink-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-pink-800 mb-3">What are DM Files?</h3>
                  <p className="text-pink-700 text-sm mb-3">
                    Digit Map Files (DM) contain number translation rules and digit manipulation patterns for call routing.
                  </p>
                  <div className="text-pink-600 text-sm">
                    <strong>Supported formats:</strong> XML, CSV files with digit mapping configurations
                  </div>
                </div>

                {/* File Input */}
                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-gray-700">
                    Select DM File
                  </label>
                  <div className="flex items-center space-x-4">
                    <input
                      id="dm-file-input"
                      type="file"
                      accept=".xml,.csv,.txt"
                      onChange={handleDmFileChange}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100 file:cursor-pointer border border-gray-300 rounded-lg p-2"
                    />
                  </div>
                  
                  {dmFileName && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <span className="text-green-600">✓</span>
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
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-pink-600 to-pink-700 hover:from-pink-700 hover:to-pink-800 transform hover:scale-105 shadow-lg hover:shadow-xl'
                    }`}
                  >
                    <span className="text-xl">
                      {isLoading ? '⏳' : '📤'}
                    </span>
                    <span>
                      {isLoading ? 'Uploading DM File...' : 'Upload Digit Map File'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Status Message */}
        {message && (
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
            <div className={`p-6 rounded-xl border font-mono text-sm leading-relaxed ${getMessageClasses()}`}>
              {message}
            </div>
          </div>
        )}

      
      </div>
    </div>
  );
}

export default FileUploader;
