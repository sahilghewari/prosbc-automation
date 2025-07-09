/**
 * Files Routes
 * API endpoints for DM and DF file management
 */

import express from 'express';
import multer from 'multer';
import { DigitMap, DialFormat, AuditLog } from '../models/index.js';
import crypto from 'crypto';
import { ProSBCFileSyncService } from '../services/ProSBCFileSyncService.js';

const router = express.Router();
const proSBCService = new ProSBCFileSyncService();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept CSV and text files
    if (file.mimetype === 'text/csv' || 
        file.mimetype === 'text/plain' || 
        file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Utility function to generate checksum
const generateChecksum = (content) => {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
};

// Utility function to log audit events
const logAuditEvent = async (event, entity, user, action, status = true, changes = null, error = null) => {
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
      error
    });
  } catch (err) {
    console.error('Failed to log audit event:', err);
  }
};

// GET /api/files/prosbc/fetch - Fetch existing files from ProSBC
router.get('/prosbc/fetch', async (req, res) => {
  try {
    const {
      fileType = 'all', // 'dm', 'df', or 'all'
      routesetId,
      limit = 100
    } = req.query;
    
    // Call the ProSBC service to fetch files
    const fetchedFiles = await proSBCService.fetchProSBCFiles({
      fileType,
      routesetId,
      limit: parseInt(limit)
    });
    
    await logAuditEvent(
      'files.prosbc.fetch', 
      'files', 
      req.user?.username || 'system', 
      'Fetched ProSBC files',
      true,
      { fileType, count: fetchedFiles.length }
    );
    
    res.json({
      success: true,
      message: `Successfully fetched ${fetchedFiles.length} files from ProSBC`,
      data: fetchedFiles
    });
  } catch (error) {
    console.error('Error fetching ProSBC files:', error);
    
    await logAuditEvent(
      'files.prosbc.fetch.error', 
      'files', 
      req.user?.username || 'system', 
      'Failed to fetch ProSBC files',
      false,
      null,
      error.message
    );
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ProSBC files',
      error: error.message
    });
  }
});

// POST /api/files/prosbc/import - Import fetched ProSBC files to database
router.post('/prosbc/import', async (req, res) => {
  try {
    const { files } = req.body;
    
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files provided for import'
      });
    }
    
    const results = {
      total: files.length,
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      details: []
    };
    
    // Process each file
    for (const file of files) {
      try {
        let result;
        
        // Check file type and use appropriate method
        if (file.type === 'df' || file.filename.toLowerCase().includes('dial')) {
          result = await proSBCService.recordDialFormatFile(file, {
            source: 'manual_import',
            imported_by: req.user?.username || 'system'
          });
        } else {
          // Default to digit map
          result = await proSBCService.recordDigitMapFile(file, {
            source: 'manual_import',
            imported_by: req.user?.username || 'system'
          });
        }
        
        // Update counters based on result
        if (result.status === 'imported') results.imported++;
        else if (result.status === 'updated') results.updated++;
        else if (result.status === 'skipped') results.skipped++;
        
        results.details.push(result);
      } catch (err) {
        console.error(`Failed to import file ${file.filename}:`, err);
        results.failed++;
        results.details.push({
          filename: file.filename,
          status: 'failed',
          error: err.message
        });
      }
    }
    
    await logAuditEvent(
      'files.prosbc.import', 
      'files', 
      req.user?.username || 'system', 
      'Imported ProSBC files',
      results.failed === 0,
      results
    );
    
    res.json({
      success: true,
      message: `Import completed: ${results.imported} imported, ${results.updated} updated, ${results.skipped} skipped, ${results.failed} failed`,
      results
    });
  } catch (error) {
    console.error('Error importing ProSBC files:', error);
    
    await logAuditEvent(
      'files.prosbc.import.error', 
      'files', 
      req.user?.username || 'system', 
      'Failed to import ProSBC files',
      false,
      null,
      error.message
    );
    
    res.status(500).json({
      success: false,
      message: 'Failed to import ProSBC files',
      error: error.message
    });
  }
});


