import React, { useState, useEffect } from 'react';
import { ClientDatabaseService } from '../services/apiClient.js';

const DatabaseStatus = ({ showDetails = false, className = '' }) => {
  const [clientDbStatus, setClientDbStatus] = useState('checking');
  const [serverDbStatus, setServerDbStatus] = useState('checking');
  const [clientDbData, setClientDbData] = useState({});
  const [serverDbData, setServerDbData] = useState({});
  const [isChecking, setIsChecking] = useState(false);
  const [expanded, setExpanded] = useState(showDetails);

  const checkDatabaseStatus = async () => {
    setIsChecking(true);
    
    // Check client-side database (localStorage)
    try {
      const dbService = new ClientDatabaseService();
      const analytics = await dbService.getAnalytics();
      
      if (analytics.success) {
        setClientDbStatus('connected');
        setClientDbData({
          naps: analytics.analytics.totalNaps,
          files: analytics.analytics.totalFiles,
          logs: analytics.analytics.totalActivations,
          storageSize: analytics.analytics.totalFileSize
        });
      } else {
        setClientDbStatus('error');
      }
    } catch (error) {
      console.error('Client DB check failed:', error);
      setClientDbStatus('error');
    }

    // Check server-side database (if available)
    try {
      // Try to import and check the server database
      const { getDBHealth } = await import('../database/index.js');
      const health = await getDBHealth();
      
      if (health && health.status === 'healthy') {
        setServerDbStatus('connected');
        setServerDbData(health);
      } else {
        setServerDbStatus('disconnected');
      }
    } catch (error) {
      console.error('Server DB check failed:', error);
      setServerDbStatus('disconnected');
    }
    
    setIsChecking(false);
  };

  const checkLocalStorageData = () => {
    const naps = JSON.parse(localStorage.getItem('prosbc_naps') || '[]');
    const files = JSON.parse(localStorage.getItem('prosbc_files') || '[]');
    const logs = JSON.parse(localStorage.getItem('prosbc_logs') || '[]');
    
    return { naps, files, logs };
  };

  const clearLocalStorageData = () => {
    localStorage.removeItem('prosbc_naps');
    localStorage.removeItem('prosbc_files');
    localStorage.removeItem('prosbc_logs');
    checkDatabaseStatus();
  };

  useEffect(() => {
    checkDatabaseStatus();
    const interval = setInterval(checkDatabaseStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'disconnected': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'error': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'checking': return 'text-blue-400 bg-blue-400/10 border-blue-400/20 animate-pulse';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'connected': 
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'checking':
        return (
          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'disconnected':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L3.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const localData = checkLocalStorageData();

  if (!expanded && !showDetails) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className={`flex items-center space-x-1 px-2 py-1 rounded border ${getStatusColor(clientDbStatus)}`}>
          {getStatusIcon(clientDbStatus)}
          <span className="text-xs font-medium">DB</span>
        </div>
        <button
          onClick={() => setExpanded(true)}
          className="text-xs text-gray-400 hover:text-white"
        >
          Details
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-gray-800 rounded-lg p-6 space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Database Status</h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={checkDatabaseStatus}
            disabled={isChecking}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isChecking ? '🔄 Checking...' : '🔄 Refresh'}
          </button>
          {expanded && (
            <button
              onClick={() => setExpanded(false)}
              className="text-gray-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Client Database (localStorage) */}
      <div className="bg-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Client Database (localStorage)</h3>
          <span className={`flex items-center space-x-2 px-3 py-1 rounded border ${getStatusColor(clientDbStatus)}`}>
            {getStatusIcon(clientDbStatus)}
            <span className="capitalize text-sm">{clientDbStatus}</span>
          </span>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-gray-800 p-3 rounded">
            <p className="text-sm text-gray-400">NAPs</p>
            <p className="text-xl font-bold text-white">{localData.naps.length}</p>
          </div>
          <div className="bg-gray-800 p-3 rounded">
            <p className="text-sm text-gray-400">Files</p>
            <p className="text-xl font-bold text-white">{localData.files.length}</p>
          </div>
          <div className="bg-gray-800 p-3 rounded">
            <p className="text-sm text-gray-400">Logs</p>
            <p className="text-xl font-bold text-white">{localData.logs.length}</p>
          </div>
          <div className="bg-gray-800 p-3 rounded">
            <p className="text-sm text-gray-400">Storage</p>
            <p className="text-xl font-bold text-white">
              {clientDbData.storageSize ? `${(clientDbData.storageSize / 1024).toFixed(1)}KB` : '0KB'}
            </p>
          </div>
        </div>

        {localData.naps.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-300 mb-2">Recent NAPs:</h4>
            <div className="space-y-1">
              {localData.naps.slice(-3).map((nap, idx) => (
                <div key={idx} className="text-sm text-gray-400 bg-gray-800 p-2 rounded">
                  {nap.name} - {nap.status} ({new Date(nap.created_at).toLocaleDateString()})
                </div>
              ))}
            </div>
          </div>
        )}

        {localData.files.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-300 mb-2">Recent Files:</h4>
            <div className="space-y-1">
              {localData.files.slice(-3).map((file, idx) => (
                <div key={idx} className="text-sm text-gray-400 bg-gray-800 p-2 rounded">
                  {file.name} ({file.type}) - {(file.size / 1024).toFixed(1)}KB
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex space-x-2">
          <button
            onClick={clearLocalStorageData}
            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
          >
            Clear LocalStorage Data
          </button>
        </div>
      </div>

      {/* Server Database (MongoDB/Backend) */}
      <div className="bg-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Server Database (Backend)</h3>
          <span className={`flex items-center space-x-2 px-3 py-1 rounded border ${getStatusColor(serverDbStatus)}`}>
            {getStatusIcon(serverDbStatus)}
            <span className="capitalize text-sm">{serverDbStatus}</span>
          </span>
        </div>
        
        {serverDbStatus === 'connected' ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-300">Database: {serverDbData.database}</p>
            <p className="text-sm text-gray-300">Collections: {serverDbData.collections}</p>
            <p className="text-sm text-gray-300">Data Size: {serverDbData.dataSize}</p>
            <p className="text-sm text-gray-300">Last Checked: {new Date(serverDbData.lastChecked).toLocaleString()}</p>
          </div>
        ) : (
          <div className="text-sm text-gray-400">
            {serverDbStatus === 'disconnected' 
              ? 'Server database is not running or not configured' 
              : 'Error connecting to server database'}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-900 border border-blue-600 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-300 mb-2">How to check your database:</h4>
        <ul className="text-sm text-blue-200 space-y-1">
          <li>• <strong>Client Database:</strong> Data stored in browser localStorage (always available)</li>
          <li>• <strong>Server Database:</strong> Requires MongoDB and backend server running</li>
          <li>• Use browser DevTools → Application → Local Storage to inspect data manually</li>
          <li>• Check browser console for database operation logs</li>
          <li>• Create a NAP or upload a file to test database recording</li>
        </ul>
      </div>
    </div>
  );
};

export default DatabaseStatus;
