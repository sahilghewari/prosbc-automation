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

// Mock data for DM and DF files
const mockDigitMaps = [
  {
    id: 'dm_001',
    filename: 'CS1_DM.csv',
    original_filename: 'CS1.csv',
    content: 'called,calling,routeset_name\n8557021437,,DIP_CUS_TNW\n8557021438,,DIP_CUS_TNW',
    content_type: 'csv',
    file_size: 1024,
    nap_id: 'nap_001',
    routeset_name: 'DIP_CUS_TNW',
    status: 'active',
    upload_time: new Date('2024-06-24T10:30:00Z'),
    uploaded_by: 'admin',
    source: 'gui',
    comments: 'Initial upload from UI'
  },
  {
    id: 'dm_002',
    filename: 'CS2_DM.csv',
    original_filename: 'CS2.csv',
    content: 'called,calling,routeset_name\n8557021439,,DIP_CUS_INTERNAL\n8557021440,,DIP_CUS_INTERNAL',
    content_type: 'csv',
    file_size: 856,
    nap_id: 'nap_002',
    routeset_name: 'DIP_CUS_INTERNAL',
    status: 'active',
    upload_time: new Date('2024-06-25T14:20:00Z'),
    uploaded_by: 'admin',
    source: 'api',
    comments: 'Auto-generated from system'
  }
];

const mockDialFormats = [
  {
    id: 'df_001',
    filename: 'CS1_DF.csv',
    original_filename: 'CS1.csv',
    content: 'routeset_name,priority,weight,remapped_called,remapped_calling\nDIP_CUS_TNW,10,100,+1${called},${calling}',
    content_type: 'csv',
    file_size: 2048,
    nap_id: 'nap_001',
    routeset_name: 'DIP_CUS_TNW',
    status: 'active',
    upload_time: new Date('2024-06-24T10:35:00Z'),
    uploaded_by: 'admin',
    source: 'gui',
    comments: 'Includes regex for normalization'
  },
  {
    id: 'df_002',
    filename: 'CS2_DF.csv',
    original_filename: 'CS2.csv',
    content: 'routeset_name,priority,weight,remapped_called,remapped_calling\nDIP_CUS_INTERNAL,5,50,${called},${calling}',
    content_type: 'csv',
    file_size: 1536,
    nap_id: 'nap_002',
    routeset_name: 'DIP_CUS_INTERNAL',
    status: 'active',
    upload_time: new Date('2024-06-25T14:25:00Z'),
    uploaded_by: 'admin',
    source: 'api',
    comments: 'Internal routing format'
  }
];

