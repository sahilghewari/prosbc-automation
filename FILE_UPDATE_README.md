# ProSBC File Update System

A comprehensive file update system for ProSBC that handles file uploads with session management, authentication, and multipart/form-data support.

## Overview

This system provides a complete solution for updating files in ProSBC, including:

- **Session Management**: Handles `_WebOAMP_session` cookies automatically
- **Authentication**: Supports Basic Auth with environment variables
- **Multipart Form Data**: Properly formats requests with file uploads
- **Error Handling**: Comprehensive error handling with retry logic
- **Progress Tracking**: Real-time progress updates during file uploads
- **Validation**: File validation before upload
- **Batch Updates**: Support for updating multiple files

## Files Structure

```
src/utils/
├── fileManagementAPI.js      # Core API client for file updates
├── sessionManager.js         # Session and cookie management
├── fileUpdateService.js      # High-level service interface
└── fileUpdateService.js      # Legacy service (if exists)

src/components/
└── FileUpdateExample.jsx     # Example React component
```

## Core Components

### 1. FileManagementAPI (`fileManagementAPI.js`)

The core API client that handles:
- Session cookie management (`_WebOAMP_session`)
- Authenticity token extraction from edit forms
- Multipart/form-data request formatting
- HTTP request/response handling
- Redirect following for success confirmation

### 2. SessionManager (`sessionManager.js`)

Manages ProSBC sessions:
- Extracts and stores session cookies
- Handles session expiration
- Provides session validation
- Auto-refresh capabilities

### 3. FileUpdateService (`fileUpdateService.js`)

High-level service interface:
- Retry logic for failed updates
- Batch file updates
- Progress tracking
- Error categorization
- Update history tracking

## Usage

### Basic File Update

```javascript
import { updateFile } from './utils/fileUpdateService.js';

// Update a DF (Definition) file
const result = await updateFile(file, {
  fileDbId: 1,
  routesetId: 1,
  fileType: 'routesets_definitions', // For DF files
  onProgress: (progress, message) => {
    console.log(`${progress}%: ${message}`);
  }
});

// Update a DM (Digit Map) file
const result = await updateFile(file, {
  fileDbId: 1,
  routesetId: 1,
  fileType: 'routesets_digitmaps', // For DM files
  onProgress: (progress, message) => {
    console.log(`${progress}%: ${message}`);
  }
});

if (result.success) {
  console.log('File updated successfully!');
} else {
  console.error('Update failed:', result.error);
}
```

### Advanced Usage with Options

```javascript
import { updateFile } from './utils/fileUpdateService.js';

// Update DF file with advanced options
const result = await updateFile(file, {
  fileDbId: 1,
  routesetId: 1,
  fileType: 'routesets_definitions', // Required: specify file type
  onProgress: (progress, message) => {
    updateProgressBar(progress, message);
  },
  validateBeforeUpdate: true,
  retryOnSessionExpired: true,
  maxRetries: 3
});

// Update DM file with advanced options
const result = await updateFile(file, {
  fileDbId: 1,
  routesetId: 1,
  fileType: 'routesets_digitmaps', // Required: specify file type
  onProgress: (progress, message) => {
    updateProgressBar(progress, message);
  },
  validateBeforeUpdate: true,
  retryOnSessionExpired: true,
  maxRetries: 3
});
```

### Batch File Updates

```javascript
import { updateMultipleFiles } from './utils/fileUpdateService.js';

const results = await updateMultipleFiles(fileArray, {
  onProgress: (progress, message) => {
    console.log(`Overall progress: ${progress}%`);
  },
  onFileComplete: (file, result, index, total) => {
    console.log(`File ${index}/${total} completed: ${file.name}`);
  },
  continueOnError: true
});

console.log(`${results.successCount} files updated successfully`);
```

### Session Management

```javascript
import { sessionManager } from './utils/sessionManager.js';

// Check session status
const status = sessionManager.getSessionInfo();
console.log('Session status:', status);

// Test session validity
const validation = await sessionManager.validateSession(apiClient);
if (!validation.valid) {
  console.log('Session invalid:', validation.reason);
}
```

### Connection Testing

```javascript
import { testConnection } from './utils/fileUpdateService.js';

const connectionResult = await testConnection();
if (connectionResult.success) {
  console.log('Connected to ProSBC successfully');
} else {
  console.error('Connection failed:', connectionResult.error);
}
```

## Configuration

### Environment Variables

Create a `.env` file in your project root:

```env
VITE_PROSBC_USERNAME=your_username
VITE_PROSBC_PASSWORD=your_password
```

### API Endpoint

The system uses different endpoint patterns for different file types:

### DF (Definition) Files
```
POST /api/file_dbs/{fileDbId}/routesets_definitions/{routesetId}
```

