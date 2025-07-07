/**
 * NAP (Network Access Points) Schema
 * Enhanced schema for managing ProSBC NAPs
 */

import mongoose from 'mongoose';

const napSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  config_data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  status: {
    type: String,
    enum: ['created', 'mapped', 'activated', 'inactive', 'error'],
    default: 'created',
    index: true
  },
  description: {
    type: String,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  prosbc_id: {
    type: String,
    sparse: true,
    index: true
  },
  validation_results: {
    is_valid: { type: Boolean, default: true },
    errors: [String],
    warnings: [String],
    last_validated: { type: Date, default: Date.now }
  },
  created_by: {
    type: String,
    required: true,
    index: true
  },
  updated_by: {
    type: String,
    index: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'naps'
});

// Indexes for performance
napSchema.index({ name: 1, status: 1 });
napSchema.index({ created_at: -1 });
napSchema.index({ status: 1, created_at: -1 });

// Virtual for mapped files count
napSchema.virtual('mapped_files_count', {
  ref: 'RoutesetMapping',
  localField: '_id',
  foreignField: 'nap_id',
  count: true
});

// Methods
napSchema.methods.isActivated = function() {
  return this.status === 'activated';
};

napSchema.methods.isMapped = function() {
  return this.status === 'mapped' || this.status === 'activated';
};

napSchema.methods.validate = function() {
  const errors = [];
  const warnings = [];

  // Basic validation logic
  if (!this.config_data || Object.keys(this.config_data).length === 0) {
    errors.push('Configuration data is empty');
  }

  if (!this.name || this.name.trim().length === 0) {
    errors.push('NAP name is required');
  }

  // Update validation results
  this.validation_results = {
    is_valid: errors.length === 0,
    errors,
    warnings,
    last_validated: new Date()
  };

  return this.validation_results;
};

// Static methods
napSchema.statics.findByStatus = function(status) {
  return this.find({ status }).sort({ created_at: -1 });
};

napSchema.statics.findUnmapped = function() {
  return this.find({ status: 'created' }).sort({ created_at: -1 });
};

napSchema.statics.getStatusCounts = async function() {
  const pipeline = [
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ];
  
  const results = await this.aggregate(pipeline);
  const counts = {
    created: 0,
    mapped: 0,
    activated: 0,
    inactive: 0,
    error: 0
  };
  
  results.forEach(result => {
    counts[result._id] = result.count;
  });
  
  return counts;
};

export const NAP = mongoose.model('NAP', napSchema);
