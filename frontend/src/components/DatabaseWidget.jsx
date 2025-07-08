import React, { useState, useEffect } from 'react';
import { getDBHealth } from '../services/apiClient.js';

const DatabaseWidget = ({ onOpenDashboard }) => {
  const [dbStatus, setDbStatus] = useState('connecting');
  const [stats, setStats] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    checkDatabaseStatus();
    const interval = setInterval(checkDatabaseStatus, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const checkDatabaseStatus = async () => {
    try {
      const health = await getDBHealth();
      if (health.status === 'healthy') {
        setDbStatus('connected');
        setStats(health);
      } else {
        setDbStatus('error');
      }
    } catch (error) {
      setDbStatus('disconnected');
      console.error('Database health check failed:', error);
    }
  };

  const getStatusColor = () => {
    switch (dbStatus) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500 animate-pulse';
      case 'error': return 'bg-orange-500';
      case 'disconnected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (dbStatus) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'error': return 'Error';
      case 'disconnected': return 'Disconnected';
      default: return 'Unknown';
    }
  };

  return (
    <div className="fixed bottom-6 right-6 w-80 bg-gray-800 rounded-lg border border-gray-700 shadow-2xl z-40 backdrop-blur-sm">
      <div 
        className="p-4 cursor-pointer hover:bg-gray-750 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
            <div>
              <h3 className="text-sm font-medium text-white">Database Status</h3>
              <p className="text-xs text-gray-400">{getStatusText()}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {dbStatus === 'connected' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDashboard();
                }}
                className="p-1 text-blue-400 hover:text-blue-300 transition-colors"
                title="Open Dashboard"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 00-2-2z" />
                </svg>
              </button>
            )}
            
            <svg 
              className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-700">
          {dbStatus === 'connected' && stats ? (
            <>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="text-center p-2 bg-gray-700 rounded">
                  <p className="text-xs text-gray-400">Collections</p>
                  <p className="text-sm font-medium text-white">{stats.collections || 0}</p>
                </div>
                <div className="text-center p-2 bg-gray-700 rounded">
                  <p className="text-xs text-gray-400">Data Size</p>
                  <p className="text-sm font-medium text-white">{stats.dataSize || 'N/A'}</p>
                </div>
              </div>
              
              <div className="text-center p-2 bg-gray-700 rounded">
                <p className="text-xs text-gray-400">Database</p>
                <p className="text-sm font-medium text-white">{stats.database || 'Unknown'}</p>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={onOpenDashboard}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                >
                  Open Dashboard
                </button>
                <button
                  onClick={checkDatabaseStatus}
                  className="px-3 py-2 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 transition-colors"
                  title="Refresh Status"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-400 mb-3">Database not available</p>
              <button
                onClick={checkDatabaseStatus}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              >
                Retry Connection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DatabaseWidget;
