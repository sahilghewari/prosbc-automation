import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { 
  Activity, 
  Server, 
  Database, 
  FileText, 
  MapPin, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  Users,
  Settings
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const HomeDashboard = () => {
  const [dashboardData, setDashboardData] = useState({
    summary_cards: {
      total_naps: 0,
      active_configurations: 0,
      unmapped_naps: 0,
      pending_activations: 0
    },
    nap_status: {},
    file_stats: {
      digit_maps: { total: 0, by_status: {} },
      dial_formats: { total: 0, by_status: {} }
    },
    mapping_stats: { total: 0, by_status: {} },
    recent_activity: { actions: [], logs: [] },
    system_health: { status: 'healthy', score: 100, metrics: {} }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activityTimeline, setActivityTimeline] = useState([]);

  useEffect(() => {
    fetchDashboardData();
    fetchActivityTimeline();
    
    // Refresh data every 30 seconds
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/dashboard/overview`);
      const data = await response.json();
      
      if (data.success) {
        setDashboardData(data.data);
      } else {
        setError(data.error || 'Failed to fetch dashboard data');
      }
    } catch (err) {
      setError('Failed to connect to server');
      console.error('Dashboard data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivityTimeline = async () => {
    try {
      const response = await fetch(`${API_BASE}/dashboard/activity-timeline?hours=24&granularity=hour`);
      const data = await response.json();
      
      if (data.success) {
        setActivityTimeline(data.data);
      }
    } catch (err) {
      console.error('Activity timeline fetch error:', err);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
      case 'caution':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'critical':
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'created':
        return 'bg-blue-100 text-blue-800';
      case 'mapped':
        return 'bg-purple-100 text-purple-800';
      case 'activated':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-700">{error}</span>
            </div>
            <Button 
              onClick={fetchDashboardData} 
              className="mt-4"
              variant="outline"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">ProSBC Dashboard</h1>
          <p className="text-gray-600">Network Access Point Management</p>
        </div>
        <div className="flex items-center space-x-2">
          {getStatusIcon(dashboardData.system_health.status)}
          <span className="font-medium">
            System {dashboardData.system_health.status}
          </span>
          <Badge variant="outline">
            Score: {dashboardData.system_health.score}%
          </Badge>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total NAPs</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.summary_cards.total_naps}</div>
            <p className="text-xs text-muted-foreground">
              Network Access Points
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Configurations</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {dashboardData.summary_cards.active_configurations}
            </div>
            <p className="text-xs text-muted-foreground">
              Successfully activated
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unmapped NAPs</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {dashboardData.summary_cards.unmapped_naps}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting mapping
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Activations</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {dashboardData.summary_cards.pending_activations}
            </div>
            <p className="text-xs text-muted-foreground">
              In progress
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* NAP Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Server className="w-5 h-5" />
              <span>NAP Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(dashboardData.nap_status).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(status)}>
                      {status}
                    </Badge>
                  </div>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* File Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5" />
              <span>File Statistics</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Digit Maps</span>
                  <span className="text-lg font-bold">
                    {dashboardData.file_stats.digit_maps.total}
                  </span>
                </div>
                <div className="space-y-1">
                  {Object.entries(dashboardData.file_stats.digit_maps.by_status).map(([status, count]) => (
                    <div key={status} className="flex justify-between text-xs">
                      <span className="capitalize">{status}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Dial Formats</span>
                  <span className="text-lg font-bold">
                    {dashboardData.file_stats.dial_formats.total}
                  </span>
                </div>
                <div className="space-y-1">
                  {Object.entries(dashboardData.file_stats.dial_formats.by_status).map(([status, count]) => (
                    <div key={status} className="flex justify-between text-xs">
                      <span className="capitalize">{status}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mapping Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MapPin className="w-5 h-5" />
              <span>Mappings</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {dashboardData.mapping_stats.total}
                </div>
                <div className="text-sm text-gray-600">Total Mappings</div>
              </div>
              <div className="space-y-2">
                {Object.entries(dashboardData.mapping_stats.by_status).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <Badge className={getStatusColor(status)}>
                      {status}
                    </Badge>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="w-5 h-5" />
              <span>Recent Actions</span>
            </CardTitle>
            <CardDescription>Latest configuration actions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboardData.recent_activity.actions.slice(0, 5).map((action, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusColor(action.status)}>
                        {action.action_type}
                      </Badge>
                      <span className="text-sm">{action.nap?.name || 'Unknown NAP'}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatTime(action.executed_at)}
                    </div>
                  </div>
                  <div className="text-right">
                    {action.status === 'success' && <CheckCircle className="w-4 h-4 text-green-500" />}
                    {action.status === 'failed' && <XCircle className="w-4 h-4 text-red-500" />}
                    {action.status === 'pending' && <Clock className="w-4 h-4 text-blue-500" />}
                    {action.status === 'running' && <Activity className="w-4 h-4 text-yellow-500" />}
                  </div>
                </div>
              ))}
              {dashboardData.recent_activity.actions.length === 0 && (
                <div className="text-center text-gray-500 py-4">
                  No recent actions
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* System Events */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="w-5 h-5" />
              <span>System Events</span>
            </CardTitle>
            <CardDescription>Recent audit log entries</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboardData.recent_activity.logs.slice(0, 5).map((log, index) => (
                <div key={index} className="flex items-start space-x-3 py-2 border-b border-gray-100 last:border-b-0">
                  <div className="flex-shrink-0 mt-1">
                    {log.status ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{log.event}</div>
                    <div className="text-xs text-gray-500">
                      {log.user_info?.username} • {formatTime(log.timestamp)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {log.related_entity?.type}: {log.related_entity?.name}
                    </div>
                  </div>
                </div>
              ))}
              {dashboardData.recent_activity.logs.length === 0 && (
                <div className="text-center text-gray-500 py-4">
                  No recent events
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5" />
            <span>System Health</span>
          </CardTitle>
          <CardDescription>Overall system status and metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{dashboardData.system_health.metrics.total_naps || 0}</div>
              <div className="text-sm text-gray-600">Total NAPs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{dashboardData.system_health.metrics.total_mappings || 0}</div>
              <div className="text-sm text-gray-600">Mappings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{dashboardData.system_health.metrics.pending_actions || 0}</div>
              <div className="text-sm text-gray-600">Pending Actions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{dashboardData.system_health.metrics.recent_errors || 0}</div>
              <div className="text-sm text-gray-600">Recent Errors</div>
            </div>
          </div>
          <div className="mt-4 text-xs text-gray-500">
            Last updated: {formatTime(dashboardData.system_health.last_updated)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HomeDashboard;
