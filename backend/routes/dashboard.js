/**
 * Dashboard Routes
 * API endpoints for dashboard data and statistics
 */

import express from 'express';
import NAP from '../models/NAP.js';
import DigitMap from '../models/DigitMap.js';
import DialFormat from '../models/DialFormat.js';
import RoutesetMapping from '../models/RoutesetMapping.js';
import ConfigAction from '../models/ConfigAction.js';
import AuditLog from '../models/AuditLog.js';
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
      NAP.count(),
      DigitMap.count(),
      DialFormat.count(),
      RoutesetMapping.count(),
      ConfigAction.count(),
      AuditLog.count(),
      getSystemHealth()
    ]);

    // Get status counts (with fallback if methods don't exist)
    let napStats = {};
    let dmStats = {};
    let dfStats = {};
    let mappingStats = {};

    // Get status counts for NAPs
    const napStatuses = ['activated', 'created', 'deactivated'];
    napStats = {};
    for (const s of napStatuses) {
      napStats[s] = await NAP.count({ where: { status: s } });
    }

    // Get recent activities
    const [recentActions, recentLogs] = await Promise.all([
      ConfigAction.findAll({ order: [['created_at', 'DESC']], limit: 10 }),
      AuditLog.findAll({ order: [['timestamp', 'DESC']], limit: 10 })
    ]);

    // Get pending and running actions
    const pendingActions = await ConfigAction.count({ where: { status: 'pending' } });
    const runningActions = await ConfigAction.count({ where: { status: 'running' } });

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
    const startTime = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);
    let dateFormat = '%Y-%m-%d %H:00:00';
    if (granularity === 'day') dateFormat = '%Y-%m-%d';
    const [results] = await AuditLog.sequelize.query(
      `SELECT DATE_FORMAT(timestamp, :dateFormat) as period, COUNT(*) as count
       FROM audit_logs
       WHERE timestamp >= :startTime
       GROUP BY period
       ORDER BY period ASC`,
      {
        replacements: { dateFormat, startTime },
        type: AuditLog.sequelize.QueryTypes.SELECT
      }
    );
    res.json({
      success: true,
      data: results
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
    const startDate = new Date(Date.now() - parseInt(timeRange) * 24 * 60 * 60 * 1000);
    const [results] = await ConfigAction.sequelize.query(
      `SELECT action_type, status, COUNT(*) as count, AVG(execution_time) as avg_duration, SUM(execution_time) as total_duration
       FROM config_actions
       WHERE executed_at >= :startDate
       GROUP BY action_type, status`,
      {
        replacements: { startDate },
        type: ConfigAction.sequelize.QueryTypes.SELECT
      }
    );
    const chartData = {};
    results.forEach(stat => {
      const key = `${stat.action_type}_${stat.status}`;
      chartData[key] = {
        count: stat.count,
        avg_duration: stat.avg_duration,
        total_duration: stat.total_duration
      };
    });
    res.json({
      success: true,
      data: {
        raw_stats: results,
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
    const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);
    const [results] = await AuditLog.sequelize.query(
      `SELECT JSON_UNQUOTE(JSON_EXTRACT(user_info, '$.username')) as username,
              COUNT(*) as activity_count,
              MAX(timestamp) as last_activity
       FROM audit_logs
       WHERE timestamp >= :startDate
       GROUP BY username
       ORDER BY activity_count DESC
       LIMIT :limit`,
      {
        replacements: { startDate, limit: parseInt(limit) },
        type: AuditLog.sequelize.QueryTypes.SELECT
      }
    );
    res.json({
      success: true,
      data: results
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
    const startTime = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);
    const [results] = await AuditLog.sequelize.query(
      `SELECT event_category as category, severity, COUNT(*) as count, MAX(timestamp) as latest_error
       FROM audit_logs
       WHERE timestamp >= :startTime
         AND (status = 0 OR severity IN ('error', 'critical'))
       GROUP BY event_category, severity
       ORDER BY count DESC`,
      {
        replacements: { startTime },
        type: AuditLog.sequelize.QueryTypes.SELECT
      }
    );
    res.json({
      success: true,
      data: results
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
    const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);
    const [dmTrends] = await DigitMap.sequelize.query(
      `SELECT DATE_FORMAT(uploaded_at, '%Y-%m-%d') as date, COUNT(*) as dm_count, SUM(file_size) as total_size
       FROM digit_maps
       WHERE uploaded_at >= :startDate
       GROUP BY date
       ORDER BY date ASC`,
      {
        replacements: { startDate },
        type: DigitMap.sequelize.QueryTypes.SELECT
      }
    );
    const [dfTrends] = await DialFormat.sequelize.query(
      `SELECT DATE_FORMAT(uploaded_at, '%Y-%m-%d') as date, COUNT(*) as df_count, SUM(file_size) as total_size
       FROM dial_formats
       WHERE uploaded_at >= :startDate
       GROUP BY date
       ORDER BY date ASC`,
      {
        replacements: { startDate },
        type: DialFormat.sequelize.QueryTypes.SELECT
      }
    );
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

    // Build where clause for Sequelize
    const where = {};
    if (category) where.event_category = category;
    if (severity) where.severity = severity;
    if (user) where[AuditLog.sequelize.literal("JSON_UNQUOTE(JSON_EXTRACT(user_info, '$.username'))")] = user;
    if (start_date || end_date) {
      where.timestamp = {};
      if (start_date) where.timestamp[AuditLog.sequelize.Op.gte] = new Date(start_date);
      if (end_date) where.timestamp[AuditLog.sequelize.Op.lte] = new Date(end_date);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count: total, rows: logs } = await AuditLog.findAndCountAll({
      where,
      order: [['timestamp', 'DESC']],
      offset,
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: logs.map(log => ({
        id: log.id,
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

    // Determine sort order
    let order = [['uploaded_at', 'DESC']];
    if (sort && sort !== '-uploaded_at') {
      const direction = sort.startsWith('-') ? 'DESC' : 'ASC';
      const field = sort.replace('-', '');
      order = [[field, direction]];
    }

    // Build where clause for both models
    const uploadSources = ['prosbc_fetch', 'manual_import'];
    const searchFilter = search
      ? {
          [DigitMap.sequelize.Op.or]: [
            { filename: { [DigitMap.sequelize.Op.like]: `%${search}%` } },
            { original_filename: { [DigitMap.sequelize.Op.like]: `%${search}%` } }
          ]
        }
      : {};

    let results = [];
    let total = 0;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const perTypeLimit = fileType ? parseInt(limit) : Math.floor(parseInt(limit) / 2);
    const perTypeOffset = fileType ? offset : Math.floor(offset / 2);

    if (!fileType || fileType === 'dm') {
      const { rows: digitMaps, count: dmCount } = await DigitMap.findAndCountAll({
        where: {
          ...searchFilter,
          metadata: { ...DigitMap.sequelize.where(DigitMap.sequelize.json('metadata.upload_source'), 'IN', uploadSources) }
        },
        order,
        limit: perTypeLimit,
        offset: perTypeOffset
      });
      results = [...results, ...digitMaps.map(dm => ({ ...dm.toJSON(), fileType: 'dm' }))];
      total += dmCount;
    }
    if (!fileType || fileType === 'df') {
      const { rows: dialFormats, count: dfCount } = await DialFormat.findAndCountAll({
        where: {
          ...searchFilter,
          metadata: { ...DialFormat.sequelize.where(DialFormat.sequelize.json('metadata.upload_source'), 'IN', uploadSources) }
        },
        order,
        limit: perTypeLimit,
        offset: perTypeOffset
      });
      results = [...results, ...dialFormats.map(df => ({ ...df.toJSON(), fileType: 'df' }))];
      total += dfCount;
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
      file = await DigitMap.findByPk(id);
    } else if (fileType === 'df') {
      file = await DialFormat.findByPk(id);
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
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${file.original_filename || file.filename}"`);
    res.send(file.content);
    // Optionally: log download event using a custom method or just skip if not implemented
    // await AuditLog.create({ ... });
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
    // SQL version: just use count()
    const [dmCount, dfCount, napCount, auditCount, mappingCount, configCount] = await Promise.all([
      DigitMap.count(),
      DialFormat.count(),
      NAP.count(),
      AuditLog.count(),
      RoutesetMapping.count(),
      ConfigAction.count()
    ]);
    return {
      total_documents: dmCount + dfCount + napCount + auditCount + mappingCount + configCount,
      collections: {
        digit_maps: dmCount,
        dial_formats: dfCount,
        naps: napCount,
        audit_logs: auditCount,
        routeset_mappings: mappingCount,
        config_actions: configCount
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
  // TODO: Implement error logs query using Sequelize if needed
  return {
    recent_errors: [],
    error_count_24h: 0,
    message: 'Error logs aggregation not implemented for SQL yet.'
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
  // TODO: Implement storage info aggregation using Sequelize if needed
  return {
    total_file_size: 0,
    estimated_db_size: 0,
    files_count: 0,
    message: 'Storage info aggregation not implemented for SQL yet.'
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
  // TODO: Implement detailed file stats aggregation using Sequelize if needed
  return {
    by_status: { digit_maps: [], dial_formats: [] },
    message: 'Detailed file stats aggregation not implemented for SQL yet.'
  };
}

async function getUploadTrends(timeframe) {
  const days = timeframe === '30d' ? 30 : 7;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  // TODO: Implement upload trends aggregation using Sequelize if needed
  return [];
}

async function getErrorTrends(timeframe) {
  const days = timeframe === '30d' ? 30 : 7;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  // TODO: Implement error trends aggregation using Sequelize if needed
  return [];
}

async function getTopUsers() {
  // TODO: Implement top users aggregation using Sequelize if needed
  return [];
}

async function getResponseTimeMetrics() {
  return {
    avg_response_time: 150,
    p95_response_time: 300,
    p99_response_time: 500
  };
}

async function getThroughputMetrics() {
  // TODO: Implement throughput metrics using Sequelize if needed
  return {
    requests_per_hour: 0,
    requests_per_minute: 0,
    message: 'Throughput metrics not implemented for SQL yet.'
  };
}

async function getErrorRateMetrics() {
  // TODO: Implement error rate metrics using Sequelize if needed
  return {
    error_rate: 0,
    total_requests_24h: 0,
    error_requests_24h: 0,
    message: 'Error rate metrics not implemented for SQL yet.'
  };
}

async function getSystemHealth() {
  try {
    // Test database connectivity
    // SQL version: just try a count()
    await NAP.count();

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
