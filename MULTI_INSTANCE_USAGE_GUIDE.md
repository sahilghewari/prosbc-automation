# Multi-ProSBC Instance Support - Usage Guide

## Overview

The ProSBC automation backend now supports multiple ProSBC instances with minimal code changes. All existing ProSBC utilities have been updated to work with specific instance configurations while maintaining backward compatibility.

## Quick Start

### 1. Basic Instance-Specific Usage

```javascript
import { createProSBCFileAPI } from './utils/prosbc/prosbcFileManager.js';
import { createNapEditService } from './utils/prosbc/napEditService.js';
import { fetchExistingNapsByInstance } from './utils/prosbc/napApiClientFixed.js';

// Create instance-specific services
const nycFileAPI = createProSBCFileAPI(1);  // ProSBC NYC1
const tpaFileAPI = createProSBCFileAPI(3);  // ProSBC TPA2

const nycNapService = createNapEditService(1);  // ProSBC NYC1
const tpaNapService = createNapEditService(3);  // ProSBC TPA2

// Use instance-specific operations
const nycNaps = await fetchExistingNapsByInstance('config_1', 1);
const tpaNaps = await fetchExistingNapsByInstance('config_1', 3);
```

### 2. File Upload with Instances

```javascript
import { uploadDfFileByInstanceId, uploadDmFileByInstanceId } from './utils/prosbc/fileUpload.js';

// Upload to specific ProSBC instances
await uploadDfFileByInstanceId(fileBuffer, 'routes.csv', sessionCookie, 1); // NYC1
await uploadDmFileByInstanceId(fileBuffer, 'digits.csv', sessionCookie, 3); // TPA2
```

### 3. RESTful API Endpoints

**Get all instances:**
```
GET /backend/api/prosbc-instances
```

**Get specific instance:**
```
GET /backend/api/prosbc-instances/:id
```

**Get NAPs for specific instance:**
```
GET /backend/api/prosbc-instances/:instanceId/naps
```

**Test connection to specific instance:**
```
POST /backend/api/prosbc-instances/:id/test
```

## Available ProSBC Instances

| ID | Name | Base URL | Location |
|----|------|----------|----------|
| 1 | ProSBC NYC1 | https://prosbc1nyc1.dipvtel.com:12358 | New York |
| 2 | ProSBC NYC2 | https://prosbc1nyc2.dipvtel.com:12358 | New York |
| 3 | ProSBC TPA2 | http://prosbc5tpa2.dipvtel.com:12358 | Tampa |

## Updated Utilities

### ProSBC File Manager
- **Old:** `new ProSBCFileAPI()` (environment-based)
- **New:** `createProSBCFileAPI(instanceId)` (instance-specific)
- **Backward Compatible:** ✅ Old usage still works

### NAP Edit Service
- **Old:** `new NapEditService(baseUrl)` (manual URL)
- **New:** `createNapEditService(instanceId)` (instance-specific)
- **Backward Compatible:** ✅ Old usage still works

### File Upload Utilities
- **New Functions:**
  - `uploadDfFileByInstanceId(fileBuffer, fileName, sessionCookie, instanceId)`
  - `uploadDmFileByInstanceId(fileBuffer, fileName, sessionCookie, instanceId)`
- **Original Functions:** Still available with optional `instanceId` parameter

### NAP API Client
- **New Functions:**
  - `fetchExistingNapsByInstance(configId, instanceId)`
  - `fetchDfFilesByInstance(configId, instanceId)`
  - `fetchDmFilesByInstance(configId, instanceId)`
  - `createInstanceApiClient(instanceId)`

## Backward Compatibility

All utilities maintain full backward compatibility:

```javascript
// This still works (uses environment variables)
const defaultAPI = createProSBCFileAPI(); // No instanceId
const defaultService = createNapEditService(); // No instanceId

// Original function signatures still work
await uploadDfFileToProSBC(fileBuffer, fileName, sessionCookie, baseUrl);
```

## Migration Guide

### For Existing Code

1. **No changes required** - existing code continues to work
2. **Optional upgrade** - add instance support where needed:

```javascript
// Before
const api = new ProSBCFileAPI();
await api.uploadFile(file);

// After (for specific instance)
const api = createProSBCFileAPI(instanceId);
await api.uploadFile(file);
```

### For New Development

Always use instance-specific functions:

```javascript
// Route handler example
app.post('/api/naps/:instanceId', async (req, res) => {
  const { instanceId } = req.params;
  const napService = createNapEditService(parseInt(instanceId));
  
  // Now all operations use the specified ProSBC instance
  const result = await napService.createNap(req.body);
  res.json(result);
});
```

## Configuration

Instance configurations are stored in the database (`ProSBCInstance` model):

```javascript
// Add new instance
await proSbcInstanceService.createInstance({
  name: 'ProSBC LA1',
  baseUrl: 'https://prosbc1la1.dipvtel.com:12358',
  username: 'Monitor',
  password: 'encrypted_password',
  location: 'Los Angeles',
  description: 'Los Angeles ProSBC instance',
  isActive: true
});
```

## Error Handling

```javascript
try {
  const context = await getInstanceContext(instanceId);
  const api = createProSBCFileAPI(instanceId);
  // ... operations
} catch (error) {
  if (error.message.includes('instance not found')) {
    // Handle missing instance
  } else if (error.message.includes('authentication failed')) {
    // Handle auth issues
  }
}
```

## Testing

Run the structure verification test:

```bash
cd backend_new
node test-structure-only.js
```

Run the mock API server:

```bash
cd backend_new
node test-multi-prosbc.js
```

## Summary

✅ **Multi-instance support** - Work with multiple ProSBC instances simultaneously
✅ **Backward compatibility** - Existing code continues to work unchanged  
✅ **Database-driven** - Instance configurations stored in database
✅ **RESTful API** - Complete CRUD operations for instance management
✅ **Minimal changes** - Factory functions provide instance-specific utilities
✅ **Comprehensive testing** - Structure and integration tests available

The implementation provides a clean path forward for managing multiple ProSBC instances while preserving all existing functionality.
