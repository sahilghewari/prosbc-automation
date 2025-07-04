/**
 * Client-Side Database API
 * Browser-compatible database interface that provides localStorage and
 * can communicate with Ubuntu backend when deployed
 */

import UbuntuStorageAPI from './ubuntuStorageAPI.js';

// Mock data for development
const mockNaps = [
  {
    id: 'nap_001',
    napName: 'sample-nap-001',
    status: 'active',
    enabled: true,
    proxyAddress: '192.168.1.100',
    proxyPort: 5060,
    createdAt: new Date('2024-01-15'),
    tags: ['sample', 'development']
  },
  {
    id: 'nap_002', 
    napName: 'prod-nap-gateway',
    status: 'active',
    enabled: true,
    proxyAddress: '10.0.1.50',
    proxyPort: 5060,
    createdAt: new Date('2024-02-10'),
    tags: ['production', 'gateway']
  }
];

const mockFiles = [
  {
    id: 'file_001',
    fileName: 'sample-df-001.csv',
    fileType: 'df',
    fileSize: 2048,
    uploadDate: new Date('2024-01-20'),
    tags: ['sample', 'development'],
    validation: { isValid: true }
  },
  {
    id: 'file_002',
    fileName: 'prod-dm-routes.csv', 
    fileType: 'dm',
    fileSize: 4096,
    uploadDate: new Date('2024-02-15'),
    tags: ['production', 'routes'],
    validation: { isValid: true }
  }
];

const mockActivationLogs = [
  {
    id: 'log_001',
    napId: 'nap_001',
    activationType: 'deployment',
    status: 'success',
    timestamp: new Date('2024-01-25'),
    details: 'NAP deployed successfully'
  },
  {
    id: 'log_002',
    napId: 'nap_002',
    activationType: 'update',
    status: 'success', 
    timestamp: new Date('2024-02-20'),
    details: 'Configuration updated'
  }
];

// Simulate database connection status
let connectionStatus = 'connected';
let connectionHealth = {
  status: 'healthy',
  database: 'prosbc_nap_client',
  collections: 5,
  dataSize: '12.5 KB',
  lastChecked: new Date()
};

// Database Service Class
export class ClientDatabaseService {
  constructor() {
    this.isConnected = true;
    this.napStorageKey = 'prosbc_naps';
    this.fileStorageKey = 'prosbc_files';
    this.logStorageKey = 'prosbc_logs';
    this.ubuntuAPI = new UbuntuStorageAPI();
  }

