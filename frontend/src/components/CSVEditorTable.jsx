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
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [bulkTargetColumn, setBulkTargetColumn] = useState(0);
  const [bulkCustomerName, setBulkCustomerName] = useState('');
  const [updateAllResults, setUpdateAllResults] = useState(null);
  const [showUpdateAllModal, setShowUpdateAllModal] = useState(false);
  
  const tableRef = useRef(null);
  const cellRefs = useRef({});

  // Check if this is a DM (Digit Map) file
  const isDMFile = fileInfo?.fileType === 'routesets_digitmaps' || 
                   fileInfo?.type === 'routesets_digitmaps' || 
                   fileInfo?.name?.toLowerCase().includes('digitmap') ||
                   fileInfo?.fileName?.toLowerCase().includes('digitmap');

  // Detect which column should be validated for DM entries (called number column)
  const calledColumnIndex = headers.findIndex((h) => {
    if (!h) return false;
    const key = h.toLowerCase();
    return (
      key.includes('called') ||
      key.includes('calling') ||
      key.includes('destination') ||
      key.includes('msisdn') ||
      key.includes('number')
    );
  });

  // Validation functions for DM files
  const validateDMEntry = (value, rowIndex, colIndex, allRows) => {
    // Only validate DM files and only for the designated called column
    if (!isDMFile) return null;
    if (calledColumnIndex === -1) return null; // No called column detected
    if (colIndex !== calledColumnIndex) return null; // Only validate the called column

    // Skip validation for headers or empty values
    if (!value || value.trim() === '') return null;

    const trimmedValue = value.trim();

    // Check if value contains only digits
    if (!/^\d+$/.test(trimmedValue)) {
      return 'Only numeric digits are allowed in DM files (called column)';
    }

    // Check if value is exactly 10 digits
    if (trimmedValue.length !== 10) {
      return 'DM entries must be exactly 10 digits long';
    }

    // Check for duplicates in the same column
    const currentColumnValues = allRows
      .map((row, idx) => ({ value: row.data[colIndex]?.trim(), rowIdx: idx }))
      .filter(item => item.value && item.value !== '' && item.rowIdx !== rowIndex);

    const isDuplicate = currentColumnValues.some(item => item.value === trimmedValue);
    if (isDuplicate) {
      return 'Duplicate numbers are not allowed in DM files';
    }

    return null; // Valid
  };

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

  // Primary save handler that prioritizes custom onSave callback
  const handleSave = async () => {
    if (!hasChanges) {
      alert('No changes to save');
      return;
    }

    // Check for validation errors before saving
    const hasValidationErrors = Object.keys(errors).length > 0;
    if (hasValidationErrors) {
      const errorMessages = Object.values(errors);
      alert(`Cannot save file due to validation errors:\n\n${errorMessages.join('\n')}\n\nPlease fix all errors before saving.`);
      return;
    }

    setIsUpdating(true);
    try {
      console.log('[CSVEditorTable] Starting save process...');
      console.log('[CSVEditorTable] onSave prop:', onSave);
      console.log('[CSVEditorTable] onSave type:', typeof onSave);
      console.log('[CSVEditorTable] fileInfo:', fileInfo);
      onProgress?.(10, 'Converting table to CSV...');
      const csvString = convertToCSV();

      // If a custom onSave callback is provided, use it instead of backend calls
      if (onSave && typeof onSave === 'function') {
        console.log('[CSVEditorTable] Using custom onSave callback');
        onProgress?.(50, 'Saving with custom handler...');
        
        await onSave(csvString, fileInfo);
        
        // Mark as saved
        onProgress?.(100, 'File saved successfully!');
        setOriginalData({ headers, rows });
        setHasChanges(false);
        console.log('[CSVEditorTable] Save completed with custom callback');
        return;
      }

      // Fallback to built-in save methods if no custom callback
      console.log('[CSVEditorTable] No custom onSave provided, using fallback method');
      if (fileInfo?.id && fileInfo?.type) {
        console.log('[CSVEditorTable] Calling handleSaveWithVersioning as fallback');
        await handleSaveWithVersioning();
      } else {
        console.log('[CSVEditorTable] Calling handleSaveWithDatabase as fallback');
        await handleSaveWithDatabase();
      }
    } catch (error) {
      console.error('[CSVEditorTable] Error in save process:', error);
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
      console.log('🚀 Starting backend-driven CSV update for file:', fileInfo);
      onProgress?.(10, 'Converting table to CSV...');
      const csvString = convertToCSV();

      // Prepare FormData for backend update
      onProgress?.(30, 'Preparing file for backend update...');
      const formData = new FormData();
      const fileName = fileInfo.name || fileInfo.fileName || `updated_${Date.now()}.csv`;
      const blob = new Blob([csvString], { type: 'text/csv' });
      formData.append('file', blob, fileName);
      formData.append('fileType', fileInfo.fileType || fileInfo.type);
      formData.append('fileId', fileInfo.prosbcId || fileInfo.id);

      onProgress?.(50, 'Uploading file to backend...');
      // Send to backend update endpoint
      const res = await fetch('/backend/api/prosbc-files/update', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: {
          ...getAuthHeaders()
        }
      });
      const data = await res.json();
      if (data.success) {
        onProgress?.(100, 'File updated successfully!');
        setOriginalData({ headers, rows });
        setHasChanges(false);
        onSave?.(csvString, data);
        alert('File updated successfully on ProSBC!');
        console.log('CSV file update completed with backend-driven workflow');
      } else {
        throw new Error(data.message || 'Update failed');
      }
    } catch (error) {
      console.error('Error saving file with backend update:', error);
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
    
    // Validate the input for DM files
    const validationError = validateDMEntry(value, rowIndex, colIndex, newRows);
    const errorKey = `${rowIndex}-${colIndex}`;
    
    // Update errors state
    const newErrors = { ...errors };
    if (validationError) {
      newErrors[errorKey] = validationError;
    } else {
      delete newErrors[errorKey];
    }
    
    setRows(newRows);
    setErrors(newErrors);
    setHasChanges(true);
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

  // Bulk add values into a selected column
  const handleBulkAdd = () => {
    if (!bulkInput.trim()) {
      alert('Please paste one or more values to add.');
      return;
    }

    const columnIndex = Math.max(0, Math.min(bulkTargetColumn, headers.length - 1));
    // Split by newline, comma, or whitespace
    const rawValues = bulkInput
      .split(/\r?\n|,|\s+/)
      .map(v => v.trim())
      .filter(v => v.length > 0);

    if (rawValues.length === 0) {
      alert('No valid values found to add.');
      return;
    }

    // Deduplicate input values while preserving order
    const seen = new Set();
    const values = rawValues.filter(v => {
      if (seen.has(v)) return false;
      seen.add(v);
      return true;
    });

    // Collect existing values in target column to prevent duplicates
    const existingValues = new Set(
      rows
        .map(r => (r.data[columnIndex] || '').trim())
        .filter(v => v !== '')
    );

    // Find routeset_name column index
    const routesetNameIndex = headers.findIndex(h => 
      h.toLowerCase().includes('routeset_name') || 
      h.toLowerCase().includes('customer') || 
      h.toLowerCase().includes('name')
    );

    const newRowsToAdd = [];
    const newErrors = { ...errors };

    for (const value of values) {
      // DM files: enforce 10-digit numbers only for called column
      if (isDMFile && calledColumnIndex !== -1 && columnIndex === calledColumnIndex) {
        if (!/^\d{10}$/.test(value)) {
          // Mark error but continue processing others
          newErrors[`bulk-${value}`] = `Invalid DM entry '${value}': must be exactly 10 digits`;
          continue;
        }
      }

      if (existingValues.has(value)) {
        // Skip duplicates already present in column
        continue;
      }

      const newRow = {
        id: Date.now() + Math.random(),
        data: new Array(headers.length).fill(''),
        isNew: true
      };
      
      // Set the main value in target column
      newRow.data[columnIndex] = value;
      
      // Set customer name in routeset_name column if found and customer name provided
      if (routesetNameIndex !== -1 && bulkCustomerName.trim()) {
        newRow.data[routesetNameIndex] = bulkCustomerName.trim();
      }
      
      newRowsToAdd.push(newRow);
      existingValues.add(value);
    }

    if (newRowsToAdd.length === 0) {
      setErrors(newErrors);
      alert('No new values to add (all were invalid or duplicates).');
      return;
    }

    setRows([...rows, ...newRowsToAdd]);
    setErrors(newErrors);
    setHasChanges(true);
    setShowBulkAdd(false);
    setBulkInput('');
    setBulkCustomerName('');
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
    // Helper to get auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('dashboard_token');
    return token ? { 'Authorization': 'Bearer ' + token } : {};
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
    <div className="fixed inset-0 bg-gray-900 text-white flex flex-col z-50">
      {/* Action Controls - Compact */}
      <div className="bg-gray-800 border-b border-gray-700 p-2 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2 text-xs">
            <div className="text-gray-300">
              <span className="font-medium">{rows.length}</span> rows × <span className="font-medium">{headers.length}</span> columns
            </div>
            {isDMFile && (
              <span className="inline-flex items-center px-2 py-0.5 bg-purple-600 text-white text-xs rounded-full">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                DM Validation
              </span>
            )}
            {Object.keys(errors).length > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 bg-red-600 text-white text-xs rounded-full">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {Object.keys(errors).length} Error{Object.keys(errors).length > 1 ? 's' : ''}
              </span>
            )}
            {hasChanges && (
              <span className="inline-flex items-center px-2 py-0.5 bg-yellow-600 text-white text-xs rounded-full">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                Unsaved
              </span>
            )}
            {backupCreated && (
              <span className="inline-flex items-center px-2 py-0.5 bg-green-600 text-white text-xs rounded-full">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Backup
              </span>
            )}
          </div>
          
          {/* Close Button */}
          <button
            onClick={onCancel}
            className="inline-flex items-center px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors duration-200"
            title="Close Editor"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex items-center space-x-2 text-xs">
          <button
            onClick={addRow}
            className="inline-flex items-center px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50"
            disabled={isUpdating}
          >
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Row
          </button>
          <button
            onClick={() => setShowBulkAdd(true)}
            className="inline-flex items-center px-2 py-1 bg-cyan-600 text-white rounded hover:bg-cyan-700 transition-colors duration-200 disabled:opacity-50"
            disabled={isUpdating}
            title={isDMFile ? 'Paste multiple 10-digit numbers at once' : 'Paste multiple values at once'}
          >
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Bulk Add
          </button>
          <button
            onClick={addColumn}
            className="inline-flex items-center px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors duration-200 disabled:opacity-50"
            disabled={isUpdating}
          >
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Column
          </button>
          <button
            onClick={handleReset}
            className="inline-flex items-center px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors duration-200 disabled:opacity-50"
            disabled={isUpdating || !hasChanges}
          >
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset
          </button>
          
          {/* History Button */}
          {fileInfo?.id && fileInfo?.type && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="inline-flex items-center px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors duration-200 disabled:opacity-50"
              disabled={isUpdating}
            >
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              History ({fileHistory.length})
            </button>
          )}
          
          {/* Backend API Status Indicator */}
          {apiClient && (
            <span className="inline-flex items-center px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              API
            </span>
          )}
        </div>
      </div>

      {/* DM File Validation Info - Compact */}
      {isDMFile && (
        <div className="bg-purple-900/20 border border-purple-500/30 p-1.5 mx-2 rounded text-xs">
          <div className="flex items-center space-x-2">
            <svg className="w-3 h-3 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-purple-200">
              <strong>DM Rules:</strong> 10-digit numbers only • No alphabets • No duplicates
            </div>
          </div>
        </div>
      )}

      {/* Table Container - Full Screen */}
      <div className="flex-1 overflow-auto bg-gray-900">
        <div className="w-full h-full">
          <table className="w-full divide-y divide-gray-700 table-fixed">
            {/* Headers - Compact */}
            <thead className="bg-gray-800 sticky top-0 z-10">
              <tr>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-300 uppercase tracking-wider bg-gray-800 border-r border-gray-700 w-16">
                  <div className="flex items-center">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                    </svg>
                    Row
                  </div>
                </th>
                {headers.map((header, index) => (
                  <th key={index} className="px-2 py-1.5 text-left text-xs font-medium text-gray-300 uppercase tracking-wider bg-gray-800 border-r border-gray-700 min-w-[100px]">
                    <div className="flex items-center space-x-1">
                      <input
                        type="text"
                        value={header}
                        onChange={(e) => handleHeaderChange(index, e.target.value)}
                        className="flex-1 px-1.5 py-0.5 text-xs bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                        disabled={isUpdating}
                        placeholder={`Col ${index + 1}`}
                      />
                      <button
                        onClick={() => deleteColumn(index)}
                        className="text-red-400 hover:text-red-300 p-0.5 transition-colors duration-200 disabled:opacity-50"
                        disabled={isUpdating || headers.length <= 1}
                        title="Delete Column"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Body - Compact */}
            <tbody className="bg-gray-900 divide-y divide-gray-700">
              {rows.map((row, rowIndex) => (
                <tr key={row.id} className={`hover:bg-gray-800 transition-colors duration-200 ${row.isNew ? 'bg-blue-900/30' : ''}`}>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-300 bg-gray-800 border-r border-gray-700">
                    <div className="flex items-center space-x-1">
                      <span className="font-medium">{rowIndex + 1}</span>
                      <button
                        onClick={() => deleteRow(rowIndex)}
                        className="text-red-400 hover:text-red-300 p-0.5 transition-colors duration-200 disabled:opacity-50"
                        disabled={isUpdating || rows.length <= 1}
                        title="Delete Row"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </td>
                  {row.data.map((cell, colIndex) => (
                    <td key={colIndex} className="px-2 py-1.5 border-r border-gray-700">
          <input
                        ref={(el) => {
                          if (el) cellRefs.current[`${rowIndex}-${colIndex}`] = el;
                        }}
                        type="text"
                        value={cell || ''}
                        onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                        onKeyPress={(e) => handleKeyPress(e, rowIndex, colIndex)}
                        className={`w-full px-2 py-1 text-xs bg-gray-800 border rounded text-white focus:outline-none focus:ring-1 transition-colors duration-200 ${
                          errors[`${rowIndex}-${colIndex}`] 
                            ? 'border-red-500 bg-red-900/20 focus:ring-red-500' 
            : isDMFile && colIndex === calledColumnIndex && cell && cell.trim() && /^\d{10}$/.test(cell.trim())
          ? 'border-green-500 bg-green-900/20 focus:ring-green-500'
          : 'border-gray-600 hover:border-gray-500 focus:ring-blue-500 focus:border-transparent'
                        }`}
        disabled={isUpdating}
        placeholder={isDMFile && colIndex === calledColumnIndex ? "10-digit #" : "Enter..."}
        maxLength={isDMFile && colIndex === calledColumnIndex ? 10 : undefined}
        pattern={isDMFile && colIndex === calledColumnIndex ? "[0-9]{10}" : undefined}
        title={isDMFile && colIndex === calledColumnIndex ? "Enter exactly 10 digits (0-9)" : ""}
        inputMode={isDMFile && colIndex === calledColumnIndex ? "numeric" : "text"}
                      />
                      {errors[`${rowIndex}-${colIndex}`] && (
                        <p className="mt-0.5 text-xs text-red-400">{errors[`${rowIndex}-${colIndex}`]}</p>
                      )}
                      {isDMFile && colIndex === calledColumnIndex && cell && cell.trim() && /^\d{10}$/.test(cell.trim()) && !errors[`${rowIndex}-${colIndex}`] && (
                        <p className="mt-0.5 text-xs text-green-400">✓ Valid</p>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Controls - Compact */}
      <div className="bg-gray-800 border-t border-gray-700 p-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-300">
            <span className="font-medium">{rows.length}</span> rows × <span className="font-medium">{headers.length}</span> columns
            {hasChanges && <span className="ml-2 text-yellow-400">• Unsaved changes</span>}
            {Object.keys(errors).length > 0 && (
              <span className="ml-2 text-red-400">• {Object.keys(errors).length} error{Object.keys(errors).length > 1 ? 's' : ''}</span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors duration-200 disabled:opacity-50 text-xs"
              disabled={isUpdating}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className={`px-3 py-1.5 text-white rounded transition-colors duration-200 disabled:opacity-50 flex items-center text-xs ${
                Object.keys(errors).length > 0 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
              disabled={isUpdating || !hasChanges || Object.keys(errors).length > 0}
              title={Object.keys(errors).length > 0 ? 'Fix validation errors before saving' : ''}
            >
              {isUpdating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Updating...
                </>
              ) : Object.keys(errors).length > 0 ? (
                <>
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Fix Errors
                </>
              ) : (
                <>
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  {fileInfo?.id && fileInfo?.type ? 'Save & Upload' : 'Save'}
                </>
              )}
            </button>
            {/* New button: Save & Update to All ProSBC */}
            <button
              onClick={async () => {
                if (!hasChanges) { alert('No changes to save'); return; }
                if (!confirm('Save changes and update this file on all ProSBC instances where it exists?')) return;
                setIsUpdating(true);
                try {
                  onProgress?.(10, 'Converting table to CSV...');
                  const csvString = convertToCSV();
                  onProgress?.(30, 'Preparing payload...');

                  const formData = new FormData();
                  const fileName = fileInfo?.name || fileInfo?.fileName || `updated_${Date.now()}.csv`;
                  const blob = new Blob([csvString], { type: 'text/csv' });
                  formData.append('file', blob, fileName);
                  formData.append('fileType', fileInfo?.fileType || fileInfo?.type);
                  formData.append('fileName', fileName);
                  formData.append('fileId', fileInfo?.prosbcId || fileInfo?.id || '');

                  onProgress?.(50, 'Sending to backend (update to all)...');
                  const res = await fetch('/backend/api/prosbc-files/update-to-all', {
                    method: 'POST',
                    body: formData,
                    credentials: 'include',
                    headers: {
                      ...getAuthHeaders()
                    }
                  });
                  const result = await res.json();
                  if (result.success) {
                    onProgress?.(100, 'Update to all completed');
                    setOriginalData({ headers, rows });
                    setHasChanges(false);
                    // Save per-instance results and show modal
                    setUpdateAllResults(result.results || []);
                    setShowUpdateAllModal(true);
                  } else {
                    throw new Error(result.error || 'Update to all failed');
                  }
                } catch (err) {
                  console.error('Update to all error:', err);
                  alert(`Update to all failed: ${err.message}`);
                } finally {
                  setIsUpdating(false);
                }
              }}
              className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors duration-200 disabled:opacity-50 text-xs"
              disabled={isUpdating || !hasChanges || Object.keys(errors).length > 0}
              title="Save and update this file across all ProSBC instances where it exists"
            >
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Save & Update to All
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

      {/* Bulk Add Modal */}
      {showBulkAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 w-full max-w-xl mx-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold text-lg">Bulk Add {isDMFile ? 'Numbers' : 'Values'}</h3>
              <button
                onClick={() => setShowBulkAdd(false)}
                className="text-gray-400 hover:text-white"
                title="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              <div className="text-xs text-gray-300">
                {isDMFile ? 'Paste one 10-digit number per line, or separated by commas/spaces. Duplicates and invalid entries will be skipped.' : 'Paste values separated by newlines, commas, or spaces.'}
              </div>
              <div>
                <label className="block text-xs text-gray-300 mb-1">Target Column</label>
                <select
                  value={bulkTargetColumn}
                  onChange={(e) => setBulkTargetColumn(parseInt(e.target.value, 10))}
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                >
                  {headers.map((h, idx) => (
                    <option key={idx} value={idx}>{h || `Column ${idx + 1}`}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-300 mb-1">Customer Name (for routeset_name column)</label>
                <input
                  type="text"
                  value={bulkCustomerName}
                  onChange={(e) => setBulkCustomerName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  placeholder="Enter customer name to apply to all rows"
                />
                <div className="text-xs text-gray-400 mt-1">
                  {headers.findIndex(h => h.toLowerCase().includes('routeset_name') || h.toLowerCase().includes('customer') || h.toLowerCase().includes('name')) !== -1 
                    ? `✓ Will fill "${headers[headers.findIndex(h => h.toLowerCase().includes('routeset_name') || h.toLowerCase().includes('customer') || h.toLowerCase().includes('name'))]}" column`
                    : '⚠ No routeset_name/customer/name column detected'}
                </div>
              </div>
              <textarea
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm"
                placeholder={isDMFile ? 'e.g.\n1234567890\n0987654321\n...' : 'Paste values here'}
              />
              <div className="flex items-center justify-end space-x-2">
                <button
                  onClick={() => setShowBulkAdd(false)}
                  className="px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkAdd}
                  className="px-3 py-1.5 bg-cyan-600 text-white rounded hover:bg-cyan-700 text-sm"
                >
                  Add Values
                </button>
              </div>
            </div>
          </div>
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

      {/* Update To All Results Modal */}
      {showUpdateAllModal && updateAllResults && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-60">
          <div className="bg-gray-900 rounded-lg p-4 max-w-3xl w-full mx-4 max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">Update to All Results</h3>
              <button onClick={() => { setShowUpdateAllModal(false); setUpdateAllResults(null); }} className="text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-2">
              {updateAllResults.length === 0 ? (
                <div className="text-gray-400">No results returned from server.</div>
              ) : (
                updateAllResults.map((r, idx) => (
                  <div key={idx} className="p-3 rounded border border-gray-700 bg-gray-800">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-200">
                        <div><strong>Instance:</strong> {r.instance}</div>
                        <div className="text-xs text-gray-400">URL: {r.url || 'N/A'}</div>
                      </div>
                      <div className="text-sm">
                        {r.success ? (
                          <span className="px-2 py-0.5 bg-green-600 text-white rounded text-xs">Success</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-red-600 text-white rounded text-xs">Failure</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-300">
                      {r.message || r.error || (r.details && r.details.message) || 'No message'}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button onClick={() => { setShowUpdateAllModal(false); setUpdateAllResults(null); }} className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700">Close</button>
            </div>
          </div>
        </div>
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
