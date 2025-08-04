import React, { createContext, useContext, useState, useEffect } from 'react';

// Create the context
const ProSBCInstanceContext = createContext();

// Context provider component
export const ProSBCInstanceProvider = ({ children }) => {
  const [selectedInstanceId, setSelectedInstanceId] = useState(null);
  const [selectedInstance, setSelectedInstance] = useState(null);
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshCallbacks, setRefreshCallbacks] = useState(new Set());

  // Fetch available instances on mount
  useEffect(() => {
    fetchInstances();
  }, []);

  // Auto-select first active instance when instances are loaded
  useEffect(() => {
    if (instances.length > 0 && !selectedInstanceId) {
      const activeInstance = instances.find(inst => inst.isActive) || instances[0];
      if (activeInstance) {
        setSelectedInstanceId(activeInstance.id);
        setSelectedInstance(activeInstance);
      }
    }
  }, [instances, selectedInstanceId]);

  const fetchInstances = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get authentication headers
      const token = localStorage.getItem('dashboard_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      };
      
      const response = await fetch('/backend/api/prosbc-instances', {
        headers
      });
      
      if (!response.ok) {
        let errorMessage = `Failed to fetch instances: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage += ` - ${errorData.error}`;
          }
          if (errorData.details) {
            console.error('Backend error details:', errorData.details);
          }
        } catch (e) {
          // Ignore JSON parsing errors for error responses
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      if (data.success && data.instances) {
        setInstances(data.instances);
      } else {
        throw new Error(data.message || 'Invalid response format');
      }
    } catch (err) {
      console.error('Error fetching ProSBC instances:', err);
      setError(err.message);
      setInstances([]);
    } finally {
      setLoading(false);
    }
  };

  const selectInstance = (instanceId, instance = null) => {
    console.log(`[ProSBCInstanceContext] Selecting instance: ${instanceId}`, instance);
    const previousInstanceId = selectedInstanceId;
    
    setSelectedInstanceId(instanceId);
    
    if (instance) {
      setSelectedInstance(instance);
      console.log(`[ProSBCInstanceContext] Instance set to:`, instance);
    } else {
      // Find instance in list if not provided
      const foundInstance = instances.find(inst => inst.id === instanceId);
      setSelectedInstance(foundInstance || null);
      console.log(`[ProSBCInstanceContext] Found instance:`, foundInstance);
    }

    // Trigger refresh callbacks if instance actually changed
    if (previousInstanceId !== instanceId && refreshCallbacks.size > 0) {
      console.log(`[ProSBCInstanceContext] Triggering ${refreshCallbacks.size} refresh callbacks for instance change`);
      const targetInstance = instance || instances.find(inst => inst.id === instanceId);
      refreshCallbacks.forEach(callback => {
        try {
          callback(instanceId, targetInstance);
        } catch (error) {
          console.error('[ProSBCInstanceContext] Refresh callback failed:', error);
        }
      });
    }
  };

  const refreshInstances = () => {
    return fetchInstances();
  };

  // Register a callback to be called when instance changes
  const registerRefreshCallback = (callback) => {
    setRefreshCallbacks(prev => new Set([...prev, callback]));
    return () => {
      setRefreshCallbacks(prev => {
        const newSet = new Set(prev);
        newSet.delete(callback);
        return newSet;
      });
    };
  };

  // Manually trigger all refresh callbacks
  const triggerRefresh = () => {
    if (refreshCallbacks.size > 0 && selectedInstance) {
      console.log(`[ProSBCInstanceContext] Manually triggering ${refreshCallbacks.size} refresh callbacks`);
      refreshCallbacks.forEach(callback => {
        try {
          callback(selectedInstanceId, selectedInstance);
        } catch (error) {
          console.error('[ProSBCInstanceContext] Manual refresh callback failed:', error);
        }
      });
    }
  };

  // Get instance-specific API base URL
  const getInstanceApiUrl = (instanceId = null) => {
    const id = instanceId || selectedInstanceId;
    if (!id) return '/backend/api';
    return `/backend/api/prosbc-instances/${id}`;
  };

  // Get instance-specific headers for API calls
  const getInstanceHeaders = (additionalHeaders = {}) => {
    const token = localStorage.getItem('dashboard_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...additionalHeaders
    };

    if (selectedInstanceId) {
      headers['X-ProSBC-Instance-ID'] = selectedInstanceId.toString();
    }

    return headers;
  };

  // Helper function to make instance-specific API calls
  const makeInstanceApiCall = async (endpoint, options = {}) => {
    const { instanceId, ...fetchOptions } = options;
    const targetInstanceId = instanceId || selectedInstanceId;
    
    if (!targetInstanceId) {
      throw new Error('No ProSBC instance selected');
    }

    const url = endpoint.startsWith('/backend/api/prosbc-instances/') 
      ? endpoint 
      : `/backend/api/prosbc-instances/${targetInstanceId}${endpoint}`;

    const defaultOptions = {
      headers: getInstanceHeaders(fetchOptions.headers),
      ...fetchOptions
    };

    const response = await fetch(url, defaultOptions);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API call failed: ${response.status}`);
    }

    return response.json();
  };

  const contextValue = {
    // State
    selectedInstanceId,
    selectedInstance,
    instances,
    loading,
    error,

    // Actions
    selectInstance,
    refreshInstances,
    fetchInstances,
    registerRefreshCallback,
    triggerRefresh,

    // Utilities
    getInstanceApiUrl,
    getInstanceHeaders,
    makeInstanceApiCall,

    // Computed values
    hasInstances: instances.length > 0,
    hasSelectedInstance: !!selectedInstance,
    isInstanceActive: selectedInstance?.isActive || false
  };

  return (
    <ProSBCInstanceContext.Provider value={contextValue}>
      {children}
    </ProSBCInstanceContext.Provider>
  );
};

// Custom hook to use the context
export const useProSBCInstance = () => {
  const context = useContext(ProSBCInstanceContext);
  
  if (!context) {
    throw new Error('useProSBCInstance must be used within a ProSBCInstanceProvider');
  }
  
  return context;
};

// Higher-order component for components that require instance selection
export const withProSBCInstance = (WrappedComponent) => {
  return function WithProSBCInstanceComponent(props) {
    const instanceContext = useProSBCInstance();
    
    return (
      <WrappedComponent 
        {...props} 
        prosbcInstance={instanceContext}
      />
    );
  };
};

export default ProSBCInstanceContext;
