// File Export Service - Downloads files from database to local filesystem with DF/DM separation
export class FileExportService {
  constructor() {
    this.defaultDownloadPath = 'ProSBC_Files';
  }

  // Export single file to download
  async exportFileToDownload(file, includeMetadata = false) {
    try {
      let content = file.content;
      let filename = file.fileName;
      let mimeType = 'text/csv';

      // Ensure proper file extension
      if (!filename.endsWith('.csv') && file.metadata?.isCSV) {
        filename += '.csv';
      } else if (!filename.endsWith('.txt') && !file.metadata?.isCSV) {
        filename += '.txt';
      }

      // Add metadata if requested
      if (includeMetadata) {
        const metadata = `# File Metadata
# Original ProSBC ID: ${file.prosbcId}
# File Type: ${file.fileType}
# Status: ${file.status}
# Version: ${file.version}
# Created: ${file.createdAt}
# Last Modified: ${file.lastModified}
# Size: ${file.metadata?.size || 0} bytes
# Lines: ${file.metadata?.lineCount || 0}
# ================================================

`;
        content = metadata + content;
      }

      // Create blob and download
      const blob = new Blob([content], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log(`Exported file: ${filename}`);
      return {
        success: true,
        filename: filename,
        size: blob.size
      };

    } catch (error) {
      console.error('Export file error:', error);
      throw error;
    }
  }

  // Export multiple files as ZIP with proper DF/DM separation
  async exportMultipleFilesAsZip(files, zipName = 'ProSBC_Files.zip') {
    try {
      // Dynamic import of JSZip
      const JSZip = (await import('jszip')).default;
      
      const zip = new JSZip();
      const rootFolder = zip.folder('ProSBC_Files');

      // Create directory structure
      const dfFolder = rootFolder.folder('Definition_Files');
      const dmFolder = rootFolder.folder('Digit_Maps');
      const metadataFolder = rootFolder.folder('Metadata');

      // Separate files by type
      const dfFiles = files.filter(f => f.fileType === 'routesets_definitions');
      const dmFiles = files.filter(f => f.fileType === 'routesets_digitmaps');

      // Process DF files
      dfFiles.forEach((file, index) => {
        let filename = this.sanitizeFileName(file.fileName);
        
        // Ensure proper file extension
        if (!filename.endsWith('.csv') && file.metadata?.isCSV) {
          filename += '.csv';
        } else if (!filename.endsWith('.txt') && !file.metadata?.isCSV) {
          filename += '.txt';
        }

        // Add to DF folder
        dfFolder.file(filename, file.content);
        
        // Add metadata file
        const metadata = this.createFileMetadata(file, 'DF');
        metadataFolder.file(`DF_${filename.replace(/\.[^/.]+$/, '')}_metadata.txt`, metadata);
      });

      // Process DM files
      dmFiles.forEach((file, index) => {
        let filename = this.sanitizeFileName(file.fileName);
        
        // Ensure proper file extension
        if (!filename.endsWith('.csv') && file.metadata?.isCSV) {
          filename += '.csv';
        } else if (!filename.endsWith('.txt') && !file.metadata?.isCSV) {
          filename += '.txt';
        }

        // Add to DM folder
        dmFolder.file(filename, file.content);
        
        // Add metadata file
        const metadata = this.createFileMetadata(file, 'DM');
        metadataFolder.file(`DM_${filename.replace(/\.[^/.]+$/, '')}_metadata.txt`, metadata);
      });

      // Add summary file
      const summary = this.createExportSummary(dfFiles, dmFiles);
      rootFolder.file('EXPORT_SUMMARY.txt', summary);

      // Generate ZIP
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // Download ZIP
      const url = window.URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = zipName;
      
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log(`Exported ${files.length} files as ${zipName}`);
      return {
        success: true,
        filename: zipName,
        fileCount: files.length,
        size: zipBlob.size,
        dfCount: dfFiles.length,
        dmCount: dmFiles.length
      };

    } catch (error) {
      console.error('Export multiple files error:', error);
      throw error;
    }
  }

  // Export files by type (separate ZIP for DF and DM)
  async exportFilesByType(files, separateByType = true) {
    try {
      const dfFiles = files.filter(f => f.fileType === 'routesets_definitions');
      const dmFiles = files.filter(f => f.fileType === 'routesets_digitmaps');

      const results = [];

      if (dfFiles.length > 0) {
        const dfResult = await this.exportMultipleFilesAsZip(dfFiles, 'ProSBC_DF_Files.zip');
        results.push({ type: 'DF', ...dfResult });
      }

      if (dmFiles.length > 0) {
        const dmResult = await this.exportMultipleFilesAsZip(dmFiles, 'ProSBC_DM_Files.zip');
        results.push({ type: 'DM', ...dmResult });
      }

      return {
        success: true,
        message: `Exported ${results.length} separate file packages`,
        results: results
      };

    } catch (error) {
      console.error('Export by type error:', error);
      throw error;
    }
  }

  // Export database backup with full metadata
  async exportDatabaseBackup(files, includeVersionHistory = false) {
    try {
      const JSZip = (await import('jszip')).default;
      
      const zip = new JSZip();
      const backupFolder = zip.folder('ProSBC_Database_Backup');

      // Create backup structure
      const dataFolder = backupFolder.folder('data');
      const metadataFolder = backupFolder.folder('metadata');

      // Export all files with full metadata
      files.forEach(file => {
        const fileData = {
          ...file,
          exportedAt: new Date().toISOString(),
          backupVersion: '1.0'
        };

        // Add file content
        let filename = this.sanitizeFileName(file.fileName);
        if (!filename.endsWith('.csv') && file.metadata?.isCSV) {
          filename += '.csv';
        } else if (!filename.endsWith('.txt') && !file.metadata?.isCSV) {
          filename += '.txt';
        }

        const subfolder = file.fileType === 'routesets_definitions' ? 'definition_files' : 'digit_maps';
        dataFolder.folder(subfolder).file(filename, file.content);

        // Add metadata
        const metadata = JSON.stringify(fileData, null, 2);
        metadataFolder.file(`${file.id}_metadata.json`, metadata);
      });

      // Add backup summary
      const summary = {
        backupCreated: new Date().toISOString(),
        totalFiles: files.length,
        dfFiles: files.filter(f => f.fileType === 'routesets_definitions').length,
        dmFiles: files.filter(f => f.fileType === 'routesets_digitmaps').length,
        backupVersion: '1.0',
        source: 'ProSBC File Management System'
      };

      backupFolder.file('backup_summary.json', JSON.stringify(summary, null, 2));

      // Generate and download backup
      const backupBlob = await zip.generateAsync({ type: 'blob' });
      
      const url = window.URL.createObjectURL(backupBlob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `ProSBC_Database_Backup_${new Date().toISOString().split('T')[0]}.zip`;
      
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      return {
        success: true,
        message: 'Database backup created successfully',
        fileCount: files.length,
        size: backupBlob.size
      };

    } catch (error) {
      console.error('Database backup error:', error);
      throw error;
    }
  }

  // Helper functions
  sanitizeFileName(filename) {
    // Remove invalid characters for filenames
    return filename.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
  }

  createFileMetadata(file, type) {
    const typeLabel = type === 'DF' ? 'Definition File' : 'Digit Map';
    
    return `${typeLabel} Metadata
=====================================
File Name: ${file.fileName}
ProSBC ID: ${file.prosbcId}
File Type: ${file.fileType}
Status: ${file.status}
Version: ${file.version}
Created: ${file.createdAt}
Last Modified: ${file.lastModified}
Size: ${file.metadata?.size || 0} bytes
Lines: ${file.metadata?.lineCount || 0}
Is CSV: ${file.metadata?.isCSV ? 'Yes' : 'No'}
Fetched At: ${file.metadata?.fetchedAt || 'Unknown'}

${type === 'DF' ? 'Definition File Specifics:' : 'Digit Map Specifics:'}
${type === 'DF' && file.dfSpecific ? `
- Routeset Count: ${file.dfSpecific.routesetCount || 'N/A'}
- Priority Levels: ${file.dfSpecific.priorityLevels || 'N/A'}
- Complexity: ${file.dfSpecific.complexity || 'N/A'}
` : ''}
${type === 'DM' && file.dmSpecific ? `
- Number Patterns: ${file.dmSpecific.numberPatterns?.length || 'N/A'}
- Routeset Mappings: ${Object.keys(file.dmSpecific.routesetMappings || {}).length || 'N/A'}
- Complexity: ${file.dmSpecific.complexity || 'N/A'}
` : ''}

Export Information:
- Exported: ${new Date().toISOString()}
- Export Type: ${type}
- Export Source: ProSBC File Management System
`;
  }

  createExportSummary(dfFiles, dmFiles) {
    const totalFiles = dfFiles.length + dmFiles.length;
    const totalSize = [...dfFiles, ...dmFiles].reduce((sum, file) => sum + (file.metadata?.size || 0), 0);
    
    return `ProSBC File Export Summary
==========================
Export Date: ${new Date().toISOString()}
Total Files: ${totalFiles}
Definition Files (DF): ${dfFiles.length}
Digit Map Files (DM): ${dmFiles.length}
Total Size: ${this.formatBytes(totalSize)}

Directory Structure:
- ProSBC_Files/
  - Definition_Files/ (${dfFiles.length} files)
  - Digit_Maps/ (${dmFiles.length} files)
  - Metadata/ (${totalFiles} metadata files)
  - EXPORT_SUMMARY.txt (this file)

Definition Files:
${dfFiles.map(f => `- ${f.fileName}`).join('\n')}

Digit Map Files:
${dmFiles.map(f => `- ${f.fileName}`).join('\n')}

Export completed successfully!
Source: ProSBC File Management System
`;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Create and export singleton instance
export const fileExportService = new FileExportService();
