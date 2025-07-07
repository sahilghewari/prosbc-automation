/**
 * Database Configuration
 * Environment-specific database settings and constants
 */

export const DATABASE_CONFIG = {
  // Connection settings
  CONNECTION: {
    MAX_POOL_SIZE: {
      development: 10,
      production: 50,
      test: 5
    },
    SERVER_SELECTION_TIMEOUT: {
      development: 5000,
      production: 10000,
      test: 5000
    },
    SOCKET_TIMEOUT: {
      development: 45000,
      production: 60000,
      test: 30000
    }
  },

  // File storage settings
  FILE_STORAGE: {
    BASE_PATH: process.env.PROSBC_STORAGE_PATH || '/opt/prosbc-dashboard/files',
    MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024, // 50MB
    ALLOWED_EXTENSIONS: ['.csv', '.txt', '.json', '.xml'],
    ALLOWED_MIME_TYPES: ['text/csv', 'text/plain', 'application/json', 'application/xml'],
    BACKUP_RETENTION_DAYS: 30,
    TEMP_FILE_CLEANUP_HOURS: 24
  },

  // Validation settings
  VALIDATION: {
    CSV_MAX_ROWS: parseInt(process.env.CSV_MAX_ROWS) || 10000,
    CSV_MAX_COLUMNS: parseInt(process.env.CSV_MAX_COLUMNS) || 100,
    NAP_CONFIG_MAX_SIZE: 1024 * 1024, // 1MB
    MAX_BATCH_SIZE: 100
  },

  // Performance settings
  PERFORMANCE: {
    DEFAULT_PAGE_SIZE: 50,
    MAX_PAGE_SIZE: 1000,
    SEARCH_LIMIT: 100,
    AGGREGATION_TIMEOUT: 30000,
    INDEX_BACKGROUND: true
  },

  // Security settings
  SECURITY: {
    CHECKSUM_ALGORITHM: 'sha256',
    SESSION_TIMEOUT: 3600000, // 1 hour
    MAX_LOGIN_ATTEMPTS: 5,
    RATE_LIMIT_WINDOW: 900000, // 15 minutes
    RATE_LIMIT_MAX: 100
  },

  // Audit settings
  AUDIT: {
    RETENTION_DAYS: 90,
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    SENSITIVE_FIELDS: ['password', 'token', 'key', 'secret'],
    MAX_LOG_SIZE: 1000000 // 1MB
  },

  // Cache settings
  CACHE: {
    TTL: 300000, // 5 minutes
    MAX_ENTRIES: 1000,
    CHECK_PERIOD: 60000 // 1 minute
  }
};

// Database collections
export const COLLECTIONS = {
  NAP_RECORDS: 'nap_records',
  UPLOADED_FILES: 'uploaded_files',
  FILE_EDIT_HISTORY: 'file_edit_history',
  ROUTESET_MAPPINGS: 'routeset_mappings',
  ACTIVATION_LOGS: 'activation_logs'
};

// Status enums
export const STATUS = {
  NAP: {
    DRAFT: 'draft',
    PENDING: 'pending',
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    ERROR: 'error',
    ARCHIVED: 'archived'
  },
  FILE: {
    ACTIVE: 'active',
    ARCHIVED: 'archived',
    DELETED: 'deleted',
    CORRUPTED: 'corrupted',
    PROCESSING: 'processing'
  },
  MAPPING: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    PENDING: 'pending',
    ERROR: 'error',
    ARCHIVED: 'archived'
  },
  LOG: {
    SUCCESS: 'success',
    FAILED: 'failed',
    PENDING: 'pending',
    TIMEOUT: 'timeout',
    CANCELLED: 'cancelled',
    PARTIAL: 'partial'
  }
};

// File types
export const FILE_TYPES = {
  DF: 'DF',
  DM: 'DM',
  ROUTESET: 'Routeset',
  BACKUP: 'Backup',
  CONFIG: 'Config'
};

// Edit types
export const EDIT_TYPES = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  RESTORE: 'restore',
  BULK_UPDATE: 'bulk_update',
  IMPORT: 'import',
  EXPORT: 'export'
};

// Action types for logging
export const ACTION_TYPES = {
  // NAP actions
  CREATE_NAP: 'create_nap',
  UPDATE_NAP: 'update_nap',
  DELETE_NAP: 'delete_nap',
  ACTIVATE_NAP: 'activate_nap',
  DEACTIVATE_NAP: 'deactivate_nap',
  
  // File actions
  UPLOAD_FILE: 'upload_file',
  UPDATE_FILE: 'update_file',
  DELETE_FILE: 'delete_file',
  ROLLBACK_FILE: 'rollback_file',
  
  // Mapping actions
  CREATE_MAPPING: 'create_mapping',
  UPDATE_MAPPING: 'update_mapping',
  DELETE_MAPPING: 'delete_mapping',
  SYNC_MAPPING: 'sync_mapping',
  
  // System actions
  VALIDATE_CONFIG: 'validate_config',
  BULK_OPERATION: 'bulk_operation',
  BACKUP_CREATE: 'backup_create',
  RESTORE_OPERATION: 'restore_operation'
};

// Tags
export const TAGS = {
  NAP: ['simple', 'complex', 'production', 'test', 'backup'],
  FILE: ['simple', 'complex', 'production', 'test', 'backup', 'validated', 'error'],
  MAPPING: ['production', 'test', 'development', 'backup', 'validated', 'complex'],
  LOG: ['production', 'test', 'development', 'emergency', 'scheduled', 'manual', 'automated']
};

