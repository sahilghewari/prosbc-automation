/**
 * Config Actions Routes
 * API endpoints for configuration generation and activation
 */

import express from 'express';
import { ConfigAction, NAP, RoutesetMapping, AuditLog } from '../models/index.js';

const router = express.Router();

// Utility function to log audit events
const logAuditEvent = async (event, entity, user, action, status = true, changes = null, error = null) => {
  try {
    await AuditLog.logEvent({
      event,
      category: 'config',
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

// GET /api/config-actions - Get all config actions
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      action_type,
      nap_id,
      sort = '-executed_at'
    } = req.query;

    const query = {};
    
    if (status) query.status = status;
    if (action_type) query.action_type = action_type;
    if (nap_id) query.nap_id = nap_id;

    const actions = await ConfigAction.find(query)
      .populate('nap_id', 'name status')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await ConfigAction.countDocuments(query);

    res.json({
      success: true,
      data: actions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching config actions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch config actions',
      message: error.message
    });
  }
});

// GET /api/config-actions/stats - Get action statistics
router.get('/stats', async (req, res) => {
  try {
    const { timeRange = 30 } = req.query;
    const stats = await ConfigAction.getActionStats(parseInt(timeRange));
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching action stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch action statistics',
      message: error.message
    });
  }
});

// GET /api/config-actions/recent - Get recent activity
router.get('/recent', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const recentActions = await ConfigAction.getRecentActivity(parseInt(limit));
    
    res.json({
      success: true,
      data: recentActions
    });
  } catch (error) {
    console.error('Error fetching recent actions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent actions',
      message: error.message
    });
  }
});

// GET /api/config-actions/pending - Get pending actions
router.get('/pending', async (req, res) => {
  try {
    const pendingActions = await ConfigAction.findPending();
    
    res.json({
      success: true,
      data: pendingActions
    });
  } catch (error) {
    console.error('Error fetching pending actions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending actions',
      message: error.message
    });
  }
});

// GET /api/config-actions/running - Get running actions
router.get('/running', async (req, res) => {
  try {
    const runningActions = await ConfigAction.findRunning();
    
    res.json({
      success: true,
      data: runningActions
    });
  } catch (error) {
    console.error('Error fetching running actions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch running actions',
      message: error.message
    });
  }
});

// GET /api/config-actions/nap/:napId - Get actions for specific NAP
router.get('/nap/:napId', async (req, res) => {
  try {
    const actions = await ConfigAction.findByNAP(req.params.napId);
    
    res.json({
      success: true,
      data: actions
    });
  } catch (error) {
    console.error('Error fetching NAP actions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch NAP actions',
      message: error.message
    });
  }
});

// POST /api/config-actions/generate - Generate configuration
router.post('/generate', async (req, res) => {
  try {
    const {
      nap_id,
      parameters = {},
      executed_by = 'system',
      execution_method = 'gui',
      priority = 0
    } = req.body;

    if (!nap_id) {
      return res.status(400).json({
        success: false,
        error: 'NAP ID is required'
      });
    }

    // Verify NAP exists
    const nap = await NAP.findById(nap_id);
    if (!nap) {
      return res.status(404).json({
        success: false,
        error: 'NAP not found'
      });
    }

    // Check if NAP has active mappings
    const activeMappings = await RoutesetMapping.find({
      nap_id,
      status: 'active'
    });

    if (activeMappings.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'NAP has no active mappings. Please create and activate mappings first.'
      });
    }

    const action = new ConfigAction({
      nap_id,
      action_type: 'generate',
      status: 'pending',
      parameters,
      executed_by,
      execution_method,
      priority,
      related_mappings: activeMappings.map(m => m._id),
      command: `generate-config --nap-id ${nap_id} --mappings ${activeMappings.length}`
    });

    await action.save();

    // Log audit event
    await logAuditEvent(
      'Configuration Generation Requested',
      { type: 'ConfigAction', id: action._id.toString(), name: `Generate config for ${nap.name}` },
      { username: executed_by },
      { action: 'generate', method: 'POST', endpoint: '/api/config-actions/generate' },
      true
    );

    // Simulate async config generation (in real implementation, this would be a background job)
    setTimeout(async () => {
      try {
        await action.start();
        
        // Simulate configuration generation logic
        const configOutput = {
          nap_name: nap.name,
          mappings_count: activeMappings.length,
          config_size: Math.floor(Math.random() * 1000) + 500,
          timestamp: new Date().toISOString()
        };

        await action.complete(true, JSON.stringify(configOutput, null, 2));
        
        // Update NAP status if generation successful
        await NAP.findByIdAndUpdate(nap_id, { status: 'activated' });

        console.log(`✅ Configuration generated successfully for NAP: ${nap.name}`);
      } catch (error) {
        await action.complete(false, '', error.message);
        console.error(`❌ Configuration generation failed for NAP: ${nap.name}`, error);
      }
    }, 2000); // 2 second delay for simulation

    res.status(201).json({
      success: true,
      data: action,
      message: 'Configuration generation started'
    });
  } catch (error) {
    console.error('Error starting config generation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start configuration generation',
      message: error.message
    });
  }
});

