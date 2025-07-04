# ProSBC File Management Database System

## Overview

The ProSBC File Management Database System provides a comprehensive solution for storing, managing, and synchronizing files fetched from ProSBC devices. This system uses IndexedDB for local storage and offers advanced features for file versioning, searching, synchronization, and **enhanced separation of Definition Files (DF) and Digit Map Files (DM)** with intelligent categorization and export capabilities.

## Key Features

### 🗄️ Local Database Storage
- **IndexedDB Integration**: Uses browser's IndexedDB for efficient local storage
- **File Versioning**: Tracks all changes with complete version history 
- **Metadata Management**: Stores file metadata including size, type, and modification dates
- **Sync Status Tracking**: Monitors synchronization status between local and ProSBC
- **DF/DM Separation**: Intelligent handling and categorization of Definition Files and Digit Maps

### 📊 Enhanced File Analysis
- **DF Analysis**: Routeset count, priority levels, weight distribution, complexity scoring
- **DM Analysis**: Number patterns, routeset mappings, complexity scoring
- **File Categorization**: Automatic classification as simple, moderate, or complex
- **Storage Distribution**: Separate tracking of DF and DM storage usage
- **Advanced Statistics**: Comprehensive breakdown of file types and categories

### 📊 Database Statistics
- Total files count
- File type breakdown (DF/DM)
- Modified files tracking
- Storage size monitoring
- Last update timestamps

### 🔍 Advanced Search & Filtering
- **Content Search**: Search within file contents
- **Filename Search**: Find files by name
- **Type Filtering**: Filter by file type (DF/DM)
- **Category Filtering**: Filter by complexity category (simple, moderate, complex)
- **Real-time Results**: Dynamic search results

### 🔄 Synchronization Features
- **Bidirectional Sync**: Sync between database and ProSBC
- **Batch Operations**: Sync multiple files at once
- **Conflict Resolution**: Handle sync conflicts gracefully
- **Queue Management**: Automatic sync queue processing

### ✏️ File Editing
- **In-place Editing**: Edit files directly in the database
- **Version Control**: Automatic version creation on edits
- **Change Tracking**: Monitor what changed between versions
- **Undo Capabilities**: Revert to previous versions

### 📤 Enhanced Export Features
- **Organized Directory Structure**: Separate folders for DF and DM files
- **Metadata Export**: Complete file metadata with each export
- **ZIP Archive Creation**: Compressed exports with organized structure
- **Backup Capabilities**: Full database backup with restore options
- **Type-Specific Exports**: Export DF and DM files separately

## Architecture

### Database Schema

#### Files Store
```javascript
{
  id: number,              // Auto-increment primary key
  fileName: string,        // Original filename
  fileType: string,        // 'routesets_definitions' or 'routesets_digitmaps'
  prosbcId: string,        // Original ProSBC file ID
  content: string,         // File content
  originalContent: string, // Original content for comparison
  parsedData: array,       // Parsed file data for editing
  status: string,          // 'stored', 'modified', 'synced'
  createdAt: string,       // ISO timestamp
  lastModified: string,    // ISO timestamp
  version: number,         // Version number
  metadata: object,        // Additional metadata
  category: string,        // 'definition_file' or 'digit_map'
  dfSpecific: object,      // DF-specific data (for DF files)
  dmSpecific: object       // DM-specific data (for DM files)
}
```

#### File Versions Store
```javascript
{
  id: number,           // Auto-increment primary key
  fileId: number,       // Reference to main file
  versionNumber: number, // Version number
  content: string,      // Version content
  parsedData: array,    // Parsed data for this version
  createdAt: string,    // ISO timestamp
  changes: object       // Change statistics
}
```

#### Sync Status Store
```javascript
{
  fileId: number,       // Reference to main file
  syncStatus: string,   // 'pending', 'syncing', 'synced', 'error'
  lastSyncTime: string, // ISO timestamp
  attempts: number      // Retry attempts
}
```

#### DF-Specific Data Structure
```javascript
dfSpecific: {
  routesetCount: number,         // Number of routesets in the file
  priorityLevels: array,         // Array of priority levels
  weightDistribution: object,    // Weight distribution mapping
  remappingRules: array,         // Array of remapping rules
  complexity: number             // Complexity score (0-100)
}
```

