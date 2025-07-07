/**
 * Configuration Actions Schema
 * Tracks generate and activate operations
 */

import mongoose from 'mongoose';

const configActionSchema = new mongoose.Schema({
  nap_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NAP',
    required: true,
    index: true
  },
  action_type: {
    type: String,
    enum: ['generate', 'activate', 'validate', 'backup', 'restore', 'sync'],
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'success', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  command: {
    type: String,
    trim: true
  },
  parameters: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  output_log: {
    type: String,
    default: ''
  },
  error_log: {
    type: String,
    default: ''
  },
  execution_time: {
    started_at: { type: Date },
    completed_at: { type: Date },
    duration_ms: { type: Number }
  },
  executed_by: {
    type: String,
    required: true,
    index: true
  },
  execution_method: {
    type: String,
    enum: ['ssh', 'api', 'gui', 'scheduler'],
    default: 'gui',
    index: true
  },
  related_mappings: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RoutesetMapping'
  }],
  prosbc_response: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  retry_count: {
    type: Number,
    default: 0
  },
  max_retries: {
    type: Number,
    default: 3
  },
  priority: {
    type: Number,
    default: 0,
    index: true
  },
  metadata: {
    ip_address: String,
    user_agent: String,
    session_id: String,
    request_id: String
  }
}, {
  timestamps: { createdAt: 'executed_at', updatedAt: 'updated_at' },
  collection: 'config_actions'
});

// Indexes for performance
configActionSchema.index({ nap_id: 1, action_type: 1, executed_at: -1 });
configActionSchema.index({ status: 1, executed_at: -1 });
configActionSchema.index({ executed_by: 1, executed_at: -1 });
configActionSchema.index({ action_type: 1, status: 1 });

// Virtual for NAP details
configActionSchema.virtual('nap', {
  ref: 'NAP',
  localField: 'nap_id',
  foreignField: '_id',
  justOne: true
});

// Methods
configActionSchema.methods.start = function() {
  this.status = 'running';
  this.execution_time.started_at = new Date();
  return this.save();
};

configActionSchema.methods.complete = function(success = true, outputLog = '', errorLog = '') {
  this.status = success ? 'success' : 'failed';
  this.execution_time.completed_at = new Date();
  
  if (this.execution_time.started_at) {
    this.execution_time.duration_ms = 
      this.execution_time.completed_at - this.execution_time.started_at;
  }
  
  if (outputLog) this.output_log = outputLog;
  if (errorLog) this.error_log = errorLog;
  
  return this.save();
};

configActionSchema.methods.retry = function() {
  if (this.retry_count < this.max_retries) {
    this.retry_count += 1;
    this.status = 'pending';
    this.error_log = '';
    this.execution_time = {};
    return this.save();
  }
  throw new Error('Maximum retry attempts exceeded');
};

configActionSchema.methods.cancel = function() {
  this.status = 'cancelled';
  this.execution_time.completed_at = new Date();
  return this.save();
};

configActionSchema.methods.getDuration = function() {
  if (this.execution_time.duration_ms) {
    return this.execution_time.duration_ms;
  }
  
  if (this.execution_time.started_at) {
    const endTime = this.execution_time.completed_at || new Date();
    return endTime - this.execution_time.started_at;
  }
  
  return 0;
};

// Static methods
configActionSchema.statics.findByNAP = function(napId) {
  return this.find({ nap_id: napId }).sort({ executed_at: -1 });
};

configActionSchema.statics.findPending = function() {
  return this.find({ status: 'pending' })
    .sort({ priority: -1, executed_at: 1 });
};

configActionSchema.statics.findRunning = function() {
  return this.find({ status: 'running' })
    .sort({ 'execution_time.started_at': 1 });
};

configActionSchema.statics.getActionStats = async function(timeRange = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeRange);
  
  const pipeline = [
    {
      $match: {
        executed_at: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          action_type: '$action_type',
          status: '$status'
        },
        count: { $sum: 1 },
        avg_duration: { $avg: '$execution_time.duration_ms' },
        total_duration: { $sum: '$execution_time.duration_ms' }
      }
    },
    {
      $sort: { '_id.action_type': 1, '_id.status': 1 }
    }
  ];
  
  return await this.aggregate(pipeline);
};

configActionSchema.statics.getRecentActivity = function(limit = 50) {
  return this.find()
    .populate('nap', 'name status')
    .sort({ executed_at: -1 })
    .limit(limit);
};

configActionSchema.statics.cleanupOldActions = async function(daysToKeep = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  const result = await this.deleteMany({
    executed_at: { $lt: cutoffDate },
    status: { $in: ['success', 'failed', 'cancelled'] }
  });
  
  return result.deletedCount;
};

export const ConfigAction = mongoose.model('ConfigAction', configActionSchema);
