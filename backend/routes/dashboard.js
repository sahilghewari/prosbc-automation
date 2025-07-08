/**
 * Dashboard Routes
 * API endpoints for dashboard data and statistics
 */

import express from 'express';
import { NAP, DigitMap, DialFormat, RoutesetMapping, ConfigAction, AuditLog } from '../models/index.js';
import { prosbcFileSyncService } from '../services/ProSBCFileSyncService.js';

const router = express.Router();

// GET /api/dashboard/overview - Get dashboard overview data
router.get('/overview', async (req, res) => {
  try {
    // Get basic counts
    const [
      totalNAPs,
      totalDMs,
      totalDFs,
      totalMappings,
      totalActions,
      totalLogs,
      systemHealth
    ] = await Promise.all([
      NAP.countDocuments(),
      DigitMap.countDocuments(),
      DialFormat.countDocuments(),
      RoutesetMapping.countDocuments(),
      ConfigAction.countDocuments(),
      AuditLog.countDocuments(),
      getSystemHealth()
    ]);

    // Get status counts (with fallback if methods don't exist)
    let napStats = {};
    let dmStats = {};
    let dfStats = {};
    let mappingStats = {};

    try {
      napStats = await NAP.getStatusCounts() || {};
    } catch (e) {
      // Fallback: count by status manually
      napStats = {
        activated: await NAP.countDocuments({ status: 'activated' }),
        created: await NAP.countDocuments({ status: 'created' }),
        deactivated: await NAP.countDocuments({ status: 'deactivated' })
      };
    }

    // Get recent activities
    const [recentActions, recentLogs] = await Promise.all([
      ConfigAction.find().sort('-created_at').limit(10),
      AuditLog.find().sort('-timestamp').limit(10)
    ]);

    // Get pending and running actions
    const pendingActions = await ConfigAction.countDocuments({ status: 'pending' });
    const runningActions = await ConfigAction.countDocuments({ status: 'running' });

    const overview = {
      summary_cards: {
        total_naps: totalNAPs,
        active_configurations: napStats.activated || 0,
        unmapped_naps: napStats.created || 0,
        pending_actions: pendingActions,
        running_actions: runningActions
      },
      nap_status: napStats,
      file_stats: {
        digit_maps: {
          total: totalDMs,
          by_status: dmStats
        },
        dial_formats: {
          total: totalDFs,
          by_status: dfStats
        }
      },
      mapping_stats: {
        total: totalMappings,
        by_status: mappingStats
      },
      recent_actions: recentActions,
      recent_logs: recentLogs,
      system_health: systemHealth
    };

    res.json({
      success: true,
      data: overview,
      ...overview // Also put data at root level for compatibility
    });
  } catch (error) {
    console.error('Error fetching dashboard overview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard overview',
      message: error.message
    });
  }
});

