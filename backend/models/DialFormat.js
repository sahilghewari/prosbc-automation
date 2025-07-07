/**
 * Dial Formats Schema
 * Manages DF files and their metadata - similar structure to DigitMap
 */

import mongoose from 'mongoose';

const dialFormatSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  original_filename: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  content_type: {
    type: String,
    enum: ['csv', 'json', 'text'],
    default: 'csv'
  },
  file_size: {
    type: Number,
    required: true
  },
  checksum: {
    type: String,
    index: true
  },
  nap_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NAP',
    sparse: true,
    index: true
  },
  prosbc_id: {
    type: String,
    sparse: true,
    index: true
  },
  status: {
    type: String,
    enum: ['uploaded', 'validated', 'mapped', 'active', 'error'],
    default: 'uploaded',
    index: true
  },
  validation_results: {
    is_valid: { type: Boolean, default: true },
    row_count: { type: Number, default: 0 },
    column_count: { type: Number, default: 0 },
    errors: [String],
    warnings: [String],
    last_validated: { type: Date, default: Date.now }
  },
  metadata: {
    encoding: { type: String, default: 'utf-8' },
    delimiter: { type: String, default: ',' },
    has_header: { type: Boolean, default: true },
    upload_source: { type: String, enum: ['web', 'api', 'sync'], default: 'web' }
  },
  uploaded_by: {
    type: String,
    required: true,
    index: true
  },
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: { createdAt: 'uploaded_at', updatedAt: 'updated_at' },
  collection: 'dial_formats'
});

// Indexes for performance
dialFormatSchema.index({ filename: 1, uploaded_at: -1 });
dialFormatSchema.index({ status: 1, uploaded_at: -1 });
dialFormatSchema.index({ nap_id: 1, status: 1 });

// Virtual for linked NAP name
dialFormatSchema.virtual('nap_name', {
  ref: 'NAP',
  localField: 'nap_id',
  foreignField: '_id',
  justOne: true,
  select: 'name'
});

// Methods
dialFormatSchema.methods.validateContent = function() {
  const errors = [];
  const warnings = [];
  let rowCount = 0;
  let columnCount = 0;

  try {
    if (!this.content || this.content.trim().length === 0) {
      errors.push('File content is empty');
    } else {
      // Basic CSV validation
      const lines = this.content.split('\n').filter(line => line.trim());
      rowCount = lines.length;
      
      if (lines.length > 0) {
        const firstLine = lines[0];
        columnCount = firstLine.split(this.metadata.delimiter || ',').length;
        
        // Check for consistent column count
        for (let i = 1; i < Math.min(lines.length, 10); i++) {
          const cols = lines[i].split(this.metadata.delimiter || ',').length;
          if (cols !== columnCount) {
            warnings.push(`Inconsistent column count at row ${i + 1}`);
          }
        }
      }
      
      if (rowCount === 0) {
        errors.push('No data rows found');
      } else if (rowCount > 10000) {
        warnings.push(`Large file with ${rowCount} rows may impact performance`);
      }
    }
  } catch (error) {
    errors.push(`Validation error: ${error.message}`);
  }

  this.validation_results = {
    is_valid: errors.length === 0,
    row_count: rowCount,
    column_count: columnCount,
    errors,
    warnings,
    last_validated: new Date()
  };

  return this.validation_results;
};

dialFormatSchema.methods.isLinked = function() {
  return !!this.nap_id;
};

// Static methods
dialFormatSchema.statics.findUnlinked = function() {
  return this.find({ nap_id: { $exists: false } }).sort({ uploaded_at: -1 });
};

dialFormatSchema.statics.findByNAP = function(napId) {
  return this.find({ nap_id: napId }).sort({ uploaded_at: -1 });
};

dialFormatSchema.statics.getStatusCounts = async function() {
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
    uploaded: 0,
    validated: 0,
    mapped: 0,
    active: 0,
    error: 0
  };
  
  results.forEach(result => {
    counts[result._id] = result.count;
  });
  
  return counts;
};

export const DialFormat = mongoose.model('DialFormat', dialFormatSchema);
