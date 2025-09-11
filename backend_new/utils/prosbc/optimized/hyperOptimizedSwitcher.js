// Hyper-optimized ProSBC switcher - MINIMAL endpoint calls after switching
import { sessionPool } from './sessionPool.js';
import { getInstanceContext } from '../multiInstanceManager.js';
import fetch from 'node-fetch';

/**
 * Hyper-optimized ProSBC switcher that reduces endpoint calls to ABSOLUTE MINIMUM
 * 
 * STRATEGY:
 * - ONE-TIME switch: Login + Config selection (2 calls max)
 * - SUBSEQUENT operations: Use cached session + config state (0 calls)
 * - File operations: Direct file fetch with cached session (1 call per file type)
 * 
 * TOTAL: 1-2 endpoint calls for switching, 0 calls for repeated operations
 */
export class HyperOptimizedProSBCSwitcher {
  constructor() {
    this.globalState = new Map(); // instanceId:configId -> complete state
    this.sessionState = new Map(); // instanceId -> session + validation state
    this.activeState = null; // Current active state
    this.cacheTimeout = 30 * 60 * 1000; // 30 minutes - very long cache
    this.callCounter = 0; // Track actual endpoint calls
  }

  /**
   * Switch with HYPER optimization - minimal endpoint calls
   */
  async switchInstance(instanceId, configId = null) {
    console.log(`[HyperOptimized] Switching to ${instanceId}:${configId || 'auto'}`);
    this.callCounter = 0;
    const startTime = Date.now();
    
    try {
      // Step 1: Check if we're already in this exact state (0 calls)
      const stateKey = `${instanceId}:${configId || 'default'}`;
      const existingState = this.globalState.get(stateKey);
      
      if (existingState && this.isStateValid(existingState)) {
        console.log(`[HyperOptimized] ✓ Using cached state - 0 endpoint calls`);
        this.activeState = existingState;
        return this.buildResult(existingState, 0, Date.now() - startTime);
      }

      // Step 2: Get instance context (database call, not endpoint call)
      const instanceContext = await this.getInstanceContextCached(instanceId);
      
      // Step 3: Get or validate session (0-1 endpoint calls)
      const sessionInfo = await this.getOptimizedSession(instanceId, instanceContext);
      
      // Step 4: Select config ONLY if needed (0-1 endpoint calls)
      const configInfo = await this.selectConfigIfNeeded(
        instanceId, 
        instanceContext, 
        sessionInfo, 
        configId
      );

      // Step 5: Create and cache complete state
      const completeState = {
        instanceId,
        configId: configInfo.id,
        configName: configInfo.name,
        dbId: configInfo.dbId,
        instanceContext,
        sessionCookie: sessionInfo.cookie,
        timestamp: Date.now(),
        validated: true
      };

      // Cache the complete state for future use
      this.globalState.set(stateKey, completeState);
      this.activeState = completeState;

      const result = this.buildResult(completeState, this.callCounter, Date.now() - startTime);
      console.log(`[HyperOptimized] ✓ Switch completed with ${this.callCounter} endpoint calls in ${result.switchTimeMs}ms`);
      return result;

    } catch (error) {
      console.error(`[HyperOptimized] Switch failed:`, error.message);
      this.invalidateState(instanceId, configId);
      throw error;
    }
  }

