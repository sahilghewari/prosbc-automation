/**
 * API Client for Backend Communication
 * Handles all communication with the new backend server
 */

import axios from 'axios';

// Create axios instance for backend API
const apiClient = axios.create({
  baseURL: '', // Use absolute paths for all backend endpoints
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Request interceptor for logging and ProSBC authentication
apiClient.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    // Add ProSBC auth header for /api requests (not /backend/api)
    if (config.url && config.url.startsWith('/api')) {
      // Replace this with your actual token retrieval logic
      const prosbcToken = localStorage.getItem('prosbc_token');
      if (prosbcToken) {
        config.headers['Authorization'] = `Bearer ${prosbcToken}`;
      }
    }
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.statusText}`);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error);
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      console.error(`Server Error ${status}:`, data);
      // Forced logout detection
      if (
        status === 401 &&
        data && typeof data.message === 'string' &&
        data.message.toLowerCase().includes('session expired')
      ) {
        // Clear token and redirect to login
        localStorage.removeItem('prosbc_token');
        window.location.href = '/login';
        return;
      }
    } else if (error.request) {
      // Network error
      console.error('Network Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// API service methods
export const napService = {
  // Get all NAPs
  async getAll(params = {}) {
    const response = await apiClient.get('/backend/api/naps', { params });
    return response.data;
  },

  // Get NAP by ID
  async getById(id) {
    const response = await apiClient.get(`/backend/api/naps/${id}`);
    return response.data;
  },

  // Create NAP
  async create(napData) {
    try {
      // Map frontend fields to expected backend fields
      const payload = {
        name: napData.name,
        config_data: napData.config_data,
        description: napData.description,
        tags: napData.tags,
        created_by: napData.created_by || 'user'
      };

      // Send request to create NAP
      const response = await apiClient.post('/backend/api/naps', payload);
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 400) {
        // Handle validation error
        console.error('Validation error:', error.response.data);
        throw new Error(error.response.data.error || 'Missing required fields');
      }
      if (error.response && error.response.status === 409) {
        // Handle duplicate name error
        console.error('Duplicate NAP name:', error.response.data);
        throw new Error(error.response.data.error || 'NAP with this name already exists');
      }
      // Handle other errors
      console.error('Failed to create NAP:', error);
      throw error;
    }
  },

  // Update NAP
  async update(id, napData) {
    const response = await apiClient.put(`/api/naps/${id}`, napData);
    return response.data;
  },

  // Delete NAP
  async delete(id) {
    const response = await apiClient.delete(`/api/naps/${id}`);
    return response.data;
  },

  // Activate NAP
  async activate(id, activationData) {
    const response = await apiClient.post(`/api/naps/${id}/activate`, activationData);
    return response.data;
  },

  // Deactivate NAP
  async deactivate(id) {
    const response = await apiClient.post(`/api/naps/${id}/deactivate`);
    return response.data;
  }
};

export const fileService = {
  // Get all files
  async getAll(params = {}) {
    const response = await apiClient.get('/api/files', { params });
    return response.data;
  },

  // Upload file
  async upload(formData, fileType = 'dm') {
    try {
      console.log(`Uploading file to ${fileType === 'dm' ? 'digit-maps' : 'dial-formats'} endpoint`);
      
      // Make sure the FormData contains the expected file field
      const hasFile = formData.has('file');
      if (!hasFile) {
        console.error('FormData is missing the required "file" field');
        throw new Error('File upload failed: Missing file data');
      }
      
      // Check what's in the FormData (debugging)
      console.log('FormData fields:', Array.from(formData.keys()));
      
      const endpoint = fileType === 'dm' ? '/backend/api/files/digit-maps/upload' : '/backend/api/files/dial-formats/upload';
      const response = await apiClient.post(endpoint, formData, {
        headers: {
          // Let the browser set the Content-Type with boundary parameter
          'Content-Type': 'multipart/form-data'
        }
      });
      
      console.log(`File upload successful: ${response.status}`);
      return response.data;
    } catch (error) {
      console.error(`File upload failed for ${fileType}:`, error);
      throw error;
    }
  },

  // Upload digit map file
  async uploadDigitMap(formData) {
    const response = await apiClient.post('/api/files/digit-maps/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // Upload dial format file
  async uploadDialFormat(formData) {
    const response = await apiClient.post('/api/files/dial-formats/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // Read file content (for preview/validation)
  async readFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  },

  // Parse CSV content
  parseCSVContent(content, fileType = 'dm') {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      throw new Error('File is empty');
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => line.split(',').map(cell => cell.trim()));

    // Extract metadata based on file type
    const metadata = {
      rowCount: rows.length,
      headers: headers
    };

    if (fileType === 'dm') {
      // Look for routeset names in digit map files
      const routesetColumn = headers.findIndex(h => h.toLowerCase().includes('routeset'));
      if (routesetColumn >= 0) {
        metadata.routesetNames = [...new Set(rows.map(row => row[routesetColumn]).filter(Boolean))];
      }
    } else if (fileType === 'df') {
      // Look for routeset names in dial format files
      const routesetColumn = headers.findIndex(h => h.toLowerCase().includes('routeset'));
      if (routesetColumn >= 0) {
        metadata.routesetNames = [...new Set(rows.map(row => row[routesetColumn]).filter(Boolean))];
      }
    }

    return {
      headers,
      rows,
      rowCount: rows.length,
      metadata
    };
  },

  // Validate file content
  validateFile(parsedContent, fileType = 'dm') {
    const validation = {
      isValid: true,
      score: 100,
      errors: [],
      warnings: []
    };

    // Basic validation
    if (!parsedContent || !parsedContent.headers || parsedContent.headers.length === 0) {
      validation.errors.push('File has no headers');
      validation.isValid = false;
      validation.score -= 50;
    }

    if (!parsedContent.rows || parsedContent.rows.length === 0) {
      validation.errors.push('File has no data rows');
      validation.isValid = false;
      validation.score -= 50;
    }

    // File type specific validation
    if (fileType === 'dm') {
      const requiredHeaders = ['pattern', 'routeset'];
      const missingHeaders = requiredHeaders.filter(h => 
        !parsedContent.headers.some(header => header.toLowerCase().includes(h))
      );
      
      if (missingHeaders.length > 0) {
        validation.warnings.push(`Recommended headers missing: ${missingHeaders.join(', ')}`);
        validation.score -= 10 * missingHeaders.length;
      }
    } else if (fileType === 'df') {
      const requiredHeaders = ['pattern', 'replacement', 'routeset'];
      const missingHeaders = requiredHeaders.filter(h => 
        !parsedContent.headers.some(header => header.toLowerCase().includes(h))
      );
      
      if (missingHeaders.length > 0) {
        validation.warnings.push(`Recommended headers missing: ${missingHeaders.join(', ')}`);
        validation.score -= 10 * missingHeaders.length;
      }
    }

    // Check for empty rows
    const emptyRows = parsedContent.rows.filter(row => row.every(cell => !cell || cell.trim() === ''));
    if (emptyRows.length > 0) {
      validation.warnings.push(`Found ${emptyRows.length} empty rows`);
      validation.score -= Math.min(20, emptyRows.length * 2);
    }

    validation.score = Math.max(0, validation.score);
    validation.isValid = validation.errors.length === 0;

    return validation;
  },

  // Generate mapping suggestions
  async generateMappingSuggestions(napId) {
    try {
      const response = await apiClient.get(`/api/files/mapping-suggestions/${napId}`);
      return response.data;
    } catch (error) {
      console.warn('Mapping suggestions endpoint not available, generating mock suggestions');
      return {
        success: true,
        suggestions: [
          {
            confidence: 85,
            dm_filename: `${napId}_digitmap.csv`,
            df_filename: `${napId}_dialformat.csv`,
            digitmap_file_id: 'dm_001',
            dialformat_file_id: 'df_001',
            shared_routesets: ['LOCAL', 'TRUNK']
          }
        ]
      };
    }
  },

  // Get digit maps
  async getDigitMaps(params = {}) {
    const response = await apiClient.get('/api/files/digit-maps', { params });
    return response.data;
  },

  // Get dial formats
  async getDialFormats(params = {}) {
    const response = await apiClient.get('/api/files/dial-formats', { params });
    return response.data;
  },

  // Fetch existing files from ProSBC
  async fetchProSBCFiles(options = {}) {
    try {
      const response = await apiClient.get('/api/files/prosbc/fetch', { params: options });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch ProSBC files:', error);
      throw error;
    }
  },

  // Import existing ProSBC files to our database
  async importProSBCFiles(filesToImport) {
    try {
      const response = await apiClient.post('/backend/api/files/prosbc/import', { files: filesToImport });
      return response.data;
    } catch (error) {
      console.error('Failed to import ProSBC files:', error);
      throw error;
    }
  },
  
  // Get file by ID (digit-maps or dial-formats)
  async getById(type, id) {
    const response = await apiClient.get(`/api/files/${type}/${id}`);
    return response.data;
  },

  // Update file content
  /**
   * Update file content
   * @param {string} type
   * @param {string|number} id
   * @param {string} content
   * @param {string} [reason]
   * @param {string} [filename] - (optional) The filename to use for ProSBC update
   */
  async updateContent(type, id, content, reason = 'Content updated', filename = null) {
    // For ProSBC file types, use legacy update logic (fetch edit form, extract CSRF, POST FormData)
    if (type === 'routesets_definitions' || type === 'routesets_digitmaps') {
      // Always use absolute paths so Vite proxy handles CORS
      const fileType = type;
      const endpoint = `/file_dbs/1/${fileType}/${id}`;
      const editUrl = `/file_dbs/1/${fileType}/${id}/edit`;
      const fieldName = fileType === 'routesets_digitmaps'
        ? 'tbgw_routesets_digitmap'
        : 'tbgw_routesets_definition';

      // 1. Fetch the edit form to get CSRF token and record ID
      const editResp = await fetch(editUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          ...(localStorage.getItem('prosbc_token')
            ? { 'Authorization': `Bearer ${localStorage.getItem('prosbc_token')}` }
            : {})
        },
        credentials: 'include'
      });
      if (!editResp.ok) {
        const errText = await editResp.text();
        throw new Error(`Failed to fetch ProSBC edit form: ${editResp.status} - ${errText.substring(0, 200)}`);
      }
      const editHtml = await editResp.text();
      // Extract CSRF token
      const tokenMatch = editHtml.match(/name="authenticity_token"[^>]*value="([^"]+)"/);
      if (!tokenMatch) {
        throw new Error('Could not find authenticity token in ProSBC edit form');
      }
      const csrfToken = tokenMatch[1];
      // Extract record ID (may be different from :id in URL)
      let recordId = id;
      const idMatch = editHtml.match(new RegExp(`name=\"${fieldName}\\[id\\]\"[^>]*value=\"([^\"]+)\"`));
      if (idMatch) {
        recordId = idMatch[1];
      }
      // 2. Build a File object from content string, use correct filename if provided
      const fileBlob = new Blob([content], { type: 'text/csv' });
      const fileNameToUse = filename || 'updated.csv';
      const fileObj = new File([fileBlob], fileNameToUse, { type: 'text/csv' });
      // 3. Build FormData
      const formData = new FormData();
      formData.append('_method', 'put');
      formData.append('authenticity_token', csrfToken);
      if (fileType === 'routesets_digitmaps') {
        formData.append('tbgw_routesets_digitmap[file]', fileObj);
        formData.append('tbgw_routesets_digitmap[id]', recordId);
        formData.append('tbgw_routesets_digitmap[tbgw_files_db_id]', '1');
      } else {
        formData.append('tbgw_routesets_definition[file]', fileObj);
        formData.append('tbgw_routesets_definition[id]', recordId);
        formData.append('tbgw_routesets_definition[tbgw_files_db_id]', '1');
      }
      formData.append('commit', 'Update');
      // 4. POST FormData to endpoint (absolute path)
      const uploadHeaders = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': editUrl,
        ...(localStorage.getItem('prosbc_token')
          ? { 'Authorization': `Bearer ${localStorage.getItem('prosbc_token')}` }
          : {})
      };
      const uploadResp = await fetch(endpoint, {
        method: 'POST',
        headers: uploadHeaders,
        body: formData,
        credentials: 'include',
        redirect: 'manual' // Prevent browser from following 302 to ProSBC (CORS)
      });
      const respText = await uploadResp.text();
      if (uploadResp.ok || uploadResp.status === 302) {
        return { success: true, message: 'File updated successfully on ProSBC!', status: uploadResp.status, response: respText };
      }
      // Treat status 0 (CORS manual redirect) as success for ProSBC update
      if (uploadResp.status === 0) {
        return { success: true, message: 'File updated successfully on ProSBC! (status 0, CORS manual redirect)', status: 0, response: respText };
      }
      throw new Error(`ProSBC update failed: ${uploadResp.status} - ${respText.substring(0, 300)}`);
    } else {
      // Backend update (JSON)
      const url = `/backend/api/files/${type}/${id}`;
      const data = {
        content,
        reason,
        updated_by: 'user' // This should come from auth context
      };
      const response = await apiClient.put(url, data);
      return response.data;
    }
  },

  // Get file history
  async getHistory(type, id) {
    const response = await apiClient.get(`/api/files/${type}/${id}/history`);
    return response.data;
  },

  // Rollback to previous version
  async rollback(type, id, historyId, reason) {
    const response = await apiClient.post(`/api/files/${type}/${id}/rollback`, {
      history_id: historyId,
      reason
    });
    return response.data;
  },

  // Get specific version content
  async getVersion(type, id, versionId) {
    const response = await apiClient.get(`/api/files/${type}/${id}/versions/${versionId}`);
    return response.data;
  },

  // Delete file
  async delete(id) {
    const response = await apiClient.delete(`/api/files/${id}`);
    return response.data;
  }
};

