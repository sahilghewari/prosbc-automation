import React, { useState, useEffect } from 'react';
import './ProSBCInstanceManager.css';

const ProSBCInstanceManager = () => {
  const [instances, setInstances] = useState([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState(null);
  const [selectedInstance, setSelectedInstance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [operationStatus, setOperationStatus] = useState(null);

  // New instance form state
  const [newInstance, setNewInstance] = useState({
    name: '',
    baseUrl: '',
    username: '',
    password: '',
    location: '',
    description: '',
    isActive: true
  });

  // Helper function to get auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('dashboard_token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  };

  useEffect(() => {
    fetchInstances();
  }, []);

  const fetchInstances = async () => {
    try {
      setLoading(true);
      const response = await fetch('/backend/api/prosbc-instances', {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      
      if (data.success) {
        setInstances(data.instances);
      } else {
        throw new Error(data.message || 'Failed to fetch instances');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInstanceChange = (instanceId, instance) => {
    setSelectedInstanceId(instanceId);
    setSelectedInstance(instance);
  };

  const handleAddInstance = async (e) => {
    e.preventDefault();
    
    try {
      setOperationStatus({ type: 'loading', message: 'Adding instance...' });
      
      const response = await fetch('/backend/api/prosbc-instances', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newInstance),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setOperationStatus({ type: 'success', message: 'Instance added successfully!' });
        setShowAddForm(false);
        setNewInstance({
          name: '',
          baseUrl: '',
          username: '',
          password: '',
          location: '',
          description: '',
          isActive: true
        });
        fetchInstances();
      } else {
        throw new Error(result.message || 'Failed to add instance');
      }
    } catch (err) {
      setOperationStatus({ type: 'error', message: err.message });
    }
  };

  const handleToggleActive = async (instanceId, currentStatus) => {
    try {
      setOperationStatus({ type: 'loading', message: 'Updating instance...' });
      
      const response = await fetch(`/backend/api/prosbc-instances/${instanceId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setOperationStatus({ type: 'success', message: 'Instance updated successfully!' });
        fetchInstances();
      } else {
        throw new Error(result.message || 'Failed to update instance');
      }
    } catch (err) {
      setOperationStatus({ type: 'error', message: err.message });
    }
  };

  const handleDeleteInstance = async (instanceId, instanceName) => {
    if (!confirm(`Are you sure you want to delete the instance "${instanceName}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      setOperationStatus({ type: 'loading', message: 'Deleting instance...' });
      
      const response = await fetch(`/backend/api/prosbc-instances/${instanceId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      const result = await response.json();
      
      if (result.success) {
        setOperationStatus({ type: 'success', message: 'Instance deleted successfully!' });
        if (selectedInstanceId === instanceId) {
          setSelectedInstanceId(null);
          setSelectedInstance(null);
        }
        fetchInstances();
      } else {
        throw new Error(result.message || 'Failed to delete instance');
      }
    } catch (err) {
      setOperationStatus({ type: 'error', message: err.message });
    }
  };

  const initializeDefaultInstances = async () => {
    try {
      setOperationStatus({ type: 'loading', message: 'Initializing default instances...' });
      
      const response = await fetch('/backend/api/prosbc-instances/initialize-defaults', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      
      const result = await response.json();
      
      if (result.success) {
        setOperationStatus({ type: 'success', message: 'Default instances initialized successfully!' });
        fetchInstances();
      } else {
        throw new Error(result.message || 'Failed to initialize default instances');
      }
    } catch (err) {
      setOperationStatus({ type: 'error', message: err.message });
    }
  };

  if (loading) {
    return (
      <div className="prosbc-instance-manager loading">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <span>Loading ProSBC Instance Manager...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="prosbc-instance-manager">
      <div className="manager-header">
        <h2>ProSBC Instance Management</h2>
        <p>Manage multiple ProSBC instances and switch between them seamlessly</p>
      </div>

      {/* Status Messages */}
      {operationStatus && (
        <div className={`status-message ${operationStatus.type}`}>
          <span>{operationStatus.message}</span>
          <button 
            className="close-status"
            onClick={() => setOperationStatus(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* Instance Management Actions */}
      <div className="management-actions">
        <div className="action-buttons">
          <button 
            className="btn btn-primary"
            onClick={() => setShowAddForm(true)}
          >
            ➕ Add New Instance
          </button>
          
          {instances.length === 0 && (
            <button 
              className="btn btn-success"
              onClick={initializeDefaultInstances}
            >
              🚀 Initialize Default Instances
            </button>
          )}
          
          <button 
            className="btn btn-secondary"
            onClick={fetchInstances}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Add Instance Form */}
      {showAddForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Add New ProSBC Instance</h3>
              <button 
                className="close-modal"
                onClick={() => setShowAddForm(false)}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleAddInstance} className="add-instance-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Instance Name *</label>
                  <input
                    type="text"
                    value={newInstance.name}
                    onChange={(e) => setNewInstance({...newInstance, name: e.target.value})}
                    placeholder="e.g., ProSBC NYC1"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Location</label>
                  <input
                    type="text"
                    value={newInstance.location}
                    onChange={(e) => setNewInstance({...newInstance, location: e.target.value})}
                    placeholder="e.g., New York"
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>Base URL *</label>
                <input
                  type="url"
                  value={newInstance.baseUrl}
                  onChange={(e) => setNewInstance({...newInstance, baseUrl: e.target.value})}
                  placeholder="https://prosbc.example.com:12358"
                  required
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Username *</label>
                  <input
                    type="text"
                    value={newInstance.username}
                    onChange={(e) => setNewInstance({...newInstance, username: e.target.value})}
                    placeholder="Monitor"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Password *</label>
                  <input
                    type="password"
                    value={newInstance.password}
                    onChange={(e) => setNewInstance({...newInstance, password: e.target.value})}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={newInstance.description}
                  onChange={(e) => setNewInstance({...newInstance, description: e.target.value})}
                  placeholder="Optional description for this instance"
                  rows="3"
                />
              </div>
              
              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={newInstance.isActive}
                    onChange={(e) => setNewInstance({...newInstance, isActive: e.target.checked})}
                  />
                  <span className="checkmark"></span>
                  Active (available for use)
                </label>
              </div>
              
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Instance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Instance List */}
      <div className="instances-list">
        <h3>All Instances ({instances.length})</h3>
        
        {instances.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📡</div>
            <h4>No ProSBC Instances</h4>
            <p>Get started by adding your first ProSBC instance or initializing the default ones.</p>
          </div>
        ) : (
          <div className="instances-grid">
            {instances.map(instance => (
              <div 
                key={instance.id} 
                className={`instance-card ${selectedInstanceId === instance.id ? 'selected' : ''} ${!instance.isActive ? 'inactive' : ''}`}
              >
                <div className="card-header">
                  <div className="instance-title">
                    <div className={`status-indicator ${instance.isActive ? 'active' : 'inactive'}`}></div>
                    <h4>{instance.name}</h4>
                    {!instance.isActive && <span className="inactive-badge">Inactive</span>}
                  </div>
                  
                  <div className="card-actions">
                    <button
                      className={`toggle-btn ${instance.isActive ? 'active' : 'inactive'}`}
                      onClick={() => handleToggleActive(instance.id, instance.isActive)}
                      title={instance.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {instance.isActive ? '🔴' : '🟢'}
                    </button>
                    
                    <button
                      className="delete-btn"
                      onClick={() => handleDeleteInstance(instance.id, instance.name)}
                      title="Delete instance"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                
                <div className="card-content">
                  <div className="info-item">
                    <span className="label">Location:</span>
                    <span className="value">{instance.location || 'Not specified'}</span>
                  </div>
                  
                  <div className="info-item">
                    <span className="label">URL:</span>
                    <span className="value url">{instance.baseUrl}</span>
                  </div>
                  
                  <div className="info-item">
                    <span className="label">Username:</span>
                    <span className="value">{instance.username}</span>
                  </div>
                  
                  {instance.description && (
                    <div className="info-item">
                      <span className="label">Description:</span>
                      <span className="value">{instance.description}</span>
                    </div>
                  )}
                  
                  <div className="info-item">
                    <span className="label">Created:</span>
                    <span className="value">{new Date(instance.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="card-footer">
                  <button 
                    className="btn btn-sm btn-primary"
                    onClick={() => handleInstanceChange(instance.id, instance)}
                  >
                    {selectedInstanceId === instance.id ? '✓ Selected' : 'Select'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProSBCInstanceManager;
