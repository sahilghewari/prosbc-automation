/**
 * Ubuntu File Storage API Client
 * This service communicates with a backend API for file storage on Ubuntu
 * Falls back to localStorage when no backend is available
 */

class UbuntuStorageAPI {
  constructor() {
    this.apiBaseUrl = this.detectApiUrl();
    this.isUbuntuDeployment = this.detectEnvironment();
  }

  detectApiUrl() {
    // Check if we're in development or production
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3001/api'; // Development backend
      } else {
        return '/api'; // Production backend on same server
      }
    }
    return '/api';
  }

  detectEnvironment() {
    // Try to detect if we're running on Ubuntu with file system backend
    return typeof window !== 'undefined' && 
           (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1');
  }

  async makeRequest(endpoint, method = 'GET', data = null) {
    try {
      const url = `${this.apiBaseUrl}${endpoint}`;
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (data) {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      // Only log warnings if we're in Ubuntu deployment, not development
      if (this.isUbuntuDeployment) {
        console.warn(`Ubuntu API request failed: ${error.message}`);
      }
      throw error;
    }
  }

  // File Operations
  async saveFile(fileData) {
    if (!this.isUbuntuDeployment) {
      throw new Error('Ubuntu storage not available in development');
    }

    try {
      return await this.makeRequest('/files', 'POST', fileData);
    } catch (error) {
      console.error('Failed to save file to Ubuntu storage:', error);
      throw error;
    }
  }

  async getFile(fileId) {
    if (!this.isUbuntuDeployment) {
      throw new Error('Ubuntu storage not available in development');
    }

    try {
      return await this.makeRequest(`/files/${fileId}`);
    } catch (error) {
      console.error('Failed to get file from Ubuntu storage:', error);
      throw error;
    }
  }

  async listFiles(type = null) {
    if (!this.isUbuntuDeployment) {
      throw new Error('Ubuntu storage not available in development');
    }

    try {
      const endpoint = type ? `/files?type=${type}` : '/files';
      return await this.makeRequest(endpoint);
    } catch (error) {
      console.error('Failed to list files from Ubuntu storage:', error);
      throw error;
    }
  }

  // NAP Operations
  async saveNap(napData) {
    if (!this.isUbuntuDeployment) {
      throw new Error('Ubuntu storage not available in development');
    }

    try {
      return await this.makeRequest('/naps', 'POST', napData);
    } catch (error) {
      console.error('Failed to save NAP to Ubuntu storage:', error);
      throw error;
    }
  }

  async getNap(napId) {
    if (!this.isUbuntuDeployment) {
      throw new Error('Ubuntu storage not available in development');
    }

    try {
      return await this.makeRequest(`/naps/${napId}`);
    } catch (error) {
      console.error('Failed to get NAP from Ubuntu storage:', error);
      throw error;
    }
  }

  async listNaps() {
    if (!this.isUbuntuDeployment) {
      throw new Error('Ubuntu storage not available in development');
    }

    try {
      return await this.makeRequest('/naps');
    } catch (error) {
      console.error('Failed to list NAPs from Ubuntu storage:', error);
      throw error;
    }
  }

  // Log Operations
  async saveLog(logData) {
    if (!this.isUbuntuDeployment) {
      throw new Error('Ubuntu storage not available in development');
    }

    try {
      return await this.makeRequest('/logs', 'POST', logData);
    } catch (error) {
      console.error('Failed to save log to Ubuntu storage:', error);
      throw error;
    }
  }

  async getLogs(date = null) {
    if (!this.isUbuntuDeployment) {
      throw new Error('Ubuntu storage not available in development');
    }

    try {
      const endpoint = date ? `/logs?date=${date}` : '/logs';
      return await this.makeRequest(endpoint);
    } catch (error) {
      console.error('Failed to get logs from Ubuntu storage:', error);
      throw error;
    }
  }

  // Health Check
  async checkHealth() {
    try {
      return await this.makeRequest('/health');
    } catch (error) {
      return {
        status: 'disconnected',
        message: 'Ubuntu backend not available',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Storage Statistics
  async getStorageStats() {
    if (!this.isUbuntuDeployment) {
      throw new Error('Ubuntu storage not available in development');
    }

    try {
      return await this.makeRequest('/storage/stats');
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      throw error;
    }
  }
}

export default UbuntuStorageAPI;