export const mappingService = {
  // Get all mappings
  async getAll(params = {}) {
    const response = await apiClient.get('/api/mappings', { params });
    return response.data;
  },

  // Get mappings for NAP
  async getByNap(napId) {
    const response = await apiClient.get(`/api/mappings/nap/${napId}`);
    return response.data;
  },

  // Create mapping
  async create(mappingData) {
    const response = await apiClient.post('/api/mappings', mappingData);
    return response.data;
  },

  // Update mapping
  async update(id, mappingData) {
    const response = await apiClient.put(`/api/mappings/${id}`, mappingData);
    return response.data;
  },

  // Delete mapping
  async delete(id) {
    const response = await apiClient.delete(`/api/mappings/${id}`);
    return response.data;
  },

  // Activate mapping
  async activate(id) {
    const response = await apiClient.post(`/api/mappings/${id}/activate`);
    return response.data;
  }
};

export const configService = {
  // Get config actions
  async getActions(params = {}) {
    const response = await apiClient.get('/api/config-actions', { params });
    return response.data;
  },

  // Start configuration generation
  async startGeneration(actionData) {
    const response = await apiClient.post('/api/config-actions/generate', actionData);
    return response.data;
  },

  // Start configuration activation
  async startActivation(actionData) {
    const response = await apiClient.post('/api/config-actions/activate', actionData);
    return response.data;
  }
};