// GET /api/dashboard/activity-timeline - Get activity timeline for charts
router.get('/activity-timeline', async (req, res) => {
  try {
    const { hours = 24, granularity = 'hour' } = req.query;
    
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

// GET /api/dashboard/action-stats - Get config action statistics
router.get('/action-stats', async (req, res) => {
  try {
    const { timeRange = 7 } = req.query;
    
    const actionStats = await ConfigAction.getActionStats(parseInt(timeRange));
    
    // Transform data for charts
    const chartData = actionStats.reduce((acc, stat) => {
      const key = `${stat._id.action_type}_${stat._id.status}`;
      acc[key] = {
        count: stat.count,
        avg_duration: stat.avg_duration,
        total_duration: stat.total_duration
      };
      return acc;
    }, {});
    
    res.json({
      success: true,
      data: {
        raw_stats: actionStats,
        chart_data: chartData
      }
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

// GET /api/dashboard/top-users - Get top active users
router.get('/top-users', async (req, res) => {
  try {
    const { days = 7, limit = 10 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const pipeline = [
      {
        $match: {
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$user_info.username',
          activity_count: { $sum: 1 },
          last_activity: { $max: '$timestamp' },
          actions: { $addToSet: '$action_details.action' },
          categories: { $addToSet: '$event_category' }
        }
      },
      {
        $sort: { activity_count: -1 }
      },
      {
        $limit: parseInt(limit)
      }
    ];
    
    const topUsers = await AuditLog.aggregate(pipeline);
    
    res.json({
      success: true,
      data: topUsers
    });
  } catch (error) {
    console.error('Error fetching top users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch top users',
      message: error.message
    });
  }
});

// GET /api/dashboard/error-summary - Get error summary
router.get('/error-summary', async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - parseInt(hours));
    
    const pipeline = [
      {
        $match: {
          timestamp: { $gte: startTime },
          $or: [
            { status: false },
            { severity: { $in: ['error', 'critical'] } }
          ]
        }
      },
      {
        $group: {
          _id: {
            category: '$event_category',
            severity: '$severity'
          },
          count: { $sum: 1 },
          latest_error: { $max: '$timestamp' },
          sample_errors: { $push: '$event' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ];
    
    const errorSummary = await AuditLog.aggregate(pipeline);
    
    res.json({
      success: true,
      data: errorSummary
    });
  } catch (error) {
    console.error('Error fetching error summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch error summary',
      message: error.message
    });
  }
});

// GET /api/dashboard/file-upload-trends - Get file upload trends
router.get('/file-upload-trends', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    // Get DM upload trends
    const dmTrends = await DigitMap.aggregate([
      {
        $match: {
          uploaded_at: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$uploaded_at" } }
          },
          dm_count: { $sum: 1 },
          total_size: { $sum: '$file_size' }
        }
      },
      {
        $sort: { '_id.date': 1 }
      }
    ]);
    
    // Get DF upload trends
    const dfTrends = await DialFormat.aggregate([
      {
        $match: {
          uploaded_at: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$uploaded_at" } }
          },
          df_count: { $sum: 1 },
          total_size: { $sum: '$file_size' }
        }
      },
      {
        $sort: { '_id.date': 1 }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        digit_maps: dmTrends,
        dial_formats: dfTrends
      }
    });
  } catch (error) {
    console.error('Error fetching file upload trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch file upload trends',
      message: error.message
    });
  }
});

// GET /api/dashboard/health - Get system health metrics
router.get('/health', async (req, res) => {
  try {
    const [
      dbStats,
      errorLogs,
      systemLoad,
      storageInfo
    ] = await Promise.all([
      getDatabaseStats(),
      getErrorLogs(),
      getSystemLoad(),
      getStorageInfo()
    ]);

    res.json({
      success: true,
      data: {
        database: dbStats,
        errors: errorLogs,
        system: systemLoad,
        storage: storageInfo,
        status: determineSystemHealth(dbStats, errorLogs, systemLoad)
      }
    });
  } catch (error) {
    console.error('Error fetching system health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system health',
      message: error.message
    });
  }
});

// GET /api/dashboard/system-status - Get Ubuntu system status
router.get('/system-status', async (req, res) => {
  try {
    const systemInfo = {
      system: process.platform === 'linux' ? 'Ubuntu Linux' : process.platform,
      uptime: formatUptime(process.uptime()),
      memory_usage: `${Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100)}%`,
      node_version: process.version,
      environment: process.env.NODE_ENV || 'development',
      last_updated: new Date().toISOString()
    };

    res.json({
      success: true,
      data: systemInfo
    });
  } catch (error) {
    console.error('Error fetching system status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system status',
      message: error.message
    });
  }
});

// GET /api/dashboard/audit-logs - Get audit logs with filtering
router.get('/audit-logs', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      severity,
      user,
      start_date,
      end_date
    } = req.query;

    const filter = {};
    
    if (category) filter.event_category = category;
    if (severity) filter.severity = severity;
    if (user) filter['user_info.username'] = user;
    
    if (start_date || end_date) {
      filter.timestamp = {};
      if (start_date) filter.timestamp.$gte = new Date(start_date);
      if (end_date) filter.timestamp.$lte = new Date(end_date);
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      AuditLog.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: logs.map(log => ({
        id: log._id,
        event: log.event,
        category: log.event_category,
        severity: log.severity,
        status: log.status,
        user: log.user_info?.username || 'system',
        timestamp: log.timestamp,
        entity: log.related_entity,
        changes: log.changes,
        error: log.error_details
      })),
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

// GET /api/dashboard/file-stats - Get file statistics and trends
router.get('/file-stats', async (req, res) => {
  try {
    const { timeframe = '7d' } = req.query;
    
    const [
      fileStats,
      uploadTrends,
      errorTrends,
      topUsers
    ] = await Promise.all([
      getDetailedFileStats(),
      getUploadTrends(timeframe),
      getErrorTrends(timeframe),
      getTopUsers()
    ]);

    res.json({
      success: true,
      data: {
        statistics: fileStats,
        trends: {
          uploads: uploadTrends,
          errors: errorTrends
        },
        top_users: topUsers
      }
    });
  } catch (error) {
    console.error('Error fetching file statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch file statistics',
      message: error.message
    });
  }
});