#### DM-Specific Data Structure  
```javascript
dmSpecific: {
  numberPatterns: array,         // Array of number patterns
  routesetMappings: object,      // Routeset mapping objects
  calledNumbers: array,          // Array of called numbers
  callingNumbers: array,         // Array of calling numbers
  complexity: number             // Complexity score (0-100)
}
```

## Usage Guide

### 1. Initial Setup

The database is automatically initialized when the FileManagement component loads. No manual setup is required.

### 2. Enhanced Fetching with DF/DM Separation

```javascript
// Fetch all files with enhanced separation and categorization
const result = await enhancedFileStorageService.fetchAndStoreFilesSeparately();

// Result includes detailed breakdown
console.log(result.summary.stats.dfFiles); // Number of DF files
console.log(result.summary.stats.dmFiles); // Number of DM files
```

```javascript
// Fetch all files from ProSBC and store in database
const result = await fileManagementService.fetchAndStoreFiles();
```

### 3. Working with Categorized Files

```javascript
// Get files by category
const complexDfFiles = await enhancedFileStorageService.getFilesByCategory('complex', 'routesets_definitions');
const simpleDmFiles = await enhancedFileStorageService.getFilesByCategory('simple', 'routesets_digitmaps');

// Get DF statistics
const dfStats = await enhancedFileStorageService.getDfStatistics();
console.log(dfStats.categories); // Category breakdown
console.log(dfStats.complexityDistribution); // Complexity distribution
```

```javascript
// Get all stored files
const files = await fileManagementService.getStoredFiles();

// Get files by type
const dfFiles = await fileManagementService.getStoredFilesByType('routesets_definitions');

// Search files
const searchResults = await fileManagementService.searchStoredFiles('search term');
```

### 4. Editing Files

```javascript
// Update file content
const result = await fileManagementService.updateStoredFileContent(fileId, newContent);

// Get file versions
const versions = await fileManagementService.getFileVersions(fileId);
```

### 6. Enhanced Export Features

```javascript
// Export with organized directory structure
const result = await fileExportService.exportMultipleFilesAsZip(files);
// Creates: ProSBC_Files/Definition_Files/ and ProSBC_Files/Digit_Maps/

// Export files by type separately
const result = await fileExportService.exportFilesByType(files);
// Creates: ProSBC_DF_Files.zip and ProSBC_DM_Files.zip

// Export database backup with complete metadata
const result = await fileExportService.exportDatabaseBackup(files);
// Creates: ProSBC_Database_Backup_YYYY-MM-DD.zip
```

```javascript
// Sync single file to ProSBC
const result = await fileManagementService.syncFileToProSBC(fileId);

// Sync all pending files
const result = await fileManagementService.syncAllPendingFiles();
```

## API Reference

### FileDatabase Class

#### Methods

- `initialize()`: Initialize the database
- `storeFile(fileData)`: Store a new file or update existing
- `getFileByProSBCId(prosbcId, fileType)`: Get file by ProSBC ID
- `getAllFiles()`: Get all stored files
- `getFilesByType(fileType)`: Get files by type
- `updateFileContent(fileId, newContent, parsedData)`: Update file content
- `getFileVersions(fileId)`: Get file version history
- `deleteFile(fileId)`: Delete file and all versions
- `searchFiles(searchTerm, fileType)`: Search files
- `getStats()`: Get database statistics

### EnhancedFileStorageService Class

#### Methods

- `fetchAndStoreFilesSeparately(onProgress)`: Fetch with enhanced DF/DM separation
- `processDfFiles(dfFiles, onProgress)`: Process DF files with specific handling
- `processDmFiles(dmFiles, onProgress)`: Process DM files with specific handling
- `categorizeDfFile(fileData)`: Categorize DF file by complexity
- `categorizeDmFile(fileData)`: Categorize DM file by complexity
- `getFilesByCategory(category, fileType)`: Get files by category
- `getDfStatistics()`: Get comprehensive DF statistics
- `getDmStatistics()`: Get comprehensive DM statistics

### FileExportService Class

#### Methods

- `exportMultipleFilesAsZip(files, zipName)`: Export with organized directory structure
- `exportFilesByType(files, separateByType)`: Export DF and DM files separately
- `exportDatabaseBackup(files, includeVersionHistory)`: Export complete database backup
- `exportFileToDownload(file, includeMetadata)`: Export single file with metadata

