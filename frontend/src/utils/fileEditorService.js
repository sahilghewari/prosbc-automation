// File Editor Service - Handle file content parsing, editing, and formatting
import { fileManagementAPI } from './fileManagementAPI.js';
import { prosbcFileAPI } from './prosbcFileApi.js';

export class FileEditorService {
  constructor() {
    this.cache = new Map();
  }

  // Parse file content into editable table format
  parseFileContent(content, fileType) {
    if (!content || content.trim() === '') {
      return {
        headers: this.getDefaultHeaders(fileType),
        rows: [],
        metadata: {
          isCSV: false,
          originalContent: content,
          fileType: fileType
        }
      };
    }

    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      return {
        headers: this.getDefaultHeaders(fileType),
        rows: [],
        metadata: {
          isCSV: false,
          originalContent: content,
          fileType: fileType
        }
      };
    }

    // Detect if it's CSV format
    const isCSV = lines.some(line => line.includes(','));
    
    if (isCSV) {
      return this.parseCSVContent(lines, fileType);
    } else {
      return this.parseTextContent(lines, fileType);
    }
  }

  // Parse CSV content
  parseCSVContent(lines, fileType) {
    const headers = [];
    const rows = [];
    
    // Try to detect headers
    const firstLine = lines[0];
    const firstLineFields = this.parseCSVLine(firstLine);
    
    // Check if first line looks like headers
    const isHeaderLine = firstLineFields.some(field => 
      ['called', 'calling', 'routeset', 'name', 'number', 'route', 'pattern', 'destination', 'description']
        .some(keyword => field.toLowerCase().includes(keyword))
    );

    if (isHeaderLine) {
      headers.push(...firstLineFields);
      // Parse data rows
      for (let i = 1; i < lines.length; i++) {
        const fields = this.parseCSVLine(lines[i]);
        if (fields.length > 0) {
          rows.push({
            id: i,
            data: fields,
            original: lines[i]
          });
        }
      }
    } else {
      // No headers detected, use default headers
      headers.push(...this.getDefaultHeaders(fileType));
      // Parse all lines as data
      for (let i = 0; i < lines.length; i++) {
        const fields = this.parseCSVLine(lines[i]);
        if (fields.length > 0) {
          rows.push({
            id: i + 1,
            data: fields,
            original: lines[i]
          });
        }
      }
    }

    return {
      headers,
      rows,
      metadata: {
        isCSV: true,
        originalContent: lines.join('\n'),
        fileType: fileType,
        hasHeaders: isHeaderLine
      }
    };
  }

  // Parse text content (non-CSV)
  parseTextContent(lines, fileType) {
    const headers = ['Line Content'];
    const rows = lines.map((line, index) => ({
      id: index + 1,
      data: [line],
      original: line
    }));

    return {
      headers,
      rows,
      metadata: {
        isCSV: false,
        originalContent: lines.join('\n'),
        fileType: fileType,
        hasHeaders: false
      }
    };
  }

  // Parse CSV line handling quotes and commas
  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"' && (i === 0 || line[i-1] !== '\\')) {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result.map(field => field.replace(/^"|"$/g, ''));
  }

  // Get default headers based on file type
  getDefaultHeaders(fileType) {
    switch (fileType) {
      case 'routesets_definitions':
        return ['Called Number', 'Calling Number', 'Routeset', 'Description'];
      case 'routesets_digitmaps':
        return ['Pattern', 'Destination', 'Description'];
      default:
        return ['Field 1', 'Field 2', 'Field 3', 'Field 4'];
    }
  }

  // Convert edited data back to file content
  formatFileContent(headers, rows, metadata) {
    if (!rows || rows.length === 0) {
      return '';
    }

    if (metadata.isCSV) {
      const lines = [];
      
      // Add headers if they were present originally
      if (metadata.hasHeaders) {
        lines.push(this.formatCSVLine(headers));
      }
      
      // Add data rows
      for (const row of rows) {
        if (row.data && row.data.length > 0) {
          lines.push(this.formatCSVLine(row.data));
        }
      }
      
      return lines.join('\n');
    } else {
      // For text files, just join the first field of each row
      return rows.map(row => row.data[0] || '').join('\n');
    }
  }

  // Format CSV line with proper quoting
  formatCSVLine(fields) {
    return fields.map(field => {
      const str = String(field || '');
      // Quote fields that contain commas, quotes, or newlines
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',');
  }

  // Add a new row
  addRow(parsedData, position = -1) {
    const newRow = {
      id: Date.now(),
      data: new Array(parsedData.headers.length).fill(''),
      original: '',
      isNew: true
    };

    if (position === -1 || position >= parsedData.rows.length) {
      parsedData.rows.push(newRow);
    } else {
      parsedData.rows.splice(position, 0, newRow);
    }

    return parsedData;
  }

  // Delete a row
  deleteRow(parsedData, rowId) {
    parsedData.rows = parsedData.rows.filter(row => row.id !== rowId);
    return parsedData;
  }

  // Update a cell
  updateCell(parsedData, rowId, columnIndex, value) {
    const row = parsedData.rows.find(r => r.id === rowId);
    if (row) {
      row.data[columnIndex] = value;
      row.modified = true;
    }
    return parsedData;
  }

  // Add a new column
  addColumn(parsedData, headerName, position = -1) {
    if (position === -1 || position >= parsedData.headers.length) {
      parsedData.headers.push(headerName);
      parsedData.rows.forEach(row => row.data.push(''));
    } else {
      parsedData.headers.splice(position, 0, headerName);
      parsedData.rows.forEach(row => row.data.splice(position, 0, ''));
    }
    return parsedData;
  }

  // Delete a column
  deleteColumn(parsedData, columnIndex) {
    if (columnIndex >= 0 && columnIndex < parsedData.headers.length) {
      parsedData.headers.splice(columnIndex, 1);
      parsedData.rows.forEach(row => row.data.splice(columnIndex, 1));
    }
    return parsedData;
  }

  // Save edited content to ProSBC
  async saveToProSBC(fileId, fileType, parsedData, prosbcId) {
    try {
      // Format the content
      const formattedContent = this.formatFileContent(
        parsedData.headers,
        parsedData.rows,
        parsedData.metadata
      );

      // Create a blob with the formatted content
      const blob = new Blob([formattedContent], { type: 'text/plain' });
      const file = new File([blob], `edited_${fileId}.txt`, { type: 'text/plain' });

      // Use the file update API
      const result = await fileManagementAPI.updateFile(prosbcId, file, fileType);
      
      if (result.success) {
        // Clear cache for this file
        this.cache.delete(fileId);
        
        return {
          success: true,
          message: 'File updated successfully',
          updatedContent: formattedContent
        };
      } else {
        return {
          success: false,
          message: result.message || 'Failed to update file'
        };
      }
    } catch (error) {
      console.error('Save to ProSBC error:', error);
      return {
        success: false,
        message: error.message || 'Error saving file'
      };
    }
  }

  // Validate file content
  validateContent(parsedData) {
    const errors = [];
    const warnings = [];

    // Check for empty required fields
    parsedData.rows.forEach((row, index) => {
      if (row.data.every(cell => !cell || cell.trim() === '')) {
        warnings.push(`Row ${index + 1}: All fields are empty`);
      }
    });

    // File type specific validation
    if (parsedData.metadata.fileType === 'routesets_definitions') {
      parsedData.rows.forEach((row, index) => {
        const [called, calling, routeset] = row.data;
        if (!called || !called.trim()) {
          errors.push(`Row ${index + 1}: Called number is required`);
        }
        if (!routeset || !routeset.trim()) {
          errors.push(`Row ${index + 1}: Routeset is required`);
        }
      });
    } else if (parsedData.metadata.fileType === 'routesets_digitmaps') {
      parsedData.rows.forEach((row, index) => {
        const [pattern, destination] = row.data;
        if (!pattern || !pattern.trim()) {
          errors.push(`Row ${index + 1}: Pattern is required`);
        }
        if (!destination || !destination.trim()) {
          errors.push(`Row ${index + 1}: Destination is required`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Get file content for editing
  async getFileForEditing(fileId, fileType, prosbcId) {
    try {
      // Check cache first
      const cacheKey = `${fileId}_${fileType}`;
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      // Fetch content from ProSBC
      const result = await prosbcFileAPI.getFileContent(fileType, prosbcId);
      
      if (!result.success) {
        return {
          success: false,
          message: result.message || 'Failed to fetch file content'
        };
      }

      // Parse content
      const parsedData = this.parseFileContent(result.content, fileType);
      
      const fileEditData = {
        success: true,
        fileId,
        fileType,
        prosbcId,
        parsedData,
        originalContent: result.content
      };

      // Cache the result
      this.cache.set(cacheKey, fileEditData);
      
      return fileEditData;
    } catch (error) {
      console.error('Get file for editing error:', error);
      return {
        success: false,
        message: error.message || 'Error loading file for editing'
      };
    }
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
  }
}

// Export singleton instance
export const fileEditorService = new FileEditorService();
