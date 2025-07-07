/**
 * Audit Logs Schema
 * Comprehensive system event tracking
 */

import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  event: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  event_category: {
    type: String,
    enum: ['nap', 'file', 'mapping', 'config', 'auth', 'system', 'security'],
    required: true,
    index: true
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'error', 'critical'],
    default: 'info',
    index: true
  },
  status: {
    type: Boolean,
    required: true,
    index: true
  },
  related_entity: {
    type: {
      type: String,
      enum: ['NAP', 'DigitMap', 'DialFormat', 'RoutesetMapping', 'ConfigAction', 'User', 'System'],
      required: true
    },
    id: {
      type: String,
      required: true
    },
    name: {
      type: String,
      trim: true
    }
  },
  user_info: {
    username: {
      type: String,
      required: true,
      index: true
    },
    ip_address: {
      type: String,
      index: true
    },
    user_agent: {
      type: String
    },
    session_id: {
      type: String,
      index: true
    }
  },
  action_details: {
    action: {
      type: String,
      enum: ['create', 'read', 'update', 'delete', 'upload', 'download', 'map', 'activate', 'generate', 'sync', 'login', 'logout'],
      required: true,
      index: true
    },
    method: {
      type: String,
      enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      index: true
    },
    endpoint: {
      type: String,
      index: true
    },
    request_id: {
      type: String,
      index: true
    }
  },
  changes: {
    before: {
      type: mongoose.Schema.Types.Mixed
    },
    after: {
      type: mongoose.Schema.Types.Mixed
    },
    fields_changed: [{
      type: String
    }]
  },
  error_details: {
    error_code: {
      type: String
    },
    error_message: {
      type: String
    },
    stack_trace: {
      type: String
    }
  },
  metadata: {
    duration_ms: {
      type: Number
    },
    file_size: {
      type: Number
    },
    record_count: {
      type: Number
    },
    system_info: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  correlation_id: {
    type: String,
    index: true
  },
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: { createdAt: 'timestamp', updatedAt: false },
  collection: 'audit_logs'
});

// Indexes for performance and querying
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ event_category: 1, timestamp: -1 });
auditLogSchema.index({ severity: 1, timestamp: -1 });
auditLogSchema.index({ status: 1, timestamp: -1 });
auditLogSchema.index({ 'user_info.username': 1, timestamp: -1 });
auditLogSchema.index({ 'related_entity.type': 1, 'related_entity.id': 1 });
auditLogSchema.index({ 'action_details.action': 1, timestamp: -1 });
auditLogSchema.index({ correlation_id: 1 });

// Compound indexes for common queries
auditLogSchema.index({ event_category: 1, severity: 1, timestamp: -1 });
auditLogSchema.index({ 'user_info.username': 1, 'action_details.action': 1, timestamp: -1 });

// TTL index for automatic cleanup (optional - remove if you want to keep all logs)
// auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 }); // 1 year

// Static methods
auditLogSchema.statics.logEvent = async function(eventData) {
  const logEntry = new this({
    event: eventData.event,
    event_category: eventData.category || 'system',
    severity: eventData.severity || 'info',
    status: eventData.status !== false,
    related_entity: eventData.entity,
    user_info: eventData.user,
    action_details: eventData.action,
    changes: eventData.changes,
    error_details: eventData.error,
    metadata: eventData.metadata,
    correlation_id: eventData.correlationId || eventData.requestId,
    tags: eventData.tags || []
  });
  
  return await logEntry.save();
};

auditLogSchema.statics.findByEntity = function(entityType, entityId) {
  return this.find({
    'related_entity.type': entityType,
    'related_entity.id': entityId
  }).sort({ timestamp: -1 });
};

auditLogSchema.statics.findByUser = function(username, limit = 100) {
  return this.find({
    'user_info.username': username
  }).sort({ timestamp: -1 }).limit(limit);
};

auditLogSchema.statics.findByCategory = function(category, limit = 100) {
  return this.find({
    event_category: category
  }).sort({ timestamp: -1 }).limit(limit);
};

auditLogSchema.statics.findErrors = function(limit = 100) {
  return this.find({
    $or: [
      { status: false },
      { severity: { $in: ['error', 'critical'] } }
    ]
  }).sort({ timestamp: -1 }).limit(limit);
};

auditLogSchema.statics.getEventStats = async function(timeRange = 24) {
  const startTime = new Date();
  startTime.setHours(startTime.getHours() - timeRange);
  
  const pipeline = [
    {
      $match: {
        timestamp: { $gte: startTime }
      }
    },
    {
      $group: {
        _id: {
          category: '$event_category',
          severity: '$severity',
          status: '$status'
        },
        count: { $sum: 1 },
        latest: { $max: '$timestamp' }
      }
    },
    {
      $sort: { '_id.category': 1, '_id.severity': 1 }
    }
  ];
  
  return await this.aggregate(pipeline);
};

auditLogSchema.statics.getActivityTimeline = async function(hours = 24, granularity = 'hour') {
  const startTime = new Date();
  startTime.setHours(startTime.getHours() - hours);
  
  let dateFormat;
  switch (granularity) {
    case 'minute':
      dateFormat = { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$timestamp" } };
      break;
    case 'hour':
      dateFormat = { $dateToString: { format: "%Y-%m-%d %H:00", date: "$timestamp" } };
      break;
    case 'day':
      dateFormat = { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } };
      break;
    default:
      dateFormat = { $dateToString: { format: "%Y-%m-%d %H:00", date: "$timestamp" } };
  }
  
  const pipeline = [
    {
      $match: {
        timestamp: { $gte: startTime }
      }
    },
    {
      $group: {
        _id: {
          time: dateFormat,
          category: '$event_category'
        },
        count: { $sum: 1 },
        errors: {
          $sum: {
            $cond: [{ $eq: ['$status', false] }, 1, 0]
          }
        }
      }
    },
    {
      $sort: { '_id.time': 1 }
    }
  ];
  
  return await this.aggregate(pipeline);
};

auditLogSchema.statics.getUserActivity = async function(username, days = 7) {
  const startTime = new Date();
  startTime.setDate(startTime.getDate() - days);
  
  const pipeline = [
    {
      $match: {
        'user_info.username': username,
        timestamp: { $gte: startTime }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
          action: '$action_details.action'
        },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.date': -1, '_id.action': 1 }
    }
  ];
  
  return await this.aggregate(pipeline);
};

auditLogSchema.statics.cleanupOldLogs = async function(daysToKeep = 365) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  const result = await this.deleteMany({
    timestamp: { $lt: cutoffDate }
  });
  
  return result.deletedCount;
};

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
