import proSbcInstanceService from '../../services/proSbcInstanceService.js';

/**
 * Multi-ProSBC Utility Wrapper
 * This wrapper allows existing ProSBC utilities to work with multiple instances
 * while maintaining backward compatibility
 */

// Cache for ProSBC credentials to avoid repeated database calls
const credentialsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get ProSBC instance credentials with caching
 */
export async function getProSBCCredentials(instanceId) {
  const cacheKey = `prosbc_${instanceId}`;
  const cached = credentialsCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.credentials;
  }

  try {
    const credentials = await proSbcInstanceService.getInstanceCredentials(instanceId);
    
    // Cache the credentials
    credentialsCache.set(cacheKey, {
      credentials,
      timestamp: Date.now()
    });
    
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
 * Get all available ProSBC instances for UI selection
 */
export async function getAvailableInstances() {
  try {
    return await proSbcInstanceService.getAllInstances();
  } catch (error) {
    console.error('Failed to get available instances:', error.message);
    return [];
  }
}

export default {
  getProSBCCredentials,
  getDefaultProSBCInstance,
  extractInstanceId,
  prosbcInstanceMiddleware,
  clearCredentialsCache,
  getAvailableInstances,
  getInstanceContext
};