// POST /api/config-actions/activate - Activate configuration
router.post('/activate', async (req, res) => {
  try {
    const {
      nap_id,
      parameters = {},
      executed_by = 'system',
      execution_method = 'gui',
      priority = 0
    } = req.body;

    if (!nap_id) {
      return res.status(400).json({
        success: false,
        error: 'NAP ID is required'
      });
    }

    // Verify NAP exists
    const nap = await NAP.findById(nap_id);
    if (!nap) {
      return res.status(404).json({
        success: false,
        error: 'NAP not found'
      });
    }

    // Check if there's a successful generate action
    const lastGenerate = await ConfigAction.findOne({
      nap_id,
      action_type: 'generate',
      status: 'success'
    }).sort({ executed_at: -1 });

    if (!lastGenerate) {
      return res.status(400).json({
        success: false,
        error: 'No successful configuration generation found. Please generate configuration first.'
      });
    }

    const action = new ConfigAction({
      nap_id,
      action_type: 'activate',
      status: 'pending',
      parameters,
      executed_by,
      execution_method,
      priority,
      command: `activate-config --nap-id ${nap_id} --config-ref ${lastGenerate._id}`
    });

    await action.save();

    // Log audit event
    await logAuditEvent(
      'Configuration Activation Requested',
      { type: 'ConfigAction', id: action._id.toString(), name: `Activate config for ${nap.name}` },
      { username: executed_by },
      { action: 'activate', method: 'POST', endpoint: '/api/config-actions/activate' },
      true
    );

    // Simulate async config activation
    setTimeout(async () => {
      try {
        await action.start();
        
        // Simulate configuration activation logic
        const activationOutput = {
          nap_name: nap.name,
          activation_time: new Date().toISOString(),
          prosbc_response: 'Configuration activated successfully',
          status: 'active'
        };

        await action.complete(true, JSON.stringify(activationOutput, null, 2));
        
        console.log(`✅ Configuration activated successfully for NAP: ${nap.name}`);
      } catch (error) {
        await action.complete(false, '', error.message);
        console.error(`❌ Configuration activation failed for NAP: ${nap.name}`, error);
      }
    }, 3000); // 3 second delay for simulation

    res.status(201).json({
      success: true,
      data: action,
      message: 'Configuration activation started'
    });
  } catch (error) {
    console.error('Error starting config activation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start configuration activation',
      message: error.message
    });
  }
});

// GET /api/config-actions/:id - Get single action
router.get('/:id', async (req, res) => {
  try {
    const action = await ConfigAction.findById(req.params.id)
      .populate('nap_id', 'name status')
      .populate('related_mappings');
    
    if (!action) {
      return res.status(404).json({
        success: false,
        error: 'Config action not found'
      });
    }

    res.json({
      success: true,
      data: action
    });
  } catch (error) {
    console.error('Error fetching config action:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch config action',
      message: error.message
    });
  }
});

// POST /api/config-actions/:id/retry - Retry failed action
router.post('/:id/retry', async (req, res) => {
  try {
    const action = await ConfigAction.findById(req.params.id);
    
    if (!action) {
      return res.status(404).json({
        success: false,
        error: 'Config action not found'
      });
    }

    if (action.status !== 'failed') {
      return res.status(400).json({
        success: false,
        error: 'Only failed actions can be retried'
      });
    }

    await action.retry();

    const retriedBy = req.body.retried_by || 'system';

    // Log audit event
    await logAuditEvent(
      'Configuration Action Retried',
      { type: 'ConfigAction', id: action._id.toString(), name: `${action.action_type} retry` },
      { username: retriedBy },
      { action: 'retry', method: 'POST', endpoint: `/api/config-actions/${req.params.id}/retry` },
      true
    );

    res.json({
      success: true,
      data: action,
      message: 'Action retry initiated'
    });
  } catch (error) {
    console.error('Error retrying action:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retry action',
      message: error.message
    });
  }
});

// POST /api/config-actions/:id/cancel - Cancel pending/running action
router.post('/:id/cancel', async (req, res) => {
  try {
    const action = await ConfigAction.findById(req.params.id);
    
    if (!action) {
      return res.status(404).json({
        success: false,
        error: 'Config action not found'
      });
    }

    if (!['pending', 'running'].includes(action.status)) {
      return res.status(400).json({
        success: false,
        error: 'Only pending or running actions can be cancelled'
      });
    }

    await action.cancel();

    const cancelledBy = req.body.cancelled_by || 'system';

    // Log audit event
    await logAuditEvent(
      'Configuration Action Cancelled',
      { type: 'ConfigAction', id: action._id.toString(), name: `${action.action_type} cancelled` },
      { username: cancelledBy },
      { action: 'cancel', method: 'POST', endpoint: `/api/config-actions/${req.params.id}/cancel` },
      true
    );

    res.json({
      success: true,
      data: action,
      message: 'Action cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling action:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel action',
      message: error.message
    });
  }
});

export default router;
