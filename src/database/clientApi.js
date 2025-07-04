/**
 * Client-Side Database API
 * Browser-compatible database service layer
 * 
 * This provides a client-side interface that can work in the browser
 * without requiring Node.js/MongoDB direct connections.
 */

// Mock database health status
let mockDBStatus = {
  status: 'healthy',
  database: 'prosbc_nap',
  collections: 5,
  dataSize: '2.4 MB',
  uptime: new Date().toISOString(),
  lastConnection: new Date().toISOString()
};

// Mock data storage (using localStorage for persistence)
const STORAGE_KEYS = {
  NAP_RECORDS: 'prosbc_nap_records',
  FILES: 'prosbc_files',
  EDIT_HISTORY: 'prosbc_edit_history',
  ACTIVATION_LOGS: 'prosbc_activation_logs',
  ROUTESET_MAPPING: 'prosbc_routeset_mapping'
};

// Utility functions for localStorage
const getStorageData = (key) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.warn(`Error reading ${key} from localStorage:`, error);
    return [];
  }
};

const setStorageData = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.warn(`Error writing ${key} to localStorage:`, error);
    return false;
  }
};

// Generate mock ID
const generateId = () => Math.random().toString(36).substr(2, 9);

/**
 * Database Health Check Service
 */
export const getDBHealth = async () => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Simulate occasional connection issues (10% chance)
  if (Math.random() < 0.1) {
    throw new Error('Database connection timeout');
  }
  
  return {
    ...mockDBStatus,
    uptime: new Date().toISOString()
  };
};

/**
 * Quick Access API
 */
export const quickAccess = {
  searchFiles: async (query, options = {}) => {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const files = getStorageData(STORAGE_KEYS.FILES);
    const limit = options.limit || 10;
    
    let filtered = files;
    if (query) {
      filtered = files.filter(file => 
        file.fileName.toLowerCase().includes(query.toLowerCase()) ||
        (file.tags && file.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase())))
      );
    }
    
    return {
      success: true,
      files: filtered.slice(0, limit),
      total: filtered.length
    };
  },

  searchNaps: async (query, options = {}) => {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const naps = getStorageData(STORAGE_KEYS.NAP_RECORDS);
    const limit = options.limit || 10;
    
    let filtered = naps;
    if (query) {
      filtered = naps.filter(nap => 
        nap.napName.toLowerCase().includes(query.toLowerCase()) ||
        (nap.tags && nap.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase())))
      );
    }
    
    return {
      success: true,
      naps: filtered.slice(0, limit),
      total: filtered.length
    };
  }
};

/**
 * Database Service Class
 */
export class DatabaseService {
  constructor() {
    this.connected = true;
  }

  async getAnalytics(period = '7d') {
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const naps = getStorageData(STORAGE_KEYS.NAP_RECORDS);
    const files = getStorageData(STORAGE_KEYS.FILES);
    const activationLogs = getStorageData(STORAGE_KEYS.ACTIVATION_LOGS);
    
    return {
      success: true,
      analytics: {
        naps: {
          total: naps.length,
          active: naps.filter(n => n.status === 'active').length,
          inactive: naps.filter(n => n.status === 'inactive').length
        },
        files: {
          total: files.length,
          df: files.filter(f => f.fileType === 'df').length,
          dm: files.filter(f => f.fileType === 'dm').length
        },
        activations: {
          total: activationLogs.length,
          successful: activationLogs.filter(a => a.status === 'success').length,
          failed: activationLogs.filter(a => a.status === 'failed').length
        },
        period
      }
    };
  }

  async listNaps(filters = {}, page = 1, limit = 10) {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    let naps = getStorageData(STORAGE_KEYS.NAP_RECORDS);
    
    // Apply filters
    if (filters.status) {
      naps = naps.filter(nap => nap.status === filters.status);
    }
    
    // Pagination
    const start = (page - 1) * limit;
    const paginatedNaps = naps.slice(start, start + limit);
    
    return {
      success: true,
      naps: paginatedNaps,
      total: naps.length,
      page,
      limit
    };
  }

  async search(query, filters = {}) {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const results = {
      naps: [],
      files: [],
      logs: []
    };
    
    if (!query) {
      return { success: true, results };
    }
    
    // Search NAPs
    const naps = getStorageData(STORAGE_KEYS.NAP_RECORDS);
    results.naps = naps.filter(nap => 
      nap.napName.toLowerCase().includes(query.toLowerCase())
    );
    
    // Search Files
    const files = getStorageData(STORAGE_KEYS.FILES);
    results.files = files.filter(file => 
      file.fileName.toLowerCase().includes(query.toLowerCase())
    );
    
    // Search Logs
    const logs = getStorageData(STORAGE_KEYS.ACTIVATION_LOGS);
    results.logs = logs.filter(log => 
      log.napId?.toLowerCase().includes(query.toLowerCase()) ||
      log.description?.toLowerCase().includes(query.toLowerCase())
    );
    
    return { success: true, results };
  }

  async getActivationLogs(filters = {}, page = 1, limit = 10) {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    let logs = getStorageData(STORAGE_KEYS.ACTIVATION_LOGS);
    
    if (filters.status) {
      logs = logs.filter(log => log.status === filters.status);
    }
    
    const start = (page - 1) * limit;
    const paginatedLogs = logs.slice(start, start + limit);
    
    return {
      success: true,
      logs: paginatedLogs,
      total: logs.length,
      page,
      limit
    };
  }
}

/**
 * Initialize with sample data
 */
const initializeSampleData = () => {
  // Sample NAP records
  const sampleNaps = [
    {
      id: generateId(),
      napName: 'sample-nap-001',
      status: 'active',
      enabled: true,
      proxyAddress: '192.168.1.100',
      proxyPort: 5060,
      tags: ['sample', 'development'],
      createdAt: new Date().toISOString(),
      metadata: {
        description: 'Sample NAP for development',
        environment: 'development'
      }
    }
  ];

  // Sample files
  const sampleFiles = [
    {
      id: generateId(),
      fileName: 'sample-df-001.csv',
      fileType: 'df',
      filePath: '/prosbc-files/df/sample-df-001.csv',
      fileSize: 1024,
      uploadDate: new Date().toISOString(),
      tags: ['sample', 'development'],
      validation: {
        isValid: true,
        validatedAt: new Date().toISOString(),
        issues: []
      }
    }
  ];

  // Sample activation logs
  const sampleLogs = [
    {
      id: generateId(),
      napId: 'sample-nap-001',
      activationType: 'deployment',
      status: 'success',
      timestamp: new Date().toISOString(),
      description: 'NAP deployed successfully'
    }
  ];

  // Initialize localStorage if empty
  if (!localStorage.getItem(STORAGE_KEYS.NAP_RECORDS)) {
    setStorageData(STORAGE_KEYS.NAP_RECORDS, sampleNaps);
  }
  if (!localStorage.getItem(STORAGE_KEYS.FILES)) {
    setStorageData(STORAGE_KEYS.FILES, sampleFiles);
  }
  if (!localStorage.getItem(STORAGE_KEYS.ACTIVATION_LOGS)) {
    setStorageData(STORAGE_KEYS.ACTIVATION_LOGS, sampleLogs);
  }
  if (!localStorage.getItem(STORAGE_KEYS.EDIT_HISTORY)) {
    setStorageData(STORAGE_KEYS.EDIT_HISTORY, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.ROUTESET_MAPPING)) {
    setStorageData(STORAGE_KEYS.ROUTESET_MAPPING, []);
  }
};

// Initialize sample data on module load
initializeSampleData();

export default {
  getDBHealth,
  quickAccess,
  DatabaseService
};
