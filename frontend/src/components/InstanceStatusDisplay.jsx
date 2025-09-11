import React from 'react';
import { useProSBCInstance } from '../contexts/ProSBCInstanceContext';
import './InstanceStatusDisplay.css';

const InstanceStatusDisplay = ({ compact = false }) => {
  let contextData;
  
  try {
    contextData = useProSBCInstance();
  } catch (error) {
    // If we're outside the provider context, show a minimal indicator
    return (
      <div className={`instance-status warning ${compact ? 'compact' : ''}`}>
        <div className="status-indicator warning">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        {!compact && <span>Initializing...</span>}
      </div>
    );
  }

  const { 
    selectedInstance, 
    hasSelectedInstance, 
    loading, 
    error,
    isInstanceActive 
  } = contextData;

  if (loading) {
    return (
      <div className={`instance-status ${compact ? 'compact' : ''}`}>
        <div className="status-indicator loading">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        {!compact && <span>Loading instances...</span>}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`instance-status error ${compact ? 'compact' : ''}`}>
        <div className="status-indicator error">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        {!compact && <span>Error: {error}</span>}
      </div>
    );
  }

  if (!hasSelectedInstance) {
    return (
      <div className={`instance-status warning ${compact ? 'compact' : ''}`}>
        <div className="status-indicator warning">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        {!compact && <span>No instance selected</span>}
      </div>
    );
  }

  return (
    <div className={`instance-status success ${compact ? 'compact' : ''}`}>
      <div className={`status-indicator ${isInstanceActive ? 'active' : 'inactive'}`}>
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      </div>
      {!compact && (
        <div className="instance-info">
          <span className="instance-name">{selectedInstance.name}</span>
          <span className="instance-status-text">
            {isInstanceActive ? 'Active' : 'Inactive'} • {selectedInstance.host}:{selectedInstance.port}
          </span>
        </div>
      )}
    </div>
  );
};

export default InstanceStatusDisplay;
