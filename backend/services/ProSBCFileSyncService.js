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
