/**
 * File Storage Service
 * Handles file system operations and storage management
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { createReadStream, createWriteStream } from 'fs';

class FileStorageService {
  constructor() {
    // File storage configuration
    this.baseStoragePath = process.env.PROSBC_STORAGE_PATH || '/opt/prosbc-dashboard/files';
    this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024; // 50MB default
    this.allowedExtensions = ['.csv', '.txt', '.json', '.xml'];
    this.allowedMimeTypes = ['text/csv', 'text/plain', 'application/json', 'application/xml'];
    
    // Initialize storage directories
    this.initializeStorageDirectories();
  }

  async initializeStorageDirectories() {
    try {
      const directories = [
        path.join(this.baseStoragePath, 'df'),
        path.join(this.baseStoragePath, 'dm'),
        path.join(this.baseStoragePath, 'routesets'),
        path.join(this.baseStoragePath, 'backups'),
        path.join(this.baseStoragePath, 'temp'),
        path.join(this.baseStoragePath, 'configs'),
        path.join(this.baseStoragePath, 'exports')
      ];

      for (const dir of directories) {
        await this.ensureDirectoryExists(dir);
      }

      console.log('✅ Storage directories initialized');
      
    } catch (error) {
      console.error('❌ Error initializing storage directories:', error);
      throw error;
    }
  }

  async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(dirPath, { recursive: true });
        console.log(`📁 Created directory: ${dirPath}`);
      } else {
        throw error;
      }
    }
  }

  generateFileName(originalFilename, fileType, timestamp = null) {
    const ext = path.extname(originalFilename);
    const baseName = path.basename(originalFilename, ext);
    const cleanBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const ts = timestamp || new Date().toISOString().replace(/[:.]/g, '-');
    
    return `${ts}_${cleanBaseName}_${Math.random().toString(36).substr(2, 8)}${ext}`;
  }

  getStoragePath(fileType) {
    const typeMap = {
      'DF': 'df',
      'DM': 'dm',
      'Routeset': 'routesets',
      'Backup': 'backups',
      'Config': 'configs'
    };

    const subDir = typeMap[fileType] || 'temp';
    return path.join(this.baseStoragePath, subDir);
  }

  async saveFile(fileData, fileType, originalFilename, metadata = {}) {
    try {
      // Validate file
      this.validateFile(fileData, originalFilename);

      // Generate file path
      const storagePath = this.getStoragePath(fileType);
      const fileName = this.generateFileName(originalFilename, fileType);
      const fullPath = path.join(storagePath, fileName);

      // Ensure directory exists
      await this.ensureDirectoryExists(storagePath);

      // Write file
      await fs.writeFile(fullPath, fileData, 'utf8');

      // Get file stats
      const stats = await fs.stat(fullPath);

      // Calculate checksum
      const checksum = await this.calculateChecksum(fileData);

      const fileInfo = {
        file_path: fullPath,
        original_filename: originalFilename,
        stored_filename: fileName,
        file_size: stats.size,
        checksum: checksum,
        mime_type: this.getMimeType(originalFilename),
        created_at: stats.birthtime,
        modified_at: stats.mtime,
        metadata: {
          ...metadata,
          encoding: 'utf8',
          line_endings: this.detectLineEndings(fileData),
          delimiter: this.detectCSVDelimiter(fileData),
          quote_char: this.detectQuoteChar(fileData)
        }
      };

      console.log(`✅ File saved: ${fullPath}`);
      return { success: true, fileInfo };
      
    } catch (error) {
      console.error('❌ Error saving file:', error);
      throw new Error(`Failed to save file: ${error.message}`);
    }
  }

  async readFile(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const stats = await fs.stat(filePath);
      
      return {
        success: true,
        content: data,
        fileInfo: {
          file_size: stats.size,
          modified_at: stats.mtime,
          accessed_at: stats.atime
        }
      };
      
    } catch (error) {
      console.error('❌ Error reading file:', error);
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  async updateFile(filePath, newContent, createBackup = true) {
    try {
      let backupPath = null;
      
      // Create backup if requested
      if (createBackup) {
        backupPath = await this.createBackup(filePath);
      }

      // Write new content
      await fs.writeFile(filePath, newContent, 'utf8');

      // Get updated stats
      const stats = await fs.stat(filePath);
      const checksum = await this.calculateChecksum(newContent);

      console.log(`✅ File updated: ${filePath}`);
      
      return {
        success: true,
        fileInfo: {
          file_size: stats.size,
          modified_at: stats.mtime,
          checksum: checksum
        },
        backup_path: backupPath
      };
      
    } catch (error) {
      console.error('❌ Error updating file:', error);
      throw new Error(`Failed to update file: ${error.message}`);
    }
  }

  async deleteFile(filePath, moveToBackup = true) {
    try {
      if (moveToBackup) {
        // Move to backup instead of deleting
        const backupPath = await this.moveToBackup(filePath);
        console.log(`✅ File moved to backup: ${backupPath}`);
        return { success: true, backup_path: backupPath };
      } else {
        // Permanently delete
        await fs.unlink(filePath);
        console.log(`✅ File deleted: ${filePath}`);
        return { success: true, deleted: true };
      }
      
    } catch (error) {
      console.error('❌ Error deleting file:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  async createBackup(filePath, reason = 'manual_backup') {
    try {
      const fileName = path.basename(filePath);
      const backupDir = path.join(this.baseStoragePath, 'backups');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `${timestamp}_${reason}_${fileName}`;
      const backupPath = path.join(backupDir, backupFileName);

      // Ensure backup directory exists
      await this.ensureDirectoryExists(backupDir);

      // Copy file to backup location
      await fs.copyFile(filePath, backupPath);

      console.log(`✅ Backup created: ${backupPath}`);
      return backupPath;
      
    } catch (error) {
      console.error('❌ Error creating backup:', error);
      throw new Error(`Failed to create backup: ${error.message}`);
    }
  }

  async moveToBackup(filePath) {
    try {
      const backupPath = await this.createBackup(filePath, 'deleted');
      await fs.unlink(filePath);
      return backupPath;
    } catch (error) {
      throw new Error(`Failed to move file to backup: ${error.message}`);
    }
  }

  async restoreFromBackup(backupPath, originalPath) {
    try {
      // Ensure target directory exists
      const targetDir = path.dirname(originalPath);
      await this.ensureDirectoryExists(targetDir);

      // Copy from backup to original location
      await fs.copyFile(backupPath, originalPath);

      console.log(`✅ File restored from backup: ${originalPath}`);
      return { success: true, restored_path: originalPath };
      
    } catch (error) {
      console.error('❌ Error restoring from backup:', error);
      throw new Error(`Failed to restore from backup: ${error.message}`);
    }
  }

  async listFiles(directory, filters = {}) {
    try {
      const fullPath = path.join(this.baseStoragePath, directory);
      const files = await fs.readdir(fullPath);
      
      const fileInfos = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(fullPath, file);
          const stats = await fs.stat(filePath);
          
          if (stats.isFile()) {
            return {
              filename: file,
              path: filePath,
              size: stats.size,
              created_at: stats.birthtime,
              modified_at: stats.mtime,
              extension: path.extname(file)
            };
          }
          return null;
        })
      );

      let filteredFiles = fileInfos.filter(Boolean);

      // Apply filters
      if (filters.extension) {
        filteredFiles = filteredFiles.filter(f => f.extension === filters.extension);
      }
      if (filters.size_min) {
        filteredFiles = filteredFiles.filter(f => f.size >= filters.size_min);
      }
      if (filters.size_max) {
        filteredFiles = filteredFiles.filter(f => f.size <= filters.size_max);
      }
      if (filters.date_from) {
        filteredFiles = filteredFiles.filter(f => f.created_at >= new Date(filters.date_from));
      }

      return { success: true, files: filteredFiles };
      
    } catch (error) {
      console.error('❌ Error listing files:', error);
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  async calculateChecksum(content) {
    try {
      return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
    } catch (error) {
      throw new Error(`Failed to calculate checksum: ${error.message}`);
    }
  }

  async getStorageStats() {
    try {
      const stats = {};
      const directories = ['df', 'dm', 'routesets', 'backups', 'temp', 'configs'];

      for (const dir of directories) {
        const dirPath = path.join(this.baseStoragePath, dir);
        try {
          const files = await fs.readdir(dirPath);
          let totalSize = 0;
          let fileCount = 0;

          for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stat = await fs.stat(filePath);
            if (stat.isFile()) {
              totalSize += stat.size;
              fileCount++;
            }
          }

          stats[dir] = {
            file_count: fileCount,
            total_size: totalSize,
            formatted_size: this.formatBytes(totalSize)
          };
        } catch (error) {
          stats[dir] = { error: error.message };
        }
      }

      return { success: true, stats };
      
    } catch (error) {
      console.error('❌ Error getting storage stats:', error);
      throw new Error(`Failed to get storage stats: ${error.message}`);
    }
  }

  // ========== VALIDATION METHODS ==========

  validateFile(content, filename) {
    // Check file extension
    const ext = path.extname(filename).toLowerCase();
    if (!this.allowedExtensions.includes(ext)) {
      throw new Error(`File extension not allowed: ${ext}`);
    }

    // Check file size
    const size = Buffer.byteLength(content, 'utf8');
    if (size > this.maxFileSize) {
      throw new Error(`File size exceeds limit: ${this.formatBytes(size)} > ${this.formatBytes(this.maxFileSize)}`);
    }

    // Check for malicious content patterns
    if (this.containsMaliciousContent(content)) {
      throw new Error('File contains potentially malicious content');
    }

    return true;
  }

  containsMaliciousContent(content) {
    // Basic security checks
    const maliciousPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi
    ];

    return maliciousPatterns.some(pattern => pattern.test(content));
  }

  getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.csv': 'text/csv',
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.xml': 'application/xml'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  // ========== UTILITY METHODS ==========

  detectLineEndings(content) {
    if (content.includes('\r\n')) return 'CRLF';
    if (content.includes('\n')) return 'LF';
    if (content.includes('\r')) return 'CR';
    return 'LF';
  }

  detectCSVDelimiter(content) {
    const delimiters = [',', ';', '\t', '|'];
    const firstLine = content.split('\n')[0] || '';
    
    let maxCount = 0;
    let detectedDelimiter = ',';
    
    delimiters.forEach(delimiter => {
      const count = (firstLine.match(new RegExp(delimiter, 'g')) || []).length;
      if (count > maxCount) {
        maxCount = count;
        detectedDelimiter = delimiter;
      }
    });
    
    return detectedDelimiter;
  }

  detectQuoteChar(content) {
    const firstLine = content.split('\n')[0] || '';
    if (firstLine.includes('"')) return '"';
    if (firstLine.includes("'")) return "'";
    return '"';
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async cleanupTempFiles(olderThanHours = 24) {
    try {
      const tempDir = path.join(this.baseStoragePath, 'temp');
      const files = await fs.readdir(tempDir);
      const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
      
      let deletedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile() && stats.mtime.getTime() < cutoffTime) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }
      
      console.log(`✅ Cleaned up ${deletedCount} temporary files`);
      return { success: true, deleted_count: deletedCount };
      
    } catch (error) {
      console.error('❌ Error cleaning up temp files:', error);
      throw new Error(`Failed to cleanup temp files: ${error.message}`);
    }
  }
}

export default FileStorageService;
