/**
 * Database Service
 * Main service class for database operations across all entities
 */

import NapRecord from '../schemas/napRecords.js';
import UploadedFile from '../schemas/uploadedFiles.js';
import FileEditHistory from '../schemas/fileEditHistory.js';
import RoutesetMapping from '../schemas/routesetMapping.js';
import ActivationLog from '../schemas/activationLogs.js';
import AuditService from './auditService.js';
import ValidationService from './validationService.js';
import FileStorageService from './fileStorageService.js';

class DatabaseService {
  constructor() {
    this.auditService = new AuditService();
    this.validationService = new ValidationService();
    this.fileStorageService = new FileStorageService();
  }

  // ========== NAP OPERATIONS ==========

  async createNap(napData, createdBy) {
    try {
      // Validate NAP data
      const validation = await this.validationService.validateNapConfig(napData.config_json);
      
      const napRecord = new NapRecord({
        nap_id: napData.nap_id || `nap_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        name: napData.name,
        config_json: napData.config_json,
        status: napData.status || 'draft',
        created_by: createdBy,
        tags: napData.tags || [],
        validation_results: validation
      });

      const savedNap = await napRecord.save();
      
      // Log the creation
      await this.auditService.logAction('create_nap', {
        nap_id: savedNap.nap_id,
        executed_by: createdBy,
        details: { name: savedNap.name, status: savedNap.status }
      });

      return { success: true, nap: savedNap, validation };
      
    } catch (error) {
      console.error('Error creating NAP:', error);
      throw new Error(`Failed to create NAP: ${error.message}`);
    }
  }

  async getNap(napId) {
    try {
      const nap = await NapRecord.findOne({ nap_id: napId })
        .populate('associated_files.file_id');
      
      if (!nap) {
        throw new Error(`NAP not found: ${napId}`);
      }

      return { success: true, nap };
      
    } catch (error) {
      console.error('Error getting NAP:', error);
      throw new Error(`Failed to get NAP: ${error.message}`);
    }
  }

  async updateNap(napId, updateData, updatedBy) {
    try {
      const nap = await NapRecord.findOne({ nap_id: napId });
      
      if (!nap) {
        throw new Error(`NAP not found: ${napId}`);
      }

      // Store original data for audit
      const originalData = nap.toObject();

      // Update fields
      Object.keys(updateData).forEach(key => {
        if (key !== 'nap_id' && key !== 'created_by' && key !== 'created_at') {
          nap[key] = updateData[key];
        }
      });

      // Revalidate if config changed
      if (updateData.config_json) {
        const validation = await this.validationService.validateNapConfig(updateData.config_json);
        nap.validation_results = validation;
      }

      const updatedNap = await nap.save();

      // Log the update
      await this.auditService.logAction('update_nap', {
        nap_id: napId,
        executed_by: updatedBy,
        details: { 
          changes: this.auditService.getChanges(originalData, updatedNap.toObject()),
          version: updatedNap.version 
        }
      });

      return { success: true, nap: updatedNap };
      
    } catch (error) {
      console.error('Error updating NAP:', error);
      throw new Error(`Failed to update NAP: ${error.message}`);
    }
  }

  async deleteNap(napId, deletedBy) {
    try {
      const nap = await NapRecord.findOne({ nap_id: napId });
      
      if (!nap) {
        throw new Error(`NAP not found: ${napId}`);
      }

      // Soft delete by changing status
      nap.status = 'archived';
      await nap.save();

      // Log the deletion
      await this.auditService.logAction('delete_nap', {
        nap_id: napId,
        executed_by: deletedBy,
        details: { name: nap.name, archived_at: new Date() }
      });

      return { success: true, message: 'NAP archived successfully' };
      
    } catch (error) {
      console.error('Error deleting NAP:', error);
      throw new Error(`Failed to delete NAP: ${error.message}`);
    }
  }

  async listNaps(filters = {}, page = 1, limit = 50) {
    try {
      const query = {};
      
      // Apply filters
      if (filters.status) query.status = filters.status;
      if (filters.created_by) query.created_by = filters.created_by;
      if (filters.tags && filters.tags.length > 0) query.tags = { $in: filters.tags };
      if (filters.search) {
        query.$text = { $search: filters.search };
      }

      const skip = (page - 1) * limit;
      
      const [naps, total] = await Promise.all([
        NapRecord.find(query)
          .sort({ updated_at: -1 })
          .skip(skip)
          .limit(limit)
          .populate('associated_files.file_id'),
        NapRecord.countDocuments(query)
      ]);

      return {
        success: true,
        naps,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
      
    } catch (error) {
      console.error('Error listing NAPs:', error);
      throw new Error(`Failed to list NAPs: ${error.message}`);
    }
  }

  // ========== FILE OPERATIONS ==========

  async saveFile(fileData, uploadedBy) {
    try {
      // Validate file data
      const validation = await this.validationService.validateFileStructure(
        fileData.content, 
        fileData.type
      );

      // Calculate checksum
      const checksum = await this.fileStorageService.calculateChecksum(fileData.content);

      // Check for duplicates
      const duplicates = await UploadedFile.findDuplicates(checksum);
      
      const uploadedFile = new UploadedFile({
        file_id: fileData.file_id || `file_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        type: fileData.type,
        nap_associated: fileData.nap_associated,
        uploaded_by: uploadedBy,
        file_path: fileData.file_path,
        original_filename: fileData.original_filename,
        file_size: fileData.file_size || Buffer.byteLength(fileData.content, 'utf8'),
        mime_type: fileData.mime_type || 'text/csv',
        tags: fileData.tags || [],
        validation_results: validation,
        checksum: checksum,
        metadata: fileData.metadata || {}
      });

      const savedFile = await uploadedFile.save();

      // Create file edit history entry
      await this.auditService.logFileEdit(savedFile.file_id, uploadedBy, 'create', {
        changes_summary: 'File uploaded',
        csv_backup: fileData.content,
        json_table_format: validation.csv_structure || {}
      });

      // Log the upload
      await this.auditService.logAction('upload_file', {
        file_id: savedFile.file_id,
        executed_by: uploadedBy,
        details: { 
          filename: savedFile.original_filename,
          type: savedFile.type,
          size: savedFile.formatted_size,
          duplicates: duplicates.length > 0
        }
      });

      return { 
        success: true, 
        file: savedFile, 
        validation,
        duplicates: duplicates.length > 0 ? duplicates : null
      };
      
    } catch (error) {
      console.error('Error saving file:', error);
      throw new Error(`Failed to save file: ${error.message}`);
    }
  }