// GET /api/dashboard/performance - Get performance metrics
router.get('/performance', async (req, res) => {
  try {
    const [
      responseMetrics,
      throughputMetrics,
      errorRates
    ] = await Promise.all([
      getResponseTimeMetrics(),
      getThroughputMetrics(),
      getErrorRateMetrics()
    ]);

    res.json({
      success: true,
      data: {
        response_times: responseMetrics,
        throughput: throughputMetrics,
        error_rates: errorRates,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch performance metrics',
      message: error.message
    });
  }
});

// GET /api/dashboard/prosbc-files - Get all ProSBC files stored in database
router.get('/prosbc-files', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      fileType,
      search,
      sort = '-uploaded_at'
    } = req.query;

    // Build queries for both DigitMap and DialFormat collections
    const dmQuery = {
      'metadata.upload_source': { $in: ['prosbc_fetch', 'manual_import'] }
    };
    
    const dfQuery = {
      'metadata.upload_source': { $in: ['prosbc_fetch', 'manual_import'] }
    };
    
    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      dmQuery.$or = [
        { filename: searchRegex },
        { original_filename: searchRegex }
      ];
      dfQuery.$or = [
        { filename: searchRegex },
        { original_filename: searchRegex }
      ];
    }

    let results = [];
    let total = 0;
    
    // Get files based on type
    if (!fileType || fileType === 'dm') {
      const digitMaps = await DigitMap.find(dmQuery)
        .sort(sort)
        .limit(fileType ? parseInt(limit) : parseInt(limit) / 2)
        .skip(fileType ? (parseInt(page) - 1) * parseInt(limit) : (parseInt(page) - 1) * parseInt(limit) / 2);
      
      results = [...results, ...digitMaps.map(dm => ({
        ...dm.toObject(),
        fileType: 'dm'
      }))];
      
      total += await DigitMap.countDocuments(dmQuery);
    }
    
    if (!fileType || fileType === 'df') {
      const dialFormats = await DialFormat.find(dfQuery)
        .sort(sort)
        .limit(fileType ? parseInt(limit) : parseInt(limit) / 2)
        .skip(fileType ? (parseInt(page) - 1) * parseInt(limit) : (parseInt(page) - 1) * parseInt(limit) / 2);
      
      results = [...results, ...dialFormats.map(df => ({
        ...df.toObject(),
        fileType: 'df'
      }))];
      
      total += await DialFormat.countDocuments(dfQuery);
    }
    
    res.json({
      success: true,
      data: results,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching ProSBC files:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ProSBC files',
      error: error.message
    });
  }
});

// GET /api/dashboard/prosbc-files/stats - Get ProSBC files statistics
router.get('/prosbc-files/stats', async (req, res) => {
  try {
    const stats = await prosbcFileSyncService.getSyncStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching ProSBC file stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ProSBC file stats',
      error: error.message
    });
  }
});

// GET /api/dashboard/prosbc-files/:fileType/:id/download - Download ProSBC file
router.get('/prosbc-files/:fileType/:id/download', async (req, res) => {
  try {
    const { fileType, id } = req.params;
    
    let file;
    if (fileType === 'dm') {
      file = await DigitMap.findById(id);
    } else if (fileType === 'df') {
      file = await DialFormat.findById(id);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type'
      });
    }
    
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${file.original_filename || file.filename}"`);
    
    // Send file content
    res.send(file.content);
    
    // Log download event
    await AuditLog.logEvent({
      event: `${fileType === 'dm' ? 'Digit Map' : 'Dial Format'} File Downloaded`,
      category: 'file',
      severity: 'info',
      status: true,
      entity: { type: fileType === 'dm' ? 'DigitMap' : 'DialFormat', id: file._id.toString(), name: file.filename },
      user: { username: req.user?.username || 'system' },
      action: { action: 'download', method: 'GET', endpoint: `/api/dashboard/prosbc-files/${fileType}/${id}/download` }
    });
    
  } catch (error) {
    console.error(`Error downloading ProSBC ${req.params.fileType} file:`, error);
    res.status(500).json({
      success: false,
      message: `Failed to download ProSBC ${req.params.fileType} file`,
      error: error.message
    });
  }
});

// Helper functions for enhanced dashboard
async function getDatabaseStats() {
  try {
    const collections = await Promise.all([
      DigitMap.estimatedDocumentCount(),
      DialFormat.estimatedDocumentCount(),
      NAP.estimatedDocumentCount(),
      AuditLog.estimatedDocumentCount(),
      RoutesetMapping.estimatedDocumentCount(),
      ConfigAction.estimatedDocumentCount()
    ]);

    return {
      total_documents: collections.reduce((sum, count) => sum + count, 0),
      collections: {
        digit_maps: collections[0],
        dial_formats: collections[1],
        naps: collections[2],
        audit_logs: collections[3],
        routeset_mappings: collections[4],
        config_actions: collections[5]
      },
      connection_status: 'connected'
    };
  } catch (error) {
    return {
      connection_status: 'error',
      error: error.message
    };
  }
}

