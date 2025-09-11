import proSbcInstanceService from '../../services/proSbcInstanceService.js';

/**
 * Multi-ProSBC Utility Wrapper
 * This wrapper allows existing ProSBC utilities to work with multiple instances
 * while maintaining backward compatibility
 * 
 * Enhanced with better caching and optimization integration
 */

// Enhanced cache for ProSBC credentials with better management
const credentialsCache = new Map();
const instanceStatsCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes - increased for better performance
const STATS_CACHE_TTL = 2 * 60 * 1000; // 2 minutes for stats

/**
 * Get ProSBC instance credentials with enhanced caching
 */
export async function getProSBCCredentials(instanceId) {
  const cacheKey = `prosbc_${instanceId}`;
  const cached = credentialsCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    // Update access timestamp for LRU behavior
    cached.lastAccessed = Date.now();
    return cached.credentials;
  }

  try {
    console.log(`[MultiInstanceManager] Fetching credentials for instance: ${instanceId}`);
    const credentials = await proSbcInstanceService.getInstanceCredentials(instanceId);
    
    // Enhanced cache entry with access tracking
    credentialsCache.set(cacheKey, {
      credentials,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      accessCount: (cached?.accessCount || 0) + 1
    });
    
    // Cleanup old cache entries (keep only 20 most recently used)
    cleanupCredentialsCache();
    
    return credentials;
  } catch (error) {
    throw new Error(`Failed to get ProSBC credentials for instance ${instanceId}: ${error.message}`);
  }
}

/**
 * Get default ProSBC instance (backward compatibility)
 * Falls back to environment variables if no instances in database
 */
export async function getDefaultProSBCInstance() {
  try {
    const instances = await proSbcInstanceService.getAllInstances();
    
    if (instances.length === 0) {
      // Fallback to environment variables for backward compatibility
      return {
        id: 'default',
        name: 'Default ProSBC',
        baseUrl: process.env.PROSBC_BASE_URL,
        username: process.env.PROSBC_USERNAME,
        password: process.env.PROSBC_PASSWORD,
        location: 'Unknown'
      };
    }
    
    // Return first active instance or first instance
    const activeInstance = instances.find(instance => instance.isActive);
    const defaultInstance = activeInstance || instances[0];
    
    return await getProSBCCredentials(defaultInstance.id);
  } catch (error) {
    // Final fallback to environment variables
    console.warn('Using environment fallback for ProSBC credentials:', error.message);
    return {
      id: 'env_fallback',
      name: 'Environment ProSBC',
      baseUrl: process.env.PROSBC_BASE_URL,
      username: process.env.PROSBC_USERNAME,
      password: process.env.PROSBC_PASSWORD,
      location: 'Environment'
    };
  }
}

/**
 * Extract instance ID from request
 * Supports multiple ways to specify instance:
 * 1. URL parameter: /api/instances/:instanceId/...
 * 2. Query parameter: ?instanceId=1
 * 3. Request body: { instanceId: 1 }
 * 4. Header: X-ProSBC-Instance-ID
 */
export function extractInstanceId(req) {
  return req.params.instanceId || 
         req.query.instanceId || 
         req.body?.instanceId || 
         req.headers['x-prosbc-instance-id'] || 
         null;
}

/**
 * Middleware to inject ProSBC instance into request
 */
export function prosbcInstanceMiddleware(req, res, next) {
  const instanceId = extractInstanceId(req);
  
  if (instanceId) {
    // Get specific instance
    getProSBCCredentials(instanceId)
      .then(credentials => {
        req.prosbcInstance = credentials;
        next();
      })
      .catch(error => {
        res.status(400).json({ 
          success: false, 
          error: `Invalid ProSBC instance: ${error.message}` 
        });
      });
  } else {
    // Use default instance
    getDefaultProSBCInstance()
      .then(credentials => {
        req.prosbcInstance = credentials;
        next();
      })
      .catch(error => {
        res.status(500).json({ 
          success: false, 
          error: `Failed to get ProSBC instance: ${error.message}` 
        });
      });
  }
}

/**
 * Clear credentials cache for a specific instance
 */
export function clearCredentialsCache(instanceId = null) {
  if (instanceId) {
    credentialsCache.delete(`prosbc_${instanceId}`);
  } else {
    credentialsCache.clear();
  }
}

/**
 * Get ProSBC instance context (including baseUrl, credentials, etc.)
 * This provides a unified interface for all instance information
 */
export async function getInstanceContext(instanceId) {
  try {
    const instance = await proSbcInstanceService.getInstanceById(instanceId);
    if (!instance) {
      throw new Error(`ProSBC instance with ID ${instanceId} not found`);
    }
    
    const credentials = await proSbcInstanceService.getInstanceCredentials(instanceId);
    
    return {
      id: instance.id,
      name: instance.name,
      baseUrl: instance.baseUrl,
      username: credentials.username,
      password: credentials.password,
      location: instance.location,
      description: instance.description,
      isActive: instance.isActive,
      createdAt: instance.createdAt,
      updatedAt: instance.updatedAt
    };
  } catch (error) {
    throw new Error(`Failed to get instance context for ${instanceId}: ${error.message}`);
  }
}

/**
 * Get available ProSBC instances with enhanced caching
 */
export async function getAvailableInstances() {
  const cacheKey = 'available_instances';
  const cached = instanceStatsCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp < STATS_CACHE_TTL)) {
    return cached.data;
  }

  try {
    const instances = await proSbcInstanceService.getAllInstances();
    
    // Cache the result
    instanceStatsCache.set(cacheKey, {
      data: instances,
      timestamp: Date.now()
    });
    
    return instances;
  } catch (error) {
    console.error('Failed to get available instances:', error.message);
    
    // Return cached data if available, even if stale
    if (cached) {
      console.log('Using stale instance cache due to error');
      return cached.data;
    }
    
    return [];
  }
}

/**
 * Cleanup credentials cache to prevent memory leaks
 */
function cleanupCredentialsCache() {
  if (credentialsCache.size <= 20) return;
  
  // Convert to array and sort by last accessed time
  const entries = Array.from(credentialsCache.entries())
    .sort(([,a], [,b]) => b.lastAccessed - a.lastAccessed);
  
  // Keep only the 15 most recently used entries
  credentialsCache.clear();
  entries.slice(0, 15).forEach(([key, value]) => {
    credentialsCache.set(key, value);
  });
  
  console.log(`[MultiInstanceManager] Cleaned credentials cache, kept ${credentialsCache.size} entries`);
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const credentialsStats = Array.from(credentialsCache.values());
  const totalAccess = credentialsStats.reduce((sum, entry) => sum + entry.accessCount, 0);
  
  return {
    credentialsCache: {
      size: credentialsCache.size,
      totalAccess,
      avgAccessPerEntry: credentialsStats.length > 0 ? totalAccess / credentialsStats.length : 0
    },
    instanceStatsCache: {
      size: instanceStatsCache.size
    },
    cacheSettings: {
      credentialsTTL: CACHE_TTL,
      statsTTL: STATS_CACHE_TTL
    }
  };
}

export default {
  getProSBCCredentials,
  getDefaultProSBCInstance,
  extractInstanceId,
  prosbcInstanceMiddleware,
  clearCredentialsCache,
  getAvailableInstances,
  getInstanceContext,
  getCacheStats
};