// GET /api/files/digit-maps - Get all digit maps (Sequelize)
import { Op } from 'sequelize';
router.get('/digit-maps', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      nap_id,
      sort = '-uploaded_at'
    } = req.query;

    const where = {};
    if (status) where.status = status;
    if (nap_id) where.nap_id = nap_id;
    if (search) {
      where[Op.or] = [
        { filename: { [Op.like]: `%${search}%` } },
        { original_filename: { [Op.like]: `%${search}%` } }
      ];
    }

    // Sequelize uses ASC/DESC, and field name (uploaded_at)
    let order = [['uploaded_at', 'DESC']];
    if (sort && typeof sort === 'string') {
      let field = sort.replace(/^-/, '');
      let direction = sort.startsWith('-') ? 'DESC' : 'ASC';
      order = [[field, direction]];
    }

    const digitMaps = await DigitMap.findAll({
      where,
      order,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });
    const total = await DigitMap.count({ where });

    res.json({
      success: true,
      data: digitMaps,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching digit maps:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch digit maps',
      message: error.message
    });
  }
});


// GET /api/files/dial-formats - Get all dial formats (Sequelize)
router.get('/dial-formats', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      nap_id,
      sort = '-uploaded_at'
    } = req.query;

    const where = {};
    if (status) where.status = status;
    if (nap_id) where.nap_id = nap_id;
    if (search) {
      where[Op.or] = [
        { filename: { [Op.like]: `%${search}%` } },
        { original_filename: { [Op.like]: `%${search}%` } }
      ];
    }

    let order = [['uploaded_at', 'DESC']];
    if (sort && typeof sort === 'string') {
      let field = sort.replace(/^-/, '');
      let direction = sort.startsWith('-') ? 'DESC' : 'ASC';
      order = [[field, direction]];
    }

    const dialFormats = await DialFormat.findAll({
      where,
      order,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });
    const total = await DialFormat.count({ where });

    res.json({
      success: true,
      data: dialFormats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching dial formats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dial formats',
      message: error.message
    });
  }
});

// POST /api/files/digit-maps/upload - Upload digit map file
router.post('/digit-maps/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const {
      nap_id,
      tags,
      uploaded_by = 'system'
    } = req.body;

    const content = req.file.buffer.toString('utf8');
    const checksum = generateChecksum(content);

    // Check for duplicate file based on checksum
    const existingFile = await DigitMap.findOne({ where: { checksum } });
    if (existingFile) {
      return res.status(409).json({
        success: false,
        error: 'File with identical content already exists',
        existing_file: existingFile.filename
      });
    }

    const digitMap = new DigitMap({
      filename: `dm_${Date.now()}_${req.file.originalname}`,
      original_filename: req.file.originalname,
      content,
      file_size: req.file.size,
      checksum,
      nap_id: nap_id || undefined,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      uploaded_by,
      metadata: {
        encoding: 'utf-8',
        upload_source: 'web'
      }
    });

    // Validate content
    digitMap.validateContent();
    
    await digitMap.save();

    // Log audit event with content backup
    await logAuditEvent(
      'Digit Map Uploaded',
      { type: 'DigitMap', id: digitMap._id.toString(), name: digitMap.filename },
      { username: uploaded_by },
      { action: 'upload', method: 'POST', endpoint: '/api/files/digit-maps/upload' },
      true,
      null,
      null,
      { 
        file_size: req.file.size, 
        row_count: digitMap.validation_results.row_count,
        content_backup: {
          content,
          headers: digitMap.headers,
          checksum,
          size: req.file.size
        }
      }
    );

    res.status(201).json({
      success: true,
      data: digitMap,
      message: 'Digit map uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading digit map:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload digit map',
      message: error.message
    });
  }
});

// POST /api/files/dial-formats/upload - Upload dial format file
router.post('/dial-formats/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const {
      nap_id,
      tags,
      uploaded_by = 'system'
    } = req.body;

    const content = req.file.buffer.toString('utf8');
    const checksum = generateChecksum(content);

    // Check for duplicate file based on checksum
    const existingFile = await DialFormat.findOne({ where: { checksum } });
    if (existingFile) {
      return res.status(409).json({
        success: false,
        error: 'File with identical content already exists',
        existing_file: existingFile.filename
      });
    }

    const dialFormat = new DialFormat({
      filename: `df_${Date.now()}_${req.file.originalname}`,
      original_filename: req.file.originalname,
      content,
      file_size: req.file.size,
      checksum,
      nap_id: nap_id || undefined,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      uploaded_by,
      metadata: {
        encoding: 'utf-8',
        upload_source: 'web'
      }
    });

    // Validate content
    dialFormat.validateContent();
    
    await dialFormat.save();

    // Log audit event with content backup
    await logAuditEvent(
      'Dial Format Uploaded',
      { type: 'DialFormat', id: dialFormat._id.toString(), name: dialFormat.filename },
      { username: uploaded_by },
      { action: 'upload', method: 'POST', endpoint: '/api/files/dial-formats/upload' },
      true,
      null,
      null,
      { 
        file_size: req.file.size, 
        row_count: dialFormat.validation_results.row_count,
        content_backup: {
          content,
          headers: dialFormat.headers,
          checksum,
          size: req.file.size
        }
      }
    );

    res.status(201).json({
      success: true,
      data: dialFormat,
      message: 'Dial format uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading dial format:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload dial format',
      message: error.message
    });
  }
});