### FileManagementService Class

#### Methods

- `fetchAndStoreFiles(onProgress)`: Fetch from ProSBC and store
- `getStoredFiles()`: Get all stored files with sync status
- `getStoredFilesByType(fileType)`: Get files by type
- `searchStoredFiles(searchTerm, fileType)`: Search stored files
- `updateStoredFileContent(fileId, newContent, autoSync)`: Update file content
- `syncFileToProSBC(fileId, onProgress)`: Sync file to ProSBC
- `syncAllPendingFiles(onProgress)`: Sync all pending files
- `deleteStoredFile(fileId)`: Delete stored file
- `getFileVersions(fileId)`: Get file versions
- `getDatabaseStats()`: Get database statistics
- `clearDatabase()`: Clear all data

## File Categories and Complexity Scoring

### DF File Categories

- **Simple**: Basic routesets with low complexity (score 0-40)
- **Moderate**: Standard routesets with moderate complexity (score 41-70)
- **Complex**: Advanced routesets with high complexity (score 71-100)
- **Multi-Routeset**: Files with multiple routesets (5+ routesets)

### DM File Categories

- **Simple**: Basic digit maps with low complexity (score 0-40)
- **Moderate**: Standard digit maps with moderate complexity (score 41-70)
- **Complex**: Advanced digit maps with high complexity (score 71-100)
- **Multi-Pattern**: Files with multiple number patterns (10+ patterns)

### Complexity Scoring Factors

**For DF Files:**
- Routeset count × 10 points
- Priority levels × 5 points
- Remapping rules × 15 points
- Weight distribution variety × 3 points

**For DM Files:**
- Number patterns × 8 points
- Routeset mappings × 12 points
- Unique called numbers × 2 points
- Unique calling numbers × 2 points

## Directory Structure for Exports

```
ProSBC_Files/
├── Definition_Files/
│   ├── [DF file 1].csv
│   ├── [DF file 2].csv
│   └── ...
├── Digit_Maps/
│   ├── [DM file 1].csv
│   ├── [DM file 2].csv
│   └── ...
├── Metadata/
│   ├── DF_[filename]_metadata.txt
│   ├── DM_[filename]_metadata.txt
│   └── ...
└── EXPORT_SUMMARY.txt
```

## File Status Indicators

- **🟢 Synced**: File is synchronized with ProSBC
- **🟡 Modified**: File has local changes not yet synced
- **🔵 Pending**: File is queued for synchronization
- **🔴 Error**: Synchronization failed

## Best Practices

### 1. Regular Synchronization
- Keep files synchronized regularly to avoid conflicts
- Use batch sync for multiple files
- Monitor sync status indicators

### 2. Version Management
- Review version history before major changes
- Use descriptive commit messages for significant updates
- Consider creating manual backups for critical files

### 3. Search Optimization
- Use specific search terms for better results
- Combine filename and content searches
- Utilize file type filters

### 4. Performance Considerations
- Regularly clean up old versions if not needed
- Monitor database size in browser settings
- Consider archiving old files periodically

## Troubleshooting

### Common Issues

1. **Database Not Initializing**
   - Check browser IndexedDB support
   - Clear browser cache and reload
   - Check for storage quota issues

2. **Sync Failures**
   - Verify ProSBC connectivity
   - Check authentication status
   - Review file permissions

3. **Search Not Working**
   - Ensure files are properly indexed
   - Check search term formatting
   - Verify file content is loaded

4. **Version History Missing**
   - Check if versioning is enabled
   - Verify database integrity
   - Review file update operations

### Recovery Options

1. **Database Corruption**
   - Use the "Clear Database" option
   - Re-fetch all files from ProSBC
   - Restore from backup if available

2. **Sync Issues**
   - Check ProSBC system status
   - Verify network connectivity
   - Review authentication credentials

## Security Considerations

- All data is stored locally in the browser
- No sensitive data is transmitted without encryption
- Regular cleanup of temporary data
- User authentication is required for ProSBC operations

## Future Enhancements

- File export/import functionality
- Advanced conflict resolution
- Real-time collaboration features
- Enhanced search capabilities
- Performance monitoring and optimization
