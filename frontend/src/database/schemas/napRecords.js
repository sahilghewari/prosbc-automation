/**
 * NAP Records Schema
 * Stores all created or fetched NAPs with full JSON structure
 */

import mongoose from 'mongoose';

const napRecordSchema = new mongoose.Schema({
  nap_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  config_json: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'pending', 'active', 'inactive', 'error', 'archived'],
    default: 'draft',
    index: true
  },
  created_by: {
    type: String,
    required: true,
    index: true
  },
  tags: [{
    type: String,
    enum: ['simple', 'complex', 'production', 'test', 'backup']
  }],
  validation_results: {
    is_valid: { type: Boolean, default: true },
    errors: [String],
    warnings: [String],
    last_validated: { type: Date, default: Date.now }
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
  associated_files: [{
    file_id: { type: mongoose.Schema.Types.ObjectId, ref: 'UploadedFile' },
    file_type: { type: String, enum: ['DF', 'DM', 'Routeset'] },
    association_date: { type: Date, default: Date.now }
  }],
  version: {
    type: Number,
    default: 1
  },
  parent_nap_id: {
    type: String,
    ref: 'NapRecord'
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'nap_records'
});

// Indexes for performance
napRecordSchema.index({ created_by: 1, created_at: -1 });
napRecordSchema.index({ status: 1, updated_at: -1 });
napRecordSchema.index({ tags: 1 });
napRecordSchema.index({ 'integration_flags.uploaded_to_prosbc': 1 });

// Virtual for formatted creation date
napRecordSchema.virtual('formatted_created_at').get(function() {
  return this.created_at.toISOString().split('T')[0];
});

// Method to update validation results
napRecordSchema.methods.updateValidation = function(isValid, errors = [], warnings = []) {
  this.validation_results = {
    is_valid: isValid,
    errors,
    warnings,
    last_validated: new Date()
  };
  return this.save();
};

// Method to mark as uploaded to ProSBC
napRecordSchema.methods.markAsUploaded = function(syncStatus = 'synced') {
  this.integration_flags.uploaded_to_prosbc = true;
  this.integration_flags.sync_status = syncStatus;
  this.integration_flags.last_sync_attempt = new Date();
  return this.save();
};

// Static method to find by status
napRecordSchema.statics.findByStatus = function(status) {
  return this.find({ status }).sort({ updated_at: -1 });
};

// Static method to find active NAPs
napRecordSchema.statics.findActive = function() {
  return this.find({ status: 'active' }).sort({ updated_at: -1 });
};

export default mongoose.model('NapRecord', napRecordSchema);
