import React, { useState, useEffect } from 'react';
import { napPerformanceMonitor } from '../utils/performanceMonitor.js';
import { napAnalytics } from '../utils/napPerformanceAnalytics.js';
import './PerformanceMetrics.css';

const PerformanceMetrics = ({ 
  showDetails = false, 
  autoRefresh = true, 
  refreshInterval = 5000 
}) => {
  const [metrics, setMetrics] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [isExpanded, setIsExpanded] = useState(showDetails);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Refresh metrics
  const refreshMetrics = () => {
    const currentMetrics = napPerformanceMonitor.getMetrics();
    const report = napAnalytics.generateReport();
    
    setMetrics(currentMetrics);
    setAnalytics(report);
    setLastUpdate(new Date());
  };

  // Auto-refresh effect
  useEffect(() => {
    refreshMetrics();
    
    if (autoRefresh) {
      const interval = setInterval(refreshMetrics, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  // Format duration for display
  const formatDuration = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // Get performance status color
  const getStatusColor = (avgTime) => {
    if (avgTime < 5000) return 'excellent';
    if (avgTime < 15000) return 'good';
    if (avgTime < 30000) return 'fair';
    return 'poor';
  };

  // Format timestamp
  const formatTimestamp = (date) => {
    return new Date(date).toLocaleTimeString();
  };

  return (
    <div className="performance-metrics">
      <div className="metrics-header">
        <h3>Performance Metrics</h3>
        <div className="metrics-controls">
          <button 
            className="toggle-details"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? '▼' : '▶'} Details
          </button>
          <button 
            className="refresh-button"
            onClick={refreshMetrics}
            title="Refresh metrics"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="metrics-summary">
        <div className="metric-card">
          <div className="metric-label">Total Operations</div>
          <div className="metric-value">{metrics.length}</div>
        </div>
        
        <div className="metric-card">
          <div className="metric-label">Success Rate</div>
          <div className="metric-value">
            {metrics.length > 0 
              ? `${((metrics.filter(m => m.success).length / metrics.length) * 100).toFixed(1)}%`
              : 'N/A'
            }
          </div>
        </div>
        
        <div className="metric-card">
          <div className="metric-label">Average Time</div>
          <div className={`metric-value ${getStatusColor(napPerformanceMonitor.getAverageTime())}`}>
            {formatDuration(napPerformanceMonitor.getAverageTime())}
          </div>
        </div>
        
        <div className="metric-card">
          <div className="metric-label">Last Operation</div>
          <div className="metric-value">
            {formatDuration(napPerformanceMonitor.getLastOperationTime())}
          </div>
        </div>
      </div>

      {/* Detailed View */}
      {isExpanded && (
        <div className="metrics-details">
          {/* Recent Operations */}
          <div className="recent-operations">
            <h4>Recent Operations</h4>
            <div className="operations-list">
              {metrics.slice(-5).reverse().map((metric, index) => (
                <div key={index} className={`operation-item ${metric.success ? 'success' : 'failed'}`}>
                  <div className="operation-header">
                    <span className="operation-name">{metric.name}</span>
                    <span className="operation-time">{formatDuration(metric.totalDuration)}</span>
                  </div>
                  <div className="operation-details">
                    <span className="operation-timestamp">
                      {formatTimestamp(metric.finishedAt)}
                    </span>
                    <span className={`operation-status ${metric.success ? 'success' : 'failed'}`}>
                      {metric.success ? '✅' : '❌'}
                    </span>
                  </div>
                  
                  {/* Step breakdown */}
                  {metric.steps && metric.steps.length > 0 && (
                    <div className="operation-steps">
                      {metric.steps.map((step, stepIndex) => (
                        <div key={stepIndex} className="step-item">
                          <span className="step-name">{step.name}</span>
                          <span className="step-duration">{formatDuration(step.duration)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Performance Analytics */}
          {analytics && (
            <div className="performance-analytics">
              <h4>Performance Analytics</h4>
              
              {/* Key Metrics */}
              <div className="analytics-grid">
                <div className="analytics-card">
                  <div className="analytics-label">Total Sessions</div>
                  <div className="analytics-value">{analytics.totalSessions}</div>
                </div>
                
                <div className="analytics-card">
                  <div className="analytics-label">Success Rate</div>
                  <div className="analytics-value">
                    {analytics.totalSessions > 0 
                      ? `${((analytics.successful / analytics.totalSessions) * 100).toFixed(1)}%`
                      : 'N/A'
                    }
                  </div>
                </div>
                
                {analytics.performance.avgDuration && (
                  <>
                    <div className="analytics-card">
                      <div className="analytics-label">Avg Duration</div>
                      <div className="analytics-value">
                        {formatDuration(analytics.performance.avgDuration)}
                      </div>
                    </div>
                    
                    <div className="analytics-card">
                      <div className="analytics-label">Best Time</div>
                      <div className="analytics-value">
                        {formatDuration(analytics.performance.minDuration)}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Workflow Breakdown */}
              {Object.keys(analytics.workflowBreakdown).length > 1 && (
                <div className="workflow-breakdown">
                  <h5>Workflow Comparison</h5>
                  {Object.entries(analytics.workflowBreakdown).map(([type, data]) => (
                    <div key={type} className="workflow-item">
                      <span className="workflow-type">{type}</span>
                      <span className="workflow-stats">
                        {formatDuration(data.avgDuration)} avg • {data.successRate.toFixed(1)}% success
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Insights */}
              {analytics.insights.length > 0 && (
                <div className="performance-insights">
                  <h5>Performance Insights</h5>
                  {analytics.insights.map((insight, index) => (
                    <div key={index} className="insight-item">
                      💡 {insight}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="metrics-actions">
            <button 
              className="action-button"
              onClick={() => {
                napPerformanceMonitor.printSummary();
                napAnalytics.printDetailedReport();
              }}
            >
              Print Report
            </button>
            
            <button 
              className="action-button"
              onClick={() => {
                const data = napAnalytics.exportData();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `nap-performance-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export Data
            </button>
            
            <button 
              className="action-button danger"
              onClick={() => {
                if (confirm('Clear all performance data?')) {
                  napAnalytics.clearAllMetrics();
                  refreshMetrics();
                }
              }}
            >
              Clear Data
            </button>
          </div>
        </div>
      )}

      {/* Last Update */}
      {lastUpdate && (
        <div className="metrics-footer">
          <small>Last updated: {formatTimestamp(lastUpdate)}</small>
        </div>
      )}
    </div>
  );
};

export default PerformanceMetrics;
