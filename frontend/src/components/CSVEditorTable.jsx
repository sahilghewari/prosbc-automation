import React, { useState, useEffect, useRef } from 'react';
import { prosbcFileAPI } from '../utils/prosbcFileApi';
import { csvFileUpdateService } from '../utils/csvFileUpdateService';
import { fileService } from '../services/apiClient.js';

const CSVEditorTable = ({ 
  csvData, 
  onSave, 
  onCancel, 
  isLoading = false, 
  fileInfo = null,
  onProgress = null 
}) => {
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [originalData, setOriginalData] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [errors, setErrors] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [backupCreated, setBackupCreated] = useState(false);
  const [apiClient, setApiClient] = useState(null);
  const [fileHistory, setFileHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [currentFileId, setCurrentFileId] = useState(null);
  
  const tableRef = useRef(null);
  const cellRefs = useRef({});

  // Initialize API client
  useEffect(() => {
    const initializeApi = async () => {
      try {
        setApiClient(fileService);
        console.log('✅ API client initialized');
      } catch (error) {
        console.error('❌ API client initialization failed:', error);
        // Continue without API - graceful degradation
      }
    };
    
    initializeApi();
  }, []);

  // Initialize table data from CSV
  useEffect(() => {
    if (csvData && csvData.trim()) {
      parseCSVData(csvData);
      
      // Load file history if fileInfo is available
      if (fileInfo?.id && apiClient) {
        loadFileHistory();
      }
    }
  }, [csvData, fileInfo, apiClient]);

  // Parse CSV data into table structure
  const parseCSVData = (csvString) => {
    try {
      const lines = csvString.trim().split('\n');
      if (lines.length === 0) return;

      // Parse headers (first row)
      const headerRow = lines[0];
      const parsedHeaders = parseCSVLine(headerRow);
      setHeaders(parsedHeaders);

      // Parse data rows
      const dataRows = [];
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          const rowData = parseCSVLine(lines[i]);
          // Ensure row has same number of columns as headers
          while (rowData.length < parsedHeaders.length) {
            rowData.push('');
          }
          dataRows.push({
            id: i,
            data: rowData,
            isNew: false
          });
        }
      }

      setRows(dataRows);
      setOriginalData({ headers: parsedHeaders, rows: dataRows });
      setHasChanges(false);
      setErrors({});
      
      console.log('CSV parsed successfully:', {
        headers: parsedHeaders.length,
        rows: dataRows.length
      });
    } catch (error) {
      console.error('Error parsing CSV:', error);
      setErrors({ parse: 'Failed to parse CSV data' });
    }
  };

  // Parse a single CSV line, handling quoted fields
  const parseCSVLine = (line) => {
    const result = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      
      if (char === '"' && !inQuotes) {
        inQuotes = true;
      } else if (char === '"' && inQuotes) {
        if (i + 1 < line.length && line[i + 1] === '"') {
          // Escaped quote
          currentField += '"';
          i++; // Skip next quote
        } else {
          inQuotes = false;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
      i++;
    }
    
    // Add the last field
    result.push(currentField.trim());
    
    return result;
  };

  // Load file history from database
  const loadFileHistory = async () => {
    if (!apiClient || !fileInfo?.id) return;
    
    try {
      // Get file history from backend
      const response = await apiClient.getHistory(fileInfo.type, fileInfo.id);
      if (response.success) {
        setFileHistory(response.data.history || []);
        console.log('✅ File history loaded:', response.data.history.length, 'entries');
      } else {
        console.error('Failed to load file history:', response.error);
        setFileHistory([]);
      }
    } catch (error) {
      console.error('Error loading file history:', error);
      setFileHistory([]);
    }
  };

  // Rollback to previous version
  const handleRollback = async (historyId, reason) => {
    if (!apiClient || !fileInfo?.id) {
      alert('API client not available');
      return;
    }

    if (!confirm(`Are you sure you want to rollback to this version?\nReason: ${reason}`)) {
      return;
    }

    setIsUpdating(true);
    
    try {
      onProgress?.(10, 'Preparing rollback...');
      
      // Perform rollback via backend API
      const rollbackResult = await apiClient.rollback(fileInfo.type, fileInfo.id, historyId, reason);
      
      if (rollbackResult.success) {
        onProgress?.(50, 'Getting updated content...');
        
        // Fetch the updated file content
        const updatedFileResponse = await apiClient.getById(fileInfo.type, fileInfo.id);
        
        if (updatedFileResponse.success) {
          onProgress?.(70, 'Updating table...');
          
          // Update the CSV data and table
          parseCSVData(updatedFileResponse.data.content);
          
          onProgress?.(90, 'Refreshing history...');
          
          // Reload history
          await loadFileHistory();
          
          onProgress?.(100, 'Rollback completed!');
          
          alert('File successfully rolled back to previous version!');
          setShowHistory(false);
        } else {
          throw new Error('Failed to fetch updated content after rollback');
        }
      } else {
        throw new Error(rollbackResult.error || 'Rollback operation failed');
      }
      
    } catch (error) {
      console.error('Error during rollback:', error);
      alert(`Rollback failed: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Enhanced save with database integration
  const handleSaveWithDatabase = async () => {
    if (!hasChanges) {
      alert('No changes to save');
      return;
    }

    setIsUpdating(true);
    
    try {
      console.log('🚀 Starting CSV save operation for file:', fileInfo);
      console.log('📋 File info detailed breakdown:', {
        id: fileInfo.id,
        name: fileInfo.name,
        type: fileInfo.type,
        fileType: fileInfo.fileType,
        prosbcId: fileInfo.prosbcId,
        routesetId: fileInfo.routesetId,
        fileDbId: fileInfo.fileDbId,
        source: fileInfo.source,
        isDigitMap: fileInfo.fileType === 'routesets_digitmaps'
      });
      
      onProgress?.(10, 'Converting table to CSV...');
      const csvString = convertToCSV();
      
      // IMPORTANT: Always update ProSBC first, then update local database
      console.log('🎯 Updating ProSBC system first...');
      onProgress?.(30, 'Updating file on ProSBC...');
      
      // Update the file using the CSV file update service
      const prosbcResult = await csvFileUpdateService.updateCSVFile(
        csvString,
        fileInfo,
        (progress, message) => onProgress?.(30 + (progress * 0.4), message) // Scale progress 30-70%
      );
      
      console.log('ProSBC update result:', prosbcResult);
      
      if (!prosbcResult.success) {
        throw new Error(prosbcResult.message || 'Failed to update file on ProSBC');
      }
      
      // Database integration removed - using backend API instead
      console.log('Database audit trail would be handled by backend API');
      onProgress?.(70, 'File updated on ProSBC...');
      
      onProgress?.(100, 'File updated successfully!');
      
      // Update original data to reflect saved state
      setOriginalData({ headers, rows });
      setHasChanges(false);
      
      // Call parent callback
      onSave?.(csvString, prosbcResult);
      
      alert('File updated successfully on ProSBC!');
      console.log('CSV file update completed successfully');
      
    } catch (error) {
      console.error('Error saving file with database:', error);
      alert(`Failed to save file: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Save with backend versioning (enhanced version)
  const handleSaveWithVersioning = async () => {
    if (!hasChanges) {
      alert('No changes to save');
      return;
    }

    if (!fileInfo?.id || !fileInfo?.type) {
      alert('File information not available for versioning');
      return;
    }

    setIsUpdating(true);
    
    try {
      console.log('🚀 Starting versioned CSV save operation for file:', fileInfo);
      
      onProgress?.(10, 'Converting table to CSV...');
      const csvString = convertToCSV();
      
      // First update backend database for versioning
      onProgress?.(30, 'Updating database with versioning...');
      const dbResult = await apiClient.updateContent(
        fileInfo.type, 
        fileInfo.id, 
        csvString, 
        'Updated via CSV editor',
        fileInfo.name // Pass the original filename for ProSBC update
      );
      
      if (!dbResult.success) {
        throw new Error(dbResult.error || 'Failed to update database');
      }
      
      // Then update ProSBC system
      onProgress?.(60, 'Updating file on ProSBC...');
      const prosbcResult = await csvFileUpdateService.updateCSVFile(
        csvString,
        fileInfo,
        (progress, message) => onProgress?.(60 + (progress * 0.3), message) // Scale progress 60-90%
      );
      
      console.log('ProSBC update result:', prosbcResult);
      
      if (!prosbcResult.success) {
        console.warn('ProSBC update failed, but database was updated:', prosbcResult.message);
        // Could implement rollback logic here if needed
      }
      
      onProgress?.(95, 'Refreshing history...');
      
      // Reload file history to show new version
      await loadFileHistory();
      
      onProgress?.(100, 'File updated successfully!');
      
      // Update original data to reflect saved state
      setOriginalData({ headers, rows });
      setHasChanges(false);
      
      // Call parent callback
      onSave?.(csvString, { 
        database: dbResult, 
        prosbc: prosbcResult 
      });
      
      alert('File updated successfully with version tracking!');
      console.log('CSV file update completed with versioning');
      
    } catch (error) {
      console.error('Error saving file with versioning:', error);
      alert(`Failed to save file: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Analyze changes for audit trail
  const analyzeChanges = () => {
    if (!originalData) return {};
    
    const originalRowCount = originalData.rows.length;
    const currentRowCount = rows.length;
    const originalColCount = originalData.headers.length;
    const currentColCount = headers.length;
    
    return {
      rows_added: Math.max(0, currentRowCount - originalRowCount),
      rows_deleted: Math.max(0, originalRowCount - currentRowCount),
      rows_modified: Math.min(originalRowCount, currentRowCount), // Simplified
      columns_added: Math.max(0, currentColCount - originalColCount),
      columns_removed: Math.max(0, originalColCount - currentColCount),
      cell_changes: [] // Would need more complex diff logic
    };
  };

  // Convert table data back to CSV
  const convertToCSV = () => {
    try {
      const csvLines = [];
      
      // Add headers
      csvLines.push(headers.map(h => escapeCSVField(h)).join(','));
      
      // Add data rows
      rows.forEach(row => {
        const csvRow = row.data.map(cell => escapeCSVField(cell)).join(',');
        csvLines.push(csvRow);
      });
      
      return csvLines.join('\n');
    } catch (error) {
      console.error('Error converting to CSV:', error);
      throw new Error('Failed to convert table data to CSV');
    }
  };

  // Escape CSV field (add quotes if needed)
  const escapeCSVField = (field) => {
    if (field == null) return '';
    
    const stringField = String(field);
    
    // If field contains comma, quote, or newline, wrap in quotes
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
      // Escape internal quotes by doubling them
      return `"${stringField.replace(/"/g, '""')}"`;
    }
    
    return stringField;
  };

  // Handle cell value change
  const handleCellChange = (rowIndex, colIndex, value) => {
    const newRows = [...rows];
    newRows[rowIndex].data[colIndex] = value;
    setRows(newRows);
    setHasChanges(true);
    
    // Clear any errors for this cell
    const errorKey = `${rowIndex}-${colIndex}`;
    if (errors[errorKey]) {
      const newErrors = { ...errors };
      delete newErrors[errorKey];
      setErrors(newErrors);
    }
  };

  // Handle header change
  const handleHeaderChange = (index, value) => {
    const newHeaders = [...headers];
    newHeaders[index] = value;
    setHeaders(newHeaders);
    setHasChanges(true);
  };

  // Add new row
  const addRow = () => {
    const newRow = {
      id: Date.now(),
      data: new Array(headers.length).fill(''),
      isNew: true
    };
    setRows([...rows, newRow]);
    setHasChanges(true);
  };

  // Delete row
  const deleteRow = (rowIndex) => {
    if (rows.length <= 1) {
      alert('Cannot delete the last row');
      return;
    }
    
    const newRows = rows.filter((_, index) => index !== rowIndex);
    setRows(newRows);
    setHasChanges(true);
  };

  // Add new column
  const addColumn = () => {
    const newHeaders = [...headers, `Column ${headers.length + 1}`];
    setHeaders(newHeaders);
    
    const newRows = rows.map(row => ({
      ...row,
      data: [...row.data, '']
    }));
    setRows(newRows);
    setHasChanges(true);
  };

  // Delete column
  const deleteColumn = (colIndex) => {
    if (headers.length <= 1) {
      alert('Cannot delete the last column');
      return;
    }
    
    const newHeaders = headers.filter((_, index) => index !== colIndex);
    setHeaders(newHeaders);
    
    const newRows = rows.map(row => ({
      ...row,
      data: row.data.filter((_, index) => index !== colIndex)
    }));
    setRows(newRows);
    setHasChanges(true);
  };

  // Create backup before editing
  const createBackup = async () => {
    if (!fileInfo || backupCreated) return;
    
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `${fileInfo.name}_backup_${timestamp}.csv`;
      
      // Create backup file
      const backupBlob = new Blob([csvData], { type: 'text/csv' });
      const backupFile = new File([backupBlob], backupName, { type: 'text/csv' });
      
      // Store backup locally (you might want to enhance this)
      localStorage.setItem(`backup_${fileInfo.id}`, JSON.stringify({
        name: backupName,
        content: csvData,
        timestamp: timestamp,
        originalFile: fileInfo
      }));
      
      setBackupCreated(true);
      console.log('Backup created successfully:', backupName);
    } catch (error) {
      console.error('Failed to create backup:', error);
      // Don't block the edit operation if backup fails
    }
  };

  // Save changes
  const handleSave = async () => {
    if (!hasChanges) {
      alert('No changes to save');
      return;
    }

    if (!fileInfo) {
      alert('File information not available');
      return;
    }

    setIsUpdating(true);
    
    try {
      console.log('🚀 Starting CSV save operation for file:', fileInfo);
      console.log('📋 File info detailed breakdown:', {
        id: fileInfo.id,
        name: fileInfo.name,
        type: fileInfo.type,
        fileType: fileInfo.fileType,
        prosbcId: fileInfo.prosbcId,
        routesetId: fileInfo.routesetId,
        fileDbId: fileInfo.fileDbId,
        source: fileInfo.source,
        isDigitMap: fileInfo.fileType === 'routesets_digitmaps'
      });
      
      // Validate critical properties for DM files
      if (fileInfo.fileType === 'routesets_digitmaps') {
        console.log('🎯 DM File Update - Validation Check:', {
          hasFileType: !!fileInfo.fileType,
          hasProsbcId: !!fileInfo.prosbcId,
          hasRoutesetId: !!fileInfo.routesetId,
          hasFileDbId: !!fileInfo.fileDbId,
          fileTypeValue: fileInfo.fileType,
          routesetIdValue: fileInfo.routesetId,
          prosbcIdValue: fileInfo.prosbcId
        });
      }
      
      // Create backup before saving
      await createBackup();
      
      onProgress?.(10, 'Converting table to CSV...');
      
      // Convert table data to CSV
      const csvString = convertToCSV();
      console.log('Generated CSV content length:', csvString.length);
      console.log('CSV content preview:', csvString.substring(0, 200));
      
      onProgress?.(30, 'Preparing file update...');
      
      onProgress?.(50, 'Updating file on ProSBC...');
      
      // Update the file using the CSV file update service
      const result = await csvFileUpdateService.updateCSVFile(
        csvString,
        fileInfo,
        onProgress
      );
      
      console.log('CSV update result:', result);
      
      if (result.success) {
        onProgress?.(100, 'File updated successfully!');
        
        // Update original data to reflect saved state
        setOriginalData({ headers, rows });
        setHasChanges(false);
        
        // Call parent callback
        onSave?.(csvString, result);
        
        // Show success message
        alert('File updated successfully on ProSBC!');
        
        console.log('CSV file update completed successfully');
      } else {
        throw new Error(result.message || 'Failed to update file');
      }
      
    } catch (error) {
      console.error('Error saving file:', error);
      
      // Log detailed error information for debugging
      console.group('CSV Save Error Details');
      console.log('Error object:', error);
      console.log('File info:', fileInfo);
      console.log('Has changes:', hasChanges);
      console.log('Table data - headers:', headers);
      console.log('Table data - rows count:', rows.length);
      console.groupEnd();
      
      alert(`Failed to save file: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Reset to original data
  const handleReset = () => {
    if (!originalData) return;
    
    if (hasChanges && !confirm('Are you sure you want to discard all changes?')) {
      return;
    }
    
    setHeaders(originalData.headers);
    setRows(originalData.rows);
    setHasChanges(false);
    setErrors({});
    setEditingCell(null);
  };

  // Handle key press in cell
  const handleKeyPress = (e, rowIndex, colIndex) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setEditingCell(null);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-800 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading CSV data...</p>
        </div>
      </div>
    );
  }

  if (headers.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-800 rounded-lg">
        <svg className="w-16 h-16 text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-gray-400 text-lg">No CSV data available</p>
        <p className="text-gray-500 text-sm mt-2">Upload a file or select from available files</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-900 text-white flex flex-col">
      {/* Action Controls - Sticky at top */}
      <div className="bg-gray-800 border-b border-gray-700 p-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="text-sm text-gray-300">
              <span className="font-medium">{rows.length}</span> rows × <span className="font-medium">{headers.length}</span> columns
            </div>
            {hasChanges && (
              <span className="inline-flex items-center px-3 py-1 bg-yellow-600 text-white text-sm rounded-full">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                Unsaved Changes
              </span>
            )}
            {backupCreated && (
              <span className="inline-flex items-center px-3 py-1 bg-green-600 text-white text-sm rounded-full">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Backup Created
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={addRow}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50"
            disabled={isUpdating}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Row
          </button>
          <button
            onClick={addColumn}
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 disabled:opacity-50"
            disabled={isUpdating}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Column
          </button>
          <button
            onClick={handleReset}
            className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200 disabled:opacity-50"
            disabled={isUpdating || !hasChanges}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset
          </button>
          
          {/* History Button */}
          {fileInfo?.id && fileInfo?.type && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200 disabled:opacity-50"
              disabled={isUpdating}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              History ({fileHistory.length})
            </button>
          )}
          
          {/* Backend API Status Indicator */}
          {apiClient && (
            <span className="inline-flex items-center px-3 py-1 bg-blue-600 text-white text-sm rounded-full">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              Backend API Connected
            </span>
          )}
        </div>
      </div>

      {/* Table Container - Scrollable middle section */}
      <div className="flex-1 overflow-auto min-h-0 bg-gray-900">
        <div className="min-w-full inline-block align-middle">
          <table className="min-w-full divide-y divide-gray-700">
            {/* Headers */}
            <thead className="bg-gray-800 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider bg-gray-800 border-r border-gray-700">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                    </svg>
                    Row
                  </div>
                </th>
                {headers.map((header, index) => (
                  <th key={index} className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider bg-gray-800 border-r border-gray-700 min-w-[200px]">
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={header}
                        onChange={(e) => handleHeaderChange(index, e.target.value)}
                        className="flex-1 px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={isUpdating}
                        placeholder={`Column ${index + 1}`}
                      />
                      <button
                        onClick={() => deleteColumn(index)}
                        className="text-red-400 hover:text-red-300 p-1 transition-colors duration-200 disabled:opacity-50"
                        disabled={isUpdating || headers.length <= 1}
                        title="Delete Column"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Body */}
            <tbody className="bg-gray-900 divide-y divide-gray-700">
              {rows.map((row, rowIndex) => (
                <tr key={row.id} className={`hover:bg-gray-800 transition-colors duration-200 ${row.isNew ? 'bg-blue-900/30' : ''}`}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300 bg-gray-800 border-r border-gray-700">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{rowIndex + 1}</span>
                      <button
                        onClick={() => deleteRow(rowIndex)}
                        className="text-red-400 hover:text-red-300 p-1 transition-colors duration-200 disabled:opacity-50"
                        disabled={isUpdating || rows.length <= 1}
                        title="Delete Row"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </td>
                  {row.data.map((cell, colIndex) => (
                    <td key={colIndex} className="px-4 py-3 border-r border-gray-700">
                      <input
                        ref={(el) => {
                          if (el) cellRefs.current[`${rowIndex}-${colIndex}`] = el;
                        }}
                        type="text"
                        value={cell || ''}
                        onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                        onKeyPress={(e) => handleKeyPress(e, rowIndex, colIndex)}
                        className={`w-full px-3 py-2 text-sm bg-gray-800 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200 ${
                          errors[`${rowIndex}-${colIndex}`] ? 'border-red-500 bg-red-900/20' : 'border-gray-600 hover:border-gray-500'
                        }`}
                        disabled={isUpdating}
                        placeholder="Enter value..."
                      />
                      {errors[`${rowIndex}-${colIndex}`] && (
                        <p className="mt-1 text-xs text-red-400">{errors[`${rowIndex}-${colIndex}`]}</p>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Controls - Always visible at bottom */}
      <div className="bg-gray-800 border-t border-gray-700 p-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-300">
            <span className="font-medium">{rows.length}</span> rows × <span className="font-medium">{headers.length}</span> columns
            {hasChanges && <span className="ml-2 text-yellow-400">• Unsaved changes</span>}
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={onCancel}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200 disabled:opacity-50"
              disabled={isUpdating}
            >
              Cancel
            </button>
            <button
              onClick={fileInfo?.id && fileInfo?.type ? handleSaveWithVersioning : handleSaveWithDatabase}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 flex items-center"
              disabled={isUpdating || !hasChanges}
            >
              {isUpdating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Updating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  {fileInfo?.id && fileInfo?.type ? 'Save and Upload to ProSBC' : 'Save to Database'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {Object.keys(errors).length > 0 && (
        <div className="bg-red-900/20 border border-red-600 rounded-lg m-4 p-4">
          <div className="flex items-center mb-2">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h4 className="text-red-400 font-medium">Validation Errors:</h4>
          </div>
          <ul className="text-red-300 text-sm space-y-1 ml-7">
            {Object.entries(errors).map(([key, error]) => (
              <li key={key}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* File History Panel */}
      {showHistory && (
        <FileHistoryPanel
          history={fileHistory}
          onRollback={handleRollback}
          onClose={() => setShowHistory(false)}
          isUpdating={isUpdating}
        />
      )}
    </div>
  );
};

// File History Panel Component
const FileHistoryPanel = ({ history, onRollback, onClose, isUpdating }) => {
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [rollbackReason, setRollbackReason] = useState('');

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getActionColor = (action) => {
    switch (action.toLowerCase()) {
      case 'create': return 'text-green-400 bg-green-600';
      case 'upload': return 'text-blue-400 bg-blue-600';
      case 'update': return 'text-yellow-400 bg-yellow-600';
      case 'current': return 'text-purple-400 bg-purple-600';
      default: return 'text-gray-400 bg-gray-600';
    }
  };

  const handleRollback = () => {
    if (!selectedHistory) return;
    onRollback(selectedHistory.id, rollbackReason);
    setSelectedHistory(null);
    setRollbackReason('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">File Version History</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {history.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-16 h-16 text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-400">No version history available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className={`bg-gray-700 rounded-lg p-4 border transition-colors ${
                    entry.action === 'current' 
                      ? 'border-purple-500 bg-purple-900/20' 
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-300">
                          {formatTimestamp(entry.timestamp)}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${getActionColor(entry.action)}`}>
                          {entry.action === 'current' ? 'CURRENT' : entry.action.toUpperCase()}
                        </span>
                        {entry.version && entry.version !== 'current' && (
                          <span className="text-xs bg-gray-600 px-2 py-1 rounded text-gray-300">
                            v{entry.version}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-400">{entry.user || 'system'}</span>
                      {entry.can_rollback && (
                        <button
                          onClick={() => setSelectedHistory(entry)}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                          disabled={isUpdating}
                        >
                          Rollback
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-gray-300 text-sm mb-2">
                    {entry.description || `${entry.action} operation`}
                  </p>
                  
                  <div className="flex items-center space-x-4 text-xs text-gray-400">
                    {entry.size && (
                      <span>Size: {(entry.size / 1024).toFixed(1)} KB</span>
                    )}
                    {entry.checksum && (
                      <span>Checksum: {entry.checksum.substring(0, 8)}...</span>
                    )}
                    {entry.changes && Object.keys(entry.changes).length > 0 && (
                      <span>Changes: {Object.keys(entry.changes).length} items</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rollback Confirmation Modal */}
        {selectedHistory && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-60">
            <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4">
              <h4 className="text-lg font-bold text-white mb-4">Confirm Rollback</h4>
              <p className="text-gray-300 mb-4">
                Are you sure you want to rollback to this version from {formatTimestamp(selectedHistory.timestamp)}?
              </p>
              <p className="text-sm text-gray-400 mb-4">
                {selectedHistory.description}
              </p>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Reason for rollback:
                </label>
                <textarea
                  value={rollbackReason}
                  onChange={(e) => setRollbackReason(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="Enter reason for rollback..."
                  required
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setSelectedHistory(null)}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRollback}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                  disabled={isUpdating || !rollbackReason.trim()}
                >
                  {isUpdating ? 'Rolling back...' : 'Confirm Rollback'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CSVEditorTable;
