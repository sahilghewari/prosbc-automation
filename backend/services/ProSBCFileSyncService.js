/**
 * ProSBC File Sync Service
 * Service for recording/syncing fetched files from ProSBC into database
 */

import { DigitMap, DialFormat, AuditLog } from '../models/index.js';
import crypto from 'crypto';

export class ProSBCFileSyncService {
  constructor() {
    this.isProcessing = false;
    this.syncResults = [];
  }

  /**
   * Fetch files from ProSBC system
   * @param {Object} options - Fetch options
   * @param {string} options.fileType - Type of files to fetch ('dm', 'df', 'all')
   * @param {string} options.routesetId - Optional routeset ID to filter
   * @param {number} options.limit - Max number of files to fetch
   * @returns {Promise<Array>} - List of fetched files
   */
  async fetchProSBCFiles(options = {}) {
    const {
      fileType = 'all',
      routesetId,
      limit = 100
    } = options;

    try {
      console.log(`Fetching ProSBC files: type=${fileType}, routesetId=${routesetId || 'all'}, limit=${limit}`);
      this.isProcessing = true;
      
      // Get connection details from environment or config
      const prosbcHost = process.env.PROSBC_HOST || 'localhost';
      const prosbcPort = process.env.PROSBC_PORT || '8080';
      const prosbcAuth = process.env.PROSBC_AUTH || 'Basic YWRtaW46YWRtaW4='; // admin:admin in Base64
      const prosbcApiPath = process.env.PROSBC_API_PATH || '/api';
      
      console.log(`Connecting to ProSBC at ${prosbcHost}:${prosbcPort}`);
      
      // Setup axios or another HTTP client to connect to ProSBC
      const axios = await import('axios');
      
      // Create base URL for ProSBC API
      const baseURL = `http://${prosbcHost}:${prosbcPort}${prosbcApiPath}`;
      
      // Create axios instance with authentication
      const prosbcClient = axios.default.create({
        baseURL,
        headers: {
          'Authorization': prosbcAuth,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000 // 10 seconds timeout
      });
      
      // Initialize files array
      let files = [];
      
      // Fetch digit map files if requested
      if (fileType === 'all' || fileType === 'dm') {
        try {
          // Path to digit map files API endpoint - adjust based on actual ProSBC API
          const dmEndpoint = '/configuration/digit-maps';
          const dmParams = routesetId ? { routeset: routesetId } : {};
          
          const dmResponse = await prosbcClient.get(dmEndpoint, { params: dmParams });
          
          if (dmResponse.data && Array.isArray(dmResponse.data.files)) {
            const dmFiles = await Promise.all(dmResponse.data.files.map(async (file) => {
              // Fetch file content
              const contentResponse = await prosbcClient.get(`${dmEndpoint}/${file.id}/content`);
              
              return {
                type: 'dm',
                filename: file.name,
                prosbc_id: file.id,
                routeset_id: file.routeset || '',
                content: contentResponse.data,
                last_modified: file.modified_date || new Date().toISOString()
              };
            }));
            
            files = [...files, ...dmFiles];
          }
        } catch (error) {
          console.error('Error fetching digit map files from ProSBC:', error);
          // Continue with other file types despite error
        }
      }
      
      // Fetch dial format files if requested
      if (fileType === 'all' || fileType === 'df') {
        try {
          // Path to dial format files API endpoint - adjust based on actual ProSBC API
          const dfEndpoint = '/configuration/dial-formats';
          const dfParams = routesetId ? { routeset: routesetId } : {};
          
          const dfResponse = await prosbcClient.get(dfEndpoint, { params: dfParams });
          
          if (dfResponse.data && Array.isArray(dfResponse.data.files)) {
            const dfFiles = await Promise.all(dfResponse.data.files.map(async (file) => {
              // Fetch file content
              const contentResponse = await prosbcClient.get(`${dfEndpoint}/${file.id}/content`);
              
              return {
                type: 'df',
                filename: file.name,
                prosbc_id: file.id,
                routeset_id: file.routeset || '',
                content: contentResponse.data,
                last_modified: file.modified_date || new Date().toISOString()
              };
            }));
            
            files = [...files, ...dfFiles];
          }
        } catch (error) {
          console.error('Error fetching dial format files from ProSBC:', error);
          // Continue despite error
        }
      }
      
      // Apply limit
      const limitedFiles = files.slice(0, limit);
      
      console.log(`Fetched ${limitedFiles.length} ProSBC files`);
      
      // Return fetched files
      return limitedFiles;
    } catch (error) {
      console.error('Error fetching ProSBC files:', error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Record a fetched DM file from ProSBC into database
   * @param {Object} fileData - File data from ProSBC fetch
   * @param {string} fileData.filename - Original filename
   * @param {string} fileData.content - File content
   * @param {string} fileData.prosbc_id - ProSBC file ID
   * @param {string} fileData.routeset_id - Routeset ID
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} - Sync result
   */
  async recordDigitMapFile(fileData, metadata = {}) {
    try {
      const {
        filename,
        content,
        prosbc_id,
        routeset_id,
        source = 'prosbc_fetch'
      } = fileData;

      // Generate checksum for duplicate detection
      const checksum = this.generateChecksum(content);

      // Check if file already exists
      const existingFile = await DigitMap.findOne({
        $or: [
          { checksum },
          { prosbc_id }
        ]
      });

      if (existingFile) {
        // Update existing file if content changed
        if (existingFile.checksum !== checksum) {
          existingFile.content = content;
          existingFile.file_size = Buffer.byteLength(content, 'utf8');
          existingFile.checksum = checksum;
          existingFile.status = 'validated';
          existingFile.metadata = {
            ...existingFile.metadata,
            last_sync: new Date(),
            sync_source: source,
            ...metadata
          };

          // Validate content
          existingFile.validateContent();
          await existingFile.save();

          await this.logAuditEvent(
            'Digit Map Updated from ProSBC',
            { type: 'DigitMap', id: existingFile._id.toString(), name: filename },
            { username: 'system' },
            { action: 'sync', method: 'SYSTEM', endpoint: 'prosbc_sync' },
            true
          );

          return {
            success: true,
            action: 'updated',
            file: existingFile,
            message: 'Digit Map file updated from ProSBC'
          };
        } else {
          return {
            success: true,
            action: 'unchanged',
            file: existingFile,
            message: 'Digit Map file already up to date'
          };
        }
      }

      // Create new file record
      const digitMap = new DigitMap({
        filename: `dm_${Date.now()}_${filename}`,
        original_filename: filename,
        content,
        file_size: Buffer.byteLength(content, 'utf8'),
        checksum,
        prosbc_id,
        status: 'validated',
        uploaded_by: 'system',
        metadata: {
          encoding: 'utf-8',
          upload_source: source,
          routeset_id,
          sync_timestamp: new Date(),
          ...metadata
        }
      });

      // Validate content
      digitMap.validateContent();
      await digitMap.save();

      await this.logAuditEvent(
        'Digit Map Recorded from ProSBC',
        { type: 'DigitMap', id: digitMap._id.toString(), name: filename },
        { username: 'system' },
        { action: 'sync', method: 'SYSTEM', endpoint: 'prosbc_sync' },
        true,
        null,
        null,
        { 
          file_size: digitMap.file_size, 
          row_count: digitMap.validation_results.row_count,
          prosbc_id
        }
      );

      return {
        success: true,
        action: 'created',
        file: digitMap,
        message: 'Digit Map file recorded from ProSBC'
      };

    } catch (error) {
      console.error('Error recording Digit Map file:', error);
      
      await this.logAuditEvent(
        'Digit Map Sync Failed',
        { type: 'DigitMap', id: 'unknown', name: fileData.filename || 'unknown' },
        { username: 'system' },
        { action: 'sync', method: 'SYSTEM', endpoint: 'prosbc_sync' },
        false,
        null,
        { error_message: error.message }
      );

      return {
        success: false,
        action: 'error',
        error: error.message,
        message: 'Failed to record Digit Map file'
      };
    }
  }

  /**
   * Record a fetched DF file from ProSBC into database
   * @param {Object} fileData - File data from ProSBC fetch
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} - Sync result
   */
  async recordDialFormatFile(fileData, metadata = {}) {
    try {
      const {
        filename,
        content,
        prosbc_id,
        routeset_id,
        source = 'prosbc_fetch'
      } = fileData;

      // Generate checksum for duplicate detection
      const checksum = this.generateChecksum(content);

      // Check if file already exists
      const existingFile = await DialFormat.findOne({
        $or: [
          { checksum },
          { prosbc_id }
        ]
      });

      if (existingFile) {
        // Update existing file if content changed
        if (existingFile.checksum !== checksum) {
          existingFile.content = content;
          existingFile.file_size = Buffer.byteLength(content, 'utf8');
          existingFile.checksum = checksum;
          existingFile.status = 'validated';
          existingFile.metadata = {
            ...existingFile.metadata,
            last_sync: new Date(),
            sync_source: source,
            ...metadata
          };

          // Validate content
          existingFile.validateContent();
          await existingFile.save();

          await this.logAuditEvent(
            'Dial Format Updated from ProSBC',
            { type: 'DialFormat', id: existingFile._id.toString(), name: filename },
            { username: 'system' },
            { action: 'sync', method: 'SYSTEM', endpoint: 'prosbc_sync' },
            true
          );

          return {
            success: true,
            action: 'updated',
            file: existingFile,
            message: 'Dial Format file updated from ProSBC'
          };
        } else {
          return {
            success: true,
            action: 'unchanged',
            file: existingFile,
            message: 'Dial Format file already up to date'
          };
        }
      }

      // Create new file record
      const dialFormat = new DialFormat({
        filename: `df_${Date.now()}_${filename}`,
        original_filename: filename,
        content,
        file_size: Buffer.byteLength(content, 'utf8'),
        checksum,
        prosbc_id,
        status: 'validated',
        uploaded_by: 'system',
        metadata: {
          encoding: 'utf-8',
          upload_source: source,
          routeset_id,
          sync_timestamp: new Date(),
          ...metadata
        }
      });

      // Validate content
      dialFormat.validateContent();
      await dialFormat.save();

      await this.logAuditEvent(
        'Dial Format Recorded from ProSBC',
        { type: 'DialFormat', id: dialFormat._id.toString(), name: filename },
        { username: 'system' },
        { action: 'sync', method: 'SYSTEM', endpoint: 'prosbc_sync' },
        true,
        null,
        null,
        { 
          file_size: dialFormat.file_size, 
          row_count: dialFormat.validation_results.row_count,
          prosbc_id
        }
      );

      return {
        success: true,
        action: 'created',
        file: dialFormat,
        message: 'Dial Format file recorded from ProSBC'
      };

    } catch (error) {
      console.error('Error recording Dial Format file:', error);
      
      await this.logAuditEvent(
        'Dial Format Sync Failed',
        { type: 'DialFormat', id: 'unknown', name: fileData.filename || 'unknown' },
        { username: 'system' },
        { action: 'sync', method: 'SYSTEM', endpoint: 'prosbc_sync' },
        false,
        null,
        { error_message: error.message }
      );

      return {
        success: false,
        action: 'error',
        error: error.message,
        message: 'Failed to record Dial Format file'
      };
    }
  }

  /**
   * Bulk sync multiple files from ProSBC
   * @param {Array} filesData - Array of file data objects
   * @returns {Promise<Object>} - Bulk sync results
   */
  async bulkSyncFiles(filesData) {
    if (this.isProcessing) {
      throw new Error('Bulk sync already in progress');
    }

    this.isProcessing = true;
    const results = {
      total: filesData.length,
      successful: 0,
      failed: 0,
      updated: 0,
      created: 0,
      unchanged: 0,
      details: []
    };

    try {
      console.log(`🔄 Starting bulk sync of ${filesData.length} files from ProSBC`);

      for (const fileData of filesData) {
        try {
          let result;
          
          if (fileData.type === 'digit_map' || fileData.type === 'dm') {
            result = await this.recordDigitMapFile(fileData);
          } else if (fileData.type === 'dial_format' || fileData.type === 'df') {
            result = await this.recordDialFormatFile(fileData);
          } else {
            result = {
              success: false,
              action: 'error',
              error: `Unknown file type: ${fileData.type}`,
              message: 'Unknown file type'
            };
          }

          results.details.push({
            filename: fileData.filename,
            ...result
          });

          if (result.success) {
            results.successful++;
            results[result.action]++;
          } else {
            results.failed++;
          }

        } catch (error) {
          console.error(`Error processing file ${fileData.filename}:`, error);
          results.failed++;
          results.details.push({
            filename: fileData.filename,
            success: false,
            action: 'error',
            error: error.message,
            message: 'Processing failed'
          });
        }
      }

      console.log(`✅ Bulk sync completed: ${results.successful} successful, ${results.failed} failed`);

      return results;

    } catch (error) {
      console.error('Bulk sync error:', error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get sync statistics
   * @returns {Object} - Sync statistics
   */
  async getSyncStats() {
    try {
      const [dmStats, dfStats] = await Promise.all([
        DigitMap.aggregate([
          {
            $match: {
              'metadata.upload_source': { $in: ['prosbc_fetch', 'sync'] }
            }
          },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              total_size: { $sum: '$file_size' }
            }
          }
        ]),
        DialFormat.aggregate([
          {
            $match: {
              'metadata.upload_source': { $in: ['prosbc_fetch', 'sync'] }
            }
          },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              total_size: { $sum: '$file_size' }
            }
          }
        ])
      ]);

      return {
        digit_maps: dmStats,
        dial_formats: dfStats,
        last_updated: new Date()
      };

    } catch (error) {
      console.error('Error getting sync stats:', error);
      return {
        digit_maps: [],
        dial_formats: [],
        error: error.message,
        last_updated: new Date()
      };
    }
  }

  /**
   * Generate checksum for file content
   * @param {string} content - File content
   * @returns {string} - SHA256 checksum
   */
  generateChecksum(content) {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }

  /**
   * Log audit event
   * @private
   */
  async logAuditEvent(event, entity, user, action, status = true, changes = null, error = null, metadata = null) {
    try {
      await AuditLog.logEvent({
        event,
        category: 'file',
        severity: status ? 'info' : 'error',
        status,
        entity,
        user,
        action,
        changes,
        error,
        metadata
      });
    } catch (err) {
      console.error('Failed to log audit event:', err);
    }
  }

  /**
   * Get files that need syncing (from external systems)
   * @returns {Array} - List of files to sync
   */
  async getFilesToSync() {
    try {
      // This would integrate with your existing ProSBC file fetching logic
      // For now, return empty array - implement based on your existing fetch mechanisms
      return [];
    } catch (error) {
      console.error('Error getting files to sync:', error);
      return [];
    }
  }
}

// Export singleton instance
export const prosbcFileSyncService = new ProSBCFileSyncService();
