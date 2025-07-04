/**
 * Routeset Mapping Schema
 * Manages mappings between NAPs and their associated files
 */

import mongoose from 'mongoose';

const routesetMappingSchema = new mongoose.Schema({
  mapping_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  nap_reference: {
    type: String,
    ref: 'NapRecord',
    required: true,
    index: true
  },
  digitmap_file_id: {
    type: String,
    ref: 'UploadedFile',
    required: true
  },
  definition_file_id: {
    type: String,
    ref: 'UploadedFile',
    required: true
  },
  routeset_file_id: {
    type: String,
    ref: 'UploadedFile'
  },
  mapping_created_at: {
    type: Date,
    default: Date.now,
    index: true
  },
  mapped_by: {
    type: String,
    required: true,
    index: true
  },
  mapping_status: {
    type: String,
    enum: ['active', 'inactive', 'pending', 'error', 'archived'],
    default: 'active',
    index: true
  },
  mapping_config: {
    digitmap_mapping: {
      column_mappings: [{
        source_column: String,
        target_field: String,
        transformation: String,
        validation_rule: String
      }],
      row_filters: [{
        condition: String,
        value: mongoose.Schema.Types.Mixed
      }]
    },
    definition_mapping: {
      column_mappings: [{
        source_column: String,
        target_field: String,
        transformation: String,
        validation_rule: String
      }],
      row_filters: [{
        condition: String,
        value: mongoose.Schema.Types.Mixed
      }]
    },
    routeset_mapping: {
      column_mappings: [{
        source_column: String,
        target_field: String,
        transformation: String,
        validation_rule: String
      }],
      row_filters: [{
        condition: String,
        value: mongoose.Schema.Types.Mixed
      }]
    }
  },
  validation_results: {
    is_valid: { type: Boolean, default: null },
    digitmap_validation: {
      valid: Boolean,
      errors: [String],
      warnings: [String],
      row_count: Number
    },
    definition_validation: {
      valid: Boolean,
      errors: [String],
      warnings: [String],
      row_count: Number
    },
    routeset_validation: {
      valid: Boolean,
      errors: [String],
      warnings: [String],
      row_count: Number
    },
    cross_validation: {
      valid: Boolean,
      errors: [String],
      warnings: [String],
      consistency_checks: [{
        check_name: String,
        passed: Boolean,
        message: String
      }]
    },
    last_validated: Date
  },
  sync_info: {
    last_sync_attempt: Date,
    sync_status: {
      type: String,
      enum: ['never_synced', 'synced', 'pending', 'failed', 'partial'],
      default: 'never_synced'
    },
    sync_errors: [String],
    prosbc_response: mongoose.Schema.Types.Mixed
  },
  version: {
    type: Number,
    default: 1
  },
  tags: [{
    type: String,
    enum: ['production', 'test', 'development', 'backup', 'validated', 'complex']
  }],
  notes: {
    type: String,
    maxlength: 1000
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'routeset_mappings'
});

// Compound indexes for performance
routesetMappingSchema.index({ nap_reference: 1, mapping_status: 1 });
routesetMappingSchema.index({ mapped_by: 1, mapping_created_at: -1 });
routesetMappingSchema.index({ digitmap_file_id: 1, definition_file_id: 1 });
routesetMappingSchema.index({ mapping_status: 1, mapping_created_at: -1 });
routesetMappingSchema.index({ 'sync_info.sync_status': 1 });

// Virtual for mapping completeness
routesetMappingSchema.virtual('mapping_completeness').get(function() {
  let score = 0;
  let total = 0;
  
  // Check required files
  if (this.digitmap_file_id) score += 1;
  if (this.definition_file_id) score += 1;
  total += 2;
  
  // Check optional files
  if (this.routeset_file_id) score += 1;
  total += 1;
  
  // Check validation status
  if (this.validation_results?.is_valid) score += 2;
  total += 2;
  
  return Math.round((score / total) * 100);
});

// Virtual for file count
routesetMappingSchema.virtual('mapped_file_count').get(function() {
  let count = 0;
  if (this.digitmap_file_id) count++;
  if (this.definition_file_id) count++;
  if (this.routeset_file_id) count++;
  return count;
});

// Method to validate mapping
routesetMappingSchema.methods.validateMapping = async function() {
  // This would contain the actual validation logic
  // For now, return a placeholder structure
  const validation = {
    is_valid: true,
    digitmap_validation: { valid: true, errors: [], warnings: [], row_count: 0 },
    definition_validation: { valid: true, errors: [], warnings: [], row_count: 0 },
    routeset_validation: { valid: true, errors: [], warnings: [], row_count: 0 },
    cross_validation: { 
      valid: true, 
      errors: [], 
      warnings: [], 
      consistency_checks: [] 
    },
    last_validated: new Date()
  };
  
  this.validation_results = validation;
  return await this.save();
};

// Method to sync with ProSBC
routesetMappingSchema.methods.syncWithProSBC = async function() {
  this.sync_info.last_sync_attempt = new Date();
  this.sync_info.sync_status = 'pending';
  
  try {
    // Actual sync logic would go here
    this.sync_info.sync_status = 'synced';
    this.sync_info.sync_errors = [];
  } catch (error) {
    this.sync_info.sync_status = 'failed';
    this.sync_info.sync_errors = [error.message];
  }
  
  return await this.save();
};

// Method to add file to mapping
routesetMappingSchema.methods.addFile = function(fileId, fileType) {
  switch (fileType.toUpperCase()) {
    case 'DM':
      this.digitmap_file_id = fileId;
      break;
    case 'DF':
      this.definition_file_id = fileId;
      break;
    case 'ROUTESET':
      this.routeset_file_id = fileId;
      break;
    default:
      throw new Error(`Invalid file type: ${fileType}`);
  }
  
  this.version += 1;
  return this.save();
};

// Static method to find by NAP
routesetMappingSchema.statics.findByNap = function(napId) {
  return this.find({ nap_reference: napId, mapping_status: { $ne: 'archived' } })
    .sort({ mapping_created_at: -1 });
};

// Static method to find active mappings
routesetMappingSchema.statics.findActive = function() {
  return this.find({ mapping_status: 'active' })
    .sort({ mapping_created_at: -1 });
};

// Static method to find mappings needing validation
routesetMappingSchema.statics.findNeedingValidation = function() {
  return this.find({
    mapping_status: 'active',
    $or: [
      { 'validation_results.is_valid': null },
      { 'validation_results.is_valid': false },
      { 'validation_results.last_validated': { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
    ]
  });
};

// Pre-save middleware to generate mapping_id
routesetMappingSchema.pre('save', function(next) {
  if (!this.mapping_id) {
    this.mapping_id = `map_${this.nap_reference}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }
  next();
});

export default mongoose.model('RoutesetMapping', routesetMappingSchema);
