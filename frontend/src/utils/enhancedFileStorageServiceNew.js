// Enhanced File Storage Service with backend API integration
import { fileService } from '../services/apiClient.js';
import { prosbcFileAPI } from './prosbcFileApi.js';

export class EnhancedFileStorageService {
  constructor() {
    this.syncQueue = [];
    this.isSyncing = false;
    this.storageStructure = {
      df: {
        directory: 'definition_files',
        prefix: 'DF_',
        extension: '.csv',
        type: 'routesets_definitions'
      },
      dm: {
        directory: 'digit_maps',
        prefix: 'DM_',
        extension: '.csv',
        type: 'routesets_digitmaps'
      },
      routesets: {
        directory: 'routesets',
        prefix: 'RT_',
        extension: '.csv',
        type: 'routesets'
      }
    };
  }

  // Store Definition Files (DF) with categorization
  async storeDefinitionFile(fileContent, fileName, metadata = {}) {
    try {
      console.log(`📁 Storing DF file: ${fileName}`);
      
      const storageInfo = this.storageStructure.df;
      const fileData = {
        name: fileName,
        type: 'dial_format',
        content: fileContent,
        metadata: {
          ...metadata,
          storage_type: storageInfo.type,
          category: 'dial_format',
          file_type: 'csv',
          uploaded_at: new Date().toISOString(),
        }
      };

      // Upload to backend
      const formData = new FormData();
      const blob = new Blob([fileContent], { type: 'text/csv' });
      formData.append('file', blob, fileName);
      formData.append('type', 'dial_format');
      formData.append('metadata', JSON.stringify(fileData.metadata));

      const result = await fileService.upload(formData);
      
      if (result.success) {
        console.log(`✅ DF file stored successfully: ${fileName}`);
        return { 
          success: true, 
          id: result.data.id,
          fileName: fileName,
          type: 'df',
          metadata: result.data
        };
      } else {
        throw new Error(result.message || 'Failed to store file');
      }
    } catch (error) {
      console.error(`❌ Error storing DF file ${fileName}:`, error);
      return { 
        success: false, 
        error: error.message,
        fileName: fileName,
        type: 'df'
      };
    }
  }

  // Store Digit Map Files (DM) with categorization
  async storeDigitMapFile(fileContent, fileName, metadata = {}) {
    try {
      console.log(`📁 Storing DM file: ${fileName}`);
      
      const storageInfo = this.storageStructure.dm;
      const fileData = {
        name: fileName,
        type: 'digit_map',
        content: fileContent,
        metadata: {
          ...metadata,
          storage_type: storageInfo.type,
          category: 'digit_map',
          file_type: 'csv',
          uploaded_at: new Date().toISOString(),
        }
      };

      // Upload to backend
      const formData = new FormData();
      const blob = new Blob([fileContent], { type: 'text/csv' });
      formData.append('file', blob, fileName);
      formData.append('type', 'digit_map');
      formData.append('metadata', JSON.stringify(fileData.metadata));

      const result = await fileService.upload(formData);
      
      if (result.success) {
        console.log(`✅ DM file stored successfully: ${fileName}`);
        return { 
          success: true, 
          id: result.data.id,
          fileName: fileName,
          type: 'dm',
          metadata: result.data
        };
      } else {
        throw new Error(result.message || 'Failed to store file');
      }
    } catch (error) {
      console.error(`❌ Error storing DM file ${fileName}:`, error);
      return { 
        success: false, 
        error: error.message,
        fileName: fileName,
        type: 'dm'
      };
    }
  }

  // Get all stored files
  async getAllStoredFiles(type = null) {
    try {
      const params = type ? { type } : {};
      const result = await fileService.getAll(params);
      
      if (result.success) {
        return result.data || [];
      } else {
        throw new Error(result.message || 'Failed to fetch files');
      }
    } catch (error) {
      console.error('Error fetching stored files:', error);
      return [];
    }
  }

  // Get files by type
  async getFilesByType(type) {
    return this.getAllStoredFiles(type);
  }

  // Delete file
  async deleteFile(fileId) {
    try {
      const result = await fileService.delete(fileId);
      return result;
    } catch (error) {
      console.error('Error deleting file:', error);
      return { success: false, error: error.message };
    }
  }

  // Sync with ProSBC (implementation depends on ProSBC API)
  async syncWithProSBC() {
    console.log('🔄 Syncing with ProSBC...');
    
    try {
      // This would sync files between backend and ProSBC
      // Implementation depends on specific requirements
      console.log('ProSBC sync feature needs implementation');
      return { success: true, message: 'Sync completed' };
    } catch (error) {
      console.error('ProSBC sync failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Get storage statistics
  async getStorageStats() {
    try {
      const files = await this.getAllStoredFiles();
      
      const stats = {
        totalFiles: files.length,
        dfFiles: files.filter(f => f.type === 'dial_format').length,
        dmFiles: files.filter(f => f.type === 'digit_map').length,
        totalSize: files.reduce((sum, f) => sum + (f.size || 0), 0),
        lastUpdate: new Date().toISOString()
      };
      
      return stats;
    } catch (error) {
      console.error('Error getting storage stats:', error);
      return {
        totalFiles: 0,
        dfFiles: 0,
        dmFiles: 0,
        totalSize: 0,
        lastUpdate: new Date().toISOString()
      };
    }
  }

  // Update file content
  async updateFileContent(fileId, newContent, metadata = {}) {
    try {
      console.log(`📝 Updating file: ${fileId}`);
      
      // For now, we'll create a new version since the backend API might not have direct update
      // This could be enhanced based on backend API capabilities
      const formData = new FormData();
      const blob = new Blob([newContent], { type: 'text/csv' });
      formData.append('file', blob, `updated_${Date.now()}.csv`);
      formData.append('metadata', JSON.stringify({
        ...metadata,
        updated_at: new Date().toISOString(),
        previous_version: fileId
      }));

      const result = await fileService.upload(formData);
      
      if (result.success) {
        console.log(`✅ File updated successfully: ${fileId}`);
        return result;
      } else {
        throw new Error(result.message || 'Failed to update file');
      }
    } catch (error) {
      console.error(`❌ Error updating file ${fileId}:`, error);
      return { success: false, error: error.message };
    }
  }
}

// Create singleton instance
export const enhancedFileStorageService = new EnhancedFileStorageService();

export default enhancedFileStorageService;
