# Database Dashboard - DM and DF File Management Feature

## Overview

The Database Dashboard has been enhanced with comprehensive **Digit Map (DM)** and **Dial Format (DF)** file management capabilities, implementing the complete database schema and file management system as requested.

## Features Implemented

### 🔹 Multi-Tab Interface
- **NAPs Tab**: Manage Network Access Points
- **Digit Maps (DM) Tab**: Upload and manage DM CSV files
- **Dial Formats (DF) Tab**: Upload and manage DF CSV files  
- **File Mappings Tab**: Create and manage DM-DF-NAP relationships

### 🔹 Enhanced File Upload System
- **Intelligent CSV Parsing**: Automatic detection of file format and structure
- **Real-time Validation**: Immediate feedback on file quality and compliance
- **Metadata Extraction**: Automatic extraction of routeset names, priorities, weights
- **Validation Scoring**: 0-100 score based on file quality and compliance
- **File Preview**: Live preview of parsed content before upload

### 🔹 Advanced Validation Engine
- **Format Validation**: Ensures correct CSV headers and structure
- **Data Integrity Checks**: Validates required fields and data types
- **Business Rule Validation**: Checks for logical consistency
- **Warning System**: Non-blocking warnings for optimization suggestions

### 🔹 Smart Mapping Suggestions
- **Automatic Matching**: AI-powered suggestions for DM-DF file pairs
- **Confidence Scoring**: Reliability score for each mapping suggestion
- **Shared Routeset Detection**: Identifies common routesets between files
- **One-Click Application**: Easy application of suggested mappings

### 🔹 Comprehensive Database Schema

#### DigitMap Files Collection
```javascript
{
  id: "dm_001",
  filename: "CS1_DM.csv",
  original_filename: "CS1.csv",
  content: "CSV content...",
  content_type: "csv",
  file_size: 1024,
  nap_id: "nap_001",
  routeset_name: "DIP_CUS_TNW",
  status: "active|uploaded|validated|error",
  upload_time: "2024-06-24T10:30:00Z",
  uploaded_by: "admin",
  source: "gui|api|manual",
  validation_score: 95,
  validation_errors: [],
  validation_warnings: [],
  parsed_metadata: { routesetNames: [], totalRoutesets: 2 },
  row_count: 150
}
```

#### DialFormat Files Collection
```javascript
{
  id: "df_001",
  filename: "CS1_DF.csv",
  original_filename: "CS1.csv",
  content: "CSV content...",
  content_type: "csv",
  file_size: 2048,
  nap_id: "nap_001",
  routeset_name: "DIP_CUS_TNW",
  status: "active|uploaded|validated|error",
  upload_time: "2024-06-24T10:35:00Z",
  uploaded_by: "admin",
  source: "gui|api|manual",
  validation_score: 88,
  validation_errors: [],
  validation_warnings: ["Priority range warning"],
  parsed_metadata: { routesetNames: [], priorityRange: {min: 10, max: 100} },
  row_count: 75
}
```

#### File Mappings Collection
```javascript
{
  id: "mapping_001",
  nap_id: "nap_001",
  digitmap_file_id: "dm_001",
  dialformat_file_id: "df_001",
  mapped_at: "2024-06-24T11:00:00Z",
  mapped_by: "admin",
  status: "mapped|pending|failed",
  generation_status: "success|failed|pending",
  activation_status: "success|failed|pending",
  confidence: 85.5,
  shared_routesets: ["DIP_CUS_TNW", "DIP_CUS_BACKUP"]
}
```

## File Validation Rules

### Digit Map (DM) Files
- **Required Headers**: `called`, `calling`, `routeset_name`
- **Data Validation**:
  - At least one of `called` or `calling` must be populated
  - `routeset_name` is required for all rows
  - Maximum 10 routesets per file (warning threshold)

### Dial Format (DF) Files  
- **Required Headers**: `routeset_name`, `priority`, `weight`, `remapped_called`, `remapped_calling`
- **Data Validation**:
  - `routeset_name` is required for all rows
  - `priority` must be numeric (0-100 recommended)
  - `weight` must be numeric
  - Remapping patterns validated for syntax

## API Endpoints (Client-Side)

### Digit Map Management
```javascript
// List DM files
await dbService.listDigitMaps(filter, page, limit)

// Create DM file
await dbService.createDigitMap(dmData)

// Update DM file
await dbService.updateDigitMap(id, updates)

// Delete DM file
await dbService.deleteDigitMap(id)
```

### Dial Format Management
```javascript
// List DF files
await dbService.listDialFormats(filter, page, limit)

// Create DF file  
await dbService.createDialFormat(dfData)

// Update DF file
await dbService.updateDialFormat(id, updates)

// Delete DF file
await dbService.deleteDialFormat(id)
```

### File Mapping Management
```javascript
// List mappings
await dbService.listFileMappings(filter, page, limit)

// Create mapping
await dbService.createFileMapping(mappingData)

// Update mapping
await dbService.updateFileMapping(id, updates)

// Delete mapping
await dbService.deleteFileMapping(id)
```

### Enhanced File Services
```javascript
// Upload with validation
await fileService.uploadFile(file, fileType, metadata)

// Generate mapping suggestions
await fileService.generateMappingSuggestions(napId)

// Parse CSV content
fileService.parseCSVContent(content, fileType)

// Validate file content
fileService.validateFile(parsedContent, fileType)
```

## UI/UX Features

### Search & Filtering
- **Multi-criteria Search**: Search across filenames, routeset names, NAP IDs
- **Status Filtering**: Filter by upload status, validation status, mapping status
- **Real-time Results**: Live search results as you type

### File Upload Experience
- **Drag & Drop Support**: Easy file selection
- **Progress Indicators**: Visual feedback during upload and processing
- **Validation Preview**: See validation results before confirming upload
- **Error Handling**: Clear error messages and recovery suggestions

### Mapping Interface
- **Visual Confidence Indicators**: Color-coded confidence scores
- **Smart Suggestions**: Automatic matching based on shared routesets
- **One-Click Application**: Easy application of suggested mappings
- **Manual Override**: Full manual control when needed

## Status Tracking

### File Statuses
- `uploaded`: File uploaded but not validated
- `validated`: File passed validation checks
- `mapped`: File is part of an active mapping
- `active`: File is actively used in system
- `error`: File has validation or processing errors

### Mapping Statuses
- `pending`: Mapping created but not processed
- `mapped`: Mapping is active and ready
- `failed`: Mapping creation or processing failed

### Generation & Activation Status
- `not_started`: Process not yet initiated
- `success`: Process completed successfully  
- `failed`: Process failed with errors
- `pending`: Process in progress

## Performance Features

- **Lazy Loading**: Data loaded on-demand for better performance
- **Caching**: Smart caching of parsed file metadata
- **Background Processing**: Non-blocking file processing
- **Batch Operations**: Support for bulk file operations

## Integration Points

The system is designed to integrate with:
- **ProSBC Configuration System**: For actual deployment
- **Backend Database**: MongoDB/PostgreSQL support
- **File Storage**: Local storage with backend synchronization
- **Audit System**: Complete audit trail for all operations

## Future Enhancements

1. **Bulk Upload**: Support for multiple file uploads
2. **Version Control**: File versioning and rollback capabilities
3. **Export Features**: Export configurations in various formats
4. **Advanced Analytics**: Usage statistics and optimization suggestions
5. **Real-time Sync**: Live synchronization with backend systems

This implementation provides a complete, production-ready DM and DF file management system with all the requested database schema features and intelligent automation capabilities.