  async getFile(fileId) {
    try {
      const file = await UploadedFile.findOne({ file_id: fileId, status: { $ne: 'deleted' } });
      
      if (!file) {
        throw new Error(`File not found: ${fileId}`);
      }

      return { success: true, file };
      
    } catch (error) {
      console.error('Error getting file:', error);
      throw new Error(`Failed to get file: ${error.message}`);
    }
  }

  async updateFile(fileId, updateData, updatedBy) {
    try {
      const file = await UploadedFile.findOne({ file_id: fileId, status: { $ne: 'deleted' } });
      
      if (!file) {
        throw new Error(`File not found: ${fileId}`);
      }

      // Create backup before updating
      if (updateData.content) {
        await file.createBackup('Pre-update backup', updatedBy);
      }

      // Store original data for audit
      const originalData = file.toObject();

      // Update fields
      Object.keys(updateData).forEach(key => {
        if (key !== 'file_id' && key !== 'uploaded_by' && key !== 'created_at') {
          file[key] = updateData[key];
        }
      });

      // Revalidate if content changed
      if (updateData.content) {
        const validation = await this.validationService.validateFileStructure(
          updateData.content, 
          file.type
        );
        file.validation_results = validation;
        
        // Update checksum
        file.checksum = await this.fileStorageService.calculateChecksum(updateData.content);
      }

      file.version += 1;
      const updatedFile = await file.save();

      // Create file edit history entry
      await this.auditService.logFileEdit(fileId, updatedBy, 'update', {
        changes_summary: updateData.changes_summary || 'File updated',
        csv_backup: updateData.content || originalData.content,
        json_table_format: updatedFile.validation_results?.csv_structure || {},
        detailed_changes: this.auditService.getChanges(originalData, updatedFile.toObject())
      });

      // Log the update
      await this.auditService.logAction('update_file', {
        file_id: fileId,
        executed_by: updatedBy,
        details: { 
          version: updatedFile.version,
          changes: this.auditService.getChanges(originalData, updatedFile.toObject())
        }
      });

      return { success: true, file: updatedFile };
      
    } catch (error) {
      console.error('Error updating file:', error);
      throw new Error(`Failed to update file: ${error.message}`);
    }
  }

