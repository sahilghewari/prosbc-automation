/**
 * Files Routes
 * API endpoints for DM and DF file management
 */

import express from 'express';
import multer from 'multer';
import { DigitMap, DialFormat, AuditLog } from '../models/index.js';
import crypto from 'crypto';

const router = express.Router();

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

// GET /api/files/digit-maps - Get all digit maps
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

    const query = {};
    
    if (status) query.status = status;
    if (nap_id) query.nap_id = nap_id;
    if (search) {
      query.$or = [
        { filename: { $regex: search, $options: 'i' } },
        { original_filename: { $regex: search, $options: 'i' } }
      ];
    }

    const digitMaps = await DigitMap.find(query)
      .populate('nap_id', 'name status')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await DigitMap.countDocuments(query);

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

// GET /api/files/dial-formats - Get all dial formats
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

    const query = {};
    
    if (status) query.status = status;
    if (nap_id) query.nap_id = nap_id;
    if (search) {
      query.$or = [
        { filename: { $regex: search, $options: 'i' } },
        { original_filename: { $regex: search, $options: 'i' } }
      ];
    }

    const dialFormats = await DialFormat.find(query)
      .populate('nap_id', 'name status')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await DialFormat.countDocuments(query);

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
    const existingFile = await DigitMap.findOne({ checksum });
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

    // Log audit event
    await logAuditEvent(
      'Digit Map Uploaded',
      { type: 'DigitMap', id: digitMap._id.toString(), name: digitMap.filename },
      { username: uploaded_by },
      { action: 'upload', method: 'POST', endpoint: '/api/files/digit-maps/upload' },
      true,
      null,
      null,
      { file_size: req.file.size, row_count: digitMap.validation_results.row_count }
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
    const existingFile = await DialFormat.findOne({ checksum });
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

    // Log audit event
    await logAuditEvent(
      'Dial Format Uploaded',
      { type: 'DialFormat', id: dialFormat._id.toString(), name: dialFormat.filename },
      { username: uploaded_by },
      { action: 'upload', method: 'POST', endpoint: '/api/files/dial-formats/upload' },
      true,
      null,
      null,
      { file_size: req.file.size, row_count: dialFormat.validation_results.row_count }
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

// GET /api/files/digit-maps/:id - Get single digit map
router.get('/digit-maps/:id', async (req, res) => {
  try {
    const digitMap = await DigitMap.findById(req.params.id).populate('nap_id', 'name status');
    
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

// GET /api/files/dial-formats/:id - Get single dial format
router.get('/dial-formats/:id', async (req, res) => {
  try {
    const dialFormat = await DialFormat.findById(req.params.id).populate('nap_id', 'name status');
    
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

// DELETE /api/files/digit-maps/:id - Delete digit map
router.delete('/digit-maps/:id', async (req, res) => {
  try {
    const digitMap = await DigitMap.findById(req.params.id);
    
    if (!digitMap) {
      return res.status(404).json({
        success: false,
        error: 'Digit map not found'
      });
    }

    // Check if file is mapped to any routesets
    const { RoutesetMapping } = await import('../models/index.js');
    const mappings = await RoutesetMapping.find({ digit_map_id: req.params.id });
    
    if (mappings.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Cannot delete digit map with active routeset mappings',
        mappings_count: mappings.length
      });
    }

    const deletedBy = req.body.deleted_by || req.query.deleted_by || 'system';
    
    await DigitMap.findByIdAndDelete(req.params.id);

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

// DELETE /api/files/dial-formats/:id - Delete dial format
router.delete('/dial-formats/:id', async (req, res) => {
  try {
    const dialFormat = await DialFormat.findById(req.params.id);
    
    if (!dialFormat) {
      return res.status(404).json({
        success: false,
        error: 'Dial format not found'
      });
    }

    // Check if file is mapped to any routesets
    const { RoutesetMapping } = await import('../models/index.js');
    const mappings = await RoutesetMapping.find({ dial_format_id: req.params.id });
    
    if (mappings.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Cannot delete dial format with active routeset mappings',
        mappings_count: mappings.length
      });
    }

    const deletedBy = req.body.deleted_by || req.query.deleted_by || 'system';
    
    await DialFormat.findByIdAndDelete(req.params.id);

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

export default router;
