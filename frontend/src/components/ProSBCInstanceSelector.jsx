import React, { useState, useEffect } from 'react';
import { useProSBCInstance } from '../contexts/ProSBCInstanceContext';
import './ProSBCInstanceSelector.css';

const ProSBCInstanceSelector = ({ 
  showDetails = true,
  className = '',
  size = 'medium' 
}) => {
  // Use the ProSBC instance context
  const {
    selectedInstanceId,
    selectedInstance,
    instances,
    loading,
    error,
    selectInstance,
    refreshInstances,
    retryFetchInstances
  } = useProSBCInstance();
  
  const [showDropdown, setShowDropdown] = useState(false);
  const [testingConnections, setTestingConnections] = useState(new Set());

  const testConnection = async (instanceId, instanceName) => {
    setTestingConnections(prev => new Set([...prev, instanceId]));
    
    try {
      // Get authentication headers
      const token = localStorage.getItem('dashboard_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      };
      
      const response = await fetch(`/backend/api/prosbc-instances/${instanceId}/test`, {
        method: 'POST',
        headers,
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(`✅ Connection to ${instanceName} successful!\n\n${result.details?.testResult || "Connection test passed"}`);
      } else {
        const errorDetails = result.details?.testResult || result.message || 'Unknown error';
        alert(`❌ Connection to ${instanceName} failed!\n\n${errorDetails}`);
      }
    } catch (error) {
      alert(`❌ Connection test failed!\n\n${error.message}`);
    } finally {
      setTestingConnections(prev => {
        const newSet = new Set(prev);
        newSet.delete(instanceId);
        return newSet;
      });
    }
  };

  const handleInstanceSelect = (instance) => {
    selectInstance(instance.id, instance);
    setShowDropdown(false);
  };

  if (loading) {
    return (
      <div className={`prosbc-instance-selector loading ${className}`}>
        <div className="loading-spinner"></div>
        <span>Loading ProSBC instances...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`prosbc-instance-selector error ${className}`}>
        <div className="error-icon">⚠️</div>
        <div className="error-content">
          <p>Failed to load ProSBC instances</p>
          <small>{error}</small>
          <button onClick={retryFetchInstances} className="retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (instances.length === 0) {
    return (
      <div className={`prosbc-instance-selector empty ${className}`}>
        <div className="empty-icon">📡</div>
        <p>No ProSBC instances available</p>
        <small>Contact administrator to configure instances</small>
      </div>
    );
  }

  return (
    <div className={`prosbc-instance-selector ${size} ${className}`}>
      <div className="selector-header">
        <label className="selector-label">ProSBC Instance</label>
        {instances.length > 1 && (
          <span className="instance-count">{instances.length} available</span>
        )}
      </div>

      <div className="selector-dropdown">
        <button
          className={`dropdown-trigger ${selectedInstance ? 'selected' : 'unselected'}`}
          onClick={() => setShowDropdown(!showDropdown)}
          type="button"
        >
          <div className="trigger-content">
            {selectedInstance ? (
              <>
                <div className="instance-indicator">
                  <div className={`status-dot ${selectedInstance.isActive ? 'active' : 'inactive'}`}></div>
                  <span className="instance-name">{selectedInstance.name}</span>
                </div>
                {showDetails && (
                  <div className="instance-details">
                    <span className="instance-location">{selectedInstance.location}</span>
                    <span className="instance-url">{selectedInstance.baseUrl}</span>
                  </div>
                )}
              </>
            ) : (
              <span className="placeholder">Select ProSBC Instance</span>
            )}
          </div>
          <div className={`dropdown-arrow ${showDropdown ? 'open' : ''}`}>▼</div>
        </button>

        {showDropdown && (
          <div className="dropdown-menu">
            <div className="dropdown-header">
              <span>Available ProSBC Instances</span>
              <button 
                className="refresh-btn"
                onClick={refreshInstances}
                title="Refresh instances"
              >
                🔄
              </button>
            </div>
            
            <div className="dropdown-items">
              {instances.map(instance => (
                <div
                  key={instance.id}
                  className={`dropdown-item ${selectedInstanceId === instance.id ? 'selected' : ''}`}
                  onClick={() => handleInstanceSelect(instance)}
                >
                  <div className="item-header">
                    <div className="instance-info">
                      <div className={`status-dot ${instance.isActive ? 'active' : 'inactive'}`}></div>
                      <span className="name">{instance.name}</span>
                      {!instance.isActive && <span className="inactive-badge">Inactive</span>}
                    </div>
                    <button
                      className={`test-btn ${testingConnections.has(instance.id) ? 'testing' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        testConnection(instance.id, instance.name);
                      }}
                      disabled={testingConnections.has(instance.id)}
                      title="Test connection"
                    >
                      {testingConnections.has(instance.id) ? '⏳' : '🧪'}
                    </button>
                  </div>
                  
                  <div className="item-details">
                    <div className="location">{instance.location || 'No location'}</div>
                    <div className="url">{instance.baseUrl || 'No URL'}</div>
                    {instance.description && (
                      <div className="description">{instance.description}</div>
                    )}
                  </div>
                  
                  <div className="item-meta">
                    <span className="protocol">
                      {instance.baseUrl && instance.baseUrl.startsWith('https') ? '🔒 HTTPS' : '🔓 HTTP'}
                    </span>
                    <span className="created">
                      Added {instance.createdAt ? new Date(instance.createdAt).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedInstance && showDetails && (
        <div className="selected-instance-info">
          <div className="info-row">
            <span className="label">Status:</span>
            <span className={`value status ${selectedInstance.isActive ? 'active' : 'inactive'}`}>
              {selectedInstance.isActive ? '🟢 Active' : '🔴 Inactive'}
            </span>
          </div>
          <div className="info-row">
            <span className="label">Location:</span>
            <span className="value">{selectedInstance.location || 'No location'}</span>
          </div>
          <div className="info-row">
            <span className="label">Endpoint:</span>
            <span className="value url">{selectedInstance.baseUrl || 'No URL'}</span>
          </div>
        </div>
      )}

      {/* Click outside to close dropdown */}
      {showDropdown && (
        <div 
          className="dropdown-overlay" 
          onClick={() => setShowDropdown(false)}
        ></div>
      )}
    </div>
  );
};

export default ProSBCInstanceSelector;
