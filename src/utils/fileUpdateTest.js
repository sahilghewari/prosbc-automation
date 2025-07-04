// Test File for File Update Functionality
// This file can be used to test the file update system

import { updateFile, testConnection, getUpdateHistory } from '../utils/fileUpdateService.js';

// Test function to verify the file update system
async function testFileUpdate() {
  console.log('Testing file update system...');
  
  // Test 1: Test connection
  try {
    console.log('1. Testing connection...');
    const connectionResult = await testConnection();
    console.log('Connection result:', connectionResult);
    
    if (!connectionResult.success) {
      console.error('Connection test failed:', connectionResult.error);
      return;
    }
    
    console.log('✓ Connection test passed');
  } catch (error) {
    console.error('Connection test error:', error);
    return;
  }
  
  // Test 2: Get update history
  try {
    console.log('2. Getting update history...');
    const history = getUpdateHistory();
    console.log('Update history:', history);
    console.log('✓ Update history retrieved');
  } catch (error) {
    console.error('Update history error:', error);
  }
  
  // Test 3: File validation (without actual file)
  try {
    console.log('3. Testing file validation...');
    const { validateFile } = await import('../utils/fileUpdateService.js');
    
    // Create a mock file for testing
    const mockFile = new File(['test content'], 'test.csv', { type: 'text/csv' });
    const validation = validateFile(mockFile);
    console.log('File validation result:', validation);
    console.log('✓ File validation works');
  } catch (error) {
    console.error('File validation error:', error);
  }
  
  console.log('File update system test completed!');
}

// Export for use in other files
export { testFileUpdate };

// Usage examples for the file update system
export const examples = {
  // Example 1: Basic file update
  basicUpdate: async (file) => {
    try {
      const result = await updateFile(file, {
        fileDbId: 1,
        routesetId: 1,
        onProgress: (progress, message) => {
          console.log(`${progress}%: ${message}`);
        }
      });
      
      if (result.success) {
        console.log('File updated successfully!');
      } else {
        console.error('Update failed:', result.error);
      }
      
      return result;
    } catch (error) {
      console.error('Update error:', error);
      throw error;
    }
  },
  
  // Example 2: Update with retry logic
  updateWithRetry: async (file) => {
    try {
      const result = await updateFile(file, {
        fileDbId: 1,
        routesetId: 1,
        validateBeforeUpdate: true,
        retryOnSessionExpired: true,
        maxRetries: 3,
        onProgress: (progress, message) => {
          console.log(`${progress}%: ${message}`);
        }
      });
      
      return result;
    } catch (error) {
      console.error('Update with retry error:', error);
      throw error;
    }
  },
  
  // Example 3: Test connection before update
  safeUpdate: async (file) => {
    try {
      // First test connection
      const connectionResult = await testConnection();
      if (!connectionResult.success) {
        throw new Error(`Connection failed: ${connectionResult.error}`);
      }
      
      // Then perform update
      const result = await updateFile(file, {
        fileDbId: 1,
        routesetId: 1,
        onProgress: (progress, message) => {
          console.log(`${progress}%: ${message}`);
        }
      });
      
      return result;
    } catch (error) {
      console.error('Safe update error:', error);
      throw error;
    }
  }
};

// File type mappings for ProSBC
export const fileTypeMappings = {
  'routesets_definitions': {
    name: 'Definition Files (DF)',
    extensions: ['.csv', '.txt'],
    description: 'Files containing routeset definitions and routing rules'
  },
  'routesets_digitmaps': {
    name: 'Digit Map Files (DM)',
    extensions: ['.csv', '.txt', '.json'],
    description: 'Files containing digit mapping patterns and routeset mappings'
  }
};

// Default configurations
export const defaultConfigs = {
  fileDbId: 1,
  routesetId: 1,
  maxRetries: 3,
  validateBeforeUpdate: true,
  retryOnSessionExpired: true,
  allowedFileTypes: ['.csv', '.txt', '.json'],
  maxFileSize: 10 * 1024 * 1024 // 10MB
};

console.log('File update test utilities loaded. Use testFileUpdate() to test the system.');
