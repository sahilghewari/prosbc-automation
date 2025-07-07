/**
 * Activation Logs Schema
 * Stores all push/update attempts to ProSBC with detailed logging
 */

import mongoose from 'mongoose';

const activationLogSchema = new mongoose.Schema({
  log_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  nap_id: {
    type: String,
    ref: 'NapRecord',
    index: true
  },
  file_id: {
    type: String,
    ref: 'UploadedFile',
    index: true
  },
  mapping_id: {
    type: String,
    ref: 'RoutesetMapping',
    index: true
  },
  action: {
    type: String,
    enum: [
      'create_nap', 'update_nap', 'delete_nap', 'activate_nap', 'deactivate_nap',
      'upload_file', 'update_file', 'delete_file',
      'sync_mapping', 'validate_config', 'bulk_operation',
      'backup_create', 'restore_operation'
    ],
    required: true,
    index: true
  },
  status_code: {
    type: Number,
    index: true
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'pending', 'timeout', 'cancelled', 'partial'],
    required: true,
    index: true
  },
  response_log: {
    request_payload: mongoose.Schema.Types.Mixed,
    response_payload: mongoose.Schema.Types.Mixed,
    headers: mongoose.Schema.Types.Mixed,
    request_size: Number,
    response_size: Number
  },
  timing_info: {
    start_time: { type: Date, default: Date.now },
    end_time: Date,
    duration_ms: Number,
    timeout_ms: Number
  },
  error_details: {
    error_code: String,
    error_message: String,
    error_stack: String,
    prosbc_error_code: String,
    prosbc_error_message: String,
    retry_count: { type: Number, default: 0 },
    is_retryable: { type: Boolean, default: false }
  },
  execution_context: {
    executed_by: { type: String, required: true, index: true },
    session_id: String,
    ip_address: String,
    user_agent: String,
    api_version: String,
    client_version: String
  },
  prosbc_info: {
    prosbc_host: String,
    prosbc_version: String,
    endpoint_used: String,
    authentication_method: String,
    ssl_verification: Boolean
  },
  batch_info: {
    is_batch_operation: { type: Boolean, default: false },
    batch_id: String,
    batch_sequence: Number,
    total_batch_items: Number,
    batch_status: String
  },
  dependencies: {
    dependent_files: [String],
    dependent_naps: [String],
    dependent_mappings: [String],
    prerequisite_actions: [String]
  },
  rollback_info: {
    rollback_available: { type: Boolean, default: false },
    rollback_data: mongoose.Schema.Types.Mixed,
    rollback_executed: { type: Boolean, default: false },
    rollback_timestamp: Date,
    rollback_reason: String
  },
  performance_metrics: {
    cpu_usage: Number,
    memory_usage: Number,
    network_latency: Number,
    disk_io: Number,
    concurrent_operations: Number
  },
  tags: [{
    type: String,
    enum: ['production', 'test', 'development', 'emergency', 'scheduled', 'manual', 'automated']
  }],
  notes: {
    type: String,
    maxlength: 2000
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'activation_logs'
});

// Compound indexes for performance
activationLogSchema.index({ action: 1, status: 1, 'timing_info.start_time': -1 });
activationLogSchema.index({ 'execution_context.executed_by': 1, 'timing_info.start_time': -1 });
activationLogSchema.index({ nap_id: 1, 'timing_info.start_time': -1 });
activationLogSchema.index({ file_id: 1, action: 1 });
activationLogSchema.index({ status: 1, 'timing_info.start_time': -1 });
activationLogSchema.index({ 'batch_info.batch_id': 1, 'batch_info.batch_sequence': 1 });

// Virtual for formatted duration
activationLogSchema.virtual('formatted_duration').get(function() {
  if (!this.timing_info.duration_ms) return 'N/A';
  
  const ms = this.timing_info.duration_ms;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
});

// Virtual for success rate (for batch operations)
activationLogSchema.virtual('success_rate').get(function() {
  if (!this.batch_info.is_batch_operation) return null;
  
  // This would need to be calculated based on related logs
  // For now, return null as placeholder
  return null;
});

