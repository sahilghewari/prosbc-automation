/**
 * File System Database for Ubuntu Deployment
 * Stores all data in /root/prosbc-dashboard/files/ directory structure
 */

import fs from 'fs';
import path from 'path';

// Base directory structure for Ubuntu deployment
const BASE_DIR = '/root/prosbc-dashboard/files';
const DIRECTORIES = {
  df: path.join(BASE_DIR, 'df'),
  dm: path.join(BASE_DIR, 'dm'),
  routesets: path.join(BASE_DIR, 'routesets'),
  backups: path.join(BASE_DIR, 'backups'),
  naps: path.join(BASE_DIR, 'naps'),
  logs: path.join(BASE_DIR, 'logs'),
  metadata: path.join(BASE_DIR, 'metadata')
};

class FileSystemDatabase {
  constructor() {
    this.baseDir = BASE_DIR;
    this.dirs = DIRECTORIES;
    this.initialized = false;
  }

  // Initialize directory structure
  async initialize() {
    try {
      console.log('🔄 Initializing file system database...');
      
      // Create base directory
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
        console.log(`✅ Created base directory: ${this.baseDir}`);
      }

      // Create all subdirectories
      for (const [name, dir] of Object.entries(this.dirs)) {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          console.log(`✅ Created directory: ${dir}`);
        }
      }

      this.initialized = true;
      console.log('✅ File system database initialized successfully');
      
