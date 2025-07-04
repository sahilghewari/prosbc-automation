# CSV File Editor - ProSBC Configuration Management

## Overview

The CSV File Editor is a comprehensive feature that allows users to view, edit, and update ProSBC configuration files directly through an intuitive web interface. This feature enables real-time editing of CSV files with automatic backup creation and seamless integration with ProSBC's update mechanisms.

## 🎯 Key Features

### 1. Interactive Table Editor
- **Dynamic HTML Table**: View and edit CSV files in a user-friendly table format
- **Editable Cells**: Click any cell to edit its content directly
- **Real-time Updates**: Changes are reflected immediately in the interface

### 2. Row and Column Management
- **Add Rows**: Dynamically add new rows to the table
- **Delete Rows**: Remove unwanted rows (minimum 1 row required)
- **Add Columns**: Expand the table with new columns
- **Delete Columns**: Remove unnecessary columns (minimum 1 column required)
- **Header Editing**: Modify column headers directly

### 3. File Management
- **Upload CSV Files**: Upload new CSV files from your local computer
- **Select Existing Files**: Choose from files already stored in ProSBC or local database
- **File Validation**: Automatic validation of CSV format and structure
- **Content Preview**: View file content before editing

### 4. Safety Features
- **Automatic Backup**: Creates backup copies before any changes
- **Change Tracking**: Visual indicators for unsaved changes
- **Reset Functionality**: Revert to original state at any time
- **Confirmation Dialogs**: Prevent accidental data loss

### 5. ProSBC Integration
- **Multipart Upload**: Uses proper multipart/form-data POST requests
- **Authentication**: Handles `authenticity_token` and authentication automatically
- **File Type Support**: Supports both Definition Files and Digit Map Files
- **Status Feedback**: Real-time progress updates during upload

## 🚀 How to Use

### Accessing the CSV Editor

1. Navigate to the **File Management** section
2. Click on the **📋 CSV Editor** tab
3. Click **"Open CSV Editor"** to launch the interface

### Editing Process

#### Option 1: Upload New File
1. Click **"Upload New CSV File"** section
2. Select a CSV file from your computer
3. The file will be automatically loaded into the editor
4. Make your changes using the table interface
5. Click **"Save and Upload to ProSBC"** when done

#### Option 2: Edit Existing File
1. Browse the **"Available Files"** section
2. Click **"✏️ Edit"** on the file you want to modify
3. The file content will be loaded into the editor
4. Make your changes using the table interface
5. Click **"Save and Upload to ProSBC"** when done

### Table Editing Features

- **Edit Cells**: Click on any cell to edit its content
- **Edit Headers**: Modify column names directly in the header row
- **Add Row**: Click the **"Add Row"** button to insert a new row
- **Delete Row**: Click the **"×"** button next to any row number
- **Add Column**: Click the **"Add Column"** button to add a new column
- **Delete Column**: Click the **"×"** button in any column header

## 🛡️ Technical Implementation

### Frontend Components

#### CSVFileEditor.jsx
- Main container component
- Handles file selection and upload
- Manages backup restoration
- Provides navigation between file selection and editing views

#### CSVEditorTable.jsx
- Core table editing functionality
- Handles CSV parsing and generation
- Manages row/column operations
- Implements save functionality

### Backend Services

#### csvFileUpdateService.js
- Handles ProSBC file updates
- Manages authentication and CSRF tokens
- Creates and manages backups
- Provides update history tracking

#### File Update Flow
1. **Authentication**: Extracts CSRF token from ProSBC edit form
2. **Backup Creation**: Automatically creates backup before changes
3. **Form Preparation**: Builds multipart/form-data with correct field names
4. **Upload**: Sends PUT request to ProSBC with file content
5. **Verification**: Validates successful upload and updates local database

### Security Features

- **CSRF Protection**: Handles `authenticity_token` automatically
- **Basic Authentication**: Uses configured ProSBC credentials
- **Input Validation**: Validates CSV format and content
- **Backup System**: Automatic backup creation before any changes

## 📋 Supported File Types

### Definition Files (DF)
- **ProSBC Path**: `/file_dbs/1/routesets_definitions/`
- **Field Name**: `tbgw_routesets_definition[file]`
- **Purpose**: Configure routing definitions

### Digit Map Files (DM)
- **ProSBC Path**: `/file_dbs/1/routesets_digitmaps/`
- **Field Name**: `tbgw_routesets_digitmap[file]`
- **Purpose**: Configure digit mapping rules

## 🔧 Configuration

### Environment Variables
```bash
VITE_PROSBC_USERNAME=your_username
VITE_PROSBC_PASSWORD=your_password
```

