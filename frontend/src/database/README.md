# ProSBC NAP Testing - Enhanced Database System

## 📋 Overview

This enhanced database system provides comprehensive data management for the ProSBC NAP Testing project. It includes robust schemas, services, and file storage management with full audit trails and validation.

## 🗄️ Database Architecture

### Database Choice: MongoDB with Mongoose

**Why MongoDB?**
- Flexible JSON document storage ideal for NAP configurations
- Dynamic schema for evolving file metadata requirements
- Excellent performance for read-heavy operations
- Built-in indexing and aggregation capabilities
- Easy horizontal scaling

### Schema Design

#### 1. NAP Records (`nap_records`)
Stores all NAP configurations with validation and metadata:
```javascript
{
  nap_id: String (unique),
  name: String,
  config_json: Mixed (NAP configuration),
  status: Enum ['draft', 'pending', 'active', 'inactive', 'error', 'archived'],
  created_by: String,
  tags: [String],
  validation_results: Object,
  integration_flags: Object,
  associated_files: [Object],
  version: Number
}
```

#### 2. Uploaded Files (`uploaded_files`)
Tracks all file uploads with comprehensive metadata:
```javascript
{
  file_id: String (unique),
  type: Enum ['DF', 'DM', 'Routeset', 'Backup', 'Config'],
  nap_associated: String (ref),
  uploaded_by: String,
  file_path: String (absolute path),
  original_filename: String,
  file_size: Number,
  version: Number,
  status: Enum ['active', 'archived', 'deleted', 'corrupted'],
  validation_results: Object,
  checksum: String (SHA-256)
}
```

#### 3. File Edit History (`file_edit_history`)
Complete audit trail for all file modifications:
```javascript
{
  history_id: String (unique),
  file_id: String (ref),
  editor: String,
  edit_type: Enum ['create', 'update', 'delete', 'restore'],
  changes_summary: String,
  detailed_changes: Object,
  csv_backup: String,
  json_table_format: Object,
  rollback_info: Object
}
```

#### 4. Routeset Mapping (`routeset_mappings`)
Manages file-to-NAP associations:
```javascript
{
  mapping_id: String (unique),
  nap_reference: String (ref),
  digitmap_file_id: String (ref),
  definition_file_id: String (ref),
  mapping_config: Object,
  validation_results: Object,
  sync_info: Object
}
```

#### 5. Activation Logs (`activation_logs`)
Comprehensive logging for ProSBC operations:
```javascript
{
  log_id: String (unique),
  nap_id: String (ref),
  file_id: String (ref),
  action: Enum [...many action types],
  status: Enum ['success', 'failed', 'pending', 'timeout'],
  response_log: Object,
  timing_info: Object,
  error_details: Object
}
```

## 📁 File System Organization

### Storage Structure
```
/opt/prosbc-dashboard/files/
├── df/              # Definition Files
├── dm/              # Digit Manipulation Files  
├── routesets/       # Routeset Files
├── backups/         # Automatic backups
├── temp/           # Temporary uploads
├── configs/        # Configuration exports
└── exports/        # Data exports
```

### File Naming Convention
```
{timestamp}_{original_name}_{random_id}.{ext}
Example: 2025-01-04T10-30-00-000Z_dialplan_abc123def.csv
```

## 🔧 Services Architecture

### 1. DatabaseService
Main service for all database operations:
- CRUD operations for all entities
- Search and analytics
- Bulk operations
- Transaction management

### 2. FileStorageService  
File system management:
- File upload/download
- Backup creation
- Storage optimization
- Security validation

### 3. AuditService
Audit trail management:
- Activity logging
- Change tracking
- Rollback functionality
- Performance metrics

### 4. ValidationService
Data validation:
- NAP configuration validation
- File structure validation
- Business rule enforcement
- Cross-reference validation

## 🚀 Usage Examples

### Basic Operations

#### Initialize Database
```javascript
import { initializeDatabase } from './src/database/index.js';

await initializeDatabase();
```