With the following form data:
- `_method`: "put"
- `authenticity_token`: (extracted from edit form)
- `tbgw_routesets_definition[file]`: (file binary)
- `tbgw_routesets_definition[id]`: (record ID)
- `commit`: "Update"

### DM (Digit Map) Files
```
POST /api/file_dbs/{fileDbId}/routesets_digitmaps/{routesetId}
```

With the following form data:
- `_method`: "put"
- `authenticity_token`: (extracted from edit form)
- `tbgw_routesets_digitmap[file]`: (file binary)
- `tbgw_routesets_digitmap[id]`: (record ID)
- `commit`: "Update"

## Error Handling

The system provides comprehensive error handling:

### Error Types

1. **Authentication Errors** (401, 403)
   - Session expired
   - Invalid credentials
   - Missing authentication

2. **Validation Errors** (422)
   - Invalid file format
   - File too large
   - Invalid file content

3. **Server Errors** (500)
   - Internal server errors
   - Database issues

4. **Network Errors**
   - Connection timeouts
   - Connection refused
   - Network unavailable

### Retry Logic

The system automatically retries failed requests:
- Session-related errors: Clear session and retry
- Network errors: Retry with exponential backoff
- Server errors: Retry with delay

## React Component Example

```jsx
import React, { useState } from 'react';
import { updateFile } from '../utils/fileUpdateService.js';

const FileUploader = () => {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');

  const handleUpdate = async () => {
    if (!file) return;

    const result = await updateFile(file, {
      onProgress: (prog, msg) => {
        setProgress(prog);
        setMessage(msg);
      }
    });

    if (result.success) {
      alert('File updated successfully!');
    } else {
      alert(`Update failed: ${result.error}`);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept=".csv,.txt,.json"
        onChange={(e) => setFile(e.target.files[0])}
      />
      <button onClick={handleUpdate} disabled={!file}>
        Update File
      </button>
      <div>Progress: {progress}%</div>
      <div>Status: {message}</div>
    </div>
  );
};
```

## API Reference

### fileManagementAPI

```javascript
// Core API methods
await fileManagementAPI.updateFile(file, fileDbId, routesetId, onProgress)
await fileManagementAPI.getEditFormData(fileDbId, routesetId)
fileManagementAPI.validateFile(file)
fileManagementAPI.resetSession()
```

### sessionManager

```javascript
// Session management methods
sessionManager.getSessionCookie()
sessionManager.setSessionCookie(cookie)
sessionManager.getAuthenticityToken()
sessionManager.setAuthenticityToken(token)
sessionManager.clearSession()
await sessionManager.validateSession(apiClient)
```

### fileUpdateService

```javascript
// High-level service methods
await fileUpdateService.updateFile(file, options)
await fileUpdateService.updateMultipleFiles(files, options)
await fileUpdateService.testConnection()
fileUpdateService.getUpdateStatus()
fileUpdateService.getUpdateHistory()
```

## File Validation

The system validates files before upload:

### Supported File Types
- `.csv` - Comma-separated values
- `.txt` - Plain text files
- `.json` - JSON files

### File Size Limits
- Maximum file size: 10MB
- Files larger than 10MB will be rejected

### Custom Validation

```javascript
import { fileManagementAPI } from './utils/fileManagementAPI.js';

const validation = fileManagementAPI.validateFile(file);
if (!validation.valid) {
  console.log('Validation errors:', validation.errors);
}
```

## Troubleshooting

### Common Issues

1. **Session Expired Error**
   - The system automatically handles session expiration
   - Retries with fresh session automatically

2. **Authentication Failed**
   - Check environment variables
   - Verify credentials are correct

3. **File Too Large**
   - Reduce file size to under 10MB
   - Check file compression options

4. **Invalid File Format**
   - Ensure file has supported extension
   - Check file content format

### Debug Mode

Enable debug logging:

```javascript
// In browser console
localStorage.setItem('debug', 'prosbc:*');
```

### Network Issues

Check the browser's Network tab:
- Look for 401/403 errors (authentication)
- Check for 422 errors (validation)
- Verify multipart/form-data requests

## Security Considerations

1. **Credentials**: Store credentials in environment variables
2. **Session Cookies**: Automatically managed, not stored persistently
3. **CSRF Protection**: Authenticity tokens extracted from server
4. **File Upload**: Only specific file types allowed

## Performance

- **Timeout**: 2 minutes for file uploads
- **Retry**: Up to 3 attempts with exponential backoff
- **Progress**: Real-time progress updates
- **Memory**: Efficient handling of large files

## Contributing

When extending the system:

1. Maintain session management consistency
2. Follow error handling patterns
3. Provide progress callbacks
4. Add comprehensive logging
5. Include validation for new features

## License

This file update system is part of the ProSBC NAP testing application.