  // Helper methods for localStorage operations
  _loadFromStorage(key, defaultData = []) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultData;
    } catch (error) {
      console.error(`Error loading from storage ${key}:`, error);
      return defaultData;
    }
  }

  _saveToStorage(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error(`Error saving to storage ${key}:`, error);
      return false;
    }
  }

  // Generate unique ID
  _generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Check if Ubuntu backend is available
  async _isUbuntuAvailable() {
    try {
      const health = await this.ubuntuAPI.checkHealth();
      return health.status === 'healthy';
    } catch (error) {
      return false;
    }
  }

  // NAP CRUD operations
  async createNap(napData) {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
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

      // Try Ubuntu storage first
      if (await this._isUbuntuAvailable()) {
        try {
          const result = await this.ubuntuAPI.saveNap(newNap);
          console.log('✅ NAP saved to Ubuntu storage:', result);
        } catch (error) {
          console.warn('Ubuntu storage failed, falling back to localStorage:', error);
        }
      }

      // Always save to localStorage as backup
      const naps = this._loadFromStorage(this.napStorageKey, []);
      naps.push(newNap);
      this._saveToStorage(this.napStorageKey, naps);

      // Record creation log
      await this.recordLog({
        action: 'NAP Created',
        resource_type: 'NAP',
        resource_id: newNap.nap_id,
        status: 'success',
        details: `NAP '${newNap.name}' created successfully`,
        execution_context: {
          executed_by: 'user',
          timestamp: new Date().toISOString()
        }
      });

      console.log('✅ NAP saved to localStorage:', newNap);
      return {
        success: true,
        nap: newNap,
        message: 'NAP created and recorded in database'
      };
    } catch (error) {
      console.error('Error creating NAP:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async saveFile(fileData) {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
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

      // Try Ubuntu storage first
      if (await this._isUbuntuAvailable()) {
        try {
          const result = await this.ubuntuAPI.saveFile(newFile);
          console.log('✅ File saved to Ubuntu storage:', result);
        } catch (error) {
          console.warn('Ubuntu storage failed, falling back to localStorage:', error);
        }
      }

      // Always save to localStorage as backup
      const files = this._loadFromStorage(this.fileStorageKey, []);
      files.push(newFile);
      this._saveToStorage(this.fileStorageKey, files);

      // Record upload log
      await this.recordLog({
        action: 'File Uploaded',
        resource_type: 'FILE',
        resource_id: newFile.id,
        status: 'success',
        details: `File '${newFile.name}' (${newFile.type}) uploaded successfully`,
        execution_context: {
          executed_by: 'user',
          timestamp: new Date().toISOString()
        }
      });

      console.log('✅ File saved to localStorage:', newFile);
      return {
        success: true,
        file: newFile,
        message: 'File uploaded and recorded in database'
      };
    } catch (error) {
      console.error('Error saving file:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async recordLog(logData) {
    await new Promise(resolve => setTimeout(resolve, 50));
    
    try {
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

      // Try Ubuntu storage first
      if (await this._isUbuntuAvailable()) {
        try {
          await this.ubuntuAPI.saveLog(newLog);
        } catch (error) {
          console.warn('Ubuntu log storage failed:', error);
        }
      }

      // Always save to localStorage
      const logs = this._loadFromStorage(this.logStorageKey, []);
      logs.push(newLog);
      this._saveToStorage(this.logStorageKey, logs);

      return {
        success: true,
        log: newLog
      };
    } catch (error) {
      console.error('Error recording log:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get live data from localStorage and Ubuntu
  async getAnalytics(period = '7d') {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    let naps = this._loadFromStorage(this.napStorageKey, []);
    let files = this._loadFromStorage(this.fileStorageKey, []);
    let logs = this._loadFromStorage(this.logStorageKey, []);

    // Try to get data from Ubuntu if available
    if (await this._isUbuntuAvailable()) {
      try {
        const ubuntuNaps = await this.ubuntuAPI.listNaps();
        const ubuntuFiles = await this.ubuntuAPI.listFiles();
        const ubuntuLogs = await this.ubuntuAPI.getLogs();
        
        if (ubuntuNaps && ubuntuNaps.length > 0) naps = ubuntuNaps;
        if (ubuntuFiles && ubuntuFiles.length > 0) files = ubuntuFiles;
        if (ubuntuLogs && ubuntuLogs.length > 0) logs = ubuntuLogs;
      } catch (error) {
        console.warn('Failed to get Ubuntu data, using localStorage:', error);
      }
    }
    
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

  async listNaps(filter = {}, page = 1, limit = 10) {
    await new Promise(resolve => setTimeout(resolve, 50));
    
    let filteredNaps = this._loadFromStorage(this.napStorageKey, []);
    
    if (filter.status) {
      filteredNaps = filteredNaps.filter(nap => nap.status === filter.status);
    }
    
    return {
      success: true,
      naps: filteredNaps.slice((page - 1) * limit, page * limit),
      total: filteredNaps.length,
      page,
      limit
    };
  }

  async getActivationLogs(filter = {}, page = 1, limit = 10) {
    await new Promise(resolve => setTimeout(resolve, 50));
    
    let filteredLogs = this._loadFromStorage(this.logStorageKey, []);
    
    if (filter.status) {
      filteredLogs = filteredLogs.filter(log => log.status === filter.status);
    }
    
    return {
      success: true,
      logs: filteredLogs.slice((page - 1) * limit, page * limit),
      total: filteredLogs.length,
      page,
      limit
    };
  }

  async search(query, filters = {}) {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const naps = this._loadFromStorage(this.napStorageKey, []);
    const files = this._loadFromStorage(this.fileStorageKey, []);
    const logs = this._loadFromStorage(this.logStorageKey, []);
    
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

  // Check Ubuntu backend status
  async getUbuntuStatus() {
    return await this.ubuntuAPI.checkHealth();
  }
}

// Quick Access Functions
export const quickAccess = {
  async searchFiles(query, options = {}) {
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const files = JSON.parse(localStorage.getItem('prosbc_files') || '[]');
    const filteredFiles = files.filter(file =>
      !query || (file.name || file.fileName || '').toLowerCase().includes(query.toLowerCase())
    );
    
    return {
      success: true,
      files: filteredFiles.slice(0, options.limit || 10)
    };
  },

  async searchNaps(query, options = {}) {
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const naps = JSON.parse(localStorage.getItem('prosbc_naps') || '[]');
    const filteredNaps = naps.filter(nap =>
      !query || (nap.name || nap.napName || '').toLowerCase().includes(query.toLowerCase())
    );
    
    return {
      success: true,
      naps: filteredNaps.slice(0, options.limit || 10)
    };
  }
};

// Database Health Check
export async function getDBHealth() {
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const ubuntuAPI = new UbuntuStorageAPI();
  const ubuntuHealth = await ubuntuAPI.checkHealth();
  
  return {
    localStorage: {
      status: 'healthy',
      database: 'prosbc_nap_client',
      type: 'localStorage',
      lastChecked: new Date()
    },
    ubuntu: ubuntuHealth,
    overall: ubuntuHealth.status === 'healthy' ? 'ubuntu_primary' : 'localStorage_only'
  };
}

// Initialize Database
export async function initializeDatabase() {
  await new Promise(resolve => setTimeout(resolve, 200));
  connectionStatus = 'connected';
  console.log('✅ Client-side database API initialized');
  return { success: true, message: 'Client database initialized' };
}

// Default export for compatibility
export default {
  ClientDatabaseService,
  quickAccess,
  getDBHealth,
  initializeDatabase
};
