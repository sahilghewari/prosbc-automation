import React, { useState, useEffect } from 'react';
import { dashboardService } from '../services/apiClient';

const EnhancedDatabaseDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [health, setHealth] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [fileStats, setFileStats] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [uploadTrends, setUploadTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [overviewData, healthData, auditData, fileData, perfData, trendsData] = await Promise.all([
        dashboardService.getOverview(),
        dashboardService.getHealth(),
        dashboardService.getAuditLogs({ limit: 20 }),
        dashboardService.getFileStats(),
        dashboardService.getPerformance(),
        dashboardService.getUploadTrends('30d')
      ]);

      setOverview(overviewData);
      setHealth(healthData);
      setAuditLogs(auditData.logs || []);
      setFileStats(fileData);
      setPerformance(perfData);
      setUploadTrends(trendsData.trends || []);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !overview) {
    return (
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-700 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-700 rounded-lg"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-96 bg-gray-700 rounded-lg"></div>
            <div className="h-96 bg-gray-700 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">System Dashboard</h1>
          <p className="text-gray-400">Monitor your ProSBC automation system</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={loadDashboardData}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded flex items-center"
            disabled={loading}
          >
            <svg className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-900/20 border border-red-600 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-400 font-medium">Error loading dashboard: {error}</span>
          </div>
        </div>
      )}

      {/* Health Alert */}
      {health && health.database?.status !== 'connected' && (
        <div className="bg-red-900/20 border border-red-600 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-400 font-medium">Database Health Issue: {health.database?.message || 'Connection problem'}</span>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-8 bg-gray-800 p-1 rounded-lg">
        {[
          { id: 'overview', label: 'Overview', icon: '📊' },
          { id: 'health', label: 'System Health', icon: '💓' },
          { id: 'files', label: 'File Analytics', icon: '📁' },
          { id: 'audit', label: 'Audit Logs', icon: '📝' },
          { id: 'performance', label: 'Performance', icon: '⚡' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center py-2 px-4 rounded-md transition-all ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'overview' && <OverviewTab overview={overview} />}
        {activeTab === 'health' && <HealthTab health={health} />}
        {activeTab === 'files' && <FilesTab fileStats={fileStats} uploadTrends={uploadTrends} />}
        {activeTab === 'audit' && <AuditTab auditLogs={auditLogs} />}
        {activeTab === 'performance' && <PerformanceTab performance={performance} />}
      </div>
    </div>
  );
};

// Metric Card Component
const MetricCard = ({ title, value, icon, color }) => {
  const getIconSvg = (iconName) => {
    const icons = {
      database: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 1.79 4 4 4h8c2.21 0 4-1.79 4-4V7M4 7c0 2.21 1.79 4 4 4h8c2.21 0 4-1.79 4-4M4 7c0-2.21 1.79-4 4-4h8c2.21 0 4 1.79 4 4" />
      ),
      network: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9V3m0 9l-3-3m3 3l3-3" />
      ),
      file: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      ),
      clock: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      ),
      check: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      ),
      warning: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      ),
      upload: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      ),
      activity: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      )
    };
    return icons[iconName] || icons.database;
  };

  const colorClasses = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    purple: 'bg-purple-600',
    yellow: 'bg-yellow-600',
    red: 'bg-red-600'
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        </div>
        <div className={`p-3 rounded-full ${colorClasses[color]}`}>
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {getIconSvg(icon)}
          </svg>
        </div>
      </div>
    </div>
  );
};

