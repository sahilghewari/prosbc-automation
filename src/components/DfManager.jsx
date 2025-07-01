import React, { useState } from 'react';
import { prosbcFileAPI } from '../utils/prosbcFileApi';

function DfManager({ onAuthError }) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
      setMessage("");
      setUploadProgress(0);
    }
  };

  // Clear file selection
  const clearFile = () => {
    setSelectedFile(null);
    setFileName("");
    setMessage("");
    setUploadProgress(0);
    const fileInput = document.getElementById('df-file-input');
    if (fileInput) fileInput.value = '';
  };

  // Upload DF file
  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage("❌ Please select a DF file first");
      return;
    }

    setIsLoading(true);
    setMessage("🔄 Initializing upload...");
    setUploadProgress(0);

    try {
      const result = await prosbcFileAPI.uploadDfFile(selectedFile, (progress, statusMessage) => {
        setUploadProgress(progress);
        setMessage(`🔄 ${statusMessage}`);
      });

      if (result.success) {
        setMessage(`✅ DF file "${fileName}" uploaded successfully!\n\nFile has been imported to ProSBC routesets definitions.`);
        
        // Clear the form after successful upload
        setTimeout(() => {
          clearFile();
        }, 3000);
      } else {
        throw new Error(result.message || 'Upload failed');
      }

    } catch (error) {
      console.error('DF Upload error:', error);
      setMessage(`❌ Failed to upload DF file: ${error.message}\n\nPlease check your file format and network connection.`);
      setUploadProgress(0);
      
      if (error.message.includes('401') || error.message.includes('authentication') || error.message.includes('login')) {
        onAuthError?.();
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Get file size in readable format
  const getFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Message styling function
  const getMessageClasses = () => {
    if (message.includes("✅") || message.includes("success")) {
      return "bg-green-50 text-green-800 border-green-200 border-l-4 border-l-green-500";
    } else if (message.includes("❌") || message.includes("Failed")) {
      return "bg-red-50 text-red-800 border-red-200 border-l-4 border-l-red-500";
    } else if (message.includes("🔄") || message.includes("Uploading") || message.includes("Getting")) {
      return "bg-blue-50 text-blue-800 border-blue-200 border-l-4 border-l-blue-500";
    }
    return "bg-gray-50 text-gray-800 border-gray-200 border-l-4 border-l-gray-500";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mb-4">
            📄 ProSBC DF Manager
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Upload and manage Definition Files (DF) for ProSBC routeset configurations
          </p>
        </div>

        {/* Info Section */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <span className="text-3xl">📋</span>
            <h3 className="text-2xl font-bold text-gray-800">Definition Files (DF)</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-semibold text-purple-800">What are DF Files?</h4>
              <p className="text-gray-600 text-sm">
                Definition Files contain routeset configurations that define how calls are routed through the ProSBC system. 
                They include rules for call handling, number manipulation, and routing decisions.
              </p>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold text-purple-800">File Requirements</h4>
              <ul className="text-gray-600 text-sm space-y-1">
                <li>• <strong>Formats:</strong> XML, CSV, TXT</li>
                <li>• <strong>Max Size:</strong> 50MB recommended</li>
                <li>• <strong>Encoding:</strong> UTF-8 preferred</li>
                <li>• <strong>Structure:</strong> Valid ProSBC format</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 mb-8">
          <div className="flex items-center mb-6">
            <span className="text-3xl mr-3">📤</span>
            <h2 className="text-2xl font-bold text-gray-800">Upload DF File</h2>
          </div>

          <div className="space-y-6">
            {/* File Input Area */}
            <div className="border-2 border-dashed border-purple-300 rounded-xl p-8 text-center hover:border-purple-400 transition-colors duration-200">
              <div className="space-y-4">
                <div className="text-6xl text-purple-400">📁</div>
                <div>
                  <label htmlFor="df-file-input" className="cursor-pointer">
                    <span className="text-lg font-semibold text-purple-600 hover:text-purple-700">
                      Choose DF File
                    </span>
                    <input
                      id="df-file-input"
                      type="file"
                      accept=".xml,.csv,.txt"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  <p className="text-gray-500 text-sm mt-2">
                    or drag and drop your file here
                  </p>
                </div>
                <p className="text-xs text-gray-400">
                  Supported formats: XML, CSV, TXT (Max 50MB)
                </p>
              </div>
            </div>

            {/* Selected File Info */}
            {selectedFile && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">📄</span>
                    <div>
                      <p className="font-semibold text-purple-800">{fileName}</p>
                      <p className="text-sm text-purple-600">
                        Size: {getFileSize(selectedFile.size)} | Type: {selectedFile.type || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={clearFile}
                    className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-colors duration-200"
                    title="Remove file"
                  >
                    <span className="text-xl">🗑️</span>
                  </button>
                </div>
              </div>
            )}

            {/* Upload Progress */}
            {isLoading && uploadProgress > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Upload Progress</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-purple-600 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-center space-x-4">
              <button
                onClick={handleUpload}
                disabled={isLoading || !selectedFile}
                className={`px-8 py-4 rounded-xl font-semibold text-white transition-all duration-200 flex items-center space-x-3 ${
                  isLoading || !selectedFile
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 transform hover:scale-105 shadow-lg hover:shadow-xl'
                }`}
              >
                <span className="text-xl">
                  {isLoading ? '⏳' : '🚀'}
                </span>
                <span>
                  {isLoading ? 'Uploading...' : 'Upload DF File'}
                </span>
              </button>

              {selectedFile && !isLoading && (
                <button
                  onClick={clearFile}
                  className="px-6 py-4 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all duration-200 flex items-center space-x-2"
                >
                  <span className="text-xl">🔄</span>
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Status Message */}
        {message && (
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 mb-8">
            <div className={`p-6 rounded-xl border font-mono text-sm leading-relaxed whitespace-pre-line ${getMessageClasses()}`}>
              {message}
            </div>
          </div>
        )}

        {/* Best Practices */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <div className="flex items-center mb-6">
            <span className="text-3xl mr-3">💡</span>
            <h3 className="text-2xl font-bold text-gray-800">Best Practices</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold text-purple-800 flex items-center">
                <span className="mr-2">📋</span>
                Before Upload
              </h4>
              <ul className="text-sm text-gray-600 space-y-2 ml-6">
                <li>✓ Validate XML structure and syntax</li>
                <li>✓ Review routeset definitions</li>
                <li>✓ Backup existing configurations</li>
                <li>✓ Test in staging environment</li>
              </ul>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-semibold text-purple-800 flex items-center">
                <span className="mr-2">⚙️</span>
                After Upload
              </h4>
              <ul className="text-sm text-gray-600 space-y-2 ml-6">
                <li>✓ Verify import success in ProSBC</li>
                <li>✓ Test call routing functionality</li>
                <li>✓ Monitor system performance</li>
                <li>✓ Document changes made</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DfManager;