const mockFileMappings = [
  {
    id: 'mapping_001',
    nap_id: 'nap_001',
    digitmap_file_id: 'dm_001',
    dialformat_file_id: 'df_001',
    mapped_at: new Date('2024-06-24T11:00:00Z'),
    mapped_by: 'admin',
    status: 'mapped',
    generation_status: 'success',
    activation_status: 'success'
  },
  {
    id: 'mapping_002',
    nap_id: 'nap_002',
    digitmap_file_id: 'dm_002',
    dialformat_file_id: 'df_002',
    mapped_at: new Date('2024-06-25T15:00:00Z'),
    mapped_by: 'admin',
    status: 'mapped',
    generation_status: 'success',
    activation_status: 'pending'
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
    this.digitMapStorageKey = 'prosbc_digit_maps';
    this.dialFormatStorageKey = 'prosbc_dial_formats';
    this.fileMappingStorageKey = 'prosbc_file_mappings';
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

  async _isUbuntuAvailable() {
    try {
      const status = await this.ubuntuAPI.getStatus();
      return status.success;
    } catch (error) {
      console.error('Ubuntu API not available:', error);
      return false;
    }
  }

  async createNap(napData) {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (await this._isUbuntuAvailable()) {
      try {
        return await this.ubuntuAPI.createNap(napData);
      } catch (error) {
        console.error('Ubuntu API error, falling back to localStorage:', error);
      }
    }
    
    // localStorage fallback
    const naps = this._loadFromStorage(this.napStorageKey, []);
    const newNap = {
      ...napData,
      id: `nap_${Date.now()}`,
      created: new Date(),
      status: napData.status || 'pending'
    };
    
    naps.push(newNap);
    this._saveToStorage(this.napStorageKey, naps);
    
    return { success: true, nap: newNap };
  }

  async saveFile(fileData) {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (await this._isUbuntuAvailable()) {
      try {
        return await this.ubuntuAPI.saveFile(fileData);
      } catch (error) {
        console.error('Ubuntu API error, falling back to localStorage:', error);
      }
    }
    
    // localStorage fallback
    const files = this._loadFromStorage(this.fileStorageKey, []);
    const newFile = {
      ...fileData,
      id: `file_${Date.now()}`,
      saved: new Date(),
      status: fileData.status || 'saved'
    };
    
    files.push(newFile);
    this._saveToStorage(this.fileStorageKey, files);
    
    return { success: true, file: newFile };
  }

  async recordLog(logData) {
    await new Promise(resolve => setTimeout(resolve, 50));
    
    if (await this._isUbuntuAvailable()) {
      try {
        return await this.ubuntuAPI.recordLog(logData);
      } catch (error) {
        console.error('Ubuntu API error, falling back to localStorage:', error);
      }
    }
    
    // localStorage fallback
    const logs = this._loadFromStorage(this.logStorageKey, []);
    const newLog = {
      ...logData,
      id: `log_${Date.now()}`,
      timestamp: new Date()
    };
    
    logs.push(newLog);
    this._saveToStorage(this.logStorageKey, logs);
    
    return { success: true, log: newLog };
  }

  async getAnalytics(period = '7d') {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const naps = this._loadFromStorage(this.napStorageKey, []);
    const files = this._loadFromStorage(this.fileStorageKey, []);
    const logs = this._loadFromStorage(this.logStorageKey, []);
    
    return {
      success: true,
      analytics: {
        totalNaps: naps.length,
        activeNaps: naps.filter(nap => nap.status === 'active').length,
        totalFiles: files.length,
        recentLogs: logs.slice(-10),
        period
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
    const digitMaps = this._loadFromStorage(this.digitMapStorageKey, mockDigitMaps);
    const dialFormats = this._loadFromStorage(this.dialFormatStorageKey, mockDialFormats);
    const mappings = this._loadFromStorage(this.fileMappingStorageKey, mockFileMappings);
    
    const searchTerm = query.toLowerCase();
    
    const results = {};
    
    if (!filters.type || filters.type === 'naps') {
      results.naps = naps.filter(nap => 
        (nap.napName && nap.napName.toLowerCase().includes(searchTerm)) ||
        (nap.id && nap.id.toLowerCase().includes(searchTerm))
      );
    }
    
    if (!filters.type || filters.type === 'files') {
      results.files = files.filter(file => 
        (file.fileName && file.fileName.toLowerCase().includes(searchTerm))
      );
    }
    
    if (!filters.type || filters.type === 'digitMaps') {
      results.digitMaps = digitMaps.filter(dm => 
        dm.filename?.toLowerCase().includes(searchTerm) ||
        dm.routeset_name?.toLowerCase().includes(searchTerm)
      );
    }
    
    if (!filters.type || filters.type === 'dialFormats') {
      results.dialFormats = dialFormats.filter(df => 
        df.filename?.toLowerCase().includes(searchTerm) ||
        df.routeset_name?.toLowerCase().includes(searchTerm)
      );
    }
    
    return {
      success: true,
      results
    };
  }

  // Digit Map (DM) File Management Methods
  async listDigitMaps(filter = {}, page = 1, limit = 10) {
    await new Promise(resolve => setTimeout(resolve, 50));
    
    let digitMaps = this._loadFromStorage(this.digitMapStorageKey, mockDigitMaps);
    
    if (filter.status) {
      digitMaps = digitMaps.filter(dm => dm.status === filter.status);
    }
    if (filter.nap_id) {
      digitMaps = digitMaps.filter(dm => dm.nap_id === filter.nap_id);
    }
    if (filter.routeset_name) {
      digitMaps = digitMaps.filter(dm => dm.routeset_name?.includes(filter.routeset_name));
    }
    
    return {
      success: true,
      digitMaps: digitMaps.slice((page - 1) * limit, page * limit),
      total: digitMaps.length,
      page,
      limit
    };
  }

  async createDigitMap(dmData) {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const digitMaps = this._loadFromStorage(this.digitMapStorageKey, mockDigitMaps);
    const newDM = {
      ...dmData,
      id: `dm_${Date.now()}`,
      upload_time: new Date(),
      status: dmData.status || 'uploaded'
    };
    
    digitMaps.push(newDM);
    this._saveToStorage(this.digitMapStorageKey, digitMaps);
    
    return { success: true, digitMap: newDM };
  }

  async updateDigitMap(id, updates) {
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const digitMaps = this._loadFromStorage(this.digitMapStorageKey, mockDigitMaps);
    const index = digitMaps.findIndex(dm => dm.id === id);
    
    if (index === -1) {
      return { success: false, error: 'Digit Map not found' };
    }
    
    digitMaps[index] = { ...digitMaps[index], ...updates };
    this._saveToStorage(this.digitMapStorageKey, digitMaps);
    
    return { success: true, digitMap: digitMaps[index] };
  }

  async deleteDigitMap(id) {
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const digitMaps = this._loadFromStorage(this.digitMapStorageKey, mockDigitMaps);
    const filteredDMs = digitMaps.filter(dm => dm.id !== id);
    
    this._saveToStorage(this.digitMapStorageKey, filteredDMs);
    
    return { success: true };
  }

  // Dial Format (DF) File Management Methods
  async listDialFormats(filter = {}, page = 1, limit = 10) {
    await new Promise(resolve => setTimeout(resolve, 50));
    
    let dialFormats = this._loadFromStorage(this.dialFormatStorageKey, mockDialFormats);
    
    if (filter.status) {
      dialFormats = dialFormats.filter(df => df.status === filter.status);
    }
    if (filter.nap_id) {
      dialFormats = dialFormats.filter(df => df.nap_id === filter.nap_id);
    }
    if (filter.routeset_name) {
      dialFormats = dialFormats.filter(df => df.routeset_name?.includes(filter.routeset_name));
    }
    
    return {
      success: true,
      dialFormats: dialFormats.slice((page - 1) * limit, page * limit),
      total: dialFormats.length,
      page,
      limit
    };
  }

  async createDialFormat(dfData) {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const dialFormats = this._loadFromStorage(this.dialFormatStorageKey, mockDialFormats);
    const newDF = {
      ...dfData,
      id: `df_${Date.now()}`,
      upload_time: new Date(),
      status: dfData.status || 'uploaded'
    };
    
    dialFormats.push(newDF);
    this._saveToStorage(this.dialFormatStorageKey, dialFormats);
    
    return { success: true, dialFormat: newDF };
  }

  async updateDialFormat(id, updates) {
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const dialFormats = this._loadFromStorage(this.dialFormatStorageKey, mockDialFormats);
    const index = dialFormats.findIndex(df => df.id === id);
    
    if (index === -1) {
      return { success: false, error: 'Dial Format not found' };
    }
    
    dialFormats[index] = { ...dialFormats[index], ...updates };
    this._saveToStorage(this.dialFormatStorageKey, dialFormats);
    
    return { success: true, dialFormat: dialFormats[index] };
  }

  async deleteDialFormat(id) {
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const dialFormats = this._loadFromStorage(this.dialFormatStorageKey, mockDialFormats);
    const filteredDFs = dialFormats.filter(df => df.id !== id);
    
    this._saveToStorage(this.dialFormatStorageKey, filteredDFs);
    
    return { success: true };
  }

  // File Mapping Management Methods
  async listFileMappings(filter = {}, page = 1, limit = 10) {
    await new Promise(resolve => setTimeout(resolve, 50));
    
    let mappings = this._loadFromStorage(this.fileMappingStorageKey, mockFileMappings);
    
    if (filter.status) {
      mappings = mappings.filter(mapping => mapping.status === filter.status);
    }
    if (filter.nap_id) {
      mappings = mappings.filter(mapping => mapping.nap_id === filter.nap_id);
    }
    
    return {
      success: true,
      mappings: mappings.slice((page - 1) * limit, page * limit),
      total: mappings.length,
      page,
      limit
    };
  }

  async createFileMapping(mappingData) {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const mappings = this._loadFromStorage(this.fileMappingStorageKey, mockFileMappings);
    const newMapping = {
      ...mappingData,
      id: `mapping_${Date.now()}`,
      mapped_at: new Date(),
      status: mappingData.status || 'pending'
    };
    
    mappings.push(newMapping);
    this._saveToStorage(this.fileMappingStorageKey, mappings);
    
    return { success: true, mapping: newMapping };
  }

  async updateFileMapping(id, updates) {
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const mappings = this._loadFromStorage(this.fileMappingStorageKey, mockFileMappings);
    const index = mappings.findIndex(mapping => mapping.id === id);
    
    if (index === -1) {
      return { success: false, error: 'File mapping not found' };
    }
    
    mappings[index] = { ...mappings[index], ...updates };
    this._saveToStorage(this.fileMappingStorageKey, mappings);
    
    return { success: true, mapping: mappings[index] };
  }

  async deleteFileMapping(id) {
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const mappings = this._loadFromStorage(this.fileMappingStorageKey, mockFileMappings);
    const filteredMappings = mappings.filter(mapping => mapping.id !== id);
    
    this._saveToStorage(this.fileMappingStorageKey, filteredMappings);
    
    return { success: true };
  }

  async getUbuntuStatus() {
    return this.ubuntuAPI.getStatus();
  }

  async searchFiles(query, options = {}) {
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const digitMaps = this._loadFromStorage(this.digitMapStorageKey, mockDigitMaps);
    const dialFormats = this._loadFromStorage(this.dialFormatStorageKey, mockDialFormats);
    const files = this._loadFromStorage(this.fileStorageKey, []);
    
    const searchTerm = query.toLowerCase();
    
    const filteredDMs = digitMaps.filter(dm => 
      dm.filename?.toLowerCase().includes(searchTerm) ||
      dm.routeset_name?.toLowerCase().includes(searchTerm) ||
      dm.uploaded_by?.toLowerCase().includes(searchTerm)
    );
    
    const filteredDFs = dialFormats.filter(df => 
      df.filename?.toLowerCase().includes(searchTerm) ||
      df.routeset_name?.toLowerCase().includes(searchTerm) ||
      df.uploaded_by?.toLowerCase().includes(searchTerm)
    );
    
    const filteredFiles = files.filter(file => 
      file.fileName?.toLowerCase().includes(searchTerm)
    );
    
    return {
      success: true,
      results: {
        digitMaps: filteredDMs,
        dialFormats: filteredDFs,
        files: filteredFiles
      }
    };
  }

  async searchNaps(query, options = {}) {
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const naps = this._loadFromStorage(this.napStorageKey, []);
    const searchTerm = query.toLowerCase();
    
    const filteredNaps = naps.filter(nap => 
      (nap.napName && nap.napName.toLowerCase().includes(searchTerm)) ||
      (nap.id && nap.id.toLowerCase().includes(searchTerm))
    );
    
    return {
      success: true,
      results: { naps: filteredNaps }
    };
  }
}

export async function getDBHealth() {
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return {
    success: true,
    health: connectionHealth,
    status: connectionStatus
  };
}

export async function initializeDatabase() {
  await new Promise(resolve => setTimeout(resolve, 200));
  
  connectionStatus = 'connected';
  connectionHealth.lastChecked = new Date();
  
  return {
    success: true,
    message: 'Database initialized successfully',
    health: connectionHealth
  };
}

export default ClientDatabaseService;