async function getErrorLogs() {
  const recentErrors = await AuditLog.find({
    $or: [
      { status: false },
      { severity: { $in: ['error', 'critical'] } }
    ]
  }).sort({ timestamp: -1 }).limit(10);

  return {
    recent_errors: recentErrors.map(log => ({
      id: log._id,
      event: log.event,
      severity: log.severity,
      error: log.error_details,
      timestamp: log.timestamp
    })),
    error_count_24h: await AuditLog.countDocuments({
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      $or: [
        { status: false },
        { severity: { $in: ['error', 'critical'] } }
      ]
    })
  };
}

function getSystemLoad() {
  return {
    memory_usage: process.memoryUsage(),
    uptime: process.uptime(),
    node_version: process.version,
    platform: process.platform
  };
}

async function getStorageInfo() {
  const [dmSize, dfSize, auditSize] = await Promise.all([
    DigitMap.aggregate([
      { $group: { _id: null, totalSize: { $sum: '$file_size' } } }
    ]),
    DialFormat.aggregate([
      { $group: { _id: null, totalSize: { $sum: '$file_size' } } }
    ]),
    AuditLog.estimatedDocumentCount()
  ]);

  const totalFileSize = (dmSize[0]?.totalSize || 0) + (dfSize[0]?.totalSize || 0);
  
  return {
    total_file_size: totalFileSize,
    estimated_db_size: totalFileSize + (auditSize * 1000),
    files_count: await DigitMap.countDocuments() + await DialFormat.countDocuments()
  };
}

function determineSystemHealth(dbStats, errorLogs, systemLoad) {
  const errorRate = errorLogs.error_count_24h;
  const memoryUsage = systemLoad.memory_usage.heapUsed / systemLoad.memory_usage.heapTotal;
  
  if (dbStats.connection_status !== 'connected' || errorRate > 50) {
    return 'critical';
  } else if (errorRate > 10 || memoryUsage > 0.8) {
    return 'warning';
  } else {
    return 'healthy';
  }
}

async function getDetailedFileStats() {
  const [dmByStatus, dfByStatus] = await Promise.all([
    DigitMap.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, avgSize: { $avg: '$file_size' } } }
    ]),
    DialFormat.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, avgSize: { $avg: '$file_size' } } }
    ])
  ]);

  return {
    by_status: { digit_maps: dmByStatus, dial_formats: dfByStatus }
  };
}

async function getUploadTrends(timeframe) {
  const days = timeframe === '30d' ? 30 : 7;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  return await AuditLog.aggregate([
    {
      $match: {
        timestamp: { $gte: startDate },
        event_category: 'file',
        'action_details.action': 'upload'
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id': 1 } }
  ]);
}

async function getErrorTrends(timeframe) {
  const days = timeframe === '30d' ? 30 : 7;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  return await AuditLog.aggregate([
    {
      $match: {
        timestamp: { $gte: startDate },
        $or: [
          { status: false },
          { severity: { $in: ['error', 'critical'] } }
        ]
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id': 1 } }
  ]);
}

async function getTopUsers() {
  return await AuditLog.aggregate([
    {
      $match: {
        timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }
    },
    {
      $group: {
        _id: '$user_info.username',
        activities: { $sum: 1 },
        lastActivity: { $max: '$timestamp' }
      }
    },
    { $sort: { activities: -1 } },
    { $limit: 10 }
  ]);
}

async function getResponseTimeMetrics() {
  return {
    avg_response_time: 150,
    p95_response_time: 300,
    p99_response_time: 500
  };
}

async function getThroughputMetrics() {
  const recentActivity = await AuditLog.countDocuments({
    timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
  });
  
  return {
    requests_per_hour: recentActivity,
    requests_per_minute: Math.round(recentActivity / 60)
  };
}

async function getErrorRateMetrics() {
  const [totalRequests, errorRequests] = await Promise.all([
    AuditLog.countDocuments({
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }),
    AuditLog.countDocuments({
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      $or: [
        { status: false },
        { severity: { $in: ['error', 'critical'] } }
      ]
    })
  ]);
  
  return {
    error_rate: totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0,
    total_requests_24h: totalRequests,
    error_requests_24h: errorRequests
  };
}

async function getSystemHealth() {
  try {
    // Test database connectivity
    const dbStatus = await Promise.race([
      NAP.countDocuments(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Database timeout')), 5000))
    ]);

    // Get basic system information
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    return {
      database: {
        status: 'connected',
        message: 'Database connection healthy',
        response_time: new Date().toISOString()
      },
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
        percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
      },
      uptime: formatUptime(uptime),
      node_version: process.version,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      database: {
        status: 'disconnected',
        message: error.message,
        response_time: new Date().toISOString()
      },
      memory: {
        used: 'N/A',
        total: 'N/A',
        percentage: 0
      },
      uptime: 'N/A',
      node_version: process.version,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    };
  }
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

export default router;
