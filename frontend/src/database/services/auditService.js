/**
 * Audit Service
 * Handles audit trails, logging, and change tracking
 */

import FileEditHistory from '../schemas/fileEditHistory.js';
import ActivationLog from '../schemas/activationLogs.js';

class AuditService {
  constructor() {
    this.sessionInfo = this.getSessionInfo();
  }

  getSessionInfo() {
    return {
      session_id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
      ip_address: process.env.CLIENT_IP || 'localhost',
      user_agent: process.env.USER_AGENT || 'ProSBC-Dashboard',
      api_version: process.env.API_VERSION || '1.0.0',
      client_version: process.env.CLIENT_VERSION || '1.0.0'
    };
  }

  async logFileEdit(fileId, editor, editType, editData) {
    try {
      const history = new FileEditHistory({
        file_id: fileId,
        editor: editor,
        edit_type: editType,
        changes_summary: editData.changes_summary || `File ${editType}`,
        detailed_changes: this.analyzeDetailedChanges(editData),
        csv_backup: editData.csv_backup || '',
        json_table_format: editData.json_table_format || {},
        version_info: {
          previous_version: editData.previous_version || 1,
          new_version: editData.new_version || 1,
          is_major_change: this.isMajorChange(editData)
        },
        session_info: {
          ...this.sessionInfo,
          edit_duration: editData.edit_duration || 0
        },
        rollback_info: {
          can_rollback: editData.can_rollback !== false,
          rollback_dependencies: editData.rollback_dependencies || [],
          rollback_warnings: editData.rollback_warnings || []
        },
        file_state_before: editData.file_state_before || {},
        file_state_after: editData.file_state_after || {}
      });

      const savedHistory = await history.save();
      console.log(`✅ File edit logged: ${savedHistory.history_id}`);
      
      return { success: true, history: savedHistory };
      
    } catch (error) {
      console.error('❌ Error logging file edit:', error);
      throw new Error(`Failed to log file edit: ${error.message}`);
    }
  }

  async logAction(action, actionData) {
    try {
      const log = new ActivationLog({
        nap_id: actionData.nap_id,
        file_id: actionData.file_id,
        mapping_id: actionData.mapping_id,
        action: action,
        status: actionData.status || 'success',
        status_code: actionData.status_code || 200,
        response_log: {
          request_payload: actionData.request_payload || {},
          response_payload: actionData.response_payload || {},
          headers: actionData.headers || {},
          request_size: JSON.stringify(actionData.request_payload || {}).length,
          response_size: JSON.stringify(actionData.response_payload || {}).length
        },
        timing_info: {
          start_time: actionData.start_time || new Date(),
          end_time: actionData.end_time || new Date(),
          duration_ms: actionData.duration_ms || 0,
          timeout_ms: actionData.timeout_ms || 30000
        },
        error_details: actionData.error_details || {},
        execution_context: {
          executed_by: actionData.executed_by,
          ...this.sessionInfo
        },
        prosbc_info: actionData.prosbc_info || {},
        batch_info: actionData.batch_info || { is_batch_operation: false },
        dependencies: actionData.dependencies || {},
        rollback_info: actionData.rollback_info || { rollback_available: false },
        performance_metrics: actionData.performance_metrics || {},
        tags: actionData.tags || [],
        notes: actionData.notes || ''
      });

      const savedLog = await log.save();
      console.log(`✅ Action logged: ${savedLog.log_id}`);
      
      return { success: true, log: savedLog };
      
    } catch (error) {
      console.error('❌ Error logging action:', error);
      throw new Error(`Failed to log action: ${error.message}`);
    }
  }

