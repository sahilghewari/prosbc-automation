// File Update Service - High-level interface for updating ProSBC files
// Provides easy-to-use methods for file updates with comprehensive error handling
import { fileManagementAPI } from './fileManagementAPI.js';
import { sessionManager } from './sessionManager.js';

export class FileUpdateService {
  constructor() {
    this.isUpdating = false;
    this.updateHistory = [];
    this.maxHistorySize = 10;
  }

  // Main method to update a file
  async updateFile(file, options = {}) {
    if (this.isUpdating) {
      throw new Error('File update already in progress');
    }

    const {
      fileDbId = 1,
      routesetId = 1,
      fileType = 'routesets_definitions',
      onProgress = null,
      validateBeforeUpdate = true,
      retryOnSessionExpired = true,
      maxRetries = 3
    } = options;

    this.isUpdating = true;
    let attempt = 0;
    
    try {
      console.log(`Starting file update for: ${file.name}`);
      
      // Validate file if requested
      if (validateBeforeUpdate) {
        onProgress?.(5, 'Validating file...');
        const validation = fileManagementAPI.validateFile(file);
        if (!validation.valid) {
          throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
        }
      }

      // Attempt update with retry logic
      while (attempt < maxRetries) {
        attempt++;
        
        try {
          console.log(`Update attempt ${attempt} of ${maxRetries}`);
          
          // Check session status before update
          const sessionStatus = sessionManager.getSessionInfo();
          console.log('Session status:', sessionStatus);
          
          if (sessionStatus.isExpired) {
            console.log('Session expired, will be refreshed during update');
          }
          
          // Perform the update
          const result = await fileManagementAPI.updateFile(
            file, 
            fileDbId, 
            routesetId, 
            fileType,
            onProgress
          );
          
          // Record successful update
          this.recordUpdateHistory(file, result, attempt);
          
          return {
            success: true,
            message: 'File updated successfully',
            attempts: attempt,
            fileInfo: {
              name: file.name,
              size: file.size,
              type: file.type
            },
            result: result
          };
          
        } catch (error) {
          console.error(`Update attempt ${attempt} failed:`, error);
          
          // Check if this is a session-related error and we should retry
          if (retryOnSessionExpired && this.isSessionError(error) && attempt < maxRetries) {
            console.log(`Session error detected, clearing session and retrying...`);
            sessionManager.clearSession();
            fileManagementAPI.resetSession();
            
            // Wait a bit before retry
            await this.delay(1000);
            continue;
          }
          
          // If it's not a session error or we've exhausted retries, throw
          throw error;
        }
      }
      
      throw new Error(`File update failed after ${maxRetries} attempts`);
      
    } catch (error) {
      console.error('File update service error:', error);
      
      // Record failed update
      this.recordUpdateHistory(file, { success: false, error: error.message }, attempt);
      
      // Create user-friendly error response
      const errorResponse = this.createErrorResponse(error);
      
      return {
        success: false,
        error: errorResponse.message,
        details: errorResponse.details,
        attempts: attempt,
        fileInfo: {
          name: file.name,
          size: file.size,
          type: file.type
        }
      };
      
    } finally {
      this.isUpdating = false;
    }
  }

  // Check if error is session-related
  isSessionError(error) {
    const sessionErrorIndicators = [
      'session expired',
      'authentication failed',
      'redirected to login',
      'authenticity token',
      'unauthorized',
      'forbidden'
    ];
    
    const errorMessage = error.message.toLowerCase();
    return sessionErrorIndicators.some(indicator => errorMessage.includes(indicator));
  }

  // Create user-friendly error response
  createErrorResponse(error) {
    // Handle different types of errors
    if (error.response) {
      const status = error.response.status;
      
      switch (status) {
        case 401:
        case 403:
          return {
            message: 'Authentication failed. Please check your credentials.',
            details: 'The session may have expired or credentials are invalid.',
            type: 'authentication'
          };
          
        case 422:
          return {
            message: 'File validation failed. Please check the file format and size.',
            details: 'The file may be too large, have an invalid format, or contain invalid data.',
            type: 'validation'
          };
          
        case 500:
          return {
            message: 'Server error occurred. Please try again later.',
            details: 'The ProSBC server encountered an internal error.',
            type: 'server'
          };
          
        case 502:
        case 503:
        case 504:
          return {
            message: 'Service temporarily unavailable. Please try again later.',
            details: 'The ProSBC service is temporarily unavailable.',
            type: 'service'
          };
          
        default:
          return {
            message: `Update failed with status ${status}`,
            details: error.message,
            type: 'http'
          };
      }
    }
    
    // Handle network errors
    if (error.code === 'ECONNABORTED') {
      return {
        message: 'Request timed out. Please check your connection and try again.',
        details: 'The server took too long to respond.',
        type: 'timeout'
      };
    }
    
    if (error.code === 'ECONNREFUSED') {
      return {
        message: 'Cannot connect to ProSBC server. Please check the server status.',
        details: 'Connection to the server was refused.',
        type: 'connection'
      };
    }
    
    // Default error
    return {
      message: error.message || 'An unexpected error occurred',
      details: error.stack || 'No additional details available',
      type: 'unknown'
    };
  }

