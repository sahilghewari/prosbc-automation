// Enhanced ProSBC switcher to fix config selection and API call issues
import { sessionPool } from './sessionPool.js';
import { getInstanceContext } from '../multiInstanceManager.js';
import fetch from 'node-fetch';

/**
 * Enhanced ProSBC switcher that addresses specific issues:
 * 1. Config selection failures (config page instead of file database page)
 * 2. Session persistence during config switching
 * 3. Proper URL formation and redirection handling
 * 4. Cache invalidation on failures
 */
export class EnhancedProSBCSwitcher {
  constructor() {
    this.instanceCache = new Map();
    this.configSelectionCache = new Map();
    this.activeInstance = null;
    this.activeConfig = null;
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
    
    // ProSBC1 hardcoded mappings to avoid HTML parsing issues
    this.prosbc1ConfigMappings = {
      'config_052421-1': { id: '2', dbId: '2', name: 'config_052421-1' },
      'config_060620221': { id: '3', dbId: '3', name: 'config_060620221' },
      'config_1': { id: '1', dbId: '1', name: 'config_1' },
      'config_1-BU': { id: '5', dbId: '3', name: 'config_1-BU' },
      'config_301122-1': { id: '4', dbId: '4', name: 'config_301122-1' },
      'config_demo': { id: '6', dbId: '6', name: 'config_demo' },
      // Support lookup by ID
      '1': { id: '1', dbId: '1', name: 'config_1' },
      '2': { id: '2', dbId: '2', name: 'config_052421-1' },
      '3': { id: '3', dbId: '3', name: 'config_060620221' },
      '4': { id: '4', dbId: '4', name: 'config_301122-1' },
      '5': { id: '5', dbId: '3', name: 'config_1-BU' },
      '6': { id: '6', dbId: '6', name: 'config_demo' }
    };
  }

  /**
   * Switch ProSBC instance with enhanced error handling and validation
   */
  async switchInstance(instanceId, configId = null) {
    console.log(`[Enhanced] Switching to ${instanceId}, config: ${configId || 'auto'}`);
    const startTime = Date.now();
    let apiCalls = 0;
    
    try {
      // Step 1: Get instance context
      const instanceContext = await this.getInstanceContextCached(instanceId);
      
      // Step 2: Get session with retry logic
      const sessionCookie = await this.getSessionWithRetry(instanceId, instanceContext);
      apiCalls += (this.activeInstance !== instanceId) ? 1 : 0;

      // Step 3: Select and validate config
      const selectedConfig = await this.selectAndValidateConfig(
        instanceId, 
        instanceContext, 
        sessionCookie, 
        configId
      );
      apiCalls += 1;

      // Step 4: Validate config selection worked
      const validationResult = await this.validateConfigSelection(
        instanceContext.baseUrl,
        sessionCookie,
        selectedConfig.dbId
      );
      apiCalls += 1;

      if (!validationResult.success) {
        console.warn(`[Enhanced] Config validation failed, retrying with fresh session`);
        
        // Invalidate session and retry
        sessionPool.invalidateSession(instanceId, instanceContext.baseUrl);
        const newSession = await sessionPool.getSession(instanceId, instanceContext);
        apiCalls += 1;
        
        // Retry config selection
        await this.forceConfigSelection(instanceContext.baseUrl, newSession, selectedConfig);
        apiCalls += 1;
        
        // Re-validate
        const revalidation = await this.validateConfigSelection(
          instanceContext.baseUrl,
          newSession,
          selectedConfig.dbId
        );
        apiCalls += 1;
        
        if (!revalidation.success) {
          throw new Error(`Config selection failed even after retry: ${revalidation.error}`);
        }
      }

      // Update active state
      this.activeInstance = instanceId;
      this.activeConfig = selectedConfig;

      const result = {
        success: true,
        instanceId,
        instanceName: instanceContext.name,
        baseUrl: instanceContext.baseUrl,
        selectedConfig,
        sessionCookie,
        switchTimeMs: Date.now() - startTime,
        apiCallsUsed: apiCalls,
        validation: validationResult
      };

      console.log(`[Enhanced] Switch completed successfully in ${result.switchTimeMs}ms with ${result.apiCallsUsed} API calls`);
      return result;

    } catch (error) {
      console.error(`[Enhanced] Switch failed:`, error.message);
      
      // Invalidate cache on failure
      this.invalidateCache(instanceId, configId);
      
      throw new Error(`Failed to switch to ${instanceId}: ${error.message}`);
    }
  }