// GET /api/files/digit-maps/:id - Get single digit map (Sequelize)
router.get('/digit-maps/:id', async (req, res) => {
  try {
    const digitMap = await DigitMap.findByPk(req.params.id);
    if (!digitMap) {
      return res.status(404).json({
        success: false,
        error: 'Digit map not found'
      });
    }
    res.json({
      success: true,
      data: digitMap
    });
  } catch (error) {
    console.error('Error fetching digit map:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch digit map',
      message: error.message
    });
  }
});


// GET /api/files/dial-formats/:id - Get single dial format (Sequelize)
router.get('/dial-formats/:id', async (req, res) => {
  try {
    const dialFormat = await DialFormat.findByPk(req.params.id);
    if (!dialFormat) {
      return res.status(404).json({
        success: false,
        error: 'Dial format not found'
      });
    }
    res.json({
      success: true,
      data: dialFormat
    });
  } catch (error) {
    console.error('Error fetching dial format:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dial format',
      message: error.message
    });
  }
});


// DELETE /api/files/digit-maps/:id - Delete digit map (Sequelize)
router.delete('/digit-maps/:id', async (req, res) => {
  try {
    const digitMap = await DigitMap.findByPk(req.params.id);
    if (!digitMap) {
      return res.status(404).json({
        success: false,
        error: 'Digit map not found'
      });
    }
    // Check if file is mapped to any routesets
    const { RoutesetMapping } = await import('../models/index.js');
    const mappings = await RoutesetMapping.findAll({ where: { digit_map_id: req.params.id } });
    if (mappings.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Cannot delete digit map with active routeset mappings',
        mappings_count: mappings.length
      });
    }
    const deletedBy = req.body.deleted_by || req.query.deleted_by || 'system';
    await DigitMap.destroy({ where: { id: req.params.id } });
    // Log audit event
    await logAuditEvent(
      'Digit Map Deleted',
      { type: 'DigitMap', id: req.params.id, name: digitMap.filename },
      { username: deletedBy },
      { action: 'delete', method: 'DELETE', endpoint: `/api/files/digit-maps/${req.params.id}` },
      true
    );
    res.json({
      success: true,
      message: 'Digit map deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting digit map:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete digit map',
      message: error.message
    });
  }
});


// DELETE /api/files/dial-formats/:id - Delete dial format (Sequelize)
router.delete('/dial-formats/:id', async (req, res) => {
  try {
    const dialFormat = await DialFormat.findByPk(req.params.id);
    if (!dialFormat) {
      return res.status(404).json({
        success: false,
        error: 'Dial format not found'
      });
    }
    // Check if file is mapped to any routesets
    const { RoutesetMapping } = await import('../models/index.js');
    const mappings = await RoutesetMapping.findAll({ where: { dial_format_id: req.params.id } });
    if (mappings.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Cannot delete dial format with active routeset mappings',
        mappings_count: mappings.length
      });
    }
    const deletedBy = req.body.deleted_by || req.query.deleted_by || 'system';
    await DialFormat.destroy({ where: { id: req.params.id } });
    // Log audit event
    await logAuditEvent(
      'Dial Format Deleted',
      { type: 'DialFormat', id: req.params.id, name: dialFormat.filename },
      { username: deletedBy },
      { action: 'delete', method: 'DELETE', endpoint: `/api/files/dial-formats/${req.params.id}` },
      true
    );
    res.json({
      success: true,
      message: 'Dial format deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting dial format:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete dial format',
      message: error.message
    });
  }
});

// GET /api/files/stats - Get file statistics
router.get('/stats', async (req, res) => {
  try {
    const [dmStats, dfStats] = await Promise.all([
      DigitMap.getStatusCounts(),
      DialFormat.getStatusCounts()
    ]);

    const dmTotal = Object.values(dmStats).reduce((sum, count) => sum + count, 0);
    const dfTotal = Object.values(dfStats).reduce((sum, count) => sum + count, 0);

    res.json({
      success: true,
      data: {
        digit_maps: {
          total: dmTotal,
          by_status: dmStats
        },
        dial_formats: {
          total: dfTotal,
          by_status: dfStats
        },
        overall: {
          total: dmTotal + dfTotal
        }
      }
    });
  } catch (error) {
    console.error('Error fetching file stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch file statistics',
      message: error.message
    });
  }
});

