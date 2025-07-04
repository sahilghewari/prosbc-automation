/**
 * Uploaded Files Metadata Schema
 * Tracks all uploaded files with metadata and file system information
 */

import mongoose from 'mongoose';

const uploadedFileSchema = new mongoose.Schema({
  file_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    enum: ['DF', 'DM', 'Routeset', 'Backup', 'Config'],
    required: true,
    index: true
  },
  nap_associated: {
    type: String,
    ref: 'NapRecord',
    index: true
  },
  uploaded_by: {
    type: String,
    required: true,
    index: true
  },
  file_path: {
    type: String,
    required: true,
    unique: true
  },
  original_filename: {
    type: String,
    required: true
  },
  file_size: {
    type: Number,
    required: true
  },
  mime_type: {
    type: String,
    default: 'text/csv'
  },
  version: {
    type: Number,
    default: 1
  },
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted', 'corrupted', 'processing'],
    default: 'active',
    index: true
  },
  tags: [{
    type: String,
    enum: ['simple', 'complex', 'production', 'test', 'backup', 'validated', 'error']
  }],
  validation_results: {
    is_valid: { type: Boolean, default: null },
    row_count: Number,
    column_count: Number,
    errors: [String],
    warnings: [String],
    last_validated: Date,
    csv_structure: {
      headers: [String],
      sample_rows: [mongoose.Schema.Types.Mixed]
    }
  },
  integration_flags: {
    uploaded_to_prosbc: { type: Boolean, default: false },
    sync_status: {
      type: String,
      enum: ['synced', 'pending', 'failed', 'never_synced'],
      default: 'never_synced'
    },
    last_sync_attempt: Date,
    sync_error: String
  },
  backup_info: {
    is_backup: { type: Boolean, default: false },
    original_file_id: { type: String, ref: 'UploadedFile' },
    backup_reason: String,
    backup_created_by: String
  },
  parent_file_id: {
    type: String,
    ref: 'UploadedFile'
  },
  checksum: {
    type: String,
    index: true
  },
  metadata: {
    encoding: String,
    line_endings: String,
    delimiter: String,
    quote_char: String,
    escape_char: String
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'uploaded_files'
});

// Compound indexes for performance
uploadedFileSchema.index({ type: 1, status: 1, created_at: -1 });
uploadedFileSchema.index({ uploaded_by: 1, created_at: -1 });
uploadedFileSchema.index({ nap_associated: 1, type: 1 });
uploadedFileSchema.index({ checksum: 1, original_filename: 1 });

// Virtual for file extension
uploadedFileSchema.virtual('file_extension').get(function() {
  return this.original_filename.split('.').pop();
});

// Virtual for formatted file size
uploadedFileSchema.virtual('formatted_size').get(function() {
  const bytes = this.file_size;
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

// Method to create backup
uploadedFileSchema.methods.createBackup = async function(backupReason, backupCreatedBy) {
  const BackupModel = this.constructor;
  
  const backup = new BackupModel({
    file_id: `backup_${this.file_id}_${Date.now()}`,
    type: this.type,
    nap_associated: this.nap_associated,
    uploaded_by: backupCreatedBy,
    file_path: this.file_path.replace(/\/([^\/]+)$/, '/backups/$1'),
    original_filename: `backup_${this.original_filename}`,
    file_size: this.file_size,
    mime_type: this.mime_type,
    version: this.version,
    status: 'archived',
    tags: [...this.tags, 'backup'],
    validation_results: this.validation_results,
    backup_info: {
      is_backup: true,
      original_file_id: this.file_id,
      backup_reason: backupReason,
      backup_created_by: backupCreatedBy
    },
    parent_file_id: this.file_id,
    checksum: this.checksum,
    metadata: this.metadata
  });
  
  return await backup.save();
};

// Method to update validation results
uploadedFileSchema.methods.updateValidation = function(validationData) {
  this.validation_results = {
    ...this.validation_results,
    ...validationData,
    last_validated: new Date()
  };
  return this.save();
};

// Method to soft delete
uploadedFileSchema.methods.softDelete = function() {
  this.status = 'deleted';
  return this.save();
};

// Static method to find by type and status
uploadedFileSchema.statics.findByTypeAndStatus = function(type, status = 'active') {
  return this.find({ type, status }).sort({ created_at: -1 });
};

// Static method to find files by NAP
uploadedFileSchema.statics.findByNap = function(napId) {
  return this.find({ nap_associated: napId, status: { $ne: 'deleted' } })
    .sort({ created_at: -1 });
};

// Static method to find duplicates by checksum
uploadedFileSchema.statics.findDuplicates = function(checksum) {
  return this.find({ checksum, status: { $ne: 'deleted' } });
};

export default mongoose.model('UploadedFile', uploadedFileSchema);
