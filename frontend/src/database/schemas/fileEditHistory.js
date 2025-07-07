/**
 * File Editing History / Audit Trail Schema
 * Maintains historical versions and audit trail of file edits
 */

import mongoose from 'mongoose';

const fileEditHistorySchema = new mongoose.Schema({
  history_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  file_id: {
    type: String,
    ref: 'UploadedFile',
    required: true,
    index: true
  },
  editor: {
    type: String,
    required: true,
    index: true
  },
  edit_timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  edit_type: {
    type: String,
    enum: ['create', 'update', 'delete', 'restore', 'bulk_update', 'import', 'export'],
    required: true,
    index: true
  },
  changes_summary: {
    type: String,
    required: true
  },
  detailed_changes: {
    rows_added: { type: Number, default: 0 },
    rows_modified: { type: Number, default: 0 },
    rows_deleted: { type: Number, default: 0 },
    columns_added: [String],
    columns_removed: [String],
    columns_renamed: [{
      from: String,
      to: String
    }],
    cell_changes: [{
      row: Number,
      column: String,
      old_value: mongoose.Schema.Types.Mixed,
      new_value: mongoose.Schema.Types.Mixed
    }]
  },
  csv_backup: {
    type: String,
    required: true
  },
  json_table_format: {
    headers: [String],
    rows: [mongoose.Schema.Types.Mixed],
    metadata: {
      total_rows: Number,
      total_columns: Number,
      encoding: String,
      delimiter: String
    }
  },
  version_info: {
    previous_version: Number,
    new_version: Number,
    is_major_change: { type: Boolean, default: false }
  },
  session_info: {
    session_id: String,
    ip_address: String,
    user_agent: String,
    edit_duration: Number // in seconds
  },
  rollback_info: {
    can_rollback: { type: Boolean, default: true },
    rollback_dependencies: [String],
    rollback_warnings: [String]
  },
  file_state_before: {
    file_size: Number,
    checksum: String,
    last_modified: Date
  },
  file_state_after: {
    file_size: Number,
    checksum: String,
    last_modified: Date
  }
}, {
  timestamps: false,
  collection: 'file_edit_history'
});

// Compound indexes for performance
fileEditHistorySchema.index({ file_id: 1, edit_timestamp: -1 });
fileEditHistorySchema.index({ editor: 1, edit_timestamp: -1 });
fileEditHistorySchema.index({ edit_type: 1, edit_timestamp: -1 });
fileEditHistorySchema.index({ 'version_info.new_version': 1 });

// Virtual for formatted edit timestamp
fileEditHistorySchema.virtual('formatted_timestamp').get(function() {
  return this.edit_timestamp.toLocaleString();
});

// Virtual for change magnitude
fileEditHistorySchema.virtual('change_magnitude').get(function() {
  const changes = this.detailed_changes;
  const total = changes.rows_added + changes.rows_modified + changes.rows_deleted;
  
  if (total === 0) return 'minimal';
  if (total < 10) return 'small';
  if (total < 100) return 'medium';
  return 'large';
});

// Method to create rollback data
fileEditHistorySchema.methods.createRollbackData = function() {
  return {
    target_version: this.version_info.previous_version,
    csv_content: this.csv_backup,
    json_structure: this.json_table_format,
    rollback_to_timestamp: this.edit_timestamp,
    warnings: this.rollback_info.rollback_warnings
  };
};

// Method to check if rollback is safe
fileEditHistorySchema.methods.isRollbackSafe = function() {
  return this.rollback_info.can_rollback && 
         this.rollback_info.rollback_dependencies.length === 0;
};

// Static method to get file history
fileEditHistorySchema.statics.getFileHistory = function(fileId, limit = 50) {
  return this.find({ file_id: fileId })
    .sort({ edit_timestamp: -1 })
    .limit(limit);
};

// Static method to get user activity
fileEditHistorySchema.statics.getUserActivity = function(editor, dateFrom, dateTo) {
  const query = { editor };
  
  if (dateFrom || dateTo) {
    query.edit_timestamp = {};
    if (dateFrom) query.edit_timestamp.$gte = new Date(dateFrom);
    if (dateTo) query.edit_timestamp.$lte = new Date(dateTo);
  }
  
  return this.find(query).sort({ edit_timestamp: -1 });
};

// Static method to find major changes
fileEditHistorySchema.statics.findMajorChanges = function(fileId) {
  return this.find({ 
    file_id: fileId, 
    'version_info.is_major_change': true 
  }).sort({ edit_timestamp: -1 });
};

// Static method to get rollback candidates
fileEditHistorySchema.statics.getRollbackCandidates = function(fileId) {
  return this.find({ 
    file_id: fileId,
    'rollback_info.can_rollback': true 
  }).sort({ edit_timestamp: -1 });
};

// Pre-save middleware to generate history_id
fileEditHistorySchema.pre('save', function(next) {
  if (!this.history_id) {
    this.history_id = `hist_${this.file_id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

export default mongoose.model('FileEditHistory', fileEditHistorySchema);
