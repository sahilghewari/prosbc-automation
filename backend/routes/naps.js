/**
 * NAP Routes
 * API endpoints for NAP management
 */

import express from 'express';
import { NAP, AuditLog } from '../models/index.js';

const router = express.Router();

// Utility function to log audit events
const logAuditEvent = async (event, entity, user, action, status = true, changes = null, error = null) => {
  try {
    await AuditLog.logEvent({
      event,
      category: 'nap',
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

// GET /api/naps - Get all NAPs with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      sort = '-created_at'
    } = req.query;

    const query = {};
    
    // Filter by status
    if (status) {
      query.status = status;
    }
    
    // Search by name or description
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort,
      populate: {
        path: 'mapped_files_count'
      }
    };

    const naps = await NAP.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await NAP.countDocuments(query);

    res.json({
      success: true,
      data: naps,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching NAPs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch NAPs',
      message: error.message
    });
  }
});

// GET /api/naps/stats - Get NAP statistics
router.get('/stats', async (req, res) => {
  try {
    const statusCounts = await NAP.getStatusCounts();
    const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
    
    res.json({
      success: true,
      data: {
        total,
        by_status: statusCounts
      }
    });
  } catch (error) {
    console.error('Error fetching NAP stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch NAP statistics',
      message: error.message
    });
  }
});

// GET /api/naps/:id - Get single NAP
router.get('/:id', async (req, res) => {
  try {
    const nap = await NAP.findById(req.params.id);
    
    if (!nap) {
      return res.status(404).json({
        success: false,
        error: 'NAP not found'
      });
    }

    res.json({
      success: true,
      data: nap
    });
  } catch (error) {
    console.error('Error fetching NAP:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch NAP',
      message: error.message
    });
  }
});

// POST /api/naps - Create new NAP
router.post('/', async (req, res) => {
  try {
    const {
      name,
      config_data,
      description,
      tags,
      created_by = 'system'
    } = req.body;

    // Validate required fields
    if (!name || !config_data) {
      return res.status(400).json({
        success: false,
        error: 'Name and config_data are required'
      });
    }

    // Check for duplicate name
    const existingNAP = await NAP.findOne({ name });
    if (existingNAP) {
      return res.status(409).json({
        success: false,
        error: 'NAP with this name already exists'
      });
    }

    const nap = new NAP({
      name,
      config_data,
      description,
      tags,
      created_by
    });

    // Validate the NAP
    nap.validate();
    
    await nap.save();

    // Log audit event
    await logAuditEvent(
      'NAP Created',
      { type: 'NAP', id: nap._id.toString(), name: nap.name },
      { username: created_by },
      { action: 'create', method: 'POST', endpoint: '/api/naps' },
      true
    );

    res.status(201).json({
      success: true,
      data: nap,
      message: 'NAP created successfully'
    });
  } catch (error) {
    console.error('Error creating NAP:', error);
    
    // Log audit event for failure
    await logAuditEvent(
      'NAP Creation Failed',
      { type: 'NAP', id: 'unknown', name: req.body.name || 'unknown' },
      { username: req.body.created_by || 'system' },
      { action: 'create', method: 'POST', endpoint: '/api/naps' },
      false,
      null,
      { error_message: error.message }
    );

    res.status(500).json({
      success: false,
      error: 'Failed to create NAP',
      message: error.message
    });
  }
});

// PUT /api/naps/:id - Update NAP
router.put('/:id', async (req, res) => {
  try {
    const nap = await NAP.findById(req.params.id);
    
    if (!nap) {
      return res.status(404).json({
        success: false,
        error: 'NAP not found'
      });
    }

    const {
      name,
      config_data,
      description,
      tags,
      status,
      updated_by = 'system'
    } = req.body;

    // Store original data for audit log
    const originalData = nap.toObject();

    // Update fields
    if (name !== undefined) nap.name = name;
    if (config_data !== undefined) nap.config_data = config_data;
    if (description !== undefined) nap.description = description;
    if (tags !== undefined) nap.tags = tags;
    if (status !== undefined) nap.status = status;
    nap.updated_by = updated_by;

    // Re-validate if config changed
    if (config_data !== undefined) {
      nap.validate();
    }

    await nap.save();

    // Log audit event
    await logAuditEvent(
      'NAP Updated',
      { type: 'NAP', id: nap._id.toString(), name: nap.name },
      { username: updated_by },
      { action: 'update', method: 'PUT', endpoint: `/api/naps/${req.params.id}` },
      true,
      { before: originalData, after: nap.toObject() }
    );

    res.json({
      success: true,
      data: nap,
      message: 'NAP updated successfully'
    });
  } catch (error) {
    console.error('Error updating NAP:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update NAP',
      message: error.message
    });
  }
});

// DELETE /api/naps/:id - Delete NAP
router.delete('/:id', async (req, res) => {
  try {
    const nap = await NAP.findById(req.params.id);
    
    if (!nap) {
      return res.status(404).json({
        success: false,
        error: 'NAP not found'
      });
    }

    // Check if NAP is mapped to any routesets
    const { RoutesetMapping } = await import('../models/index.js');
    const mappings = await RoutesetMapping.find({ nap_id: req.params.id });
    
    if (mappings.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Cannot delete NAP with active routeset mappings',
        mappings_count: mappings.length
      });
    }

    const deletedBy = req.body.deleted_by || req.query.deleted_by || 'system';
    
    await NAP.findByIdAndDelete(req.params.id);

    // Log audit event
    await logAuditEvent(
      'NAP Deleted',
      { type: 'NAP', id: req.params.id, name: nap.name },
      { username: deletedBy },
      { action: 'delete', method: 'DELETE', endpoint: `/api/naps/${req.params.id}` },
      true
    );

    res.json({
      success: true,
      message: 'NAP deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting NAP:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete NAP',
      message: error.message
    });
  }
});

// POST /api/naps/:id/validate - Validate NAP configuration
router.post('/:id/validate', async (req, res) => {
  try {
    const nap = await NAP.findById(req.params.id);
    
    if (!nap) {
      return res.status(404).json({
        success: false,
        error: 'NAP not found'
      });
    }

    const validationResults = nap.validate();
    await nap.save();

    res.json({
      success: true,
      data: validationResults,
      message: validationResults.is_valid ? 'NAP validation passed' : 'NAP validation failed'
    });
  } catch (error) {
    console.error('Error validating NAP:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate NAP',
      message: error.message
    });
  }
});

export default router;
