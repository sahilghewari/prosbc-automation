// CSV File Update Service - Handles CSV file updates to ProSBC
import { prosbcFileAPI } from './prosbcFileApi.js';
import { fileManagementAPI } from './fileManagementAPI.js';
import { fileDatabase } from './fileDatabase.js';

export class CSVFileUpdateService {
  constructor() {
    this.isUpdating = false;
    this.updateHistory = [];
    this.maxHistorySize = 20;
  }

  /**
   * Update a CSV file on ProSBC
   * @param {string} csvContent - The CSV content to upload
   * @param {Object} fileInfo - File information object
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} - Update result
   */
  async updateCSVFile(csvContent, fileInfo, onProgress = null) {
    if (this.isUpdating) {
      throw new Error('CSV file update already in progress');
    }

    this.isUpdating = true;
    let updateResult = null;

    try {
      console.log('🚀 Starting CSV file update for DM file:', fileInfo);
      console.log('📋 File info detailed breakdown:', {
        id: fileInfo.id,
        name: fileInfo.name,
        type: fileInfo.type,
        fileType: fileInfo.fileType,
        prosbcId: fileInfo.prosbcId,
        routesetId: fileInfo.routesetId,
        fileDbId: fileInfo.fileDbId,
        source: fileInfo.source
      });
      
      onProgress?.(5, 'Preparing CSV file update...');

      // Validate input
      if (!csvContent || !csvContent.trim()) {
        throw new Error('CSV content is empty');
      }

      if (!fileInfo || !fileInfo.id) {
        throw new Error('File information is missing');
      }

      // Create backup before updating
      await this.createBackup(fileInfo, csvContent);
      onProgress?.(15, 'Backup created successfully');

      // Create a File object from CSV content
      const fileName = fileInfo.name || `file_${fileInfo.id}.csv`;
      const csvFile = new File([csvContent], fileName, { type: 'text/csv' });
      
      onProgress?.(25, 'Preparing file for upload...');

      // Determine file type and endpoint details with enhanced logic for DM files
      let fileType = fileInfo.fileType || fileInfo.type;
      
      // Special handling for DM files
      if (!fileType && fileInfo.name && fileInfo.name.toLowerCase().includes('digitmap')) {
        fileType = 'routesets_digitmaps';
      }
      
      // Default to DF if still not determined
      if (!fileType) {
        fileType = 'routesets_definitions';
      }
      
      const fileDbId = fileInfo.fileDbId || 1;
      const routesetId = fileInfo.routesetId || fileInfo.prosbcId || fileInfo.id;

      console.log('🎯 Update parameters determined:', {
        fileType,
        fileDbId,
        routesetId,
        fileName,
        contentLength: csvContent.length,
        isDigitMap: fileType === 'routesets_digitmaps'
      });

      onProgress?.(35, 'Getting authentication token...');

      // Get edit form data first to extract authenticity token
      const editFormData = await this.getEditFormData(fileDbId, routesetId, fileType);
      
      if (!editFormData.success) {
        throw new Error(`Failed to get edit form data: ${editFormData.error}`);
      }
      
      console.log('🔐 Authentication data retrieved for', fileType);
      
      onProgress?.(50, 'Uploading CSV file to ProSBC...');

      // Perform the update using multipart/form-data
      updateResult = await this.performCSVUpdate(
        csvFile,
        editFormData,
        fileType,
        fileDbId,
        routesetId,
        onProgress
      );

      onProgress?.(90, 'Updating local database...');

      // Update local database if successful
      if (updateResult.success) {
        await this.updateLocalDatabase(fileInfo, csvContent, updateResult);
      }

      onProgress?.(100, 'CSV file updated successfully!');

      // Record update in history
      this.recordUpdateHistory(fileInfo, updateResult, csvContent);

      return {
        success: true,
        message: 'CSV file updated successfully',
        result: updateResult,
        fileInfo: fileInfo,
        contentLength: csvContent.length
      };

    } catch (error) {
      console.error('CSV file update failed:', error);
      
      // Record failed update in history
      this.recordUpdateHistory(fileInfo, { success: false, error: error.message }, csvContent);
      
      throw new Error(`Failed to update CSV file: ${error.message}`);
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Get edit form data including authenticity token
   * @param {number} fileDbId - File database ID
   * @param {number} routesetId - Routeset ID
   * @param {string} fileType - File type
   * @returns {Promise<Object>} - Edit form data
   */
  async getEditFormData(fileDbId, routesetId, fileType) {
    try {
      const endpoint = fileType === 'routesets_digitmaps' ? 'routesets_digitmaps' : 'routesets_definitions';
      const editUrl = `/file_dbs/${fileDbId}/${endpoint}/${routesetId}/edit`;
      
      console.log('Fetching edit form from:', editUrl);
      
      // Use fileManagementAPI instead of direct fetch for better session handling
      const response = await fileManagementAPI.getEditFormData(fileDbId, routesetId, fileType);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get edit form');
      }

      console.log('Edit form data extracted:', {
        authenticityToken: response.authenticityToken?.substring(0, 20) + '...',
        recordId: response.recordId,
        fileType
      });

      return {
        success: true,
        authenticityToken: response.authenticityToken,
        recordId: response.recordId,
        fileType,
        endpoint
      };

    } catch (error) {
      console.error('Error getting edit form data:', error);
      
      // Handle session expiration by attempting to re-authenticate
      if (error.message.includes('Session expired') || error.message.includes('401') || error.message.includes('403')) {
        console.log('Session expired, attempting to re-authenticate...');
        try {
          // Clear any existing session data
          fileManagementAPI.sessionCookies = null;
          fileManagementAPI.authenticityToken = null;
          
          // Retry the request with fresh authentication
          const retryResponse = await fileManagementAPI.getEditFormData(fileDbId, routesetId, fileType);
          
          if (retryResponse.success) {
            console.log('Re-authentication successful, edit form retrieved');
            return {
              success: true,
              authenticityToken: retryResponse.authenticityToken,
              recordId: retryResponse.recordId,
              fileType,
              endpoint: fileType === 'routesets_digitmaps' ? 'routesets_digitmaps' : 'routesets_definitions'
            };
          }
        } catch (retryError) {
          console.error('Re-authentication failed:', retryError);
        }
      }
      
      throw new Error(`Failed to get edit form data: ${error.message}`);
    }
  }

  /**
   * Perform the actual CSV update using multipart/form-data
   * @param {File} csvFile - The CSV file to upload
   * @param {Object} editFormData - Edit form data with authenticity token
   * @param {string} fileType - File type
   * @param {number} fileDbId - File database ID
   * @param {number} routesetId - Routeset ID
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} - Update result
   */
  async performCSVUpdate(csvFile, editFormData, fileType, fileDbId, routesetId, onProgress) {
    try {
      console.log('🔥 Performing CSV update with multipart/form-data');
      console.log('📋 Update parameters:', {
        fileName: csvFile.name,
        fileSize: csvFile.size,
        fileType: fileType,
        fileDbId: fileDbId,
        routesetId: routesetId,
        isDigitMap: fileType === 'routesets_digitmaps'
      });
      
      onProgress?.(60, 'Sending update request to ProSBC...');

      // Use fileManagementAPI for better session handling
      console.log('🌐 Calling fileManagementAPI.updateFile with params:', {
        file: csvFile.name,
        fileDbId,
        routesetId,
        fileType,
        hasProgress: !!onProgress
      });
      
      const updateResult = await fileManagementAPI.updateFile(
        csvFile,
        fileDbId,
        routesetId,
        fileType,
        onProgress
      );

      console.log('📝 fileManagementAPI.updateFile result:', updateResult);
      
      onProgress?.(80, 'Processing update response...');

      if (updateResult.success) {
        console.log('✅ CSV update successful via fileManagementAPI');
        return {
          success: true,
          message: 'CSV file updated successfully on ProSBC',
          status: 200,
          response: updateResult.message || 'File updated successfully'
        };
      } else {
        console.error('❌ CSV update failed via fileManagementAPI:', updateResult);
        throw new Error(updateResult.error || 'Update failed');
      }

    } catch (error) {
      console.error('💥 Error performing CSV update:', error);
      
      // Handle session expiration by attempting to retry
      if (error.message.includes('Session expired') || error.message.includes('401') || error.message.includes('403')) {
        console.log('🔄 Session expired during update, attempting to retry...');
        try {
          // Clear any existing session data
          fileManagementAPI.sessionCookies = null;
          fileManagementAPI.authenticityToken = null;
          
          // Retry the update with fresh authentication
          const retryResult = await fileManagementAPI.updateFile(
            csvFile,
            fileDbId,
            routesetId,
            fileType,
            onProgress
          );
          
          if (retryResult.success) {
            console.log('✅ Retry successful after session refresh');
            return {
              success: true,
              message: 'CSV file updated successfully on ProSBC (after retry)',
              status: 200,
              response: retryResult.message || 'File updated successfully'
            };
          }
        } catch (retryError) {
          console.error('💥 Retry failed:', retryError);
        }
      }
      
      throw new Error(`Failed to perform CSV update: ${error.message}`);
    }
  }

  /**
   * Create backup of the original file
   * @param {Object} fileInfo - File information
   * @param {string} csvContent - Current CSV content
   */
  async createBackup(fileInfo, csvContent) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupKey = `backup_${fileInfo.id}_${timestamp}`;
      
      const backupData = {
        originalFile: fileInfo,
        content: csvContent,
        timestamp: timestamp,
        backupKey: backupKey
      };
      
      // Store in localStorage (could be enhanced to use IndexedDB)
      localStorage.setItem(backupKey, JSON.stringify(backupData));
      
      // Also store in file database if available
      if (fileDatabase) {
        try {
          await fileDatabase.storeFile({
            fileName: `${fileInfo.name}_backup_${timestamp}.csv`,
            fileType: 'backup',
            content: csvContent,
            metadata: {
              originalFileId: fileInfo.id,
              backupTimestamp: timestamp,
              isBackup: true
            }
          });
        } catch (dbError) {
          console.warn('Failed to store backup in database:', dbError);
        }
      }
      
      console.log('Backup created successfully:', backupKey);
      
    } catch (error) {
      console.error('Failed to create backup:', error);
      // Don't throw error here - backup failure shouldn't prevent update
    }
  }

  /**
   * Update local database with new content
   * @param {Object} fileInfo - File information
   * @param {string} csvContent - Updated CSV content
   * @param {Object} updateResult - Update result from ProSBC
   */
  async updateLocalDatabase(fileInfo, csvContent, updateResult) {
    try {
      if (!fileDatabase) {
        console.warn('File database not available for local update');
        return;
      }

      // Update the file in local database
      const updateData = {
        content: csvContent,
        lastModified: new Date().toISOString(),
        status: 'synced',
        metadata: {
          ...fileInfo.metadata,
          lastUpdateTimestamp: new Date().toISOString(),
          lastUpdateResult: updateResult,
          contentLength: csvContent.length
        }
      };

      await fileDatabase.updateFile(fileInfo.id, updateData);
      console.log('Local database updated successfully');

    } catch (error) {
      console.error('Failed to update local database:', error);
      // Don't throw error here - local database update failure shouldn't prevent the main update
    }
  }

  /**
   * Record update in history
   * @param {Object} fileInfo - File information
   * @param {Object} result - Update result
   * @param {string} csvContent - CSV content
   */
  recordUpdateHistory(fileInfo, result, csvContent) {
    try {
      const historyEntry = {
        timestamp: new Date().toISOString(),
        fileInfo: {
          id: fileInfo.id,
          name: fileInfo.name,
          type: fileInfo.fileType || fileInfo.type
        },
        result: result,
        contentLength: csvContent ? csvContent.length : 0,
        success: result.success
      };

      this.updateHistory.unshift(historyEntry);
      
      // Keep only the most recent entries
      if (this.updateHistory.length > this.maxHistorySize) {
        this.updateHistory = this.updateHistory.slice(0, this.maxHistorySize);
      }

      console.log('Update history recorded:', historyEntry);

    } catch (error) {
      console.error('Failed to record update history:', error);
    }
  }

  /**
   * Get basic auth header
   * @returns {string} - Basic auth header
   */
  getBasicAuthHeader() {
    const username = import.meta.env.VITE_PROSBC_USERNAME || 'admin';
    const password = import.meta.env.VITE_PROSBC_PASSWORD || 'admin';
    const credentials = btoa(`${username}:${password}`);
    return `Basic ${credentials}`;
  }

  /**
   * Get update history
   * @returns {Array} - Update history array
   */
  getUpdateHistory() {
    return [...this.updateHistory];
  }

  /**
   * Clear update history
   */
  clearUpdateHistory() {
    this.updateHistory = [];
  }

  /**
   * Get backup files from localStorage
   * @returns {Array} - Array of backup files
   */
  getBackupFiles() {
    try {
      const backups = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('backup_')) {
          try {
            const backupData = JSON.parse(localStorage.getItem(key));
            backups.push({
              key: key,
              ...backupData
            });
          } catch (parseError) {
            console.warn('Failed to parse backup data:', key);
          }
        }
      }
      
      // Sort by timestamp (newest first)
      backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      return backups;
      
    } catch (error) {
      console.error('Failed to get backup files:', error);
      return [];
    }
  }

  /**
   * Restore from backup
   * @param {string} backupKey - Backup key
   * @returns {Object} - Backup data
   */
  restoreFromBackup(backupKey) {
    try {
      const backupData = localStorage.getItem(backupKey);
      if (!backupData) {
        throw new Error('Backup not found');
      }
      
      return JSON.parse(backupData);
      
    } catch (error) {
      console.error('Failed to restore from backup:', error);
      throw new Error(`Failed to restore from backup: ${error.message}`);
    }
  }

  /**
   * Delete backup
   * @param {string} backupKey - Backup key
   */
  deleteBackup(backupKey) {
    try {
      localStorage.removeItem(backupKey);
      console.log('Backup deleted:', backupKey);
    } catch (error) {
      console.error('Failed to delete backup:', error);
    }
  }
}

export const csvFileUpdateService = new CSVFileUpdateService();
