/**
 * Dashboard Routes
 * API endpoints for dashboard data and statistics
 */

import express from 'express';
import { NAP, DigitMap, DialFormat, RoutesetMapping, ConfigAction, AuditLog } from '../models/index.js';

const router = express.Router();

// GET /api/dashboard/overview - Get dashboard overview data
router.get('/overview', async (req, res) => {
  try {
    // Get parallel stats for all entities
    const [
      napStats,
      dmStats,
      dfStats,
      mappingStats,
      recentActions,
      recentLogs,
      systemHealth
    ] = await Promise.all([
      NAP.getStatusCounts(),
      DigitMap.getStatusCounts(),
      DialFormat.getStatusCounts(),
      RoutesetMapping.getStatusCounts(),
      ConfigAction.getRecentActivity(10),
      AuditLog.find().sort('-timestamp').limit(10),
      getSystemHealth()
    ]);

    // Calculate totals
    const totalNAPs = Object.values(napStats).reduce((sum, count) => sum + count, 0);
    const totalDMs = Object.values(dmStats).reduce((sum, count) => sum + count, 0);
    const totalDFs = Object.values(dfStats).reduce((sum, count) => sum + count, 0);
    const totalMappings = Object.values(mappingStats).reduce((sum, count) => sum + count, 0);

    // Get unmapped NAPs
    const unmappedNAPs = napStats.created || 0;

    // Get pending activations
    const pendingActions = await ConfigAction.countDocuments({ status: 'pending' });
    const runningActions = await ConfigAction.countDocuments({ status: 'running' });

    const overview = {
      summary_cards: {
        total_naps: totalNAPs,
        active_configurations: napStats.activated || 0,
        unmapped_naps: unmappedNAPs,
        pending_activations: pendingActions + runningActions
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
      recent_activity: {
        actions: recentActions,
        logs: recentLogs
      },
      system_health: systemHealth
    };

    res.json({
      success: true,
      data: overview
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

// Helper function to get system health
async function getSystemHealth() {
  try {
    const [
      totalNAPs,
      totalMappings,
      pendingActions,
      recentErrors
    ] = await Promise.all([
      NAP.countDocuments(),
      RoutesetMapping.countDocuments(),
      ConfigAction.countDocuments({ status: { $in: ['pending', 'running'] } }),
      AuditLog.countDocuments({
        timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        status: false
      })
    ]);
    
    // Calculate health score (0-100)
    let healthScore = 100;
    
    // Deduct points for issues
    if (recentErrors > 10) healthScore -= 20;
    else if (recentErrors > 5) healthScore -= 10;
    
    if (pendingActions > 20) healthScore -= 15;
    else if (pendingActions > 10) healthScore -= 10;
    
    // Determine status
    let status = 'healthy';
    if (healthScore < 50) status = 'critical';
    else if (healthScore < 70) status = 'warning';
    else if (healthScore < 90) status = 'caution';
    
    return {
      status,
      score: healthScore,
      metrics: {
        total_naps: totalNAPs,
        total_mappings: totalMappings,
        pending_actions: pendingActions,
        recent_errors: recentErrors
      },
      last_updated: new Date()
    };
  } catch (error) {
    return {
      status: 'error',
      score: 0,
      error: error.message,
      last_updated: new Date()
    };
  }
}

export default router;