  async getFileHistory(fileId, options = {}) {
    try {
      const {
        limit = 50,
        page = 1,
        editType = null,
        editor = null,
        dateFrom = null,
        dateTo = null
      } = options;

      const query = { file_id: fileId };
      
      if (editType) query.edit_type = editType;
      if (editor) query.editor = editor;
      if (dateFrom || dateTo) {
        query.edit_timestamp = {};
        if (dateFrom) query.edit_timestamp.$gte = new Date(dateFrom);
        if (dateTo) query.edit_timestamp.$lte = new Date(dateTo);
      }

      const skip = (page - 1) * limit;
      
      const [history, total] = await Promise.all([
        FileEditHistory.find(query)
          .sort({ edit_timestamp: -1 })
          .skip(skip)
          .limit(limit),
        FileEditHistory.countDocuments(query)
      ]);

      return {
        success: true,
        history,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
      
    } catch (error) {
      console.error('❌ Error getting file history:', error);
      throw new Error(`Failed to get file history: ${error.message}`);
    }
  }

  async getUserActivity(userId, options = {}) {
    try {
      const {
        limit = 100,
        page = 1,
        dateFrom = null,
        dateTo = null,
        includeFileEdits = true,
        includeActivations = true
      } = options;

      const results = {};

      if (includeFileEdits) {
        const fileEditQuery = { editor: userId };
        if (dateFrom || dateTo) {
          fileEditQuery.edit_timestamp = {};
          if (dateFrom) fileEditQuery.edit_timestamp.$gte = new Date(dateFrom);
          if (dateTo) fileEditQuery.edit_timestamp.$lte = new Date(dateTo);
        }

        results.file_edits = await FileEditHistory.find(fileEditQuery)
          .sort({ edit_timestamp: -1 })
          .limit(limit);
      }

      if (includeActivations) {
        const activationQuery = { 'execution_context.executed_by': userId };
        if (dateFrom || dateTo) {
          activationQuery['timing_info.start_time'] = {};
          if (dateFrom) activationQuery['timing_info.start_time'].$gte = new Date(dateFrom);
          if (dateTo) activationQuery['timing_info.start_time'].$lte = new Date(dateTo);
        }

        results.activations = await ActivationLog.find(activationQuery)
          .sort({ 'timing_info.start_time': -1 })
          .limit(limit);
      }

      return { success: true, activity: results };
      
    } catch (error) {
      console.error('❌ Error getting user activity:', error);
      throw new Error(`Failed to get user activity: ${error.message}`);
    }
  }

  async getAuditTrail(options = {}) {
    try {
      const {
        limit = 100,
        page = 1,
        entityType = null, // 'file', 'nap', 'mapping'
        entityId = null,
        action = null,
        status = null,
        dateFrom = null,
        dateTo = null
      } = options;

      const query = {};
      
      if (entityType && entityId) {
        switch (entityType) {
          case 'file':
            query.file_id = entityId;
            break;
          case 'nap':
            query.nap_id = entityId;
            break;
          case 'mapping':
            query.mapping_id = entityId;
            break;
        }
      }
      
      if (action) query.action = action;
      if (status) query.status = status;
      if (dateFrom || dateTo) {
        query['timing_info.start_time'] = {};
        if (dateFrom) query['timing_info.start_time'].$gte = new Date(dateFrom);
        if (dateTo) query['timing_info.start_time'].$lte = new Date(dateTo);
      }

      const skip = (page - 1) * limit;
      
      const [logs, total] = await Promise.all([
        ActivationLog.find(query)
          .sort({ 'timing_info.start_time': -1 })
          .skip(skip)
          .limit(limit),
        ActivationLog.countDocuments(query)
      ]);

      return {
        success: true,
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
      
    } catch (error) {
      console.error('❌ Error getting audit trail:', error);
      throw new Error(`Failed to get audit trail: ${error.message}`);
    }
  }

  async createRollbackPoint(fileId, editor, reason = 'Manual rollback point') {
    try {
      // This would typically be called before making changes
      const rollbackData = {
        file_id: fileId,
        editor: editor,
        edit_type: 'create_rollback_point',
        changes_summary: reason,
        rollback_info: {
          can_rollback: true,
          rollback_dependencies: [],
          rollback_warnings: []
        }
      };

      return await this.logFileEdit(fileId, editor, 'create_rollback_point', rollbackData);
      
    } catch (error) {
      console.error('❌ Error creating rollback point:', error);
      throw new Error(`Failed to create rollback point: ${error.message}`);
    }
  }

  async getRollbackCandidates(fileId) {
    try {
      const candidates = await FileEditHistory.find({
        file_id: fileId,
        'rollback_info.can_rollback': true
      })
      .sort({ edit_timestamp: -1 })
      .limit(20);

      return { success: true, candidates };
      
    } catch (error) {
      console.error('❌ Error getting rollback candidates:', error);
      throw new Error(`Failed to get rollback candidates: ${error.message}`);
    }
  }

  async executeRollback(historyId, rollbackBy, reason) {
    try {
      const history = await FileEditHistory.findOne({ history_id: historyId });
      
      if (!history) {
        throw new Error(`History record not found: ${historyId}`);
      }

      if (!history.rollback_info.can_rollback) {
        throw new Error('Rollback not available for this history record');
      }

      // Create new file edit entry for the rollback
      const rollbackData = {
        file_id: history.file_id,
        editor: rollbackBy,
        edit_type: 'restore',
        changes_summary: `Rollback to version ${history.version_info.new_version}: ${reason}`,
        csv_backup: history.csv_backup,
        json_table_format: history.json_table_format,
        rollback_info: {
          can_rollback: true,
          rollback_dependencies: [],
          rollback_warnings: [`Rolled back from history: ${historyId}`]
        }
      };

      const rollbackHistory = await this.logFileEdit(
        history.file_id, 
        rollbackBy, 
        'restore', 
        rollbackData
      );

      // Log the rollback action
      await this.logAction('rollback_file', {
        file_id: history.file_id,
        executed_by: rollbackBy,
        details: {
          source_history_id: historyId,
          target_version: history.version_info.new_version,
          reason: reason
        }
      });

      return {
        success: true,
        rollback_history: rollbackHistory.history,
        rollback_data: {
          csv_content: history.csv_backup,
          json_structure: history.json_table_format
        }
      };
      
    } catch (error) {
      console.error('❌ Error executing rollback:', error);
      throw new Error(`Failed to execute rollback: ${error.message}`);
    }
  }

  // ========== ANALYSIS METHODS ==========

  analyzeDetailedChanges(editData) {
    const changes = {
      rows_added: 0,
      rows_modified: 0,
      rows_deleted: 0,
      columns_added: [],
      columns_removed: [],
      columns_renamed: [],
      cell_changes: []
    };

    // This would contain actual diff analysis logic
    // For now, return basic structure
    if (editData.detailed_changes) {
      return { ...changes, ...editData.detailed_changes };
    }

    return changes;
  }

  isMajorChange(editData) {
    const changes = editData.detailed_changes || {};
    
    // Consider it a major change if:
    // - More than 100 rows affected
    // - Columns added/removed
    // - More than 50% of data changed
    
    const totalRowChanges = (changes.rows_added || 0) + 
                           (changes.rows_modified || 0) + 
                           (changes.rows_deleted || 0);
    
    return totalRowChanges > 100 || 
           (changes.columns_added && changes.columns_added.length > 0) ||
           (changes.columns_removed && changes.columns_removed.length > 0);
  }

  getChanges(before, after) {
    const changes = {};
    
    // Simple change detection
    Object.keys(after).forEach(key => {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changes[key] = {
          before: before[key],
          after: after[key]
        };
      }
    });

    return changes;
  }

  async getActivityStats(userId, days = 7) {
    try {
      const dateFrom = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

      const [fileEditStats, activationStats] = await Promise.all([
        FileEditHistory.aggregate([
          {
            $match: {
              editor: userId,
              edit_timestamp: { $gte: dateFrom }
            }
          },
          {
            $group: {
              _id: '$edit_type',
              count: { $sum: 1 }
            }
          }
        ]),
        ActivationLog.aggregate([
          {
            $match: {
              'execution_context.executed_by': userId,
              'timing_info.start_time': { $gte: dateFrom }
            }
          },
          {
            $group: {
              _id: {
                action: '$action',
                status: '$status'
              },
              count: { $sum: 1 },
              avg_duration: { $avg: '$timing_info.duration_ms' }
            }
          }
        ])
      ]);

      return {
        success: true,
        stats: {
          period: `${days} days`,
          file_edits: fileEditStats,
          activations: activationStats
        }
      };
      
    } catch (error) {
      console.error('❌ Error getting activity stats:', error);
      throw new Error(`Failed to get activity stats: ${error.message}`);
    }
  }

  async getSystemHealthMetrics() {
    try {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const [recentErrors, recentActivity, performanceMetrics] = await Promise.all([
        ActivationLog.countDocuments({
          status: 'failed',
          'timing_info.start_time': { $gte: oneDayAgo }
        }),
        ActivationLog.countDocuments({
          'timing_info.start_time': { $gte: oneHourAgo }
        }),
        ActivationLog.aggregate([
          {
            $match: {
              'timing_info.start_time': { $gte: oneDayAgo },
              'timing_info.duration_ms': { $exists: true }
            }
          },
          {
            $group: {
              _id: null,
              avg_duration: { $avg: '$timing_info.duration_ms' },
              max_duration: { $max: '$timing_info.duration_ms' },
              min_duration: { $min: '$timing_info.duration_ms' },
              total_operations: { $sum: 1 }
            }
          }
        ])
      ]);

      return {
        success: true,
        metrics: {
          recent_errors: recentErrors,
          recent_activity: recentActivity,
          performance: performanceMetrics[0] || {},
          timestamp: now
        }
      };
      
    } catch (error) {
      console.error('❌ Error getting system health metrics:', error);
      throw new Error(`Failed to get system health metrics: ${error.message}`);
    }
  }
}

export default AuditService;