  /**
   * Get instance context with caching
   */
  async getInstanceContextCached(instanceId) {
    const cacheKey = `context_${instanceId}`;
    const cached = this.instanceCache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached.timestamp)) {
      return cached.data;
    }

    const context = await getInstanceContext(instanceId);
    
    this.instanceCache.set(cacheKey, {
      data: context,
      timestamp: Date.now()
    });

    return context;
  }

  /**
   * Get session with retry logic for failed sessions
   */
  async getSessionWithRetry(instanceId, instanceContext, maxRetries = 2) {
    let lastError = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const session = await sessionPool.getSession(instanceId, {
          baseUrl: instanceContext.baseUrl,
          username: instanceContext.username,
          password: instanceContext.password
        });
        
        // Test session validity with a simple request
        await this.testSession(instanceContext.baseUrl, session);
        return session;
        
      } catch (error) {
        lastError = error;
        console.warn(`[Enhanced] Session attempt ${attempt + 1} failed:`, error.message);
        
        // Invalidate session and try again
        sessionPool.invalidateSession(instanceId, instanceContext.baseUrl);
      }
    }
    
    throw new Error(`Failed to get valid session after ${maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Test session validity with a lightweight request
   */
  async testSession(baseUrl, sessionCookie) {
    const response = await fetch(`${baseUrl}/configurations`, {
      method: 'GET',
      headers: {
        'Cookie': sessionCookie,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 10000
    });

    if (!response.ok) {
      throw new Error(`Session test failed: ${response.status}`);
    }

    const text = await response.text();
    if (text.includes('login') || text.includes('Login')) {
      throw new Error('Session expired - login page returned');
    }

    return true;
  }

  /**
   * Select and validate config with proper error handling
   */
  async selectAndValidateConfig(instanceId, instanceContext, sessionCookie, targetConfigId) {
    // Determine which config to select
    const configToSelect = this.determineConfigId(instanceId, targetConfigId);
    
    console.log(`[Enhanced] Selecting config: ${configToSelect.name} (ID: ${configToSelect.id}, DB: ${configToSelect.dbId})`);
    
    // Check cache first
    const cacheKey = `${instanceId}:${configToSelect.id}`;
    const cached = this.configSelectionCache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached.timestamp)) {
      console.log(`[Enhanced] Using cached config: ${cached.config.name}`);
      return cached.config;
    }

    // Select the config
    await this.performConfigSelection(instanceContext.baseUrl, sessionCookie, configToSelect);
    
    // Cache the selection
    this.configSelectionCache.set(cacheKey, {
      config: configToSelect,
      timestamp: Date.now()
    });

    return configToSelect;
  }

  /**
   * Determine which config ID to use based on instance and request
   */
  determineConfigId(instanceId, targetConfigId) {
    // For ProSBC1, use hardcoded mappings
    if (instanceId === 'prosbc1' || instanceId.includes('prosbc1')) {
      if (targetConfigId) {
        const config = this.prosbc1ConfigMappings[targetConfigId];
        if (config) {
          return config;
        }
      }
      
      // Default to config_052421-1 for prosbc1
      return this.prosbc1ConfigMappings['config_052421-1'];
    }
    
    // For other instances, use the targetConfigId or default
    return {
      id: targetConfigId || '1',
      dbId: targetConfigId || '1',
      name: `config_${targetConfigId || '1'}`
    };
  }

  /**
   * Perform the actual config selection
   */
  async performConfigSelection(baseUrl, sessionCookie, config) {
    console.log(`[Enhanced] Performing config selection for: ${config.name}`);
    
    const response = await fetch(`${baseUrl}/configurations/${config.id}/choose_redirect`, {
      method: 'POST',
      headers: {
        'Cookie': sessionCookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': `${baseUrl}/configurations`
      },
      body: '',
      redirect: 'manual', // Handle redirects manually
      timeout: 15000
    });

    if (response.status === 302 || response.status === 301) {
      const location = response.headers.get('location');
      console.log(`[Enhanced] Config selection redirect to: ${location}`);
      
      if (location && location.includes('/file_dbs/')) {
        console.log(`[Enhanced] ✓ Config selection successful - redirected to file database`);
        return true;
      }
    }

    if (!response.ok) {
      throw new Error(`Config selection failed: ${response.status} ${response.statusText}`);
    }

    console.log(`[Enhanced] Config selection completed with status: ${response.status}`);
    return true;
  }

  /**
   * Force config selection when validation fails
   */
  async forceConfigSelection(baseUrl, sessionCookie, config) {
    console.log(`[Enhanced] Force selecting config: ${config.name}`);
    
    // Try the direct selection endpoint
    await this.performConfigSelection(baseUrl, sessionCookie, config);
    
    // Wait a moment for the selection to take effect
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Validate that config selection worked by checking file database access
   */
  async validateConfigSelection(baseUrl, sessionCookie, dbId) {
    try {
      console.log(`[Enhanced] Validating config selection for DB ID: ${dbId}`);
      
      const response = await fetch(`${baseUrl}/file_dbs/${dbId}/edit`, {
        method: 'GET',
        headers: {
          'Cookie': sessionCookie,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 10000
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const html = await response.text();
      
      // Check if we got the file database page (not config page)
      const hasFileDatabase = html.includes('Routesets Definition') || 
                            html.includes('Routesets Digitmap') ||
                            html.includes('file_dbs');
                            
      const hasConfigPage = html.includes('Configuration Management') ||
                          html.includes('choose_redirect') ||
                          html.includes('/configurations/');

      if (hasConfigPage && !hasFileDatabase) {
        return {
          success: false,
          error: 'Config selection failed - still on configuration page'
        };
      }

      if (hasFileDatabase) {
        console.log(`[Enhanced] ✓ Config validation successful - file database page loaded`);
        return {
          success: true,
          pageType: 'file_database',
          htmlLength: html.length
        };
      }

      return {
        success: false,
        error: 'Unexpected page content - neither config nor file database'
      };

    } catch (error) {
      return {
        success: false,
        error: `Validation request failed: ${error.message}`
      };
    }
  }

  /**
   * Check if cache entry is still valid
   */
  isCacheValid(timestamp) {
    return (Date.now() - timestamp) < this.cacheTimeout;
  }

  /**
   * Invalidate cache for specific instance/config
   */
  invalidateCache(instanceId, configId = null) {
    if (configId) {
      const cacheKey = `${instanceId}:${configId}`;
      this.configSelectionCache.delete(cacheKey);
    } else {
      // Clear all cache entries for this instance
      for (const key of this.configSelectionCache.keys()) {
        if (key.startsWith(`${instanceId}:`)) {
          this.configSelectionCache.delete(key);
        }
      }
    }
    
    // Clear instance context cache too
    this.instanceCache.delete(`context_${instanceId}`);
    
    console.log(`[Enhanced] Cache invalidated for ${instanceId}:${configId || 'all'}`);
  }

  /**
   * Get current active instance info
   */
  getActiveInstanceInfo() {
    return {
      instanceId: this.activeInstance,
      activeConfig: this.activeConfig,
      isActive: this.activeInstance !== null
    };
  }

  /**
   * Get performance statistics
   */
  getStats() {
    return {
      instanceCacheSize: this.instanceCache.size,
      configCacheSize: this.configSelectionCache.size,
      activeInstance: this.activeInstance,
      activeConfig: this.activeConfig?.name
    };
  }
}

// Global enhanced switcher instance
export const enhancedSwitcher = new EnhancedProSBCSwitcher();

export default enhancedSwitcher;
