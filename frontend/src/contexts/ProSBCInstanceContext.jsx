import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

// Create the context
const ProSBCInstanceContext = createContext();

// Helper functions for localStorage persistence
const SELECTED_INSTANCE_KEY = 'prosbc_selected_instance_id';

const saveSelectedInstanceId = (instanceId) => {
  try {
    if (instanceId) {
      localStorage.setItem(SELECTED_INSTANCE_KEY, instanceId.toString());
    } else {
      localStorage.removeItem(SELECTED_INSTANCE_KEY);
    }
  } catch (error) {
    console.warn('[ProSBCInstanceContext] Failed to save selected instance to localStorage:', error);
  }
};

const loadSelectedInstanceId = () => {
  try {
    const stored = localStorage.getItem(SELECTED_INSTANCE_KEY);
    return stored ? parseInt(stored, 10) : null;
  } catch (error) {
    console.warn('[ProSBCInstanceContext] Failed to load selected instance from localStorage:', error);
    return null;
  }
};

// Context provider component
export const ProSBCInstanceProvider = ({ children }) => {
  const [selectedInstanceId, setSelectedInstanceId] = useState(null);
  const [selectedInstance, setSelectedInstance] = useState(null);
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Use ref to avoid re-renders when registering callbacks
  const refreshCallbacksRef = useRef(new Set());

  // Check if user is authenticated
  const isAuthenticated = () => {
    const token = localStorage.getItem('dashboard_token');
    return !!token;
  };

  // Fetch available instances only when authenticated
  useEffect(() => {
    if (isAuthenticated()) {
      fetchInstances();
    } else {
      // If not authenticated, clear everything
      setInstances([]);
      setSelectedInstanceId(null);
      setSelectedInstance(null);
      setLoading(false);
    }
  }, []);

  // Watch for authentication changes
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'dashboard_token') {
        if (e.newValue) {
          // Token added - fetch instances
          fetchInstances();
        } else {
          // Token removed - clear instances
          setInstances([]);
          setSelectedInstanceId(null);
          setSelectedInstance(null);
          saveSelectedInstanceId(null);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Auto-select instance when instances are loaded (with persistence)
  useEffect(() => {
    if (instances.length > 0 && !selectedInstanceId) {
      // Try to restore from localStorage first
      const savedInstanceId = loadSelectedInstanceId();
      let targetInstance = null;
      
      if (savedInstanceId) {
        targetInstance = instances.find(inst => inst.id === savedInstanceId);
        console.log(`[ProSBCInstanceContext] Attempting to restore saved instance: ${savedInstanceId}`, targetInstance);
      }
      
      // Fall back to first active instance or first instance
      if (!targetInstance) {
        targetInstance = instances.find(inst => inst.isActive) || instances[0];
        console.log(`[ProSBCInstanceContext] Using fallback instance:`, targetInstance);
      }
      
      if (targetInstance) {
        console.log(`[ProSBCInstanceContext] Auto-selecting instance: ${targetInstance.id} (${targetInstance.name})`);
        setSelectedInstanceId(targetInstance.id);
        setSelectedInstance(targetInstance);
        saveSelectedInstanceId(targetInstance.id);
      }
    }
  }, [instances, selectedInstanceId]);

  const fetchInstances = async () => {
    // Don't fetch if not authenticated
    if (!isAuthenticated()) {
      console.log('[ProSBCInstanceContext] Not authenticated, skipping instance fetch');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Get authentication headers
      const token = localStorage.getItem('dashboard_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      };
      
      console.log('[ProSBCInstanceContext] Fetching instances with token:', token ? 'present' : 'missing');
      
      const response = await fetch('/backend/api/prosbc-instances', {
        headers
      });
      
      if (!response.ok) {
        let errorMessage = `Failed to fetch instances: ${response.status}`;
        try {
          const errorData = await response.json();
          // Forced logout detection
          if (
            response.status === 401 &&
            errorData && typeof errorData.message === 'string' &&
            errorData.message.toLowerCase().includes('session expired')
          ) {
            localStorage.removeItem('dashboard_token');
            window.location.href = '/login';
            return;
          }
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
        console.log('[ProSBCInstanceContext] Successfully fetched instances:', data.instances.length);
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

    // Persist the selection
    saveSelectedInstanceId(instanceId);

    // Trigger refresh callbacks if instance actually changed
    if (previousInstanceId !== instanceId && refreshCallbacksRef.current.size > 0) {
      console.log(`[ProSBCInstanceContext] Triggering ${refreshCallbacksRef.current.size} refresh callbacks for instance change`);
      const targetInstance = instance || instances.find(inst => inst.id === instanceId);
      refreshCallbacksRef.current.forEach(callback => {
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

  // Clear instance selection (for logout)
  const clearInstanceSelection = () => {
    console.log('[ProSBCInstanceContext] Clearing instance selection');
    setSelectedInstanceId(null);
    setSelectedInstance(null);
    saveSelectedInstanceId(null);
    
    // Also clear backend credentials cache
    clearInstanceCache();
  };

  // Retry fetching instances (for error recovery)
  const retryFetchInstances = async () => {
    console.log('[ProSBCInstanceContext] Retrying instance fetch');
    setError(null);
    await fetchInstances();
  };

  // Clear backend credentials cache
  const clearInstanceCache = async (instanceId = null) => {
    try {
      const token = localStorage.getItem('dashboard_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      };

      await fetch('/backend/api/prosbc-instances/clear-cache', {
        method: 'POST',
        headers,
        body: JSON.stringify({ instanceId })
      });

      console.log(`[ProSBCInstanceContext] Cache cleared for instance: ${instanceId || 'all'}`);
    } catch (error) {
      console.warn('[ProSBCInstanceContext] Failed to clear cache:', error);
    }
  };

  // Register a callback to be called when instance changes (stable identity)
  const registerRefreshCallback = useCallback((callback) => {
    refreshCallbacksRef.current.add(callback);
    return () => {
      refreshCallbacksRef.current.delete(callback);
    };
  }, []);

  // Manually trigger all refresh callbacks
  const triggerRefresh = () => {
    if (refreshCallbacksRef.current.size > 0 && selectedInstance) {
      console.log(`[ProSBCInstanceContext] Manually triggering ${refreshCallbacksRef.current.size} refresh callbacks`);
      refreshCallbacksRef.current.forEach(callback => {
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
      // Forced logout detection
      if (
        response.status === 401 &&
        errorData && typeof errorData.message === 'string' &&
        errorData.message.toLowerCase().includes('session expired')
      ) {
        localStorage.removeItem('dashboard_token');
        window.location.href = '/login';
        return;
      }
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
    clearInstanceSelection,
    retryFetchInstances,
    clearInstanceCache,
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