      return { success: true, message: 'File system database initialized' };
    } catch (error) {
      console.error('❌ Failed to initialize file system database:', error);
      throw error;
    }
  }

  // Helper method to ensure directory exists
  _ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  // Generate unique ID
  _generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Save file to appropriate directory
  async saveFile(fileData, fileContent = null) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const fileType = fileData.type.toLowerCase();
      const targetDir = this.dirs[fileType] || this.dirs.backups;
      
      // Create metadata
      const metadata = {
        id: this._generateId('file'),
        name: fileData.name,
        type: fileData.type,
        size: fileData.size,
        original_filename: fileData.originalFile || fileData.name,
        uploaded_by: fileData.uploadedBy || 'user',
        created_at: new Date().toISOString(),
        file_path: path.join(targetDir, fileData.name),
        tags: fileData.tags || [],
        validation: fileData.validation || { isValid: true },
        prosbc_result: fileData.prosbc_result || null
      };

      // Save file content if provided
      if (fileContent) {
        const filePath = path.join(targetDir, fileData.name);
        fs.writeFileSync(filePath, fileContent);
        console.log(`✅ File saved: ${filePath}`);
      }

      // Save metadata
      const metadataFile = path.join(this.dirs.metadata, `file_${metadata.id}.json`);
      fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));

      // Update file index
      await this._updateFileIndex(metadata);

      console.log(`✅ File metadata saved: ${metadataFile}`);
      
      return {
        success: true,
        file: metadata,
        message: `File ${fileData.name} saved successfully`
      };
    } catch (error) {
      console.error('❌ Error saving file:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Save NAP data
  async saveNap(napData) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const napMetadata = {
        nap_id: napData.napId || this._generateId('nap'),
        name: napData.napName || napData.name,
        status: napData.enabled ? 'active' : 'inactive',
        enabled: napData.enabled,
        proxy_address: napData.proxyAddress,
        proxy_port: napData.proxyPort,
        use_proxy: napData.useProxy,
        register_to_proxy: napData.registerToProxy,
        default_profile: napData.defaultProfile,
        config: napData.config,
        created_by: napData.createdBy || 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tags: napData.tags || [],
        prosbc_result: napData.prosbc_result || null
      };

      // Save NAP configuration as JSON
      const napFile = path.join(this.dirs.naps, `${napMetadata.nap_id}.json`);
      fs.writeFileSync(napFile, JSON.stringify(napMetadata, null, 2));

      // Save metadata
      const metadataFile = path.join(this.dirs.metadata, `nap_${napMetadata.nap_id}.json`);
      fs.writeFileSync(metadataFile, JSON.stringify(napMetadata, null, 2));

      // Update NAP index
      await this._updateNapIndex(napMetadata);

      console.log(`✅ NAP saved: ${napFile}`);
      
      return {
        success: true,
        nap: napMetadata,
        message: `NAP ${napMetadata.name} saved successfully`
      };
    } catch (error) {
      console.error('❌ Error saving NAP:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Save activity log
  async saveLog(logData) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const log = {
        id: this._generateId('log'),
        action: logData.action,
        resource_type: logData.resource_type,
        resource_id: logData.resource_id,
        status: logData.status,
        details: logData.details,
        execution_context: logData.execution_context || {
          executed_by: 'user',
          timestamp: new Date().toISOString()
        },
        timing_info: {
          start_time: new Date().toISOString(),
          end_time: new Date().toISOString()
        },
        created_at: new Date().toISOString()
      };

      // Save log to daily file
      const today = new Date().toISOString().split('T')[0];
      const logFile = path.join(this.dirs.logs, `${today}.json`);
      
      let logs = [];
      if (fs.existsSync(logFile)) {
        const existingLogs = fs.readFileSync(logFile, 'utf8');
        logs = JSON.parse(existingLogs);
      }
      
      logs.push(log);
      fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));

      console.log(`✅ Log saved: ${logFile}`);
      
      return {
        success: true,
        log: log
      };
    } catch (error) {
      console.error('❌ Error saving log:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get all files
  async getFiles(type = null) {
    try {
      const indexFile = path.join(this.dirs.metadata, 'file_index.json');
      if (!fs.existsSync(indexFile)) {
        return { success: true, files: [] };
      }

      const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
      let files = index.files || [];

      if (type) {
        files = files.filter(file => file.type.toLowerCase() === type.toLowerCase());
      }

      return {
        success: true,
        files: files,
        total: files.length
      };
    } catch (error) {
      console.error('❌ Error getting files:', error);
      return {
        success: false,
        error: error.message,
        files: []
      };
    }
  }

  // Get all NAPs
  async getNaps() {
    try {
      const indexFile = path.join(this.dirs.metadata, 'nap_index.json');
      if (!fs.existsSync(indexFile)) {
        return { success: true, naps: [] };
      }

      const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
      
      return {
        success: true,
        naps: index.naps || [],
        total: (index.naps || []).length
      };
    } catch (error) {
      console.error('❌ Error getting NAPs:', error);
      return {
        success: false,
        error: error.message,
        naps: []
      };
    }
  }

  // Get logs
  async getLogs(days = 7) {
    try {
      const logs = [];
      const today = new Date();
      
      for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const logFile = path.join(this.dirs.logs, `${dateStr}.json`);
        if (fs.existsSync(logFile)) {
          const dayLogs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
          logs.push(...dayLogs);
        }
      }

      return {
        success: true,
        logs: logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
        total: logs.length
      };
    } catch (error) {
      console.error('❌ Error getting logs:', error);
      return {
        success: false,
        error: error.message,
        logs: []
      };
    }
  }

  // Get analytics
  async getAnalytics() {
    try {
      const [filesResult, napsResult, logsResult] = await Promise.all([
        this.getFiles(),
        this.getNaps(),
        this.getLogs(7)
      ]);

      const files = filesResult.files || [];
      const naps = napsResult.naps || [];
      const logs = logsResult.logs || [];

      const analytics = {
        totalNaps: naps.length,
        totalFiles: files.length,
        totalActivations: logs.length,
        totalFileSize: files.reduce((sum, f) => sum + (f.size || 0), 0),
        recentActivity: logs.slice(0, 5),
        files: files,
        naps: naps,
        activations: logs,
        generatedAt: new Date().toISOString()
      };

      return {
        success: true,
        analytics: analytics
      };
    } catch (error) {
      console.error('❌ Error getting analytics:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Update file index
  async _updateFileIndex(fileMetadata) {
    const indexFile = path.join(this.dirs.metadata, 'file_index.json');
    let index = { files: [], lastUpdated: new Date().toISOString() };
    
    if (fs.existsSync(indexFile)) {
      index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    }
    
    index.files.push(fileMetadata);
    index.lastUpdated = new Date().toISOString();
    
    fs.writeFileSync(indexFile, JSON.stringify(index, null, 2));
  }

  // Update NAP index
  async _updateNapIndex(napMetadata) {
    const indexFile = path.join(this.dirs.metadata, 'nap_index.json');
    let index = { naps: [], lastUpdated: new Date().toISOString() };
    
    if (fs.existsSync(indexFile)) {
      index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    }
    
    index.naps.push(napMetadata);
    index.lastUpdated = new Date().toISOString();
    
    fs.writeFileSync(indexFile, JSON.stringify(index, null, 2));
  }

  // Check system health
  async getHealth() {
    try {
      const health = {
        status: 'healthy',
        storage_type: 'file_system',
        base_directory: this.baseDir,
        initialized: this.initialized,
        directories: {},
        total_size: 0,
        lastChecked: new Date().toISOString()
      };

      // Check each directory
      for (const [name, dir] of Object.entries(this.dirs)) {
        try {
          const stats = fs.statSync(dir);
          health.directories[name] = {
            exists: true,
            path: dir,
            accessible: true
          };
        } catch (error) {
          health.directories[name] = {
            exists: false,
            path: dir,
            accessible: false,
            error: error.message
          };
          health.status = 'warning';
        }
      }

      return health;
    } catch (error) {
      return {
        status: 'error',
        storage_type: 'file_system',
        error: error.message,
        lastChecked: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
export default new FileSystemDatabase();
