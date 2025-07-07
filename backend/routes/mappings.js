/**
 * Mappings Routes
 * API endpoints for routeset mapping management
 */

import express from 'express';
import { RoutesetMapping, NAP, DigitMap, DialFormat, AuditLog } from '../models/index.js';

const router = express.Router();

// Utility function to log audit events
const logAuditEvent = async (event, entity, user, action, status = true, changes = null, error = null) => {
  try {
    await AuditLog.logEvent({
      event,
      category: 'mapping',
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

// GET /api/mappings - Get all routeset mappings
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      nap_id,
      sort = '-mapped_at'
    } = req.query;

    const query = {};
    
    if (status) query.status = status;
    if (nap_id) query.nap_id = nap_id;

    const mappings = await RoutesetMapping.find(query)
      .populate('nap_id', 'name status')
      .populate('digit_map_id', 'filename original_filename status validation_results')
      .populate('dial_format_id', 'filename original_filename status validation_results')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await RoutesetMapping.countDocuments(query);

    res.json({
      success: true,
      data: mappings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching mappings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch mappings',
      message: error.message
    });
  }
});

// GET /api/mappings/stats - Get mapping statistics
router.get('/stats', async (req, res) => {
  try {
    const statusCounts = await RoutesetMapping.getStatusCounts();
    const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
    
    res.json({
      success: true,
      data: {
        total,
        by_status: statusCounts
      }
    });
  } catch (error) {
    console.error('Error fetching mapping stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch mapping statistics',
      message: error.message
    });
  }
});

// GET /api/mappings/summary - Get mappings summary
router.get('/summary', async (req, res) => {
  try {
    const summary = await RoutesetMapping.getMappingsSummary();
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching mapping summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch mapping summary',
      message: error.message
    });
  }
});

// GET /api/mappings/nap/:napId - Get mappings for a specific NAP
router.get('/nap/:napId', async (req, res) => {
  try {
    const mappings = await RoutesetMapping.findByNAP(req.params.napId);
    
    res.json({
      success: true,
      data: mappings
    });
  } catch (error) {
    console.error('Error fetching NAP mappings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch NAP mappings',
      message: error.message
    });
  }
});

// POST /api/mappings - Create new mapping
router.post('/', async (req, res) => {
  try {
    const {
      nap_id,
      digit_map_id,
      dial_format_id,
      mapping_name,
      priority = 0,
      configuration = {},
      mapped_by = 'system',
      mapped_via = 'gui',
      notes
    } = req.body;

    // Validate required fields
    if (!nap_id || !digit_map_id || !dial_format_id || !mapping_name) {
      return res.status(400).json({
        success: false,
        error: 'NAP ID, Digit Map ID, Dial Format ID, and mapping name are required'
      });
    }

    // Verify that referenced entities exist
    const [nap, digitMap, dialFormat] = await Promise.all([
      NAP.findById(nap_id),
      DigitMap.findById(digit_map_id),
      DialFormat.findById(dial_format_id)
    ]);

    if (!nap) {
      return res.status(404).json({
        success: false,
        error: 'NAP not found'
      });
    }

    if (!digitMap) {
      return res.status(404).json({
        success: false,
        error: 'Digit Map not found'
      });
    }

    if (!dialFormat) {
      return res.status(404).json({
        success: false,
        error: 'Dial Format not found'
      });
    }

    // Check for existing mapping with same combination
    const existingMapping = await RoutesetMapping.findOne({
      nap_id,
      digit_map_id,
      dial_format_id
    });

    if (existingMapping) {
      return res.status(409).json({
        success: false,
        error: 'Mapping with this combination already exists',
        existing_mapping_id: existingMapping._id
      });
    }

    const mapping = new RoutesetMapping({
      nap_id,
      digit_map_id,
      dial_format_id,
      mapping_name,
      priority,
      configuration,
      mapped_by,
      mapped_via,
      notes
    });

    // Validate the mapping
    await mapping.validateMapping();
    
    await mapping.save();

    // Update file statuses to 'mapped'
    await Promise.all([
      DigitMap.findByIdAndUpdate(digit_map_id, { status: 'mapped' }),
      DialFormat.findByIdAndUpdate(dial_format_id, { status: 'mapped' })
    ]);

    // Update NAP status to 'mapped' if not already activated
    if (nap.status === 'created') {
      await NAP.findByIdAndUpdate(nap_id, { status: 'mapped' });
    }

    // Populate the mapping for response
    await mapping.populate([
      { path: 'nap_id', select: 'name status' },
      { path: 'digit_map_id', select: 'filename original_filename status' },
      { path: 'dial_format_id', select: 'filename original_filename status' }
    ]);

    // Log audit event
    await logAuditEvent(
      'Routeset Mapping Created',
      { type: 'RoutesetMapping', id: mapping._id.toString(), name: mapping.mapping_name },
      { username: mapped_by },
      { action: 'create', method: 'POST', endpoint: '/api/mappings' },
      true
    );

    res.status(201).json({
      success: true,
      data: mapping,
      message: 'Mapping created successfully'
    });
  } catch (error) {
    console.error('Error creating mapping:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create mapping',
      message: error.message
    });
  }
});

