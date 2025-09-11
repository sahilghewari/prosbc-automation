// File Management Service - Integrates ProSBC API with local database
import { fileDatabase } from './fileDatabase.js';
import { prosbcFileAPI } from './prosbcFileApi.js';

export class FileManagementService {
  constructor() {
    // File management service initialized
  }

  // Fetch files from ProSBC and store in database
  async fetchAndStoreFiles(onProgress = null) {
    try {
      onProgress?.(10, 'Fetching file lists from ProSBC...');
      
      // Get file lists from ProSBC
      const [dfResult, dmResult] = await Promise.all([
        prosbcFileAPI.listDfFiles(),
        prosbcFileAPI.listDmFiles()
      ]);

      if (!dfResult.success || !dmResult.success) {
        throw new Error('Failed to fetch file lists from ProSBC');
      }

      onProgress?.(30, 'Processing file lists...');

      const allFiles = [
        ...dfResult.files.map(f => ({ ...f, fileType: 'routesets_definitions' })),
        ...dmResult.files.map(f => ({ ...f, fileType: 'routesets_digitmaps' }))
      ];

      console.log(`Found ${allFiles.length} files on ProSBC`);

      const storedFiles = [];
      const errors = [];
      let processed = 0;

      // Process each file
      for (const file of allFiles) {
        try {
          processed++;
          const progressPercent = 30 + (processed / allFiles.length) * 60;
          onProgress?.(progressPercent, `Fetching content for ${file.name}...`);

          // Check if file is already in database
          const existingFile = await fileDatabase.getFileByProSBCId(file.id, file.fileType);
          
          if (existingFile && existingFile.status === 'synced') {
            console.log(`File ${file.name} already synced, skipping`);
            storedFiles.push(existingFile);
            continue;
          }

          // Get file content from ProSBC
          const contentResult = await prosbcFileAPI.getFileContent(file.fileType, file.id);
          
          if (!contentResult.success) {
            console.warn(`Failed to get content for ${file.name}:`, contentResult);
            errors.push(`Failed to fetch content for ${file.name}`);
            continue;
          }

          // Parse content
          const parsedData = this.parseFileContent(contentResult.content);

          // Store in database
          const fileData = {
            fileName: file.name,
            fileType: file.fileType,
            prosbcId: file.id,
            content: contentResult.content || '',
            parsedData: parsedData,
            status: 'synced',
            metadata: {
              prosbcUpdateUrl: file.updateUrl,
              prosbcExportUrl: file.exportUrl,
              prosbcDeleteUrl: file.deleteUrl,
              isCsvFile: contentResult.isCsvFile || false,
              fetchedAt: new Date().toISOString()
            }
          };

          const storedFile = await fileDatabase.storeFile(fileData);
          await fileDatabase.updateSyncStatus(storedFile.id, 'synced');
          
          storedFiles.push(storedFile);
          console.log(`Stored file: ${file.name}`);

        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error);
          errors.push(`Error processing ${file.name}: ${error.message}`);
        }
      }

      onProgress?.(100, 'Files fetched and stored successfully!');

      return {
        success: true,
        storedFiles: storedFiles,
        errors: errors,
        stats: {
          total: allFiles.length,
          stored: storedFiles.length,
          errors: errors.length
        }
      };

    } catch (error) {
      console.error('Fetch and store files error:', error);
      throw error;
    }
  }

  // Get all stored files with enhanced information
  async getStoredFiles() {
    try {
      const files = await fileDatabase.getAllFiles();
      
      // Enhance with sync status
      const enhancedFiles = await Promise.all(
        files.map(async (file) => {
          const syncStatus = await fileDatabase.getSyncStatus(file.id);
          return {
            ...file,
            syncStatus: syncStatus
          };
        })
      );

      return {
        success: true,
        files: enhancedFiles
      };
    } catch (error) {
      console.error('Get stored files error:', error);
      throw error;
    }
  }

  // Get stored files by type
  async getStoredFilesByType(fileType) {
    try {
      const files = await fileDatabase.getFilesByType(fileType);
      
      // Enhance with sync status
      const enhancedFiles = await Promise.all(
        files.map(async (file) => {
          const syncStatus = await fileDatabase.getSyncStatus(file.id);
          return {
            ...file,
            syncStatus: syncStatus
          };
        })
      );

      return {
        success: true,
        files: enhancedFiles
      };
    } catch (error) {
      console.error('Get stored files by type error:', error);
      throw error;
    }
  }

  // Search stored files
  async searchStoredFiles(searchTerm, fileType = null) {
    try {
      const files = await fileDatabase.searchFiles(searchTerm, fileType);
      
      return {
        success: true,
        files: files,
        searchTerm: searchTerm
      };
    } catch (error) {
      console.error('Search stored files error:', error);
      throw error;
    }
  }

  // Delete stored file
  async deleteStoredFile(fileId) {
    try {
      const deleted = await fileDatabase.deleteFile(fileId);
      
      return {
        success: deleted,
        message: deleted ? 'File deleted from local database' : 'File not found'
      };
    } catch (error) {
      console.error('Delete stored file error:', error);
      throw error;
    }
  }

  // Get file versions/history
  async getFileVersions(fileId) {
    try {
      const versions = await fileDatabase.getFileVersions(fileId);
      
      return {
        success: true,
        versions: versions
      };
    } catch (error) {
      console.error('Get file versions error:', error);
      throw error;
    }
  }

  // Get database statistics
  async getDatabaseStats() {
    try {
      const stats = await fileDatabase.getStats();
      
      return {
        success: true,
        stats: stats
      };
    } catch (error) {
      console.error('Get database stats error:', error);
      throw error;
    }
  }

  // Update stored file content
  async updateStoredFile(fileId, newContent) {
    try {
      const file = await fileDatabase.getFile(fileId);
      if (!file) {
        throw new Error('File not found');
      }

      // Parse the new content
      const parsedData = this.parseFileContent(newContent);

      // Update the file
      const updateData = {
        content: newContent,
        parsedData: parsedData,
        lastModified: new Date().toISOString(),
        status: 'modified',
        metadata: {
          ...file.metadata,
          lastUpdateTimestamp: new Date().toISOString(),
          contentLength: newContent.length
        }
      };

      await fileDatabase.updateFile(fileId, updateData);
      
      return {
        success: true,
        message: 'File updated successfully',
        file: await fileDatabase.getFile(fileId)
      };
    } catch (error) {
      console.error('Update stored file error:', error);
      throw error;
    }
  }

  // Update file on ProSBC
  async updateFileOnProSBC(fileId, newContent, onProgress = null) {
    try {
      const file = await fileDatabase.getFile(fileId);
      if (!file) {
        throw new Error('File not found');
      }

      onProgress?.(10, 'Preparing file for update...');

      // Create a File object from the content
      const fileName = file.fileName;
      const fileType = file.fileType;
      const updatedFile = new File([newContent], fileName, { type: 'text/csv' });

      onProgress?.(30, 'Updating file on ProSBC...');

      // Use the ProSBC API to update the file
      const updateResult = await prosbcFileAPI.updateFile(
        fileType,
        file.prosbcId,
        updatedFile,
        onProgress
      );

      if (updateResult.success) {
        onProgress?.(80, 'Updating local database...');
        
        // Update local database
        await this.updateStoredFile(fileId, newContent);
        
        onProgress?.(100, 'File updated successfully!');
      }

      return updateResult;
    } catch (error) {
      console.error('Update file on ProSBC error:', error);
      throw error;
    }
  }

  // Get file content for editing
  async getFileForEditing(fileId) {
    try {
      const file = await fileDatabase.getFile(fileId);
      if (!file) {
        throw new Error('File not found');
      }

      // If file has content, return it
      if (file.content) {
        return {
          success: true,
          file: file,
          content: file.content
        };
      }

      // Otherwise, try to get content from ProSBC
      const contentResult = await prosbcFileAPI.getFileContent(
        file.fileType,
        file.prosbcId
      );

      if (contentResult.success) {
        // Update local database with the fetched content
        await this.updateStoredFile(fileId, contentResult.content);
        
        return {
          success: true,
          file: await fileDatabase.getFile(fileId),
          content: contentResult.content
        };
      }

      throw new Error('Failed to get file content');
    } catch (error) {
      console.error('Get file for editing error:', error);
      throw error;
    }
  }

  // Utility methods
  parseFileContent(content) {
    if (!content || content.trim() === '') return [];
    
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];
    
    const isCSV = lines.some(line => line.includes(','));
    
    if (isCSV) {
      return lines.map((line, index) => {
        const fields = line.split(',').map(field => field.trim().replace(/^"|"$/g, ''));
        return {
          id: index,
          original: line,
          data: fields,
          isHeader: index === 0 && fields.some(field => 
            ['called', 'calling', 'routeset', 'name', 'number', 'route'].some(keyword => 
              field.toLowerCase().includes(keyword)
            )
          )
        };
      });
    } else {
      return lines.map((line, index) => ({
        id: index,
        original: line,
        data: [line],
        isHeader: false
      }));
    }
  }



  // Clear database (for testing/reset)
  async clearDatabase() {
    try {
      await fileDatabase.clearDatabase();
      
      return {
        success: true,
        message: 'Database cleared successfully'
      };
    } catch (error) {
      console.error('Clear database error:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const fileManagementService = new FileManagementService();