// File History and Rollback endpoints

// Get file history
router.get('/:type/:id/history', async (req, res) => {
  try {
    const { type, id } = req.params;
    const Model = type === 'digit-maps' ? DigitMap : DialFormat;
    
    if (!Model) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file type'
      });
    }

    // Get the current file
    const currentFile = await Model.findByPk(id);
    if (!currentFile) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // Get version history from audit logs
    const auditLogs = await AuditLog.findAll({
      where: {
        entity: id,
        event_category: 'file',
        action_details: { [Op.or]: [
          { action: 'create' },
          { action: 'update' },
          { action: 'upload' }
        ] }
      },
      order: [['timestamp', 'DESC']],
      limit: 50
    });

    // Build history entries
    const history = auditLogs.map(log => ({
      id: log._id,
      version: log.version || 'unknown',
      timestamp: log.created_at,
      user: log.user || 'system',
      action: log.action,
      changes: log.changes || {},
      checksum: log.metadata?.checksum,
      size: log.metadata?.size,
      description: log.description || `${log.action} operation`,
      can_rollback: log.action !== 'delete' && log.metadata?.backup_path
    }));

    // Add current version as the first entry
    history.unshift({
      id: 'current',
      version: 'current',
      timestamp: currentFile.updated_at || currentFile.created_at,
      user: currentFile.last_modified_by || 'system',
      action: 'current',
      changes: {},
      checksum: currentFile.checksum,
      size: currentFile.size,
      description: 'Current version',
      can_rollback: false
    });

    await logAuditEvent(
      'file_history_requested',
      id,
      req.user?.username || 'anonymous',
      'view_history'
    );

    res.json({
      success: true,
      data: {
        file_id: id,
        file_type: type,
        current_version: currentFile.version || 'latest',
        history
      }
    });

  } catch (error) {
    console.error('Error fetching file history:', error);
    await logAuditEvent(
      'file_history_error',
      req.params.id,
      req.user?.username || 'anonymous',
      'view_history',
      false,
      null,
      error.message
    );
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch file history',
      message: error.message
    });
  }
});

// Rollback to a previous version
router.post('/:type/:id/rollback', async (req, res) => {
  try {
    const { type, id } = req.params;
    const { history_id, reason } = req.body;
    
    if (!history_id || !reason) {
      return res.status(400).json({
        success: false,
        error: 'History ID and reason are required'
      });
    }

    const Model = type === 'digit-maps' ? DigitMap : DialFormat;
    
    if (!Model) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file type'
      });
    }

    // Get the current file
    const currentFile = await Model.findByPk(id);
    if (!currentFile) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // Get the audit log entry for the target version
    const targetAuditLog = await AuditLog.findByPk(history_id);
    if (!targetAuditLog || targetAuditLog.entity !== id) {
      return res.status(404).json({
        success: false,
        error: 'History entry not found'
      });
    }

    // Check if we have backup data for rollback
    if (!targetAuditLog.metadata?.backup_path && !targetAuditLog.metadata?.content_backup) {
      return res.status(400).json({
        success: false,
        error: 'No backup data available for this version'
      });
    }

    // Create a backup of current state before rollback
    const currentBackup = {
      content: currentFile.content,
      headers: currentFile.headers,
      checksum: currentFile.checksum,
      size: currentFile.size,
      version: currentFile.version
    };

    // Restore the previous version's data
    let rollbackData;
    if (targetAuditLog.metadata?.content_backup) {
      rollbackData = targetAuditLog.metadata.content_backup;
    } else {
      // If we have a backup path, we'd need to read from it
      // For now, we'll use the content backup approach
      return res.status(400).json({
        success: false,
        error: 'Backup file restoration not implemented yet'
      });
    }

    // Update the file with rollback data
    const rollbackUpdate = {
      content: rollbackData.content,
      headers: rollbackData.headers || currentFile.headers,
      checksum: generateChecksum(rollbackData.content),
      size: Buffer.byteLength(rollbackData.content, 'utf8'),
      version: (currentFile.version || 0) + 1,
      last_modified_by: req.user?.username || 'system',
      updated_at: new Date()
    };

    await Model.update(rollbackUpdate, { where: { id } });

    // Log the rollback operation
    await logAuditEvent(
      'file_rollback',
      id,
      req.user?.username || 'anonymous',
      'rollback',
      true,
      {
        rolled_back_to: history_id,
        reason,
        previous_version: currentFile.version,
        new_version: rollbackUpdate.version
      },
      null,
      {
        backup_content: currentBackup,
        target_audit_log: history_id
      }
    );

    res.json({
      success: true,
      message: 'File successfully rolled back',
      data: {
        file_id: id,
        rolled_back_to: history_id,
        new_version: rollbackUpdate.version,
        reason
      }
    });

  } catch (error) {
    console.error('Error rolling back file:', error);
    await logAuditEvent(
      'file_rollback_error',
      req.params.id,
      req.user?.username || 'anonymous',
      'rollback',
      false,
      null,
      error.message
    );
    
    res.status(500).json({
      success: false,
      error: 'Failed to rollback file',
      message: error.message
    });
  }
});

