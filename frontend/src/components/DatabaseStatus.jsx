import React, { useState, useEffect } from 'react';
import { ClientDatabaseService } from '../services/apiClient.js';
import { config, getEnvironmentInfo, getStorageType } from '../config/environment.js';

const DatabaseStatus = ({ showDetails = false, className = '' }) => {
  const [dbStatus, setDbStatus] = useState('checking');
  const [dbData, setDbData] = useState({});
  const [serverDbStatus, setServerDbStatus] = useState('checking');
  const [serverDbData, setServerDbData] = useState({});
  const [environmentInfo, setEnvironmentInfo] = useState({});
  const [isChecking, setIsChecking] = useState(false);
  const [expanded, setExpanded] = useState(showDetails);

  const checkDatabaseStatus = async () => {
    setIsChecking(true);
    
    try {
      // Get environment information
      const envInfo = getEnvironmentInfo();
      setEnvironmentInfo(envInfo);
      
      // Check database status
      const dbService = new ClientDatabaseService();
      
      // Get analytics to check client-side storage
      const analytics = await dbService.getAnalytics();
      
      if (analytics.success) {
        setDbStatus('connected');
        setDbData({
          naps: analytics.analytics.totalNaps,
          files: analytics.analytics.totalFiles,
          logs: analytics.analytics.totalActivations,
          storageSize: analytics.analytics.totalFileSize,
          storageType: getStorageType(),
          environment: envInfo
        });
      } else {
        setDbStatus('error');
        setDbData({ error: analytics.error });
      }

      // Check Ubuntu backend health through API endpoint
      try {
        const response = await fetch('/api/dashboard/system-status');
        const data = await response.json();
        if (data.success) {
          setServerDbStatus('connected');
          setServerDbData(data.data);
        } else {
          setServerDbStatus('disconnected');
          setServerDbData({ message: 'Ubuntu backend not available' });
        }
      } catch (error) {
        console.log('Ubuntu backend not available (expected in development)');
        setServerDbStatus('disconnected');
        setServerDbData({ message: 'Ubuntu backend not available' });
      }
      
    } catch (error) {
      console.error('Database check failed:', error);
      setDbStatus('error');
      setServerDbStatus('error');
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
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
        <div className={`flex items-center space-x-1 px-2 py-1 rounded border ${getStatusColor(dbStatus)}`}>
          {getStatusIcon(dbStatus)}
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
          <div className="flex items-center space-x-2">
            <span className={`flex items-center space-x-2 px-3 py-1 rounded border ${getStatusColor(dbStatus)}`}>
              {getStatusIcon(dbStatus)}
              <span className="capitalize text-sm">{dbStatus}</span>
            </span>
            <button
              onClick={clearLocalStorageData}
              className="px-2 py-1 text-xs text-red-400 hover:text-red-300 border border-red-400 hover:border-red-300 rounded"
              title="Clear localStorage data"
            >
              Clear Data
            </button>
          </div>
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
              {dbData.storageSize ? `${(dbData.storageSize / 1024).toFixed(1)}KB` : '0KB'}
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
                  {file.name || file.fileName} ({file.type || file.fileType})
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Ubuntu Backend Status */}
      <div className="bg-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Ubuntu Backend</h3>
          <span className={`flex items-center space-x-2 px-3 py-1 rounded border ${getStatusColor(serverDbStatus)}`}>
            {getStatusIcon(serverDbStatus)}
            <span className="capitalize text-sm">{serverDbStatus}</span>
          </span>
        </div>
        
        {serverDbStatus === 'connected' ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-300">System: {serverDbData.system}</p>
            <p className="text-sm text-gray-300">Uptime: {serverDbData.uptime}</p>
            <p className="text-sm text-gray-300">Memory Usage: {serverDbData.memory_usage}</p>
            <p className="text-sm text-gray-300">Environment: {serverDbData.environment}</p>
            <p className="text-sm text-gray-300">Last Checked: {new Date(serverDbData.last_updated).toLocaleString()}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-sm text-gray-400">
              {serverDbStatus === 'disconnected' 
                ? 'Ubuntu backend not running (expected in development)' 
                : 'Error connecting to Ubuntu backend'}
            </div>
            {serverDbStatus === 'disconnected' && (
              <div className="text-xs text-blue-300 bg-blue-900 p-2 rounded">
                💡 This is normal in development. The app automatically uses localStorage when Ubuntu backend is not available.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-900 border border-blue-600 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-300 mb-2">How to check your database:</h4>
        <ul className="text-sm text-blue-200 space-y-1">
          <li>• <strong>Client Database:</strong> Data stored in browser localStorage (always available)</li>
          <li>• <strong>Ubuntu Backend:</strong> File system storage for production deployment</li>
          <li>• Use browser DevTools → Application → Local Storage to inspect data manually</li>
          <li>• Check browser console for database operation logs</li>
          <li>• Create a NAP or upload a file to test database recording</li>
          <li>• Connection errors to Ubuntu backend are expected in development</li>
        </ul>
      </div>
    </div>
  );
};

export default DatabaseStatus;