  async deleteFile(fileId, deletedBy) {
    try {
      const file = await UploadedFile.findOne({ file_id: fileId, status: { $ne: 'deleted' } });
      
      if (!file) {
        throw new Error(`File not found: ${fileId}`);
      }

      // Create backup before deletion
      await file.createBackup('Pre-deletion backup', deletedBy);

      // Soft delete
      await file.softDelete();

      // Log the deletion
      await this.auditService.logAction('delete_file', {
        file_id: fileId,
        executed_by: deletedBy,
        details: { 
          filename: file.original_filename,
          type: file.type,
          deleted_at: new Date()
        }
      });

      return { success: true, message: 'File deleted successfully' };
      
    } catch (error) {
      console.error('Error deleting file:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  // ========== MAPPING OPERATIONS ==========

  async createMapping(mappingData, mappedBy) {
    try {
      const mapping = new RoutesetMapping({
        nap_reference: mappingData.nap_reference,
        digitmap_file_id: mappingData.digitmap_file_id,
        definition_file_id: mappingData.definition_file_id,
        routeset_file_id: mappingData.routeset_file_id,
        mapped_by: mappedBy,
        mapping_config: mappingData.mapping_config || {},
        tags: mappingData.tags || []
      });

      const savedMapping = await mapping.save();

      // Validate the mapping
      await savedMapping.validateMapping();

      // Log the creation
      await this.auditService.logAction('create_mapping', {
        mapping_id: savedMapping.mapping_id,
        nap_id: savedMapping.nap_reference,
        executed_by: mappedBy,
        details: { 
          files_mapped: savedMapping.mapped_file_count,
          completeness: savedMapping.mapping_completeness
        }
      });

      return { success: true, mapping: savedMapping };
      
    } catch (error) {
      console.error('Error creating mapping:', error);
      throw new Error(`Failed to create mapping: ${error.message}`);
    }
  }

  async getMapping(mappingId) {
    try {
      const mapping = await RoutesetMapping.findOne({ mapping_id: mappingId })
        .populate('digitmap_file_id definition_file_id routeset_file_id');
      
      if (!mapping) {
        throw new Error(`Mapping not found: ${mappingId}`);
      }

      return { success: true, mapping };
      
    } catch (error) {
      console.error('Error getting mapping:', error);
      throw new Error(`Failed to get mapping: ${error.message}`);
    }
  }

  // ========== ACTIVATION LOG OPERATIONS ==========

  async logActivation(logData) {
    try {
      const activationLog = new ActivationLog({
        nap_id: logData.nap_id,
        file_id: logData.file_id,
        mapping_id: logData.mapping_id,
        action: logData.action,
        status: logData.status || 'pending',
        execution_context: {
          executed_by: logData.executed_by,
          session_id: logData.session_id,
          ip_address: logData.ip_address,
          user_agent: logData.user_agent
        },
        prosbc_info: logData.prosbc_info || {},
        tags: logData.tags || []
      });

      const savedLog = await activationLog.save();
      return { success: true, log: savedLog };
      
    } catch (error) {
      console.error('Error logging activation:', error);
      throw new Error(`Failed to log activation: ${error.message}`);
    }
  }

  async getActivationLogs(filters = {}, page = 1, limit = 100) {
    try {
      const query = {};
      
      // Apply filters
      if (filters.nap_id) query.nap_id = filters.nap_id;
      if (filters.file_id) query.file_id = filters.file_id;
      if (filters.action) query.action = filters.action;
      if (filters.status) query.status = filters.status;
      if (filters.executed_by) query['execution_context.executed_by'] = filters.executed_by;
      
      if (filters.date_from || filters.date_to) {
        query['timing_info.start_time'] = {};
        if (filters.date_from) query['timing_info.start_time'].$gte = new Date(filters.date_from);
        if (filters.date_to) query['timing_info.start_time'].$lte = new Date(filters.date_to);
      }

      const skip = (page - 1) * limit;
      
      const [logs, total] = await Promise.all([
        ActivationLog.find(query)
          .sort({ 'timing_info.start_time': -1 })
          .skip(skip)
          .limit(limit),
        ActivationLog.countDocuments(query)
      ]);

      return {
        success: true,
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
      
    } catch (error) {
      console.error('Error getting activation logs:', error);
      throw new Error(`Failed to get activation logs: ${error.message}`);
    }
  }

  // ========== SEARCH AND ANALYTICS ==========

  async search(query, filters = {}) {
    try {
      const results = {};

      // Search NAPs
      if (!filters.type || filters.type === 'nap') {
        results.naps = await NapRecord.find({
          $text: { $search: query },
          ...(filters.status && { status: filters.status })
        }).limit(20);
      }

      // Search Files
      if (!filters.type || filters.type === 'file') {
        results.files = await UploadedFile.find({
          $text: { $search: query },
          status: { $ne: 'deleted' },
          ...(filters.file_type && { type: filters.file_type })
        }).limit(20);
      }

      // Search History
      if (!filters.type || filters.type === 'history') {
        results.history = await FileEditHistory.find({
          $text: { $search: query }
        }).limit(20);
      }

      return { success: true, results };
      
    } catch (error) {
      console.error('Error searching:', error);
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  async getAnalytics(period = '7d') {
    try {
      const days = parseInt(period);
      const dateFrom = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

      const [napStats, fileStats, activityStats] = await Promise.all([
        this.getNapAnalytics(dateFrom),
        this.getFileAnalytics(dateFrom),
        this.getActivityAnalytics(dateFrom)
      ]);

      return {
        success: true,
        analytics: {
          period: `${days} days`,
          naps: napStats,
          files: fileStats,
          activity: activityStats
        }
      };
      
    } catch (error) {
      console.error('Error getting analytics:', error);
      throw new Error(`Failed to get analytics: ${error.message}`);
    }
  }

  async getNapAnalytics(dateFrom) {
    return await NapRecord.aggregate([
      { $match: { created_at: { $gte: dateFrom } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
  }

  async getFileAnalytics(dateFrom) {
    return await UploadedFile.aggregate([
      { $match: { created_at: { $gte: dateFrom }, status: { $ne: 'deleted' } } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          total_size: { $sum: '$file_size' }
        }
      }
    ]);
  }

  async getActivityAnalytics(dateFrom) {
    return await ActivationLog.aggregate([
      { $match: { 'timing_info.start_time': { $gte: dateFrom } } },
      {
        $group: {
          _id: {
            action: '$action',
            status: '$status'
          },
          count: { $sum: 1 },
          avg_duration: { $avg: '$timing_info.duration_ms' }
        }
      }
    ]);
  }
}

export default DatabaseService;