  /**
   * Get session with aggressive caching and minimal validation
   */
  async getOptimizedSession(instanceId, instanceContext) {
    const sessionKey = `session_${instanceId}`;
    const cached = this.sessionState.get(sessionKey);
    
    // Use cached session if available and recently validated
    if (cached && this.isSessionStateValid(cached)) {
      console.log(`[HyperOptimized] ✓ Using cached session (last validated ${Math.round((Date.now() - cached.lastValidated) / 1000)}s ago)`);
      return cached;
    }

    // Get session from pool (may be cached at pool level)
    console.log(`[HyperOptimized] Getting session from pool...`);
    const sessionCookie = await sessionPool.getSession(instanceId, {
      baseUrl: instanceContext.baseUrl,
      username: instanceContext.username,
      password: instanceContext.password
    });

    // Only validate session if we don't have recent validation
    let needsValidation = true;
    if (cached && (Date.now() - cached.lastValidated) < 5 * 60 * 1000) {
      needsValidation = false;
    }

    if (needsValidation) {
      console.log(`[HyperOptimized] Validating session...`);
      await this.quickSessionValidation(instanceContext.baseUrl, sessionCookie);
      this.callCounter++;
    }

    const sessionInfo = {
      cookie: sessionCookie,
      instanceId,
      baseUrl: instanceContext.baseUrl,
      created: Date.now(),
      lastValidated: Date.now(),
      valid: true
    };

    this.sessionState.set(sessionKey, sessionInfo);
    return sessionInfo;
  }

  /**
   * Quick session validation - lightweight endpoint call
   */
  async quickSessionValidation(baseUrl, sessionCookie) {
    const response = await fetch(`${baseUrl}/`, {
      method: 'HEAD', // Use HEAD instead of GET to minimize data transfer
      headers: {
        'Cookie': sessionCookie
      },
      timeout: 5000
    });

    if (!response.ok || response.url.includes('login')) {
      throw new Error('Session invalid');
    }

    return true;
  }

  /**
   * Select config ONLY if we're not already on it
   */
  async selectConfigIfNeeded(instanceId, instanceContext, sessionInfo, targetConfigId) {
    // Determine target config
    const targetConfig = this.determineTargetConfig(instanceId, targetConfigId);
    
    // Check if we're already on this config (check state cache)
    const currentConfigKey = `current_config_${instanceId}`;
    const currentConfig = this.globalState.get(currentConfigKey);
    
    if (currentConfig && 
        currentConfig.id === targetConfig.id && 
        this.isStateValid(currentConfig)) {
      console.log(`[HyperOptimized] ✓ Already on config ${targetConfig.name} - skipping selection`);
      return targetConfig;
    }

    // Need to select config - this is unavoidable but we optimize it
    console.log(`[HyperOptimized] Selecting config ${targetConfig.name}...`);
    await this.performConfigSelection(instanceContext.baseUrl, sessionInfo.cookie, targetConfig);
    this.callCounter++;

    // Cache current config state
    this.globalState.set(currentConfigKey, {
      ...targetConfig,
      timestamp: Date.now()
    });

    return targetConfig;
  }

  /**
   * Determine target config with hardcoded mappings
   */
  determineTargetConfig(instanceId, targetConfigId) {
    // ProSBC1 hardcoded mappings
    const prosbc1Configs = {
      'config_052421-1': { id: '2', dbId: '2', name: 'config_052421-1' },
      'config_060620221': { id: '3', dbId: '3', name: 'config_060620221' },
      'config_1': { id: '1', dbId: '1', name: 'config_1' },
      'config_1-BU': { id: '5', dbId: '3', name: 'config_1-BU' },
      'config_301122-1': { id: '4', dbId: '4', name: 'config_301122-1' },
      'config_demo': { id: '6', dbId: '6', name: 'config_demo' },
      '1': { id: '1', dbId: '1', name: 'config_1' },
      '2': { id: '2', dbId: '2', name: 'config_052421-1' },
      '3': { id: '3', dbId: '3', name: 'config_060620221' },
      '4': { id: '4', dbId: '4', name: 'config_301122-1' },
      '5': { id: '5', dbId: '3', name: 'config_1-BU' },
      '6': { id: '6', dbId: '6', name: 'config_demo' }
    };

    if (instanceId === 'prosbc1' || instanceId.includes('prosbc1')) {
      if (targetConfigId && prosbc1Configs[targetConfigId]) {
        return prosbc1Configs[targetConfigId];
      }
      // Default to config_052421-1
      return prosbc1Configs['config_052421-1'];
    }

    // For other instances
    return {
      id: targetConfigId || '1',
      dbId: targetConfigId || '1',
      name: `config_${targetConfigId || '1'}`
    };
  }