// Overview Tab Component
const OverviewTab = ({ overview }) => (
  <div className="space-y-6">
    {/* Summary Cards */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <MetricCard
        title="Total NAPs"
        value={overview?.summary_cards?.total_naps || 0}
        icon="network"
        color="blue"
      />
      <MetricCard
        title="Active Configurations"
        value={overview?.summary_cards?.active_configurations || 0}
        icon="check"
        color="green"
      />
      <MetricCard
        title="Unmapped NAPs"
        value={overview?.summary_cards?.unmapped_naps || 0}
        icon="warning"
        color="yellow"
      />
      <MetricCard
        title="Pending Actions"
        value={overview?.summary_cards?.pending_actions || 0}
        icon="clock"
        color="purple"
      />
    </div>

    {/* Recent Activity */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-xl font-bold mb-4">Recent Configuration Actions</h3>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {overview?.recent_actions?.length > 0 ? overview.recent_actions.map((action, index) => (
            <div key={index} className="flex items-start space-x-3 p-3 bg-gray-700/50 rounded">
              <div className={`w-2 h-2 rounded-full mt-2 ${
                action.type === 'activation' ? 'bg-green-400' :
                action.type === 'deactivation' ? 'bg-red-400' :
                action.type === 'update' ? 'bg-blue-400' : 'bg-gray-400'
              }`}></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white">{action.action || action.description}</p>
                <p className="text-xs text-gray-400 mt-1">{action.created_at || action.timestamp}</p>
                {action.user && (
                  <p className="text-xs text-gray-500">by {action.user}</p>
                )}
              </div>
            </div>
          )) : (
            <div className="text-center text-gray-400 py-8">
              <p>No recent actions</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-xl font-bold mb-4">System Statistics</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Database Status</span>
            <span className="text-green-400">Connected</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Total Records</span>
            <span className="text-white font-semibold">{(overview?.summary_cards?.total_naps || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Running Actions</span>
            <span className="text-blue-400">{overview?.summary_cards?.running_actions || 0}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Health Tab Component
const HealthTab = ({ health }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-bold mb-4">Database Health</h3>
        <div className="space-y-3">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-3 ${
              health?.database?.status === 'connected' ? 'bg-green-400' : 'bg-red-400'
            }`}></div>
            <span>{health?.database?.status || 'Unknown'}</span>
          </div>
          <p className="text-sm text-gray-400">{health?.database?.message || 'No details available'}</p>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-bold mb-4">Memory Usage</h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span>Used</span>
            <span>{health?.memory?.used || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span>Total</span>
            <span>{health?.memory?.total || 'N/A'}</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${health?.memory?.percentage || 0}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-bold mb-4">System Info</h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span>Uptime</span>
            <span>{health?.uptime || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span>Node Version</span>
            <span className="text-sm">{health?.node_version || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span>Environment</span>
            <span className="text-sm">{health?.environment || 'N/A'}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Files Tab Component
const FilesTab = ({ fileStats, uploadTrends }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <MetricCard
        title="Total Files"
        value={fileStats?.total_files || 0}
        icon="file"
        color="blue"
      />
      <MetricCard
        title="Recent Uploads"
        value={fileStats?.recent_uploads || 0}
        icon="upload"
        color="green"
      />
      <MetricCard
        title="Storage Used"
        value={fileStats?.storage_used || 'N/A'}
        icon="database"
        color="purple"
      />
    </div>

    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h3 className="text-xl font-bold mb-4">Upload Trends</h3>
      <div className="h-64 flex items-center justify-center text-gray-400">
        {uploadTrends?.length > 0 ? (
          <div className="w-full">
            <div className="grid grid-cols-7 gap-2 text-xs text-center">
              {uploadTrends.slice(-7).map((trend, index) => (
                <div key={index} className="space-y-2">
                  <div className="text-gray-500">{trend.date}</div>
                  <div className="bg-blue-600 rounded" style={{ height: `${Math.max(trend.count * 10, 20)}px` }}></div>
                  <div className="text-white">{trend.count}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p>No upload trends available</p>
          </div>
        )}
      </div>
    </div>
  </div>
);

// Audit Tab Component
const AuditTab = ({ auditLogs }) => (
  <div className="space-y-6">
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h3 className="text-xl font-bold mb-4">Recent Audit Logs</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 text-gray-400">Timestamp</th>
              <th className="text-left py-2 text-gray-400">Action</th>
              <th className="text-left py-2 text-gray-400">User</th>
              <th className="text-left py-2 text-gray-400">Entity</th>
              <th className="text-left py-2 text-gray-400">Status</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.length > 0 ? auditLogs.map((log, index) => (
              <tr key={index} className="border-b border-gray-700/50">
                <td className="py-3">{new Date(log.timestamp).toLocaleString()}</td>
                <td className="py-3">{log.action}</td>
                <td className="py-3">{log.user || 'System'}</td>
                <td className="py-3">{log.entity_type}/{log.entity_id}</td>
                <td className="py-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    log.status === 'success' ? 'bg-green-600' : 'bg-red-600'
                  }`}>
                    {log.status}
                  </span>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="5" className="py-8 text-center text-gray-400">No audit logs available</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

// Performance Tab Component
const PerformanceTab = ({ performance }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <MetricCard
        title="Avg Response Time"
        value={performance?.avg_response_time || 'N/A'}
        icon="clock"
        color="blue"
      />
      <MetricCard
        title="Requests/min"
        value={performance?.requests_per_minute || 0}
        icon="activity"
        color="green"
      />
      <MetricCard
        title="Error Rate"
        value={`${performance?.error_rate || 0}%`}
        icon="warning"
        color="red"
      />
    </div>

    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h3 className="text-xl font-bold mb-4">Performance Metrics</h3>
      <div className="h-64 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p>Performance charts coming soon</p>
          {performance && (
            <div className="mt-4 text-left space-y-2">
              <p className="text-sm">Active Connections: {performance.active_connections || 0}</p>
              <p className="text-sm">Query Execution Time: {performance.query_time || 'N/A'}</p>
              <p className="text-sm">Cache Hit Rate: {performance.cache_hit_rate || 'N/A'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
);

export default EnhancedDatabaseDashboard;