// GET /api/mappings/:id - Get single mapping
router.get('/:id', async (req, res) => {
  try {
    const mapping = await RoutesetMapping.findById(req.params.id)
      .populate('nap_id')
      .populate('digit_map_id')
      .populate('dial_format_id');
    
    if (!mapping) {
      return res.status(404).json({
        success: false,
        error: 'Mapping not found'
      });
    }

    res.json({
      success: true,
      data: mapping
    });
  } catch (error) {
    console.error('Error fetching mapping:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch mapping',
      message: error.message
    });
  }
});

// PUT /api/mappings/:id - Update mapping
router.put('/:id', async (req, res) => {
  try {
    const mapping = await RoutesetMapping.findById(req.params.id);
    
    if (!mapping) {
      return res.status(404).json({
        success: false,
        error: 'Mapping not found'
      });
    }

    const {
      mapping_name,
      status,
      priority,
      configuration,
      notes,
      updated_by = 'system'
    } = req.body;

    // Store original data for audit log
    const originalData = mapping.toObject();

    // Update fields
    if (mapping_name !== undefined) mapping.mapping_name = mapping_name;
    if (status !== undefined) mapping.status = status;
    if (priority !== undefined) mapping.priority = priority;
    if (configuration !== undefined) mapping.configuration = configuration;
    if (notes !== undefined) mapping.notes = notes;

    await mapping.save();

    // Log audit event
    await logAuditEvent(
      'Routeset Mapping Updated',
      { type: 'RoutesetMapping', id: mapping._id.toString(), name: mapping.mapping_name },
      { username: updated_by },
      { action: 'update', method: 'PUT', endpoint: `/api/mappings/${req.params.id}` },
      true,
      { before: originalData, after: mapping.toObject() }
    );

    res.json({
      success: true,
      data: mapping,
      message: 'Mapping updated successfully'
    });
  } catch (error) {
    console.error('Error updating mapping:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update mapping',
      message: error.message
    });
  }
});

// POST /api/mappings/:id/activate - Activate mapping
router.post('/:id/activate', async (req, res) => {
  try {
    const mapping = await RoutesetMapping.findById(req.params.id);
    
    if (!mapping) {
      return res.status(404).json({
        success: false,
        error: 'Mapping not found'
      });
    }

    await mapping.activate();

    const activatedBy = req.body.activated_by || 'system';

    // Log audit event
    await logAuditEvent(
      'Routeset Mapping Activated',
      { type: 'RoutesetMapping', id: mapping._id.toString(), name: mapping.mapping_name },
      { username: activatedBy },
      { action: 'activate', method: 'POST', endpoint: `/api/mappings/${req.params.id}/activate` },
      true
    );

    res.json({
      success: true,
      data: mapping,
      message: 'Mapping activated successfully'
    });
  } catch (error) {
    console.error('Error activating mapping:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to activate mapping',
      message: error.message
    });
  }
});

// POST /api/mappings/:id/deactivate - Deactivate mapping
router.post('/:id/deactivate', async (req, res) => {
  try {
    const mapping = await RoutesetMapping.findById(req.params.id);
    
    if (!mapping) {
      return res.status(404).json({
        success: false,
        error: 'Mapping not found'
      });
    }

    await mapping.deactivate();

    const deactivatedBy = req.body.deactivated_by || 'system';

    // Log audit event
    await logAuditEvent(
      'Routeset Mapping Deactivated',
      { type: 'RoutesetMapping', id: mapping._id.toString(), name: mapping.mapping_name },
      { username: deactivatedBy },
      { action: 'deactivate', method: 'POST', endpoint: `/api/mappings/${req.params.id}/deactivate` },
      true
    );

    res.json({
      success: true,
      data: mapping,
      message: 'Mapping deactivated successfully'
    });
  } catch (error) {
    console.error('Error deactivating mapping:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate mapping',
      message: error.message
    });
  }
});

// DELETE /api/mappings/:id - Delete mapping
router.delete('/:id', async (req, res) => {
  try {
    const mapping = await RoutesetMapping.findById(req.params.id);
    
    if (!mapping) {
      return res.status(404).json({
        success: false,
        error: 'Mapping not found'
      });
    }

    const deletedBy = req.body.deleted_by || req.query.deleted_by || 'system';
    
    await RoutesetMapping.findByIdAndDelete(req.params.id);

    // Log audit event
    await logAuditEvent(
      'Routeset Mapping Deleted',
      { type: 'RoutesetMapping', id: req.params.id, name: mapping.mapping_name },
      { username: deletedBy },
      { action: 'delete', method: 'DELETE', endpoint: `/api/mappings/${req.params.id}` },
      true
    );

    res.json({
      success: true,
      message: 'Mapping deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting mapping:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete mapping',
      message: error.message
    });
  }
});

// POST /api/mappings/:id/validate - Validate mapping
router.post('/:id/validate', async (req, res) => {
  try {
    const mapping = await RoutesetMapping.findById(req.params.id);
    
    if (!mapping) {
      return res.status(404).json({
        success: false,
        error: 'Mapping not found'
      });
    }

    const validationResults = await mapping.validateMapping();
    await mapping.save();

    res.json({
      success: true,
      data: validationResults,
      message: validationResults.is_valid ? 'Mapping validation passed' : 'Mapping validation failed'
    });
  } catch (error) {
    console.error('Error validating mapping:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate mapping',
      message: error.message
    });
  }
});

export default router;
