// Optimized ProSBC File Manager with advanced caching and multi-instance support
import { getInstanceContext } from '../multiInstanceManager.js';
import { sessionPool } from './sessionPool.js';
import { configCache } from './configCache.js';
import { connectionPool } from './connectionPool.js';
import { htmlParser } from './htmlParser.js';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

/**
 * Optimized ProSBC File API with advanced performance features
 * - Session pooling and reuse
 * - Configuration caching
 * - Connection pooling
 * - Request queuing and batching
 * - Intelligent error handling and retries
 */
class OptimizedProSBCFileAPI {
  constructor(instanceId = null) {
    this.instanceId = instanceId;
    this.instanceContext = null;
    this.baseURL = null;
    
    // ProSBC1 hardcoded mappings (preserved for compatibility)
    this.prosbc1ConfigMappings = {
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

    // Performance tracking
    this.metrics = {
      requests: 0,
      errors: 0,
      cacheHits: 0,
      avgResponseTime: 0,
      sessionReuse: 0
    };
  }

  /**
   * Load instance context with caching
   */
  async loadInstanceContext() {
    if (this.instanceContext) return this.instanceContext;
    
    if (this.instanceId) {
      this.instanceContext = await getInstanceContext(this.instanceId);
      this.baseURL = this.instanceContext.baseUrl;
      console.log(`[OptimizedProSBC] Loaded context for instance: ${this.instanceContext.name} (${this.baseURL})`);
    } else {
      // Environment fallback
      this.instanceContext = {
        baseUrl: process.env.PROSBC_BASE_URL,
        username: process.env.PROSBC_USERNAME,
        password: process.env.PROSBC_PASSWORD,
        name: 'Environment-based',
        id: 'env'
      };
      this.baseURL = this.instanceContext.baseUrl;
      console.log(`[OptimizedProSBC] Using environment configuration: ${this.baseURL}`);
    }
    
    return this.instanceContext;
  }

  /**
   * Get session cookie with pooling
   */
  async getSessionCookie() {
    await this.loadInstanceContext();
    
    const cookie = await sessionPool.getSession(this.instanceId || 'env', {
      baseUrl: this.baseURL,
      username: this.instanceContext.username,
      password: this.instanceContext.password
    });

    this.metrics.sessionReuse++;
    return cookie;
  }

  /**
   * Get basic auth header
   */
  getBasicAuthHeader() {
    if (!this.instanceContext) {
      throw new Error('Instance context not loaded');
    }
    
    const credentials = Buffer.from(
      `${this.instanceContext.username}:${this.instanceContext.password}`
    ).toString('base64');
    
    return `Basic ${credentials}`;
  }

  /**
   * Make HTTP request with optimizations
   */
  async makeRequest(url, options = {}) {
    const startTime = Date.now();
    this.metrics.requests++;

    try {
      // Add session cookie if not present
      if (!options.headers?.Authorization && !options.headers?.Cookie) {
        const sessionCookie = await this.getSessionCookie();
        options.headers = {
          ...options.headers,
          Cookie: `_WebOAMP_session=${sessionCookie}`
        };
      }

      const response = await connectionPool.request(this.instanceId || 'env', url, options);
      
      // Update metrics
      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime, true);
      
      return response;

    } catch (error) {
      this.metrics.errors++;
      this.updateMetrics(Date.now() - startTime, false);
      
      // Handle session expiry
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.log(`[OptimizedProSBC] Session expired for ${this.instanceId}, invalidating...`);
        sessionPool.invalidateSession(this.instanceId || 'env', this.baseURL);
        
        // Retry once with new session
        if (!options._retried) {
          options._retried = true;
          return this.makeRequest(url, options);
        }
      }
      
      throw error;
    }
  }

  /**
   * Ensure configuration is selected with caching
   */
  async ensureConfigSelected(configId = null) {
    await this.loadInstanceContext();
    
    // Use cached selection if available
    let targetConfigId = configId;
    if (!targetConfigId) {
      targetConfigId = this.getDefaultConfigId();
    }

    // Check if already selected via cache
    const currentSelection = configCache.getSelectionState(this.instanceId || 'env');
    if (currentSelection === targetConfigId) {
      console.log(`[OptimizedProSBC] Config ${targetConfigId} already selected (cached)`);
      this.selectedConfigId = this.getDbIdForConfig(targetConfigId);
      this.metrics.cacheHits++;
      return;
    }

    // Perform config selection with caching
    const sessionCookie = await this.getSessionCookie();
    
    await configCache.ensureConfigSelected(
      this.instanceId || 'env',
      targetConfigId,
      this.baseURL,
      sessionCookie,
      this.prosbc1ConfigMappings
    );

    this.selectedConfigId = this.getDbIdForConfig(targetConfigId);
    console.log(`[OptimizedProSBC] Selected config: ${targetConfigId} -> DB ID: ${this.selectedConfigId}`);
  }

  /**
   * Get database ID for configuration
   */
  getDbIdForConfig(configId) {
    // Handle ProSBC1 mappings
    if (this.instanceId?.toLowerCase() === 'prosbc1' && this.prosbc1ConfigMappings[configId]) {
      return this.prosbc1ConfigMappings[configId].dbId;
    }
    
    return configId;
  }

  /**
   * Get default configuration ID
   */
  getDefaultConfigId() {
    return process.env.PROSBC_CONFIG_ID || '3';
  }

  /**
   * List files with optimization and caching
   */
  async listFiles(fileType, configId = null) {
    await this.ensureConfigSelected(configId);
    
    const url = `${this.baseURL}/file_dbs/${this.selectedConfigId}/edit`;
    
    try {
      const response = await this.makeRequest(url);
      const html = await response.text();
      
      // Use optimized HTML parser
      const sectionTitle = fileType === 'routesets_definitions' ? 
        'Routesets/Definitions Files' : 'Digit Map Files';
      
      const files = htmlParser.parseFileTable(html, sectionTitle, fileType);
      
      console.log(`[OptimizedProSBC] Listed ${files.length} ${fileType} files for config ${configId || 'default'}`);
      
      return {
        success: true,
        files,
        total: files.length,
        configId: this.selectedConfigId,
        instanceId: this.instanceId
      };

    } catch (error) {
      console.error(`[OptimizedProSBC] Error listing ${fileType} files:`, error.message);
      throw new Error(`Failed to list ${fileType} files: ${error.message}`);
    }
  }

  /**
   * List DF files (routesets_definitions)
   */
  async listDfFiles(configId = null) {
    return this.listFiles('routesets_definitions', configId);
  }

  /**
   * List DM files (digit_maps)
   */
  async listDmFiles(configId = null) {
    return this.listFiles('digit_maps', configId);
  }

  /**
   * List all files with parallel processing
   */
  async listAllFiles(configId = null) {
    await this.ensureConfigSelected(configId);
    
    // Parallel execution for better performance
    const [dfResult, dmResult] = await Promise.allSettled([
      this.listDfFiles(configId),
      this.listDmFiles(configId)
    ]);

    const dfFiles = dfResult.status === 'fulfilled' ? dfResult.value.files : [];
    const dmFiles = dmResult.status === 'fulfilled' ? dmResult.value.files : [];

    return {
      success: true,
      dfFiles,
      dmFiles,
      total: dfFiles.length + dmFiles.length,
      configId: this.selectedConfigId,
      instanceId: this.instanceId,
      errors: [
        ...(dfResult.status === 'rejected' ? [`DF: ${dfResult.reason.message}`] : []),
        ...(dmResult.status === 'rejected' ? [`DM: ${dmResult.reason.message}`] : [])
      ]
    };
  }

  /**
   * Upload file with optimization
   */
  async uploadFile(filePath, fileContent = null, configId = null, customFileName = null) {
    await this.ensureConfigSelected(configId);
    
    const fileName = customFileName || path.basename(filePath);
    const fileTypeFromName = fileName.toLowerCase().includes('digit') || fileName.toLowerCase().includes('dm') 
      ? 'digit_maps' : 'routesets_definitions';
    
    console.log(`[OptimizedProSBC] Uploading ${fileName} as ${fileTypeFromName} to config ${this.selectedConfigId}`);

    try {
      const form = new FormData();
      
      if (fileContent) {
        form.append('file', fileContent, fileName);
      } else {
        form.append('file', fs.createReadStream(filePath), fileName);
      }

      const uploadUrl = `${this.baseURL}/file_dbs/${this.selectedConfigId}/${fileTypeFromName}`;
      
      const response = await this.makeRequest(uploadUrl, {
        method: 'POST',
        body: form,
        headers: {
          ...form.getHeaders(),
          'Authorization': this.getBasicAuthHeader()
        }
      });

      if (response.ok || response.status === 302) {
        console.log(`[OptimizedProSBC] Successfully uploaded: ${fileName}`);
        return {
          success: true,
          message: `File '${fileName}' uploaded successfully`,
          fileName,
          fileType: fileTypeFromName,
          configId: this.selectedConfigId
        };
      } else {
        throw new Error(`Upload failed with status: ${response.status}`);
      }

    } catch (error) {
      console.error(`[OptimizedProSBC] Upload error:`, error.message);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Delete file with optimization
   */
  async deleteFile(fileType, fileName, configId = null, fileId = null) {
    await this.ensureConfigSelected(configId);
    
    // Find file ID if not provided
    if (!fileId) {
      const files = await this.listFiles(fileType, configId);
      const file = files.files.find(f => f.name === fileName);
      if (!file) {
        throw new Error(`File '${fileName}' not found`);
      }
      fileId = file.id;
    }

    const deleteUrl = `${this.baseURL}/file_dbs/${this.selectedConfigId}/${fileType}/${fileId}`;
    
    try {
      // Try REST API DELETE first
      const response = await this.makeRequest(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          'Authorization': this.getBasicAuthHeader()
        }
      });

      if (response.ok) {
        console.log(`[OptimizedProSBC] Successfully deleted: ${fileName}`);
        return {
          success: true,
          message: `File '${fileName}' deleted successfully`,
          fileName,
          fileId,
          fileType
        };
      } else {
        throw new Error(`Delete failed with status: ${response.status}`);
      }

    } catch (error) {
      console.error(`[OptimizedProSBC] Delete error:`, error.message);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Batch upload multiple files
   */
  async batchUpload(files, configId = null, onProgress = null) {
    await this.ensureConfigSelected(configId);
    
    const results = [];
    const batchSize = 3; // Conservative batch size
    
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      
      const batchPromises = batch.map(file => 
        this.uploadFile(file.path, file.content, configId, file.name)
          .catch(error => ({ success: false, error: error.message, fileName: file.name }))
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults.map(r => r.status === 'fulfilled' ? r.value : r.reason));
      
      // Progress callback
      if (onProgress) {
        const progress = Math.min(100, ((i + batch.length) / files.length) * 100);
        onProgress(progress, `Completed ${Math.min(i + batch.length, files.length)}/${files.length} files`);
      }
      
      // Small delay between batches
      if (i + batchSize < files.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    return results;
  }

  /**
   * Update performance metrics
   */
  updateMetrics(responseTime, success) {
    if (!this.metrics.responseTimes) {
      this.metrics.responseTimes = [];
    }
    
    this.metrics.responseTimes.push(responseTime);
    
    // Keep only last 50 response times
    if (this.metrics.responseTimes.length > 50) {
      this.metrics.responseTimes.shift();
    }
    
    this.metrics.avgResponseTime = 
      this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length;
  }

  /**
   * Get performance statistics
   */
  getStats() {
    return {
      instance: {
        id: this.instanceId,
        name: this.instanceContext?.name,
        baseUrl: this.baseURL
      },
      metrics: {
        ...this.metrics,
        successRate: this.metrics.requests > 0 ? 
          ((this.metrics.requests - this.metrics.errors) / this.metrics.requests) * 100 : 0,
        errorRate: this.metrics.requests > 0 ? 
          (this.metrics.errors / this.metrics.requests) * 100 : 0,
        cacheHitRate: this.metrics.requests > 0 ? 
          (this.metrics.cacheHits / this.metrics.requests) * 100 : 0
      },
      pools: {
        session: sessionPool.getStats(),
        connection: connectionPool.getStats(),
        config: configCache.getStats(),
        html: htmlParser.getStats()
      }
    };
  }

  /**
   * Clear all caches for this instance
   */
  clearCaches() {
    configCache.invalidateInstance(this.instanceId || 'env');
    sessionPool.clearInstanceSessions(this.instanceId || 'env');
    connectionPool.clearQueue(this.instanceId || 'env');
    htmlParser.clearCache();
    
    console.log(`[OptimizedProSBC] Cleared all caches for instance: ${this.instanceId}`);
  }
}

export { OptimizedProSBCFileAPI };
export default OptimizedProSBCFileAPI;
