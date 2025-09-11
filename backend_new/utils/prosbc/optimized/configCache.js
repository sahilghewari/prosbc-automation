// Advanced configuration cache with multi-instance support
import { selectConfiguration } from '../prosbcConfigSelector.js';
import { fetchLiveConfigIds } from '../prosbcConfigLiveFetcher.js';

/**
 * Configuration cache for ProSBC instances
 * Caches configuration data, selection state, and provides smart invalidation
 */
class ConfigCache {
  constructor() {
    this.configData = new Map(); // instanceId:configId -> config data
    this.selectionState = new Map(); // instanceId -> currently selected config
    this.configLists = new Map(); // instanceId -> list of available configs
    this.cacheTimeout = 15 * 60 * 1000; // 15 minutes
    this.selectionTimeout = 10 * 60 * 1000; // 10 minutes for selection state
    this.lastFetch = new Map(); // instanceId -> last fetch timestamp
    
    // Start cleanup timer
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Get cached configuration data
   */
  getConfigData(instanceId, configId) {
    const key = `${instanceId}:${configId}`;
    const cached = this.configData.get(key);
    
    if (cached && this.isCacheValid(cached.timestamp)) {
      return cached.data;
    }
    
    return null;
  }

  /**
   * Set configuration data in cache
   */
  setConfigData(instanceId, configId, data) {
    const key = `${instanceId}:${configId}`;
    this.configData.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Get cached configuration list for instance
   */
  async getConfigList(instanceId, baseUrl, sessionCookie, forceRefresh = false) {
    const lastFetchTime = this.lastFetch.get(instanceId) || 0;
    const cached = this.configLists.get(instanceId);
    
    // Return cached if valid and not forcing refresh
    if (!forceRefresh && cached && this.isCacheValid(lastFetchTime)) {
      return cached;
    }

    // Fetch fresh config list
    try {
      console.log(`[ConfigCache] Fetching config list for instance: ${instanceId}`);
      const configs = await fetchLiveConfigIds(baseUrl, sessionCookie);
      
      this.configLists.set(instanceId, configs);
      this.lastFetch.set(instanceId, Date.now());
      
      return configs;
    } catch (error) {
      console.error(`[ConfigCache] Failed to fetch config list for ${instanceId}:`, error.message);
      
      // Return cached data if available, even if expired
      if (cached) {
        console.log(`[ConfigCache] Using stale cache for ${instanceId}`);
        return cached;
      }
      
      throw error;
    }
  }

  /**
   * Get current selection state for instance
   */
  getSelectionState(instanceId) {
    const state = this.selectionState.get(instanceId);
    
    if (state && this.isSelectionValid(state.timestamp)) {
      return state.configId;
    }
    
    return null;
  }

  /**
   * Set selection state for instance
   */
  setSelectionState(instanceId, configId) {
    this.selectionState.set(instanceId, {
      configId,
      timestamp: Date.now()
    });
    
    console.log(`[ConfigCache] Set selection state: ${instanceId} -> ${configId}`);
  }

  /**
   * Ensure configuration is selected with caching
   */
  async ensureConfigSelected(instanceId, targetConfigId, baseUrl, sessionCookie, prosbc1Mappings = null) {
    // Check if already selected
    const currentSelection = this.getSelectionState(instanceId);
    if (currentSelection === targetConfigId) {
      console.log(`[ConfigCache] Config ${targetConfigId} already selected for ${instanceId}`);
      return targetConfigId;
    }

    // Handle ProSBC1 special mappings
    let configToSelect = targetConfigId;
    if (prosbc1Mappings && prosbc1Mappings[targetConfigId]) {
      configToSelect = prosbc1Mappings[targetConfigId].id;
      console.log(`[ConfigCache] ProSBC1 mapping: ${targetConfigId} -> ${configToSelect}`);
    }

    // Perform selection
    try {
      console.log(`[ConfigCache] Selecting config ${configToSelect} for instance ${instanceId}`);
      await selectConfiguration(configToSelect, baseUrl, sessionCookie);
      
      // Update selection state
      this.setSelectionState(instanceId, targetConfigId);
      
      return targetConfigId;
    } catch (error) {
      console.error(`[ConfigCache] Config selection failed for ${instanceId}:`, error.message);
      
      // Invalidate selection state on failure
      this.invalidateSelectionState(instanceId);
      throw error;
    }
  }

  /**
   * Find config by name or ID with caching
   */
  async findConfig(instanceId, baseUrl, sessionCookie, searchValue) {
    const configs = await this.getConfigList(instanceId, baseUrl, sessionCookie);
    
    // Try direct matches first
    let found = configs.find(cfg => 
      cfg.name === searchValue || 
      cfg.id === searchValue ||
      cfg.id === String(searchValue)
    );
    
    // Try fuzzy matching if no direct match
    if (!found) {
      found = configs.find(cfg => {
        const searchLower = String(searchValue).toLowerCase();
        const nameLower = cfg.name.toLowerCase();
        
        return nameLower.includes(searchLower) || searchLower.includes(nameLower);
      });
    }
    
    if (found) {
      console.log(`[ConfigCache] Found config: ${searchValue} -> ${found.name} (ID: ${found.id})`);
    } else {
      console.warn(`[ConfigCache] Config not found: ${searchValue} in instance ${instanceId}`);
    }
    
    return found;
  }

  /**
   * Check if cache timestamp is valid
   */
  isCacheValid(timestamp) {
    return Date.now() - timestamp < this.cacheTimeout;
  }

  /**
   * Check if selection state is valid
   */
  isSelectionValid(timestamp) {
    return Date.now() - timestamp < this.selectionTimeout;
  }

  /**
   * Invalidate selection state for instance
   */
  invalidateSelectionState(instanceId) {
    this.selectionState.delete(instanceId);
    console.log(`[ConfigCache] Invalidated selection state for ${instanceId}`);
  }

  /**
   * Invalidate all cache for instance
   */
  invalidateInstance(instanceId) {
    // Remove config data
    const configKeys = Array.from(this.configData.keys())
      .filter(key => key.startsWith(`${instanceId}:`));
    configKeys.forEach(key => this.configData.delete(key));
    
    // Remove other instance data
    this.selectionState.delete(instanceId);
    this.configLists.delete(instanceId);
    this.lastFetch.delete(instanceId);
    
    console.log(`[ConfigCache] Invalidated all cache for instance ${instanceId}`);
  }

  /**
   * Cleanup expired cache entries
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    // Clean config data
    for (const [key, entry] of this.configData.entries()) {
      if (!this.isCacheValid(entry.timestamp)) {
        this.configData.delete(key);
        cleaned++;
      }
    }

    // Clean selection state
    for (const [instanceId, state] of this.selectionState.entries()) {
      if (!this.isSelectionValid(state.timestamp)) {
        this.selectionState.delete(instanceId);
        cleaned++;
      }
    }

    // Clean config lists
    for (const [instanceId, timestamp] of this.lastFetch.entries()) {
      if (!this.isCacheValid(timestamp)) {
        this.configLists.delete(instanceId);
        this.lastFetch.delete(instanceId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[ConfigCache] Cleaned up ${cleaned} expired cache entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      configDataEntries: this.configData.size,
      selectionStates: this.selectionState.size,
      configLists: this.configLists.size,
      instances: new Set([
        ...Array.from(this.selectionState.keys()),
        ...Array.from(this.configLists.keys())
      ]).size
    };
  }
}

// Global config cache instance
export const configCache = new ConfigCache();

export default configCache;
