/**
 * Audit Logs Routes
 * API endpoints for audit log management
 */

import express from 'express';
import { AuditLog } from '../models/index.js';

const router = express.Router();

// GET /api/audit-logs - Get all audit logs with filtering
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      event_category,
      severity,
      status,
      username,
      entity_type,
      entity_id,
      action,
      start_date,
      end_date,
      sort = '-timestamp'
    } = req.query;

    const query = {};
    
    // Apply filters
    if (event_category) query.event_category = event_category;
    if (severity) query.severity = severity;
    if (status !== undefined) query.status = status === 'true';
    if (username) query['user_info.username'] = username;
    if (entity_type) query['related_entity.type'] = entity_type;
    if (entity_id) query['related_entity.id'] = entity_id;
    if (action) query['action_details.action'] = action;
    
    // Date range filter
    if (start_date || end_date) {
      query.timestamp = {};
      if (start_date) query.timestamp.$gte = new Date(start_date);
      if (end_date) query.timestamp.$lte = new Date(end_date);
    }

    const logs = await AuditLog.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await AuditLog.countDocuments(query);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit logs',
      message: error.message
    });
  }
});

// GET /api/audit-logs/stats - Get audit log statistics
router.get('/stats', async (req, res) => {
  try {
    const { timeRange = 24 } = req.query;
    const stats = await AuditLog.getEventStats(parseInt(timeRange));
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching audit stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit statistics',
      message: error.message
    });
  }
});

// GET /api/audit-logs/timeline - Get activity timeline
router.get('/timeline', async (req, res) => {
  try {
    const { 
      hours = 24, 
      granularity = 'hour' 
    } = req.query;
    
    const timeline = await AuditLog.getActivityTimeline(
      parseInt(hours), 
      granularity
    );
    
    res.json({
      success: true,
      data: timeline
    });
  } catch (error) {
    console.error('Error fetching activity timeline:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity timeline',
      message: error.message
    });
  }
});

// GET /api/audit-logs/errors - Get error logs
router.get('/errors', async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const errorLogs = await AuditLog.findErrors(parseInt(limit));
    
    res.json({
      success: true,
      data: errorLogs
    });
  } catch (error) {
    console.error('Error fetching error logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch error logs',
      message: error.message
    });
  }
});

// GET /api/audit-logs/user/:username - Get logs for specific user
router.get('/user/:username', async (req, res) => {
  try {
    const { limit = 100, days = 7 } = req.query;
    
    // Get user logs
    const userLogs = await AuditLog.findByUser(req.params.username, parseInt(limit));
    
    // Get user activity summary
    const userActivity = await AuditLog.getUserActivity(req.params.username, parseInt(days));
    
    res.json({
      success: true,
      data: {
        logs: userLogs,
        activity_summary: userActivity
      }
    });
  } catch (error) {
    console.error('Error fetching user logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user logs',
      message: error.message
    });
  }
});

// GET /api/audit-logs/entity/:type/:id - Get logs for specific entity
router.get('/entity/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const entityLogs = await AuditLog.findByEntity(type, id);
    
    res.json({
      success: true,
      data: entityLogs
    });
  } catch (error) {
    console.error('Error fetching entity logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch entity logs',
      message: error.message
    });
  }
});

// GET /api/audit-logs/category/:category - Get logs by category
router.get('/category/:category', async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const categoryLogs = await AuditLog.findByCategory(req.params.category, parseInt(limit));
    
    res.json({
      success: true,
      data: categoryLogs
    });
  } catch (error) {
    console.error('Error fetching category logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch category logs',
      message: error.message
    });
  }
});

// GET /api/audit-logs/:id - Get single audit log
router.get('/:id', async (req, res) => {
  try {
    const log = await AuditLog.findById(req.params.id);
    
    if (!log) {
      return res.status(404).json({
        success: false,
        error: 'Audit log not found'
      });
    }

    res.json({
      success: true,
      data: log
    });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit log',
      message: error.message
    });
  }
});

// POST /api/audit-logs - Create new audit log (manual logging)
router.post('/', async (req, res) => {
  try {
    const {
      event,
      category = 'system',
      severity = 'info',
      status = true,
      entity,
      user,
      action,
      changes,
      error,
      metadata,
      correlationId,
      tags
    } = req.body;

    if (!event || !entity || !user || !action) {
      return res.status(400).json({
        success: false,
        error: 'Event, entity, user, and action are required'
      });
    }

    const log = await AuditLog.logEvent({
      event,
      category,
      severity,
      status,
      entity,
      user,
      action,
      changes,
      error,
      metadata,
      correlationId,
      tags
    });

    res.status(201).json({
      success: true,
      data: log,
      message: 'Audit log created successfully'
    });
  } catch (error) {
    console.error('Error creating audit log:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create audit log',
      message: error.message
    });
  }
});

// DELETE /api/audit-logs/cleanup - Clean up old logs
router.delete('/cleanup', async (req, res) => {
  try {
    const { days = 365, confirm = false } = req.body;

    if (!confirm) {
      return res.status(400).json({
        success: false,
        error: 'Cleanup must be confirmed by setting confirm=true'
      });
    }

    const deletedCount = await AuditLog.cleanupOldLogs(parseInt(days));

    res.json({
      success: true,
      data: {
        deleted_count: deletedCount,
        days_threshold: parseInt(days)
      },
      message: `Cleaned up ${deletedCount} old audit logs`
    });
  } catch (error) {
    console.error('Error cleaning up audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup audit logs',
      message: error.message
    });
  }
});

// GET /api/audit-logs/export/csv - Export logs to CSV
router.get('/export/csv', async (req, res) => {
  try {
    const {
      start_date,
      end_date,
      event_category,
      limit = 10000
    } = req.query;

    const query = {};
    
    if (event_category) query.event_category = event_category;
    if (start_date || end_date) {
      query.timestamp = {};
      if (start_date) query.timestamp.$gte = new Date(start_date);
      if (end_date) query.timestamp.$lte = new Date(end_date);
    }

    const logs = await AuditLog.find(query)
      .sort('-timestamp')
      .limit(parseInt(limit))
      .exec();

    // Convert to CSV format
    const csvHeader = 'Timestamp,Event,Category,Severity,Status,User,Action,Entity Type,Entity ID,Entity Name\n';
    const csvRows = logs.map(log => {
      const row = [
        log.timestamp.toISOString(),
        `"${log.event}"`,
        log.event_category,
        log.severity,
        log.status,
        log.user_info.username,
        log.action_details.action,
        log.related_entity.type,
        log.related_entity.id,
        `"${log.related_entity.name || ''}"`
      ].join(',');
      return row;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export audit logs',
      message: error.message
    });
  }
});

export default router;
