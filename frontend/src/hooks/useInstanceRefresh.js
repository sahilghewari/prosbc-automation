import { useEffect, useRef, useCallback } from 'react';
import { useProSBCInstance } from '../contexts/ProSBCInstanceContext';

/**
 * Custom hook that triggers a refresh function when the ProSBC instance changes
 * @param {Function} refreshFunction - Function to call when instance changes
 * @param {Array} dependencies - Additional dependencies to watch for changes
 * @param {Object} options - Configuration options
 * @param {boolean} options.refreshOnMount - Whether to refresh on component mount (default: true)
 * @param {boolean} options.refreshOnInstanceChange - Whether to refresh when instance changes (default: true)
 */
export const useInstanceRefresh = (refreshFunction, dependencies = [], options = {}) => {
  const { 
    selectedInstanceId, 
    selectedInstance, 
    hasSelectedInstance,
    registerRefreshCallback
  } = useProSBCInstance();
  
  const {
    refreshOnMount = true,
    refreshOnInstanceChange = true
  } = options;
  
  const isInitialMount = useRef(true);

  // Create stable callback reference
  const stableRefreshFunction = useCallback(refreshFunction, dependencies);

  // Register callback for instance changes
  useEffect(() => {
    if (!refreshOnInstanceChange) return;

    const callback = (instanceId, instance) => {
      console.log(`[useInstanceRefresh] Instance changed to: ${instanceId}`);
      if (typeof stableRefreshFunction === 'function') {
        const result = stableRefreshFunction(instance);
        
        // Handle promise-based refresh functions
        if (result && typeof result.catch === 'function') {
          result.catch(error => {
            console.error('[useInstanceRefresh] Refresh function failed:', error);
          });
        }
      }
    };

    const unregister = registerRefreshCallback(callback);
    return unregister;
  }, [stableRefreshFunction, refreshOnInstanceChange, registerRefreshCallback]);

  // Handle initial mount refresh
  useEffect(() => {
    if (refreshOnMount && isInitialMount.current && hasSelectedInstance) {
      console.log(`[useInstanceRefresh] Initial refresh for instance: ${selectedInstanceId}`);
      
      if (typeof stableRefreshFunction === 'function') {
        const result = stableRefreshFunction(selectedInstance);
        
        // Handle promise-based refresh functions
        if (result && typeof result.catch === 'function') {
          result.catch(error => {
            console.error('[useInstanceRefresh] Initial refresh function failed:', error);
          });
        }
      }
    }

    isInitialMount.current = false;
  }, [hasSelectedInstance, selectedInstanceId, selectedInstance, stableRefreshFunction, refreshOnMount]);

  return {
    selectedInstanceId,
    selectedInstance,
    hasSelectedInstance
  };
};

/**
 * Hook for components that need to refresh multiple data sources
 * @param {Object} refreshFunctions - Object with named refresh functions
 * @param {Array} dependencies - Additional dependencies to watch
 * @param {Object} options - Configuration options
 */
export const useMultiInstanceRefresh = (refreshFunctions = {}, dependencies = [], options = {}) => {
  const refreshCallback = useCallback(async (instance) => {
    const refreshPromises = Object.entries(refreshFunctions).map(async ([name, fn]) => {
      try {
        console.log(`[useMultiInstanceRefresh] Refreshing ${name} for instance ${instance?.id}`);
        await fn(instance);
      } catch (error) {
        console.error(`[useMultiInstanceRefresh] Failed to refresh ${name}:`, error);
      }
    });
    
    await Promise.allSettled(refreshPromises);
  }, [refreshFunctions, ...dependencies]);

  const instanceData = useInstanceRefresh(
    refreshCallback,
    dependencies,
    options
  );

  return instanceData;
};

export default useInstanceRefresh;
