/**
 * Client-Side CSV Editor Database Integration
 * Browser-compatible integration for CSV editing with audit trails
 */

// Storage keys for different data types
const STORAGE_KEYS = {
  FILES: 'prosbc_files',
  EDIT_HISTORY: 'prosbc_edit_history'
};

// Utility functions
const getStorageData = (key) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.warn(`Error reading ${key} from localStorage:`, error);
    return [];
  }
};

const setStorageData = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.warn(`Error writing ${key} to localStorage:`, error);
    return false;
  }
};

const generateId = () => Math.random().toString(36).substr(2, 9);

class CSVEditorDatabaseIntegration {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    // Simulate initialization delay
    await new Promise(resolve => setTimeout(resolve, 100));
    this.initialized = true;
    return { success: true };
  }

  async updateFileWithDatabase(fileName, csvData, originalData, changeDescription, userId = 'current_user') {
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 200));

      const files = getStorageData(STORAGE_KEYS.FILES);
      const editHistory = getStorageData(STORAGE_KEYS.EDIT_HISTORY);

      // Find or create file record
      let fileRecord = files.find(f => f.fileName === fileName);
      if (!fileRecord) {
        fileRecord = {
          id: generateId(),
          fileName,
          fileType: fileName.toLowerCase().includes('.df') ? 'df' : 'dm',
          filePath: `/prosbc-files/${fileName.toLowerCase().includes('.df') ? 'df' : 'dm'}/${fileName}`,
          fileSize: csvData.length,
          uploadDate: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          tags: ['edited'],
          validation: {
            isValid: true,
            validatedAt: new Date().toISOString(),
            issues: []
          }
        };
        files.push(fileRecord);
      } else {
        fileRecord.lastModified = new Date().toISOString();
        fileRecord.fileSize = csvData.length;
      }

      // Create edit history entry
      const historyEntry = {
        id: generateId(),
        fileId: fileRecord.id,
        fileName: fileName,
        version: editHistory.filter(h => h.fileId === fileRecord.id).length + 1,
        timestamp: new Date().toISOString(),
        userId: userId,
        changeDescription: changeDescription || 'CSV file updated',
        changeType: 'edit',
        previousData: originalData,
        newData: csvData,
        metadata: {
          fileSize: csvData.length,
          editor: 'CSV Editor',
          userAgent: navigator.userAgent
        }
      };

      editHistory.push(historyEntry);

      // Save to localStorage
      setStorageData(STORAGE_KEYS.FILES, files);
      setStorageData(STORAGE_KEYS.EDIT_HISTORY, editHistory);

      return {
        success: true,
        fileId: fileRecord.id,
        version: historyEntry.version,
        message: 'File updated successfully with audit trail'
      };

    } catch (error) {
      console.error('Error updating file with database:', error);
      return {
        success: false,
        error: error.message || 'Failed to update file'
      };
    }
  }

  async getFileHistory(fileName) {
    try {
      await new Promise(resolve => setTimeout(resolve, 100));

      const files = getStorageData(STORAGE_KEYS.FILES);
      const editHistory = getStorageData(STORAGE_KEYS.EDIT_HISTORY);

      const fileRecord = files.find(f => f.fileName === fileName);
      if (!fileRecord) {
        return {
          success: true,
          history: [],
          message: 'No history found for this file'
        };
      }

      const fileHistory = editHistory
        .filter(h => h.fileId === fileRecord.id)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      return {
        success: true,
        history: fileHistory,
        totalVersions: fileHistory.length
      };

    } catch (error) {
      console.error('Error getting file history:', error);
      return {
        success: false,
        error: error.message || 'Failed to get file history'
      };
    }
  }

  async rollbackToVersion(fileName, versionId) {
    try {
      await new Promise(resolve => setTimeout(resolve, 150));

      const editHistory = getStorageData(STORAGE_KEYS.EDIT_HISTORY);
      const targetVersion = editHistory.find(h => h.id === versionId);

      if (!targetVersion) {
        return {
          success: false,
          error: 'Version not found'
        };
      }

      // Create a new history entry for the rollback
      const rollbackEntry = {
        id: generateId(),
        fileId: targetVersion.fileId,
        fileName: fileName,
        version: editHistory.filter(h => h.fileId === targetVersion.fileId).length + 1,
        timestamp: new Date().toISOString(),
        userId: 'current_user',
        changeDescription: `Rolled back to version ${targetVersion.version}`,
        changeType: 'rollback',
        previousData: null, // Would be current data in real implementation
        newData: targetVersion.newData,
        metadata: {
          rolledBackFrom: versionId,
          originalVersion: targetVersion.version,
          editor: 'CSV Editor'
        }
      };

      editHistory.push(rollbackEntry);
      setStorageData(STORAGE_KEYS.EDIT_HISTORY, editHistory);

      return {
        success: true,
        data: targetVersion.newData,
        message: `Successfully rolled back to version ${targetVersion.version}`
      };

    } catch (error) {
      console.error('Error rolling back file:', error);
      return {
        success: false,
        error: error.message || 'Failed to rollback file'
      };
    }
  }

  async deleteVersion(versionId) {
    try {
      await new Promise(resolve => setTimeout(resolve, 100));

      const editHistory = getStorageData(STORAGE_KEYS.EDIT_HISTORY);
      const filteredHistory = editHistory.filter(h => h.id !== versionId);

      setStorageData(STORAGE_KEYS.EDIT_HISTORY, filteredHistory);

      return {
        success: true,
        message: 'Version deleted successfully'
      };

    } catch (error) {
      console.error('Error deleting version:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete version'
      };
    }
  }

  // Utility method to check if integration is available
  isAvailable() {
    return this.initialized;
  }

  // Get storage statistics
  getStorageStats() {
    const files = getStorageData(STORAGE_KEYS.FILES);
    const editHistory = getStorageData(STORAGE_KEYS.EDIT_HISTORY);

    return {
      totalFiles: files.length,
      totalEdits: editHistory.length,
      storageUsed: JSON.stringify(files).length + JSON.stringify(editHistory).length
    };
  }
}

export default CSVEditorDatabaseIntegration;