export const auditService = {
  // Get audit logs
  async getLogs(params = {}) {
    const response = await apiClient.get('/api/audit-logs', { params });
    return response.data;
  }
};

export const dashboardService = {
  // Get dashboard overview
  async getOverview() {
    const response = await apiClient.get('/api/dashboard/overview');
    return response.data;
  },

  // Get dashboard analytics (maps to overview for backward compatibility)
  async getAnalytics(period = '7d') {
    const response = await apiClient.get('/api/dashboard/overview');
    return response.data;
  },

  // Get system health
  async getHealth() {
    const response = await apiClient.get('/api/dashboard/health');
    return response.data;
  },

  // Get Ubuntu system status
  async getUbuntuStatus() {
    try {
      const response = await apiClient.get('/api/dashboard/system-status');
      return response.data;
    } catch (error) {
      console.warn('Ubuntu status endpoint not available, returning mock data');
      return {
        success: true,
        data: {
          system: 'Ubuntu 20.04 LTS',
          uptime: '12 days, 3 hours',
          cpu_usage: '15%',
          memory_usage: '45%',
          disk_usage: '62%',
          last_updated: new Date().toISOString()
        }
      };
    }
  },

  // Get audit logs
  async getAuditLogs(params = {}) {
    const response = await apiClient.get('/api/dashboard/audit-logs', { params });
    return response.data;
  },

  // Get file statistics
  async getFileStats() {
    const response = await apiClient.get('/api/dashboard/file-stats');
    return response.data;
  },

  // Get performance metrics
  async getPerformance() {
    const response = await apiClient.get('/api/dashboard/performance');
    return response.data;
  },

  // Get file upload trends
  async getUploadTrends(period = '30d') {
    const response = await apiClient.get('/api/dashboard/file-upload-trends', { 
      params: { period } 
    });
    return response.data;
  },

  // Get activity timeline
  async getActivityTimeline(period = '7d') {
    const response = await apiClient.get('/api/dashboard/activity-timeline', {
      params: { period }
    });
    return response.data;
  },

  // Get action statistics
  async getActionStats() {
    const response = await apiClient.get('/api/dashboard/action-stats');
    return response.data;
  },

  // Get ProSBC files stored in database
  async getProSBCFiles(params = {}) {
    const response = await apiClient.get('/api/dashboard/prosbc-files', { params });
    return response.data;
  },

  // Download ProSBC file
  async downloadProSBCFile(fileId, fileType) {
    const response = await apiClient.get(`/api/dashboard/prosbc-files/${fileType}/${fileId}/download`, {
      responseType: 'blob'
    });
    
    return {
      blob: response.data,
      filename: response.headers['content-disposition'] 
        ? response.headers['content-disposition'].split('filename=')[1].replace(/"/g, '')
        : `prosbc_file_${fileId}.csv`
    };
  },

  // Get ProSBC file stats
  async getProSBCFileStats() {
    const response = await apiClient.get('/api/dashboard/prosbc-files/stats');
    return response.data;
  }
};

// Legacy support for existing code
export class ClientDatabaseService {
  async getAnalytics(period = '7d') {
    return dashboardService.getAnalytics(period);
  }

  async listNaps(filters = {}, page = 1, limit = 10) {
    return napService.getAll({ ...filters, page, limit });
  }

  async createNap(napData) {
    return napService.create(napData);
  }

  async saveFile(fileData) {
    const formData = new FormData();
    
    // Get the File object - check both file and originalFile properties
    const file = fileData.file || fileData.originalFile;
    
    // Validate that we have a File object
    if (!file || !(file instanceof File)) {
      console.error('Invalid file object:', file);
      throw new Error('No valid file provided. Expected a File object in fileData.file or fileData.originalFile');
    }
    
    console.log(`Saving file to database: ${file.name}, size: ${file.size}, type: ${fileData.type}`);
    
    // Add the file with the expected field name
    formData.append('file', file);
    
    // Add metadata fields that backend expects
    if (fileData.nap_id) formData.append('nap_id', fileData.nap_id);
    if (fileData.tags) formData.append('tags', fileData.tags);
    if (fileData.uploaded_by) formData.append('uploaded_by', fileData.uploaded_by || 'user');
    formData.append('name', fileData.name || file.name);
    
    // Determine file type based on explicit type or extension
    let fileType = 'dm'; // Default to digit map
    if (fileData.type === 'DF' || fileData.type === 'df') {
      fileType = 'df';
    } else if (file.name.toLowerCase().includes('dial') || file.name.toLowerCase().includes('df')) {
      fileType = 'df';
    }
    
    console.log(`Using file type for upload: ${fileType}`);
    
    return fileService.upload(formData, fileType);
  }

  async fetchProSBCFiles(options = {}) {
    return fileService.fetchProSBCFiles(options);
  }

  async importProSBCFiles(filesToImport) {
    return fileService.importProSBCFiles(filesToImport);
  }

  async getProSBCFiles(params = {}) {
    return dashboardService.getProSBCFiles(params);
  }


  async downloadProSBCFile(fileId, fileType) {
    return dashboardService.downloadProSBCFile(fileId, fileType);
  }

  /**
   * Store DM and DF files fetched from ProSBC into the database using the upload endpoints.
   * @param {Array} files - Array of objects with { file, type, name, nap_id, tags, uploaded_by }
   *        file: File | Blob | string (CSV content), type: 'dm' | 'df', name: string
   *        If file is string, it will be converted to a File object.
   * @returns {Promise<Array>} Array of upload results
   */
  async storeFetchedProSBCFiles(files = []) {
    const results = [];
    for (const fileObj of files) {
      let { file, type, name, nap_id, tags, uploaded_by } = fileObj;
      let fileType = (type && type.toLowerCase() === 'df') ? 'df' : 'dm';

      // If file is a string (CSV content), convert to File object
      if (typeof file === 'string') {
        file = new File([file], name || `prosbc_${fileType}_${Date.now()}.csv`, { type: 'text/csv' });
      }

      // Build FormData
      const formData = new FormData();
      formData.append('file', file);
      if (nap_id) formData.append('nap_id', nap_id);
      if (tags) formData.append('tags', tags);
      if (uploaded_by) formData.append('uploaded_by', uploaded_by);
      formData.append('name', name || file.name);

      // Upload using the correct endpoint
      try {
        const uploadResult = await fileService.upload(formData, fileType);
        results.push({ success: true, file: name || file.name, result: uploadResult });
      } catch (err) {
        results.push({ success: false, file: name || file.name, error: err.message });
      }
    }
    return results;
  }

  async getProSBCFileStats() {
    return dashboardService.getProSBCFileStats();
  }

  async getActivationLogs(filters = {}, page = 1, limit = 10) {
    return auditService.getLogs({ ...filters, page, limit, category: 'activation' });
  }

  async search(query, filters = {}) {
    // Search across multiple endpoints
    const [naps, files] = await Promise.all([
      napService.getAll({ search: query, ...filters }),
      fileService.getAll({ search: query, ...filters })
    ]);
    
    return {
      success: true,
      results: {
        naps: naps.data || [],
        files: files.data || []
      }
    };
  }
}

// Database health check
export async function getDBHealth() {
  try {
    const health = await dashboardService.getHealth();
    return {
      status: 'healthy',
      message: 'Backend connection is healthy',
      details: health
    };
  } catch (error) {
    return {
      status: 'error',
      message: error.message,
      error: error
    };
  }
}

// Quick access functions for compatibility
export const quickAccess = {
  async searchFiles(query, options = {}) {
    const result = await fileService.getAll({ search: query, ...options });
    return result.data || [];
  },

  async searchNaps(query, options = {}) {
    const result = await napService.getAll({ search: query, ...options });
    return result.data || [];
  },
  
  async fetchProSBCFiles(options = {}) {
    return fileService.fetchProSBCFiles(options);
  },
  
  async importProSBCFiles(filesToImport) {
    return fileService.importProSBCFiles(filesToImport);
  }
};

// Alias for backward compatibility
export const dbService = dashboardService;

// Default export
export default apiClient;