// Method to mark as completed
activationLogSchema.methods.markCompleted = function(status, responseData) {
  this.status = status;
  this.timing_info.end_time = new Date();
  this.timing_info.duration_ms = this.timing_info.end_time - this.timing_info.start_time;
  
  if (responseData) {
    this.response_log.response_payload = responseData.response;
    this.response_log.headers = responseData.headers;
    this.response_log.response_size = JSON.stringify(responseData.response || {}).length;
    this.status_code = responseData.statusCode;
  }
  
  return this.save();
};

// Method to mark as failed with error
activationLogSchema.methods.markFailed = function(error, isRetryable = false) {
  this.status = 'failed';
  this.timing_info.end_time = new Date();
  this.timing_info.duration_ms = this.timing_info.end_time - this.timing_info.start_time;
  
  this.error_details = {
    error_code: error.code,
    error_message: error.message,
    error_stack: error.stack,
    prosbc_error_code: error.prosbc_code,
    prosbc_error_message: error.prosbc_message,
    retry_count: this.error_details.retry_count + 1,
    is_retryable: isRetryable
  };
  
  return this.save();
};

// Method to create rollback data
activationLogSchema.methods.createRollbackData = function(rollbackData) {
  this.rollback_info = {
    rollback_available: true,
    rollback_data: rollbackData,
    rollback_executed: false
  };
  
  return this.save();
};

// Method to execute rollback
activationLogSchema.methods.executeRollback = function(reason) {
  this.rollback_info.rollback_executed = true;
  this.rollback_info.rollback_timestamp = new Date();
  this.rollback_info.rollback_reason = reason;
  
  return this.save();
};

// Static method to get logs by action
activationLogSchema.statics.getByAction = function(action, limit = 100) {
  return this.find({ action })
    .sort({ 'timing_info.start_time': -1 })
    .limit(limit);
};

// Static method to get failed operations
activationLogSchema.statics.getFailedOperations = function(dateFrom, dateTo) {
  const query = { status: 'failed' };
  
  if (dateFrom || dateTo) {
    query['timing_info.start_time'] = {};
    if (dateFrom) query['timing_info.start_time'].$gte = new Date(dateFrom);
    if (dateTo) query['timing_info.start_time'].$lte = new Date(dateTo);
  }
  
  return this.find(query).sort({ 'timing_info.start_time': -1 });
};

// Static method to get user activity
activationLogSchema.statics.getUserActivity = function(userId, dateFrom, dateTo) {
  const query = { 'execution_context.executed_by': userId };
  
  if (dateFrom || dateTo) {
    query['timing_info.start_time'] = {};
    if (dateFrom) query['timing_info.start_time'].$gte = new Date(dateFrom);
    if (dateTo) query['timing_info.start_time'].$lte = new Date(dateTo);
  }
  
  return this.find(query).sort({ 'timing_info.start_time': -1 });
};

// Static method to get performance statistics
activationLogSchema.statics.getPerformanceStats = function(action, days = 7) {
  const dateFrom = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
  
  return this.aggregate([
    {
      $match: {
        action: action,
        'timing_info.start_time': { $gte: dateFrom },
        'timing_info.duration_ms': { $exists: true }
      }
    },
    {
      $group: {
        _id: null,
        avg_duration: { $avg: '$timing_info.duration_ms' },
        min_duration: { $min: '$timing_info.duration_ms' },
        max_duration: { $max: '$timing_info.duration_ms' },
        total_operations: { $sum: 1 },
        successful_operations: {
          $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
        },
        failed_operations: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        }
      }
    },
    {
      $project: {
        avg_duration: { $round: ['$avg_duration', 2] },
        min_duration: 1,
        max_duration: 1,
        total_operations: 1,
        successful_operations: 1,
        failed_operations: 1,
        success_rate: {
          $round: [
            { $multiply: [{ $divide: ['$successful_operations', '$total_operations'] }, 100] },
            2
          ]
        }
      }
    }
  ]);
};

// Pre-save middleware to generate log_id and set timing
activationLogSchema.pre('save', function(next) {
  if (!this.log_id) {
    this.log_id = `log_${this.action}_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }
  
  if (!this.timing_info.start_time) {
    this.timing_info.start_time = new Date();
  }
  
  next();
});

export default mongoose.model('ActivationLog', activationLogSchema);
