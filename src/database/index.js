/**
 * Database Models Index
 * Central export for all database models
 */

// Import all schemas
import NapRecord from './schemas/napRecords.js';
import UploadedFile from './schemas/uploadedFiles.js';
import FileEditHistory from './schemas/fileEditHistory.js';
import RoutesetMapping from './schemas/routesetMapping.js';
import ActivationLog from './schemas/activationLogs.js';

// Import database connection
import dbConnection, { connectDB, disconnectDB, getDBHealth } from './connection.js';

// Export models
export {
  NapRecord,
  UploadedFile,
  FileEditHistory,
  RoutesetMapping,
  ActivationLog
};

// Export connection utilities
export {
  dbConnection,
  connectDB,
  disconnectDB,
  getDBHealth
};

// Export database service classes
export { default as DatabaseService } from './services/databaseService.js';
export { default as FileStorageService } from './services/fileStorageService.js';
export { default as AuditService } from './services/auditService.js';
export { default as ValidationService } from './services/validationService.js';

// Database utilities
export const Models = {
  NapRecord,
  UploadedFile,
  FileEditHistory,
  RoutesetMapping,
  ActivationLog
};

// Quick access methods
export const quickAccess = {
  // NAP operations
  async createNap(napData, createdBy) {
    const Models = await import('./services/databaseService.js');
    return Models.default.createNap(napData, createdBy);
  },

  async getNap(napId) {
    const Models = await import('./services/databaseService.js');
    return Models.default.getNap(napId);
  },

  async updateNap(napId, updateData, updatedBy) {
    const Models = await import('./services/databaseService.js');
    return Models.default.updateNap(napId, updateData, updatedBy);
  },

  // File operations
  async saveFile(fileData, uploadedBy) {
    const Models = await import('./services/databaseService.js');
    return Models.default.saveFile(fileData, uploadedBy);
  },

  async getFile(fileId) {
    const Models = await import('./services/databaseService.js');
    return Models.default.getFile(fileId);
  },

  async updateFile(fileId, updateData, updatedBy) {
    const Models = await import('./services/databaseService.js');
    return Models.default.updateFile(fileId, updateData, updatedBy);
  },

  // Mapping operations
  async createMapping(mappingData, mappedBy) {
    const Models = await import('./services/databaseService.js');
    return Models.default.createMapping(mappingData, mappedBy);
  },

  async getMapping(mappingId) {
    const Models = await import('./services/databaseService.js');
    return Models.default.getMapping(mappingId);
  },

  // Log operations
  async logActivation(logData) {
    const Models = await import('./services/databaseService.js');
    return Models.default.logActivation(logData);
  },

  async getActivationLogs(filters = {}) {
    const Models = await import('./services/databaseService.js');
    return Models.default.getActivationLogs(filters);
  }
};

// Database initialization
export const initializeDatabase = async () => {
  try {
    console.log('🔄 Initializing ProSBC NAP Testing Database...');
    
    // Connect to database
    await connectDB();
    
    // Check health
    const health = await getDBHealth();
    console.log('📊 Database Health:', health);
    
    // Run any initialization scripts
    await runInitializationScripts();
    
    console.log('✅ Database initialized successfully');
    
    return { success: true, health };
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};

// Run initialization scripts
const runInitializationScripts = async () => {
  try {
    // Create default admin user if none exists
    // This would be customized based on your user management system
    
    console.log('🔄 Running initialization scripts...');
    
    // You can add any initialization logic here
    // For example, creating default configurations, admin users, etc.
    
    console.log('✅ Initialization scripts completed');
    
  } catch (error) {
    console.error('❌ Error running initialization scripts:', error);
    throw error;
  }
};

// Cleanup and shutdown
export const cleanup = async () => {
  try {
    console.log('🔄 Cleaning up database connections...');
    await disconnectDB();
    console.log('✅ Database cleanup completed');
  } catch (error) {
    console.error('❌ Error during database cleanup:', error);
    throw error;
  }
};

// Default export for convenience
export default {
  Models,
  quickAccess,
  connectDB,
  disconnectDB,
  getDBHealth,
  initializeDatabase,
  cleanup
};