// Get specific version content
router.get('/:type/:id/versions/:version_id', async (req, res) => {
  try {
    const { type, id, version_id } = req.params;
    
    if (version_id === 'current') {
      // Redirect to the regular file endpoint for current version
      return res.redirect(`/api/files/${type}/${id}`);
    }

    // Get the audit log entry for this version
    const auditLog = await AuditLog.findById(version_id);
    if (!auditLog || auditLog.entity !== id) {
      return res.status(404).json({
        success: false,
        error: 'Version not found'
      });
    }

    if (!auditLog.metadata?.content_backup) {
      return res.status(404).json({
        success: false,
        error: 'Version content not available'
      });
    }

    const versionData = auditLog.metadata.content_backup;

    res.json({
      success: true,
      data: {
        file_id: id,
        version_id,
        timestamp: auditLog.created_at,
        content: versionData.content,
        headers: versionData.headers,
        checksum: versionData.checksum,
        size: versionData.size,
        metadata: {
          user: auditLog.user,
          action: auditLog.action,
          description: auditLog.description
        }
      }
    });

  } catch (error) {
    console.error('Error fetching version content:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch version content',
      message: error.message
    });
  }
});

// PUT /api/files/digit-maps/:id - Update digit map content
router.put('/digit-maps/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, updated_by = 'system', reason } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required'
      });
    }

    const digitMap = await DigitMap.findById(id);
    if (!digitMap) {
      return res.status(404).json({
        success: false,
        error: 'Digit map not found'
      });
    }

    // Create backup of current state
    const currentBackup = {
      content: digitMap.content,
      headers: digitMap.headers,
      checksum: digitMap.checksum,
      size: digitMap.file_size,
      version: digitMap.version
    };

    // Generate new checksum and validate
    const newChecksum = generateChecksum(content);
    const newSize = Buffer.byteLength(content, 'utf8');

    // Update the document
    digitMap.content = content;
    digitMap.checksum = newChecksum;
    digitMap.file_size = newSize;
    digitMap.version = (digitMap.version || 0) + 1;
    digitMap.last_modified_by = updated_by;
    digitMap.updated_at = new Date();

    // Validate new content
    digitMap.validateContent();
    await digitMap.save();

    // Log the update with backup
    await logAuditEvent(
      'Digit Map Updated',
      { type: 'DigitMap', id: digitMap._id.toString(), name: digitMap.filename },
      { username: updated_by },
      { action: 'update', method: 'PUT', endpoint: `/api/files/digit-maps/${id}` },
      true,
      { reason: reason || 'Content updated', new_checksum: newChecksum },
      null,
      {
        content_backup: currentBackup,
        new_size: newSize,
        row_count: digitMap.validation_results.row_count
      }
    );

    res.json({
      success: true,
      data: digitMap,
      message: 'Digit map updated successfully'
    });

  } catch (error) {
    console.error('Error updating digit map:', error);
    await logAuditEvent(
      'Digit Map Update Failed',
      { type: 'DigitMap', id: req.params.id },
      { username: req.body.updated_by || 'system' },
      { action: 'update', method: 'PUT', endpoint: `/api/files/digit-maps/${req.params.id}` },
      false,
      null,
      error.message
    );

    res.status(500).json({
      success: false,
      error: 'Failed to update digit map',
      message: error.message
    });
  }
});

