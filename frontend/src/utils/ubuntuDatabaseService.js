/**
 * Ubuntu File System Database Service
 * Provides a client-side interface that can switch between localStorage (development)
 * and file system storage (Ubuntu production)
 */

import fileSystemDB from './fileSystemDatabase.js';

class UbuntuDatabaseService {
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production' || process.env.STORAGE_TYPE === 'filesystem';
    this.storageType = this.isProduction ? 'filesystem' : 'localstorage';
    
    // Storage keys for localStorage fallback
    this.napStorageKey = 'prosbc_naps';
    this.fileStorageKey = 'prosbc_files';
    this.logStorageKey = 'prosbc_logs';
  }

  // Initialize the appropriate storage system
  async initialize() {
    if (this.isProduction) {
      console.log('🔄 Initializing Ubuntu file system database...');
      return await fileSystemDB.initialize();
    } else {
      console.log('🔄 Using localStorage for development...');
      return { success: true, message: 'Using localStorage for development' };
    }
  }

  // Helper methods for localStorage operations (development mode)
  _loadFromStorage(key, defaultData = []) {
    if (this.isProduction) return defaultData;
    
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultData;
    } catch (error) {
      console.error(`Error loading from storage ${key}:`, error);
      return defaultData;
    }
  }

  _saveToStorage(key, data) {
    if (this.isProduction) return true;
    
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error(`Error saving to storage ${key}:`, error);
      return false;
    }
  }

  _generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Create NAP (works for both localStorage and file system)
  async createNap(napData) {
    if (this.isProduction) {
      return await fileSystemDB.saveNap(napData);
    }

    // Development mode - use localStorage
    try {
      const naps = this._loadFromStorage(this.napStorageKey, []);
      const newNap = {
        nap_id: napData.napId || this._generateId('nap'),
        name: napData.napName,
        status: napData.enabled ? 'active' : 'inactive',
        enabled: napData.enabled,
        proxy_address: napData.proxyAddress,
        proxy_port: napData.proxyPort,
        use_proxy: napData.useProxy,
        register_to_proxy: napData.registerToProxy,
        default_profile: napData.defaultProfile,
        config: napData.config,
        created_by: 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tags: napData.tags || [],
        prosbc_result: napData.prosbc_result
      };

      naps.push(newNap);
      this._saveToStorage(this.napStorageKey, naps);

      await this.recordLog({
        action: 'NAP Created',
        resource_type: 'NAP',
        resource_id: newNap.nap_id,
        status: 'success',
        details: `NAP '${newNap.name}' created successfully`
      });

      return {
        success: true,
        nap: newNap,
        message: 'NAP created and recorded in database'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Save file (works for both localStorage and file system)
  async saveFile(fileData, fileContent = null) {
    if (this.isProduction) {
      return await fileSystemDB.saveFile(fileData, fileContent);
    }

    // Development mode - use localStorage
    try {
      const files = this._loadFromStorage(this.fileStorageKey, []);
      const newFile = {
        id: this._generateId('file'),
        name: fileData.name,
        type: fileData.type,
        size: fileData.size,
        original_filename: fileData.originalFile,
        uploaded_by: 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tags: fileData.tags || [],
        validation: fileData.validation || { isValid: true },
        prosbc_result: fileData.prosbc_result
      };

      files.push(newFile);
      this._saveToStorage(this.fileStorageKey, files);

      await this.recordLog({
        action: 'File Uploaded',
        resource_type: 'FILE',
        resource_id: newFile.id,
        status: 'success',
        details: `File '${newFile.name}' (${newFile.type}) uploaded successfully`
      });

      return {
        success: true,
        file: newFile,
        message: 'File uploaded and recorded in database'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Record log (works for both storage types)
  async recordLog(logData) {
    if (this.isProduction) {
      return await fileSystemDB.saveLog(logData);
    }

    // Development mode - use localStorage
    try {
      const logs = this._loadFromStorage(this.logStorageKey, []);
      const newLog = {
        id: this._generateId('log'),
        action: logData.action,
        resource_type: logData.resource_type,
        resource_id: logData.resource_id,
        status: logData.status,
        details: logData.details,
        execution_context: logData.execution_context || {
          executed_by: 'user',
          timestamp: new Date().toISOString()
        },
        timing_info: {
          start_time: new Date().toISOString(),
          end_time: new Date().toISOString()
        },
        created_at: new Date().toISOString()
      };

      logs.push(newLog);
      this._saveToStorage(this.logStorageKey, logs);

      return {
        success: true,
        log: newLog
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get analytics
  async getAnalytics(period = '7d') {
    if (this.isProduction) {
      return await fileSystemDB.getAnalytics();
    }

    // Development mode - use localStorage
    const naps = this._loadFromStorage(this.napStorageKey, []);
    const files = this._loadFromStorage(this.fileStorageKey, []);
    const logs = this._loadFromStorage(this.logStorageKey, []);

    return {
      success: true,
      analytics: {
        totalNaps: naps.length,
        totalFiles: files.length,
        totalActivations: logs.length,
        totalFileSize: files.reduce((sum, f) => sum + (f.size || f.fileSize || 0), 0),
        recentActivity: logs.slice(-5),
        files: files,
        naps: naps,
        activations: logs,
        period: period,
        generatedAt: new Date()
      }
    };
  }

  // List NAPs
  async listNaps(filter = {}, page = 1, limit = 10) {
    let naps = [];
    
    if (this.isProduction) {
      const result = await fileSystemDB.getNaps();
      naps = result.naps || [];
    } else {
      naps = this._loadFromStorage(this.napStorageKey, []);
    }

    if (filter.status) {
      naps = naps.filter(nap => nap.status === filter.status);
    }

    return {
      success: true,
      naps: naps.slice((page - 1) * limit, page * limit),
      total: naps.length,
      page,
      limit
    };
  }

  // Get activation logs
  async getActivationLogs(filter = {}, page = 1, limit = 10) {
    let logs = [];
    
    if (this.isProduction) {
      const result = await fileSystemDB.getLogs(7);
      logs = result.logs || [];
    } else {
      logs = this._loadFromStorage(this.logStorageKey, []);
    }

    if (filter.status) {
      logs = logs.filter(log => log.status === filter.status);
    }

    return {
      success: true,
      logs: logs.slice((page - 1) * limit, page * limit),
      total: logs.length,
      page,
      limit
    };
  }

  // Search across all data
  async search(query, filters = {}) {
    let naps = [];
    let files = [];
    let logs = [];

    if (this.isProduction) {
      const [napsResult, filesResult, logsResult] = await Promise.all([
        fileSystemDB.getNaps(),
        fileSystemDB.getFiles(),
        fileSystemDB.getLogs(7)
      ]);
      
      naps = napsResult.naps || [];
      files = filesResult.files || [];
      logs = logsResult.logs || [];
    } else {
      naps = this._loadFromStorage(this.napStorageKey, []);
      files = this._loadFromStorage(this.fileStorageKey, []);
      logs = this._loadFromStorage(this.logStorageKey, []);
    }

    const results = {
      naps: naps.filter(nap => 
        (nap.name || nap.napName || '').toLowerCase().includes(query.toLowerCase()) ||
        (nap.tags || []).some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      ),
      files: files.filter(file =>
        (file.name || file.fileName || '').toLowerCase().includes(query.toLowerCase()) ||
        (file.tags || []).some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      ),
      logs: logs.filter(log =>
        (log.details || '').toLowerCase().includes(query.toLowerCase())
      )
    };

    return {
      success: true,
      results,
      query,
      totalFound: results.naps.length + results.files.length + results.logs.length
    };
  }

  // Get system health
  async getHealth() {
    if (this.isProduction) {
      return await fileSystemDB.getHealth();
    }

    // Development mode health check
    return {
      status: 'healthy',
      storage_type: 'localStorage',
      environment: 'development',
      lastChecked: new Date().toISOString()
    };
  }

  // Get storage info
  getStorageInfo() {
    return {
      storageType: this.storageType,
      isProduction: this.isProduction,
      environment: process.env.NODE_ENV || 'development'
    };
  }
}

// Quick access functions that work with both storage types
export const quickAccess = {
  async searchFiles(query, options = {}) {
    const service = new UbuntuDatabaseService();
    
    if (service.isProduction) {
      const result = await fileSystemDB.getFiles();
      const files = result.files || [];
      const filteredFiles = files.filter(file =>
        !query || (file.name || file.fileName || '').toLowerCase().includes(query.toLowerCase())
      );
      
      return {
        success: true,
        files: filteredFiles.slice(0, options.limit || 10)
      };
    } else {
      const files = JSON.parse(localStorage.getItem('prosbc_files') || '[]');
      const filteredFiles = files.filter(file =>
        !query || (file.name || file.fileName || '').toLowerCase().includes(query.toLowerCase())
      );
      
      return {
        success: true,
        files: filteredFiles.slice(0, options.limit || 10)
      };
    }
  },

  async searchNaps(query, options = {}) {
    const service = new UbuntuDatabaseService();
    
    if (service.isProduction) {
      const result = await fileSystemDB.getNaps();
      const naps = result.naps || [];
      const filteredNaps = naps.filter(nap =>
        !query || (nap.name || nap.napName || '').toLowerCase().includes(query.toLowerCase())
      );
      
      return {
        success: true,
        naps: filteredNaps.slice(0, options.limit || 10)
      };
    } else {
      const naps = JSON.parse(localStorage.getItem('prosbc_naps') || '[]');
      const filteredNaps = naps.filter(nap =>
        !query || (nap.name || nap.napName || '').toLowerCase().includes(query.toLowerCase())
      );
      
      return {
        success: true,
        naps: filteredNaps.slice(0, options.limit || 10)
      };
    }
  }
};

export default UbuntuDatabaseService;