### API Endpoints
- **Edit Form**: `/file_dbs/{fileDbId}/{fileType}/{routesetId}/edit`
- **Update**: `/file_dbs/{fileDbId}/{fileType}/{routesetId}` (POST with `_method=put`)
- **Export**: `/file_dbs/{fileDbId}/{fileType}/{routesetId}/export`

## 💾 Backup System

### Automatic Backups
- Created before any file modification
- Stored in browser localStorage
- Includes original file metadata
- Timestamped for easy identification

### Backup Management
- **View Backups**: Access all stored backups
- **Restore**: Load backup content into editor
- **Delete**: Remove unwanted backups
- **Automatic Cleanup**: Maintains reasonable storage limits

## 📊 Update History

The system maintains a comprehensive history of all file updates:

- **Success/Failure Status**: Track which updates succeeded
- **Timestamp**: When each update was performed
- **File Information**: Which files were modified
- **Error Details**: Specific error messages for failed updates
- **Attempt Count**: Number of retry attempts made

## 🎨 User Interface

### Modern Design
- **Gradient Backgrounds**: Attractive visual design
- **Responsive Layout**: Works on desktop and mobile devices
- **Intuitive Icons**: Clear visual indicators for all actions
- **Status Indicators**: Real-time feedback on operations

### Accessibility
- **Keyboard Navigation**: Full keyboard support
- **Screen Reader Friendly**: Proper ARIA labels and descriptions
- **High Contrast**: Clear visual distinction between elements
- **Focus Indicators**: Clear focus states for all interactive elements

## 🔍 Error Handling

### Validation Errors
- **Empty Files**: Prevents saving empty CSV files
- **Invalid Format**: Validates CSV structure
- **Missing Headers**: Ensures proper header row exists
- **Cell Validation**: Checks for valid cell content

### Network Errors
- **Connection Issues**: Handles ProSBC connectivity problems
- **Authentication Failures**: Manages session expiration
- **Upload Failures**: Provides detailed error messages
- **Retry Logic**: Automatic retry for transient failures

## 📈 Performance Optimization

### Efficient Parsing
- **Streaming CSV Parser**: Handles large files efficiently
- **Memory Management**: Optimized for large datasets
- **Lazy Loading**: Content loaded only when needed
- **Debounced Updates**: Prevents excessive API calls

### Caching Strategy
- **Local Storage**: Caches file content for offline editing
- **Session Management**: Maintains ProSBC session across requests
- **Metadata Caching**: Stores file information locally

## 🧪 Testing

### Manual Testing Steps
1. **Upload Test**: Upload a valid CSV file
2. **Edit Test**: Modify cells, add/remove rows and columns
3. **Save Test**: Save changes and verify ProSBC update
4. **Backup Test**: Verify backup creation and restoration
5. **Error Test**: Test error handling with invalid files

### Test Data
```csv
Name,Type,Priority,Weight
Route1,Definition,1,100
Route2,Definition,2,200
Route3,Definition,3,300
```

## 🚨 Troubleshooting

### Common Issues

#### "Authentication Failed"
- **Solution**: Check VITE_PROSBC_USERNAME and VITE_PROSBC_PASSWORD
- **Verification**: Test connection in File Update tab

#### "File Not Found"
- **Solution**: Refresh file list or fetch from ProSBC
- **Check**: Ensure file exists in ProSBC system

#### "Invalid CSV Format"
- **Solution**: Ensure file has proper CSV structure
- **Requirements**: Must have headers and at least one data row

#### "Upload Failed"
- **Solution**: Check ProSBC connectivity and credentials
- **Retry**: Use the automatic retry functionality

### Debug Information
- Browser console logs provide detailed operation tracking
- Network tab shows ProSBC communication
- Local storage contains backup and session information

## 🔮 Future Enhancements

### Planned Features
- **Bulk Operations**: Edit multiple files simultaneously
- **Advanced Validation**: Custom validation rules per file type
- **Export Options**: Export to different formats (JSON, XML)
- **Collaboration**: Multi-user editing capabilities
- **Version Control**: Full version history with diff views

### Integration Opportunities
- **Git Integration**: Track changes in version control
- **API Extensions**: Additional ProSBC configuration endpoints
- **Workflow Automation**: Automated deployment pipelines
- **Monitoring**: Real-time change notifications

## 📞 Support

For technical support or feature requests:

1. **Check Documentation**: Review this README and component comments
2. **Console Logs**: Check browser developer tools for error details
3. **Test Connection**: Use the built-in connection test feature
4. **Backup Recovery**: Use backup system for data recovery

---

*This CSV File Editor provides a powerful, user-friendly interface for managing ProSBC configuration files with enterprise-grade security, backup, and validation features.*
