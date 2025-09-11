// Migration utility for seamless transition to optimized ProSBC utilities
import ProSBCFileAPI from '../prosbcFileManager.js';
import { OptimizedProSBCFileAPI } from './optimizedFileManager.js';

/**
 * Factory function to create the appropriate ProSBC API instance
 * Allows gradual migration and A/B testing
 */
export function createProSBCFileAPI(instanceId = null, options = {}) {
  const {
    useOptimized = true, // Default to optimized version
    fallbackToOriginal = true,
    enableMetrics = true
  } = options;

  if (useOptimized) {
    try {
      const api = new OptimizedProSBCFileAPI(instanceId);
      
      if (enableMetrics) {
        console.log(`[ProSBC Migration] Using optimized API for instance: ${instanceId || 'default'}`);
      }
      
      return api;
    } catch (error) {
      console.error('[ProSBC Migration] Failed to create optimized API:', error.message);
      
      if (fallbackToOriginal) {
        console.log('[ProSBC Migration] Falling back to original API');
        return new ProSBCFileAPI(instanceId);
      }
      
      throw error;
    }
  }
  
  return new ProSBCFileAPI(instanceId);
}

/**
 * Wrapper class that provides the original API interface while using optimized backend
 * Ensures 100% compatibility during migration
 */
export class CompatibilityProSBCFileAPI {
  constructor(instanceId = null) {
    this.optimizedAPI = new OptimizedProSBCFileAPI(instanceId);
    this.instanceId = instanceId;
  }

  // Delegate all methods to optimized API with compatibility layer
  async getSessionCookie() {
    return this.optimizedAPI.getSessionCookie();
  }

  getBasicAuthHeader() {
    return this.optimizedAPI.getBasicAuthHeader();
  }

  async loadInstanceContext() {
    return this.optimizedAPI.loadInstanceContext();
  }

  async ensureConfigSelected(configId = null) {
    await this.optimizedAPI.ensureConfigSelected(configId);
    // Set properties for backward compatibility
    this.selectedConfigId = this.optimizedAPI.selectedConfigId;
    this.configSelectionDone = true;
  }

  async listDfFiles(configId = null) {
    return this.optimizedAPI.listDfFiles(configId);
  }

  async listDmFiles(configId = null) {
    return this.optimizedAPI.listDmFiles(configId);
  }

  async listAllFiles(configId = null) {
    return this.optimizedAPI.listAllFiles(configId);
  }

  async uploadFile(filePath, fileContent = null, configId = null, customFileName = null) {
    return this.optimizedAPI.uploadFile(filePath, fileContent, configId, customFileName);
  }

  async deleteFile(fileType, fileName, configId = null, fileId = null) {
    return this.optimizedAPI.deleteFile(fileType, fileName, configId, fileId);
  }

  // Additional compatibility methods that might be used by existing code
  async getConfigName(configId) {
    if (!configId) return null;
    
    await this.optimizedAPI.loadInstanceContext();
    const sessionCookie = await this.optimizedAPI.getSessionCookie();
    
    // Use the config cache to find config name
    const found = await this.optimizedAPI.configCache.findConfig(
      this.instanceId || 'env',
      this.optimizedAPI.baseURL,
      sessionCookie,
      configId
    );
    
    return found ? found.name : configId;
  }

  resolveProsbc1Config(configId) {
    return this.optimizedAPI.prosbc1ConfigMappings[configId] || null;
  }

  // Performance monitoring methods
  getPerformanceStats() {
    return this.optimizedAPI.getStats();
  }

  clearCaches() {
    return this.optimizedAPI.clearCaches();
  }
}

/**
 * Performance comparison utility
 * Useful for measuring improvements during migration
 */
export class PerformanceComparator {
  constructor(instanceId = null) {
    this.originalAPI = new ProSBCFileAPI(instanceId);
    this.optimizedAPI = new OptimizedProSBCFileAPI(instanceId);
    this.instanceId = instanceId;
  }

  async compareOperation(operation, ...args) {
    const results = {
      original: null,
      optimized: null,
      improvement: null
    };

    // Test original API
    try {
      const startTime = Date.now();
      results.original = {
        result: await this.originalAPI[operation](...args),
        duration: Date.now() - startTime,
        success: true
      };
    } catch (error) {
      results.original = {
        error: error.message,
        success: false
      };
    }

    // Test optimized API
    try {
      const startTime = Date.now();
      results.optimized = {
        result: await this.optimizedAPI[operation](...args),
        duration: Date.now() - startTime,
        success: true
      };
    } catch (error) {
      results.optimized = {
        error: error.message,
        success: false
      };
    }

    // Calculate improvement
    if (results.original?.success && results.optimized?.success) {
      const originalDuration = results.original.duration;
      const optimizedDuration = results.optimized.duration;
      
      results.improvement = {
        speedupRatio: originalDuration / optimizedDuration,
        timeSavedMs: originalDuration - optimizedDuration,
        percentImprovement: ((originalDuration - optimizedDuration) / originalDuration) * 100
      };
    }

    return results;
  }

  async runBenchmarkSuite() {
    const benchmarks = [];

    // Test file listing
    console.log('[Benchmark] Testing file listing performance...');
    benchmarks.push({
      operation: 'listAllFiles',
      ...await this.compareOperation('listAllFiles')
    });

    // Test configuration selection
    console.log('[Benchmark] Testing config selection performance...');
    benchmarks.push({
      operation: 'ensureConfigSelected',
      ...await this.compareOperation('ensureConfigSelected', '3')
    });

    return {
      instanceId: this.instanceId,
      timestamp: new Date().toISOString(),
      benchmarks,
      summary: this.calculateSummary(benchmarks)
    };
  }

  calculateSummary(benchmarks) {
    const successful = benchmarks.filter(b => b.improvement);
    
    if (successful.length === 0) {
      return { message: 'No successful comparisons' };
    }

    const avgSpeedup = successful.reduce((sum, b) => sum + b.improvement.speedupRatio, 0) / successful.length;
    const avgImprovement = successful.reduce((sum, b) => sum + b.improvement.percentImprovement, 0) / successful.length;
    const totalTimeSaved = successful.reduce((sum, b) => sum + b.improvement.timeSavedMs, 0);

    return {
      averageSpeedup: `${avgSpeedup.toFixed(2)}x`,
      averageImprovement: `${avgImprovement.toFixed(1)}%`,
      totalTimeSavedMs: totalTimeSaved,
      successfulTests: successful.length,
      totalTests: benchmarks.length
    };
  }
}

export default {
  createProSBCFileAPI,
  CompatibilityProSBCFileAPI,
  PerformanceComparator
};