  // Record update history
  recordUpdateHistory(file, result, attempts) {
    const historyEntry = {
      timestamp: new Date().toISOString(),
      fileName: file.name,
      fileSize: file.size,
      success: result.success,
      attempts: attempts,
      error: result.error || null
    };
    
    this.updateHistory.unshift(historyEntry);
    
    // Keep only the last N entries
    if (this.updateHistory.length > this.maxHistorySize) {
      this.updateHistory = this.updateHistory.slice(0, this.maxHistorySize);
    }
  }

  // Get update history
  getUpdateHistory() {
    return [...this.updateHistory];
  }

  // Clear update history
  clearUpdateHistory() {
    this.updateHistory = [];
  }

  // Get current update status
  getUpdateStatus() {
    return {
      isUpdating: this.isUpdating,
      sessionStatus: sessionManager.getStatusSummary(),
      lastUpdate: this.updateHistory.length > 0 ? this.updateHistory[0] : null
    };
  }

  // Utility method to delay execution
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Batch update multiple files
  async updateMultipleFiles(files, options = {}) {
    const {
      onProgress = null,
      onFileComplete = null,
      continueOnError = false
    } = options;

    if (this.isUpdating) {
      throw new Error('File update already in progress');
    }

    const results = [];
    const totalFiles = files.length;

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      const fileProgress = (i / totalFiles) * 100;
      
      onProgress?.(fileProgress, `Updating file ${i + 1} of ${totalFiles}: ${file.name}`);
      
      try {
        const result = await this.updateFile(file, {
          ...options,
          onProgress: (progress, message) => {
            const overallProgress = fileProgress + (progress / totalFiles);
            onProgress?.(overallProgress, message);
          }
        });
        
        results.push(result);
        onFileComplete?.(file, result, i + 1, totalFiles);
        
      } catch (error) {
        console.error(`Failed to update file ${file.name}:`, error);
        
        const errorResult = {
          success: false,
          error: error.message,
          fileInfo: {
            name: file.name,
            size: file.size,
            type: file.type
          }
        };
        
        results.push(errorResult);
        onFileComplete?.(file, errorResult, i + 1, totalFiles);
        
        if (!continueOnError) {
          throw new Error(`Batch update failed at file ${i + 1}: ${error.message}`);
        }
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return {
      success: failureCount === 0,
      totalFiles,
      successCount,
      failureCount,
      results
    };
  }

  // Test connection to ProSBC
  async testConnection(fileType = 'routesets_definitions') {
    try {
      console.log('Testing connection to ProSBC...');
      
      const sessionStatus = sessionManager.getSessionInfo();
      console.log('Current session status:', sessionStatus);
      
      // Try to get edit form data to test connectivity
      const testResult = await fileManagementAPI.getEditFormData(1, 1, fileType);
      
      return {
        success: true,
        message: `Successfully connected to ProSBC (${fileType === 'routesets_digitmaps' ? 'DM' : 'DF'} files)`,
        sessionInfo: sessionManager.getSessionInfo(),
        fileType: fileType
      };
      
    } catch (error) {
      console.error('Connection test failed:', error);
      
      return {
        success: false,
        error: error.message,
        details: this.createErrorResponse(error),
        fileType: fileType
      };
    }
  }
}

// Create and export singleton instance
export const fileUpdateService = new FileUpdateService();

// Export convenience functions
export const updateFile = (file, options = {}) => {
  return fileUpdateService.updateFile(file, options);
};

export const updateMultipleFiles = (files, options = {}) => {
  return fileUpdateService.updateMultipleFiles(files, options);
};

export const testConnection = () => {
  return fileUpdateService.testConnection();
};

export const getUpdateStatus = () => {
  return fileUpdateService.getUpdateStatus();
};

export const getUpdateHistory = () => {
  return fileUpdateService.getUpdateHistory();
};

export const clearUpdateHistory = () => {
  return fileUpdateService.clearUpdateHistory();
};