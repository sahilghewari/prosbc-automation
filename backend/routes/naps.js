/**
 * NAP Routes
 * API endpoints for NAP management
 */


import express from 'express';
import NAP from '../models/NAP.js';
import AuditLog from '../models/AuditLog.js';

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


    // Build Sequelize where clause
    const where = {};
    if (status) where.status = status;
    if (search) {
      where[Sequelize.Op.or] = [
        { name: { [Sequelize.Op.iLike]: `%${search}%` } },
        { description: { [Sequelize.Op.iLike]: `%${search}%` } }
      ];
    }

    const naps = await NAP.findAll({
      where,
      order: [[sort.replace('-', ''), sort.startsWith('-') ? 'DESC' : 'ASC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });
    const total = await NAP.count({ where });

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
    // Get status counts
    const statuses = ['created', 'mapped', 'activated', 'inactive', 'error'];
    const statusCounts = {};
    for (const s of statuses) {
      statusCounts[s] = await NAP.count({ where: { status: s } });
    }
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
    const nap = await NAP.findByPk(req.params.id);
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

    const existingNAP = await NAP.findOne({ where: { name } });
    if (existingNAP) {
      return res.status(409).json({
        success: false,
        error: 'NAP with this name already exists'
      });
    }

    // Create and validate
    const nap = await NAP.create({
      name,
      config_data,
      description,
      tags,
      created_by
    });

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

    const nap = await NAP.findByPk(req.params.id);
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
    const originalData = nap.toJSON();
    // Update fields
    if (name !== undefined) nap.name = name;
    if (config_data !== undefined) nap.config_data = config_data;
    if (description !== undefined) nap.description = description;
    if (tags !== undefined) nap.tags = tags;
    if (status !== undefined) nap.status = status;
    nap.updated_by = updated_by;
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

    const nap = await NAP.findByPk(req.params.id);
    if (!nap) {
      return res.status(404).json({
        success: false,
        error: 'NAP not found'
      });
    }
    // Check if NAP is mapped to any routesets
    const { default: RoutesetMapping } = await import('../models/RoutesetMapping.js');
    const mappings = await RoutesetMapping.findAll({ where: { nap_id: req.params.id } });
    if (mappings.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Cannot delete NAP with active routeset mappings',
        mappings_count: mappings.length
      });
    }
    const deletedBy = req.body.deleted_by || req.query.deleted_by || 'system';
    await nap.destroy();

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
    const nap = await NAP.findByPk(req.params.id);
    if (!nap) {
      return res.status(404).json({
        success: false,
        error: 'NAP not found'
      });
    }
    // You may want to implement validation logic here as a utility function
    // For now, just return a success
    res.json({
      success: true,
      data: {},
      message: 'NAP validation (Sequelize) not implemented'
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
