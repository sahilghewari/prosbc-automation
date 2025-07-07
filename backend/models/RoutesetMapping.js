/**
 * Routeset Mappings Schema
 * Links NAPs with DM/DF files
 */

import mongoose from 'mongoose';

const routesetMappingSchema = new mongoose.Schema({
  nap_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NAP',
    required: true,
    index: true
  },
  digit_map_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DigitMap',
    required: true,
    index: true
  },
  dial_format_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DialFormat',
    required: true,
    index: true
  },
  mapping_name: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending', 'error'],
    default: 'pending',
    index: true
  },
  priority: {
    type: Number,
    default: 0,
    index: true
  },
  configuration: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  mapped_by: {
    type: String,
    required: true,
    index: true
  },
  mapped_via: {
    type: String,
    enum: ['gui', 'api', 'ssh', 'import'],
    default: 'gui',
    index: true
  },
  validation_results: {
    is_valid: { type: Boolean, default: true },
    errors: [String],
    warnings: [String],
    last_validated: { type: Date, default: Date.now }
  },
  prosbc_sync: {
    synced: { type: Boolean, default: false },
    sync_attempts: { type: Number, default: 0 },
    last_sync_attempt: { type: Date },
    last_successful_sync: { type: Date },
    sync_error: { type: String }
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: { createdAt: 'mapped_at', updatedAt: 'updated_at' },
  collection: 'routeset_mappings'
});

// Compound indexes for performance
routesetMappingSchema.index({ nap_id: 1, status: 1 });
routesetMappingSchema.index({ mapped_at: -1 });
routesetMappingSchema.index({ status: 1, priority: -1 });
routesetMappingSchema.index({ mapped_by: 1, mapped_at: -1 });

// Unique constraint to prevent duplicate mappings
routesetMappingSchema.index({ 
  nap_id: 1, 
  digit_map_id: 1, 
  dial_format_id: 1 
}, { unique: true });

// Virtual population for referenced documents
routesetMappingSchema.virtual('nap', {
  ref: 'NAP',
  localField: 'nap_id',
  foreignField: '_id',
  justOne: true
});

routesetMappingSchema.virtual('digit_map', {
  ref: 'DigitMap',
  localField: 'digit_map_id',
  foreignField: '_id',
  justOne: true
});

routesetMappingSchema.virtual('dial_format', {
  ref: 'DialFormat',
  localField: 'dial_format_id',
  foreignField: '_id',
  justOne: true
});

// Methods
routesetMappingSchema.methods.validateMapping = async function() {
  const errors = [];
  const warnings = [];

  try {
    // Check if referenced documents exist and are valid
    const NAP = mongoose.model('NAP');
    const DigitMap = mongoose.model('DigitMap');
    const DialFormat = mongoose.model('DialFormat');

    const nap = await NAP.findById(this.nap_id);
    if (!nap) {
      errors.push('Referenced NAP not found');
    } else if (!nap.validation_results.is_valid) {
      warnings.push('Referenced NAP has validation errors');
    }

    const digitMap = await DigitMap.findById(this.digit_map_id);
    if (!digitMap) {
      errors.push('Referenced Digit Map not found');
    } else if (!digitMap.validation_results.is_valid) {
      warnings.push('Referenced Digit Map has validation errors');
    }

    const dialFormat = await DialFormat.findById(this.dial_format_id);
    if (!dialFormat) {
      errors.push('Referenced Dial Format not found');
    } else if (!dialFormat.validation_results.is_valid) {
      warnings.push('Referenced Dial Format has validation errors');
    }

    // Check for mapping conflicts
    const conflictingMappings = await this.constructor.find({
      nap_id: this.nap_id,
      status: 'active',
      _id: { $ne: this._id }
    });

    if (conflictingMappings.length > 0) {
      warnings.push(`NAP already has ${conflictingMappings.length} active mapping(s)`);
    }

  } catch (error) {
    errors.push(`Validation error: ${error.message}`);
  }

  this.validation_results = {
    is_valid: errors.length === 0,
    errors,
    warnings,
    last_validated: new Date()
  };

  return this.validation_results;
};

routesetMappingSchema.methods.activate = function() {
  this.status = 'active';
  this.updated_at = new Date();
  return this.save();
};

routesetMappingSchema.methods.deactivate = function() {
  this.status = 'inactive';
  this.updated_at = new Date();
  return this.save();
};

// Static methods
routesetMappingSchema.statics.findByNAP = function(napId) {
  return this.find({ nap_id: napId })
    .populate('digit_map', 'filename original_filename status')
    .populate('dial_format', 'filename original_filename status')
    .sort({ priority: -1, mapped_at: -1 });
};

routesetMappingSchema.statics.findActive = function() {
  return this.find({ status: 'active' })
    .populate('nap', 'name status')
    .populate('digit_map', 'filename original_filename')
    .populate('dial_format', 'filename original_filename')
    .sort({ priority: -1, mapped_at: -1 });
};

routesetMappingSchema.statics.getStatusCounts = async function() {
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
    active: 0,
    inactive: 0,
    pending: 0,
    error: 0
  };
  
  results.forEach(result => {
    counts[result._id] = result.count;
  });
  
  return counts;
};

routesetMappingSchema.statics.getMappingsSummary = async function() {
  const pipeline = [
    {
      $lookup: {
        from: 'naps',
        localField: 'nap_id',
        foreignField: '_id',
        as: 'nap'
      }
    },
    {
      $unwind: '$nap'
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        naps: { $addToSet: '$nap.name' }
      }
    }
  ];
  
  return await this.aggregate(pipeline);
};

export const RoutesetMapping = mongoose.model('RoutesetMapping', routesetMappingSchema);