#### Create NAP
```javascript
import { quickAccess } from './src/database/index.js';

const result = await quickAccess.createNap({
  name: 'Emergency NAP',
  config_json: { /* NAP config */ },
  tags: ['emergency', 'production']
}, 'admin_user');
```

#### Upload File
```javascript
const fileResult = await quickAccess.saveFile({
  type: 'DF',
  original_filename: 'dialplan.csv',
  content: csvContent,
  nap_associated: 'nap_12345'
}, 'user123');
```

#### Search Operations
```javascript
import DatabaseService from './src/database/services/databaseService.js';

const dbService = new DatabaseService();
const results = await dbService.search('emergency', {
  type: 'nap',
  status: 'active'
});
```

### Advanced Operations

#### File Rollback
```javascript
import AuditService from './src/database/services/auditService.js';

const auditService = new AuditService();
const candidates = await auditService.getRollbackCandidates('file_123');
const rollback = await auditService.executeRollback(
  candidates[0].history_id, 
  'admin_user',
  'Reverting problematic changes'
);
```

#### Bulk Validation
```javascript
import ValidationService from './src/database/services/validationService.js';

const validationService = new ValidationService();
const result = await validationService.validateBulkOperation(
  files, 
  'upload'
);
```

## 📊 Performance Features

### Indexing Strategy
- Compound indexes for common query patterns
- Text indexes for search functionality
- TTL indexes for temporary data cleanup

### Optimization Features
- Connection pooling
- Query optimization
- Automatic cleanup of temporary files
- Backup rotation

### Monitoring
- Performance metrics collection
- Error rate tracking
- Storage usage monitoring
- Activity analytics

## 🔒 Security Features

### File Security
- File type validation
- Content scanning for malicious patterns
- Checksum verification
- Size limits

### Data Protection
- Audit trails for all operations
- Soft delete with recovery
- Automatic backups
- Data encryption support

### Access Control
- User-based operation tracking
- Session management
- IP address logging
- Operation timeouts

## 🔧 Configuration

### Environment Variables
```bash
# Database
MONGODB_URI=mongodb://localhost:27017/prosbc_nap_testing
NODE_ENV=development

# File Storage
PROSBC_STORAGE_PATH=/opt/prosbc-dashboard/files
MAX_FILE_SIZE=52428800  # 50MB
CSV_MAX_ROWS=10000
CSV_MAX_COLUMNS=100

# Security
CLIENT_IP=auto
USER_AGENT=ProSBC-Dashboard
API_VERSION=1.0.0
```

## 📈 Scalability Considerations

### Horizontal Scaling
- MongoDB sharding support
- Distributed file storage
- Load balancing ready

### Performance Optimization
- Lazy loading for large datasets
- Pagination for all list operations
- Caching layer support
- Background processing

### Monitoring & Maintenance
- Health check endpoints
- Performance metrics
- Automatic cleanup tasks
- Backup verification

## 🐛 Error Handling

### Graceful Degradation
- Fallback mechanisms
- Retry logic for network operations
- Circuit breaker patterns
- Comprehensive error logging

### Recovery Procedures
- Automatic rollback on errors
- Backup restoration
- Data consistency checks
- Manual recovery tools

## 📝 Best Practices

### Development
1. Always use transactions for multi-document operations
2. Implement proper error handling
3. Use the service layer for business logic
4. Validate all inputs

### Production
1. Monitor performance metrics
2. Implement proper backup strategies
3. Use connection pooling
4. Secure file storage paths

### Maintenance
1. Regular cleanup of temporary files
2. Monitor disk space usage
3. Verify backup integrity
4. Update indexes as needed

## 🔄 Migration Strategy

### From Existing Systems
1. Data export from current system
2. Schema mapping and validation
3. Incremental migration with rollback
4. Verification and testing

### Version Updates
1. Schema versioning
2. Backward compatibility
3. Migration scripts
4. Testing procedures

This enhanced database system provides a robust, scalable, and maintainable foundation for your ProSBC NAP testing project.
