/**
 * Database Integration Example
 * Shows how to integrate the new database system with your existing CSV Editor
 */

import { 
  initializeDatabase, 
  quickAccess, 
  DatabaseService,
  FileStorageService,
  AuditService 
} from './index.js';

class CSVEditorDatabaseIntegration {
  constructor() {
    this.dbService = new DatabaseService();
    this.fileStorage = new FileStorageService();
    this.auditService = new AuditService();
  }

  async initialize() {
    try {
      // Initialize database connection
      await initializeDatabase();
      console.log('✅ Database integration initialized');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  // Enhanced file save with database integration
  async saveFileWithDatabase(csvContent, fileInfo, userId) {
    try {
      // 1. Save file to storage
      const storageResult = await this.fileStorage.saveFile(
        csvContent,
        fileInfo.type || 'DF',
        fileInfo.original_filename,
        {
          editor: userId,
          source: 'csv_editor',
          edited_at: new Date()
        }
      );

      // 2. Save file metadata to database
      const fileData = {
        file_id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        type: fileInfo.type || 'DF',
        nap_associated: fileInfo.nap_id,
        original_filename: fileInfo.original_filename,
        file_path: storageResult.fileInfo.file_path,
        file_size: storageResult.fileInfo.file_size,
        checksum: storageResult.fileInfo.checksum,
        tags: fileInfo.tags || ['csv_editor'],
        metadata: {
          ...storageResult.fileInfo.metadata,
          csv_rows: this.countCSVRows(csvContent),
          csv_columns: this.countCSVColumns(csvContent)
        }
      };

      const dbResult = await this.dbService.saveFile(fileData, userId);

      // 3. Log the edit action
      await this.auditService.logFileEdit(
        dbResult.file.file_id,
        userId,
        'create',
        {
          changes_summary: 'File created via CSV Editor',
          csv_backup: csvContent,
          json_table_format: this.csvToTableFormat(csvContent),
          file_state_after: {
            file_size: storageResult.fileInfo.file_size,
            checksum: storageResult.fileInfo.checksum,
            last_modified: new Date()
          }
        }
      );

      return {
        success: true,
        file: dbResult.file,
        storage_path: storageResult.fileInfo.file_path,
        validation: dbResult.validation
      };

    } catch (error) {
      console.error('❌ Error saving file with database:', error);
      throw error;
    }
  }

  // Enhanced file update with full audit trail
  async updateFileWithDatabase(fileId, csvContent, changes, userId) {
    try {
      // 1. Get existing file
      const existingFile = await this.dbService.getFile(fileId);
      if (!existingFile.success) {
        throw new Error('File not found');
      }

      // 2. Create backup
      const backupPath = await this.fileStorage.createBackup(
        existingFile.file.file_path,
        'csv_editor_update'
      );

      // 3. Update file content
      const updateResult = await this.fileStorage.updateFile(
        existingFile.file.file_path,
        csvContent,
        true
      );

      // 4. Update database record
      const updateData = {
        file_size: updateResult.fileInfo.file_size,
        checksum: updateResult.fileInfo.checksum,
        metadata: {
          ...existingFile.file.metadata,
          csv_rows: this.countCSVRows(csvContent),
          csv_columns: this.countCSVColumns(csvContent),
          last_edited_by: userId,
          last_edited_at: new Date()
        }
      };

      const dbResult = await this.dbService.updateFile(fileId, updateData, userId);

      // 5. Log detailed edit history
      await this.auditService.logFileEdit(
        fileId,
        userId,
        'update',
        {
          changes_summary: this.generateChangesSummary(changes),
          detailed_changes: this.analyzeChanges(changes),
          csv_backup: csvContent,
          json_table_format: this.csvToTableFormat(csvContent),
          file_state_before: {
            file_size: existingFile.file.file_size,
            checksum: existingFile.file.checksum
          },
          file_state_after: {
            file_size: updateResult.fileInfo.file_size,
            checksum: updateResult.fileInfo.checksum,
            last_modified: new Date()
          }
        }
      );

      return {
        success: true,
        file: dbResult.file,
        backup_path: backupPath,
        changes_logged: true
      };

    } catch (error) {
      console.error('❌ Error updating file with database:', error);
      throw error;
    }
  }

  // Get file history for rollback functionality
  async getFileHistory(fileId, options = {}) {
    try {
      const history = await this.auditService.getFileHistory(fileId, options);
      
      // Format history for CSV Editor UI
      const formattedHistory = history.history.map(entry => ({
        id: entry.history_id,
        timestamp: entry.edit_timestamp,
        editor: entry.editor,
        action: entry.edit_type,
        summary: entry.changes_summary,
        changes: {
          rows_changed: entry.detailed_changes.rows_added + 
                       entry.detailed_changes.rows_modified + 
                       entry.detailed_changes.rows_deleted,
          columns_changed: entry.detailed_changes.columns_added.length + 
                          entry.detailed_changes.columns_removed.length
        },
        can_rollback: entry.rollback_info.can_rollback,
        magnitude: this.getChangeMagnitude(entry.detailed_changes)
      }));

      return {
        success: true,
        history: formattedHistory,
        pagination: history.pagination
      };

    } catch (error) {
      console.error('❌ Error getting file history:', error);
      throw error;
    }
  }

  // Rollback to previous version
  async rollbackFile(fileId, historyId, userId, reason) {
    try {
      // 1. Execute rollback
      const rollbackResult = await this.auditService.executeRollback(
        historyId,
        userId,
        reason
      );

      // 2. Update file content
      await this.fileStorage.updateFile(
        rollbackResult.rollback_data.file_path,
        rollbackResult.rollback_data.csv_content,
        true
      );

      // 3. Update database record
      const file = await this.dbService.getFile(fileId);
      await this.dbService.updateFile(fileId, {
        version: file.file.version + 1,
        metadata: {
          ...file.file.metadata,
          rollback_performed: true,
          rollback_timestamp: new Date(),
          rollback_by: userId,
          rollback_reason: reason
        }
      }, userId);

      return {
        success: true,
        csv_content: rollbackResult.rollback_data.csv_content,
        table_structure: rollbackResult.rollback_data.json_structure
      };

    } catch (error) {
      console.error('❌ Error rolling back file:', error);
      throw error;
    }
  }

  // Search files with advanced filters
  async searchFiles(query, filters = {}) {
    try {
      const searchResults = await this.dbService.search(query, {
        type: 'file',
        ...filters
      });

      // Format results for CSV Editor UI
      const formattedFiles = searchResults.results.files?.map(file => ({
        id: file.file_id,
        name: file.original_filename,
        type: file.type,
        size: file.formatted_size,
        uploaded_by: file.uploaded_by,
        created_at: file.created_at,
        modified_at: file.updated_at,
        status: file.status,
        validation_status: file.validation_results?.is_valid ? 'valid' : 'invalid',
        tags: file.tags,
        nap_associated: file.nap_associated
      })) || [];

      return {
        success: true,
        files: formattedFiles,
        total: formattedFiles.length
      };

    } catch (error) {
      console.error('❌ Error searching files:', error);
      throw error;
    }
  }

  // Get analytics for dashboard
  async getAnalytics(period = '7d') {
    try {
      const analytics = await this.dbService.getAnalytics(period);
      
      return {
        success: true,
        analytics: {
          ...analytics.analytics,
          csv_editor_specific: {
            files_edited: analytics.analytics.activity.filter(a => 
              a._id.action === 'update_file'
            ).reduce((sum, a) => sum + a.count, 0),
            
            rollbacks_performed: analytics.analytics.activity.filter(a => 
              a._id.action === 'rollback_file'
            ).reduce((sum, a) => sum + a.count, 0),
            
            validation_errors: analytics.analytics.files.reduce((sum, f) => 
              sum + (f.validation_errors || 0), 0
            )
          }
        }
      };

    } catch (error) {
      console.error('❌ Error getting analytics:', error);
      throw error;
    }
  }

  // Utility methods
  countCSVRows(csvContent) {
    return csvContent.split('\n').length - 1; // Exclude header
  }

  countCSVColumns(csvContent) {
    const firstLine = csvContent.split('\n')[0];
    return (firstLine.match(/,/g) || []).length + 1;
  }

  csvToTableFormat(csvContent) {
    const lines = csvContent.split('\n');
    const headers = this.parseCSVLine(lines[0]);
    const rows = lines.slice(1).map(line => this.parseCSVLine(line));
    
    return {
      headers,
      rows,
      metadata: {
        total_rows: rows.length,
        total_columns: headers.length,
        encoding: 'utf8',
        delimiter: ','
      }
    };
  }

  parseCSVLine(line) {
    // Simple CSV parsing - you can enhance this
    const result = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"' && !inQuotes) {
        inQuotes = true;
      } else if (char === '"' && inQuotes) {
        inQuotes = false;
      } else if (char === ',' && !inQuotes) {
        result.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
    
    result.push(currentField.trim());
    return result;
  }

  generateChangesSummary(changes) {
    const summaryParts = [];
    
    if (changes.rows_added > 0) summaryParts.push(`${changes.rows_added} rows added`);
    if (changes.rows_modified > 0) summaryParts.push(`${changes.rows_modified} rows modified`);
    if (changes.rows_deleted > 0) summaryParts.push(`${changes.rows_deleted} rows deleted`);
    if (changes.columns_added > 0) summaryParts.push(`${changes.columns_added} columns added`);
    if (changes.columns_removed > 0) summaryParts.push(`${changes.columns_removed} columns removed`);
    
    return summaryParts.length > 0 ? summaryParts.join(', ') : 'Minor changes';
  }

  analyzeChanges(changes) {
    return {
      rows_added: changes.rows_added || 0,
      rows_modified: changes.rows_modified || 0,
      rows_deleted: changes.rows_deleted || 0,
      columns_added: changes.columns_added || [],
      columns_removed: changes.columns_removed || [],
      columns_renamed: changes.columns_renamed || [],
      cell_changes: changes.cell_changes || []
    };
  }

  getChangeMagnitude(changes) {
    const total = changes.rows_added + changes.rows_modified + changes.rows_deleted;
    
    if (total === 0) return 'minimal';
    if (total < 10) return 'small';
    if (total < 100) return 'medium';
    return 'large';
  }
}

export default CSVEditorDatabaseIntegration;