// Error codes
export const ERROR_CODES = {
  // Database errors
  DB_CONNECTION_FAILED: 'DB_CONNECTION_FAILED',
  DB_OPERATION_FAILED: 'DB_OPERATION_FAILED',
  DB_VALIDATION_FAILED: 'DB_VALIDATION_FAILED',
  
  // File errors
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  FILE_INVALID_TYPE: 'FILE_INVALID_TYPE',
  FILE_CORRUPTED: 'FILE_CORRUPTED',
  
  // Validation errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_NAP_CONFIG: 'INVALID_NAP_CONFIG',
  INVALID_FILE_STRUCTURE: 'INVALID_FILE_STRUCTURE',
  
  // Business logic errors
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  MISSING_DEPENDENCY: 'MISSING_DEPENDENCY',
  OPERATION_NOT_ALLOWED: 'OPERATION_NOT_ALLOWED',
  
  // System errors
  INSUFFICIENT_STORAGE: 'INSUFFICIENT_STORAGE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  TIMEOUT: 'TIMEOUT'
};

// Success messages
export const SUCCESS_MESSAGES = {
  NAP_CREATED: 'NAP created successfully',
  NAP_UPDATED: 'NAP updated successfully',
  NAP_DELETED: 'NAP deleted successfully',
  FILE_UPLOADED: 'File uploaded successfully',
  FILE_UPDATED: 'File updated successfully',
  FILE_DELETED: 'File deleted successfully',
  MAPPING_CREATED: 'Mapping created successfully',
  VALIDATION_PASSED: 'Validation completed successfully',
  ROLLBACK_COMPLETED: 'Rollback completed successfully'
};

// Default configurations
export const DEFAULTS = {
  PAGINATION: {
    PAGE: 1,
    LIMIT: 50
  },
  NAP: {
    STATUS: STATUS.NAP.DRAFT,
    VERSION: 1,
    TAGS: []
  },
  FILE: {
    STATUS: STATUS.FILE.ACTIVE,
    VERSION: 1,
    MIME_TYPE: 'text/csv'
  },
  MAPPING: {
    STATUS: STATUS.MAPPING.ACTIVE,
    VERSION: 1
  }
};

// Validation rules
export const VALIDATION_RULES = {
  NAP_ID: {
    MIN_LENGTH: 5,
    MAX_LENGTH: 50,
    PATTERN: /^[a-zA-Z0-9_-]+$/
  },
  FILE_ID: {
    MIN_LENGTH: 5,
    MAX_LENGTH: 50,
    PATTERN: /^[a-zA-Z0-9_-]+$/
  },
  FILENAME: {
    MAX_LENGTH: 255,
    FORBIDDEN_CHARS: ['<', '>', ':', '"', '|', '?', '*', '\\', '/']
  },
  NAP_NAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 100,
    REQUIRED: true
  },
  USER_ID: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 50,
    PATTERN: /^[a-zA-Z0-9._-]+$/
  }
};

// Index definitions
export const INDEXES = {
  NAP_RECORDS: [
    { fields: { nap_id: 1 }, unique: true },
    { fields: { created_by: 1, created_at: -1 } },
    { fields: { status: 1, updated_at: -1 } },
    { fields: { tags: 1 } },
    { fields: { name: 'text', created_by: 'text' } }
  ],
  UPLOADED_FILES: [
    { fields: { file_id: 1 }, unique: true },
    { fields: { type: 1, status: 1, created_at: -1 } },
    { fields: { uploaded_by: 1, created_at: -1 } },
    { fields: { nap_associated: 1, type: 1 } },
    { fields: { checksum: 1, original_filename: 1 } },
    { fields: { original_filename: 'text', uploaded_by: 'text' } }
  ],
  FILE_EDIT_HISTORY: [
    { fields: { history_id: 1 }, unique: true },
    { fields: { file_id: 1, edit_timestamp: -1 } },
    { fields: { editor: 1, edit_timestamp: -1 } },
    { fields: { edit_type: 1, edit_timestamp: -1 } },
    { fields: { changes_summary: 'text', editor: 'text' } }
  ],
  ROUTESET_MAPPINGS: [
    { fields: { mapping_id: 1 }, unique: true },
    { fields: { nap_reference: 1, mapping_status: 1 } },
    { fields: { mapped_by: 1, mapping_created_at: -1 } },
    { fields: { digitmap_file_id: 1, definition_file_id: 1 } }
  ],
  ACTIVATION_LOGS: [
    { fields: { log_id: 1 }, unique: true },
    { fields: { action: 1, status: 1, 'timing_info.start_time': -1 } },
    { fields: { 'execution_context.executed_by': 1, 'timing_info.start_time': -1 } },
    { fields: { nap_id: 1, 'timing_info.start_time': -1 } },
    { fields: { file_id: 1, action: 1 } }
  ]
};

export default {
  DATABASE_CONFIG,
  COLLECTIONS,
  STATUS,
  FILE_TYPES,
  EDIT_TYPES,
  ACTION_TYPES,
  TAGS,
  ERROR_CODES,
  SUCCESS_MESSAGES,
  DEFAULTS,
  VALIDATION_RULES,
  INDEXES
};
