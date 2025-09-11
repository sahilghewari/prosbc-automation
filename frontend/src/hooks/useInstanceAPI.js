import { useProSBCInstance } from '../contexts/ProSBCInstanceContext';

/**
 * Custom hook for making instance-aware API calls
 * Automatically includes instance context in all API requests
 */
export const useInstanceAPI = () => {
  const { 
    selectedInstanceId, 
    selectedInstance, 
    getInstanceHeaders, 
    makeInstanceApiCall 
  } = useProSBCInstance();

  /**
   * Make a GET request to an instance-specific endpoint
   */
  const get = async (endpoint, options = {}) => {
    return makeInstanceApiCall(endpoint, {
      method: 'GET',
      ...options
    });
  };

  /**
   * Make a POST request to an instance-specific endpoint
   */
  const post = async (endpoint, data, options = {}) => {
    return makeInstanceApiCall(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
      ...options
    });
  };

  /**
   * Make a PUT request to an instance-specific endpoint
   */
  const put = async (endpoint, data, options = {}) => {
    return makeInstanceApiCall(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
      ...options
    });
  };

  /**
   * Make a DELETE request to an instance-specific endpoint
   */
  const del = async (endpoint, options = {}) => {
    return makeInstanceApiCall(endpoint, {
      method: 'DELETE',
      ...options
    });
  };

  /**
   * Upload a file to an instance-specific endpoint
   */
  const upload = async (endpoint, formData, options = {}) => {
    const headers = getInstanceHeaders(options.headers || {});
    // Remove Content-Type to let browser set it with boundary
    delete headers['Content-Type'];

    return makeInstanceApiCall(endpoint, {
      method: 'POST',
      body: formData,
      headers,
      ...options
    });
  };

  /**
   * Make a direct fetch call with instance headers
   * Useful for non-JSON responses or custom handling
   */
  const fetchWithInstance = async (url, options = {}) => {
    const headers = getInstanceHeaders(options.headers);
    
    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Request failed: ${response.status}`);
    }

    return response;
  };

  /**
   * Get the current instance info
   */
  const getCurrentInstance = () => ({
    id: selectedInstanceId,
    instance: selectedInstance,
    isSelected: !!selectedInstanceId,
    isActive: selectedInstance?.isActive || false
  });

  /**
   * Check if an instance is currently selected
   */
  const hasInstanceSelected = () => !!selectedInstanceId;

  /**
   * Require instance selection - throws error if no instance selected
   */
  const requireInstance = () => {
    if (!selectedInstanceId) {
      throw new Error('No ProSBC instance selected. Please select an instance first.');
    }
    return selectedInstanceId;
  };

  return {
    // HTTP methods
    get,
    post,
    put,
    delete: del,
    upload,
    fetchWithInstance,

    // Instance info
    getCurrentInstance,
    hasInstanceSelected,
    requireInstance,

    // Direct access to context utilities
    selectedInstanceId,
    selectedInstance,
    getInstanceHeaders,
    makeInstanceApiCall
  };
};

/**
 * Higher-order component that provides instance API to components
 */
export const withInstanceAPI = (WrappedComponent) => {
  return function WithInstanceAPIComponent(props) {
    const instanceAPI = useInstanceAPI();
    
    return (
      <WrappedComponent 
        {...props} 
        instanceAPI={instanceAPI}
      />
    );
  };
};

/**
 * Utility function for non-hook contexts
 * Note: This should only be used in rare cases where hooks can't be used
 */
export const createInstanceAPICall = (instanceId) => {
  const headers = {
    'Content-Type': 'application/json',
    'X-ProSBC-Instance-ID': instanceId.toString()
  };

  return async (endpoint, options = {}) => {
    const url = endpoint.startsWith('/backend/api/prosbc-instances/') 
      ? endpoint 
      : `/backend/api/prosbc-instances/${instanceId}${endpoint}`;

    const response = await fetch(url, {
      headers: { ...headers, ...(options.headers || {}) },
      ...options
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API call failed: ${response.status}`);
    }

    return response.json();
  };
};

export default useInstanceAPI;