  /**
   * Perform config selection with minimal overhead
   */
  async performConfigSelection(baseUrl, sessionCookie, config) {
    const response = await fetch(`${baseUrl}/configurations/${config.id}/choose_redirect`, {
      method: 'POST',
      headers: {
        'Cookie': sessionCookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      body: '',
      redirect: 'manual',
      timeout: 10000
    });

    // We don't need to follow the redirect or validate extensively
    // Just check that the selection call was accepted
    if (response.status !== 302 && response.status !== 301 && !response.ok) {
      throw new Error(`Config selection failed: ${response.status}`);
    }

    console.log(`[HyperOptimized] ✓ Config ${config.name} selected`);
  }

  /**
   * Get instance context with caching
   */
  async getInstanceContextCached(instanceId) {
    const cacheKey = `context_${instanceId}`;
    const cached = this.globalState.get(cacheKey);
    
    if (cached && this.isStateValid(cached)) {
      return cached.data;
    }

    const context = await getInstanceContext(instanceId);
    
    this.globalState.set(cacheKey, {
      data: context,
      timestamp: Date.now()
    });

    return context;
  }

  /**
   * Check if state is valid (longer cache time)
   */
  isStateValid(state) {
    return state && (Date.now() - state.timestamp) < this.cacheTimeout;
  }

  /**
   * Check if session state is valid
   */
  isSessionStateValid(sessionState) {
    const age = Date.now() - sessionState.created;
    const validationAge = Date.now() - sessionState.lastValidated;
    
    return age < (25 * 60 * 1000) && // Session not older than 25 minutes
           validationAge < (10 * 60 * 1000) && // Validated within 10 minutes
           sessionState.valid;
  }

  /**
   * Build result object
   */
  buildResult(state, apiCalls, switchTime) {
    return {
      success: true,
      instanceId: state.instanceId,
      instanceName: state.instanceContext.name,
      baseUrl: state.instanceContext.baseUrl,
      selectedConfig: {
        id: state.configId,
        name: state.configName,
        dbId: state.dbId
      },
      sessionCookie: state.sessionCookie,
      switchTimeMs: switchTime,
      apiCallsUsed: apiCalls,
      cached: apiCalls === 0,
      timestamp: state.timestamp
    };
  }

  /**
   * Invalidate state on errors
   */
  invalidateState(instanceId, configId = null) {
    if (configId) {
      const stateKey = `${instanceId}:${configId}`;
      this.globalState.delete(stateKey);
    } else {
      // Clear all state for this instance
      for (const key of this.globalState.keys()) {
        if (key.startsWith(`${instanceId}:`) || key.includes(`_${instanceId}`)) {
          this.globalState.delete(key);
        }
      }
    }
    
    // Clear session state
    this.sessionState.delete(`session_${instanceId}`);
    
    console.log(`[HyperOptimized] State invalidated for ${instanceId}:${configId || 'all'}`);
  }

  /**
   * Get current active state
   */
  getActiveState() {
    return this.activeState;
  }

  /**
   * Force clear all cache
   */
  clearAllCache() {
    this.globalState.clear();
    this.sessionState.clear();
    this.activeState = null;
    console.log(`[HyperOptimized] All cache cleared`);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      globalStateSize: this.globalState.size,
      sessionStateSize: this.sessionState.size,
      activeState: this.activeState ? {
        instance: this.activeState.instanceId,
        config: this.activeState.configName,
        age: Math.round((Date.now() - this.activeState.timestamp) / 1000)
      } : null,
      lastCallCounter: this.callCounter
    };
  }
}

// Global hyper-optimized switcher instance
export const hyperOptimizedSwitcher = new HyperOptimizedProSBCSwitcher();

export default hyperOptimizedSwitcher;