// PUT /api/files/dial-formats/:id - Update dial format content
router.put('/dial-formats/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, updated_by = 'system', reason } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required'
      });
    }

    const dialFormat = await DialFormat.findById(id);
    if (!dialFormat) {
      return res.status(404).json({
        success: false,
        error: 'Dial format not found'
      });
    }

    // Create backup of current state
    const currentBackup = {
      content: dialFormat.content,
      headers: dialFormat.headers,
      checksum: dialFormat.checksum,
      size: dialFormat.file_size,
      version: dialFormat.version
    };

    // Generate new checksum and validate
    const newChecksum = generateChecksum(content);
    const newSize = Buffer.byteLength(content, 'utf8');

    // Update the document
    dialFormat.content = content;
    dialFormat.checksum = newChecksum;
    dialFormat.file_size = newSize;
    dialFormat.version = (dialFormat.version || 0) + 1;
    dialFormat.last_modified_by = updated_by;
    dialFormat.updated_at = new Date();

    // Validate new content
    dialFormat.validateContent();
    await dialFormat.save();

    // Log the update with backup
    await logAuditEvent(
      'Dial Format Updated',
      { type: 'DialFormat', id: dialFormat._id.toString(), name: dialFormat.filename },
      { username: updated_by },
      { action: 'update', method: 'PUT', endpoint: `/api/files/dial-formats/${id}` },
      true,
      { reason: reason || 'Content updated', new_checksum: newChecksum },
      null,
      {
        content_backup: currentBackup,
        new_size: newSize,
        row_count: dialFormat.validation_results.row_count
      }
    );

    res.json({
      success: true,
      data: dialFormat,
      message: 'Dial format updated successfully'
    });

  } catch (error) {
    console.error('Error updating dial format:', error);
    await logAuditEvent(
      'Dial Format Update Failed',
      { type: 'DialFormat', id: req.params.id },
      { username: req.body.updated_by || 'system' },
      { action: 'update', method: 'PUT', endpoint: `/api/files/dial-formats/${req.params.id}` },
      false,
      null,
      error.message
    );

    res.status(500).json({
      success: false,
      error: 'Failed to update dial format',
      message: error.message
    });
  }
});

// GET /api/files/mapping-suggestions/:napId - Get mapping suggestions for NAP
router.get('/mapping-suggestions/:napId', async (req, res) => {
  try {
    const { napId } = req.params;
    
    // Find DM and DF files that could be mapped to this NAP
    const [dmFiles, dfFiles] = await Promise.all([
      DigitMap.find({ 
        $or: [
          { nap_id: napId },
          { routeset_name: { $ne: null } }
        ]
      }).select('id filename routeset_name nap_id'),
      DialFormat.find({
        $or: [
          { nap_id: napId },
          { routeset_name: { $ne: null } }
        ]
      }).select('id filename routeset_name nap_id')
    ]);

    const suggestions = [];

    // Generate suggestions based on matching routeset names and NAP IDs
    for (const dmFile of dmFiles) {
      for (const dfFile of dfFiles) {
        let confidence = 0;
        const sharedRoutesets = [];

        // High confidence for exact NAP ID match
        if (dmFile.nap_id === napId && dfFile.nap_id === napId) {
          confidence = 95;
        } 
        // Medium confidence for one matching NAP ID
        else if (dmFile.nap_id === napId || dfFile.nap_id === napId) {
          confidence = 75;
        }
        // Lower confidence for matching routeset names
        else if (dmFile.routeset_name && dfFile.routeset_name && 
                dmFile.routeset_name === dfFile.routeset_name) {
          confidence = 60;
          sharedRoutesets.push(dmFile.routeset_name);
        }
        // Minimal confidence for any pairing
        else {
          confidence = 30;
        }

        if (confidence >= 50) {
          suggestions.push({
            confidence,
            digitmap_file_id: dmFile.id,
            dialformat_file_id: dfFile.id,
            dm_filename: dmFile.filename,
            df_filename: dfFile.filename,
            shared_routesets: sharedRoutesets
          });
        }
      }
    }

    // Sort by confidence
    suggestions.sort((a, b) => b.confidence - a.confidence);

    res.json({
      success: true,
      suggestions: suggestions.slice(0, 5) // Return top 5 suggestions
    });

  } catch (error) {
    console.error('Error generating mapping suggestions:', error);
    
    await logAuditEvent(
      'Failed to generate mapping suggestions',
      'mapping_suggestion',
      'system',
      'generate_suggestions',
      false,
      null,
      error.message
    );

    res.status(500).json({
      success: false,
      error: 'Failed to generate mapping suggestions',
      message: error.message
    });
  }
});

export default router;
