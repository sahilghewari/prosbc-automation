// File Database for storing and managing ProSBC files locally
export class FileDatabase {
  constructor() {
    this.dbName = 'ProSBCFileDB';
    this.version = 1;
    this.db = null;
    this.isInitialized = false;
  }

  // Initialize IndexedDB
  async initialize() {
    if (this.isInitialized) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log('Database initialized successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log('Upgrading database schema...');

        // Create files store
        if (!db.objectStoreNames.contains('files')) {
          const filesStore = db.createObjectStore('files', { keyPath: 'id', autoIncrement: true });
          
          // Create indexes for efficient querying
          filesStore.createIndex('fileType', 'fileType', { unique: false });
          filesStore.createIndex('fileName', 'fileName', { unique: false });
          filesStore.createIndex('prosbcId', 'prosbcId', { unique: false });
          filesStore.createIndex('lastModified', 'lastModified', { unique: false });
          filesStore.createIndex('status', 'status', { unique: false });
          
          console.log('Files store created with indexes');
        }

        // Create file versions store for tracking changes
        if (!db.objectStoreNames.contains('fileVersions')) {
          const versionsStore = db.createObjectStore('fileVersions', { keyPath: 'id', autoIncrement: true });
          
          versionsStore.createIndex('fileId', 'fileId', { unique: false });
          versionsStore.createIndex('versionNumber', 'versionNumber', { unique: false });
          versionsStore.createIndex('createdAt', 'createdAt', { unique: false });
          
          console.log('File versions store created');
        }

        // Create sync status store
        if (!db.objectStoreNames.contains('syncStatus')) {
          const syncStore = db.createObjectStore('syncStatus', { keyPath: 'fileId' });
          
          syncStore.createIndex('lastSyncTime', 'lastSyncTime', { unique: false });
          syncStore.createIndex('syncStatus', 'syncStatus', { unique: false });
          
          console.log('Sync status store created');
        }
      };
    });
  }

  // Store file in database
  async storeFile(fileData) {
    await this.initialize();
    
    try {
      const now = new Date().toISOString();
      
      // Prepare file record
      const fileRecord = {
        fileName: fileData.fileName,
        fileType: fileData.fileType, // 'routesets_definitions' or 'routesets_digitmaps'
        prosbcId: fileData.prosbcId, // Original ProSBC file ID
        content: fileData.content,
        originalContent: fileData.originalContent || fileData.content,
        parsedData: fileData.parsedData || [],
        status: fileData.status || 'stored', // 'stored', 'modified', 'synced'
        createdAt: now,
        lastModified: now,
        version: 1,
        metadata: {
          size: fileData.content ? fileData.content.length : 0,
          lineCount: fileData.content ? fileData.content.split('\n').length : 0,
          isCSV: fileData.content ? fileData.content.includes(',') : false,
          fetchedFrom: 'prosbc',
          ...fileData.metadata
        }
      };

      // Check if file already exists (by prosbcId and fileType)
      const existingFile = await this.getFileByProSBCId(fileData.prosbcId, fileData.fileType);
      
      if (existingFile) {
        // Update existing file with new transaction
        const updateTransaction = this.db.transaction(['files', 'fileVersions'], 'readwrite');
        const filesStore = updateTransaction.objectStore('files');
        const versionsStore = updateTransaction.objectStore('fileVersions');
        
        fileRecord.id = existingFile.id;
        fileRecord.version = existingFile.version + 1;
        fileRecord.createdAt = existingFile.createdAt;
        
        // Store new version
        const versionRecord = {
          fileId: existingFile.id,
          versionNumber: existingFile.version,
          content: existingFile.content,
          parsedData: existingFile.parsedData,
          createdAt: existingFile.lastModified,
          changes: this.calculateChanges(existingFile.content, fileData.content)
        };
        
        await this.addRecordWithTransaction(versionsStore, versionRecord);
        await this.updateRecordWithTransaction(filesStore, fileRecord);
        
        // Wait for transaction to complete
        await this.waitForTransaction(updateTransaction);
        
        console.log(`Updated existing file: ${fileData.fileName} (version ${fileRecord.version})`);
        return fileRecord;
      } else {
        // Add new file with new transaction
        const addTransaction = this.db.transaction(['files'], 'readwrite');
        const filesStore = addTransaction.objectStore('files');
        
        const result = await this.addRecordWithTransaction(filesStore, fileRecord);
        fileRecord.id = result;
        
        // Wait for transaction to complete
        await this.waitForTransaction(addTransaction);
        
        console.log(`Stored new file: ${fileData.fileName} (ID: ${result})`);
        return fileRecord;
      }
      
    } catch (error) {
      console.error('Error storing file:', error);
      throw error;
    }
  }

  // Get file by ProSBC ID and type
  async getFileByProSBCId(prosbcId, fileType) {
    await this.initialize();
    
    const transaction = this.db.transaction(['files'], 'readonly');
    const store = transaction.objectStore('files');
    const index = store.index('prosbcId');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(prosbcId);
      
      request.onsuccess = () => {
        const files = request.result.filter(file => file.fileType === fileType);
        resolve(files.length > 0 ? files[0] : null);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  // Get all files
  async getAllFiles() {
    await this.initialize();
    
    const transaction = this.db.transaction(['files'], 'readonly');
    const store = transaction.objectStore('files');
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Get files by type
  async getFilesByType(fileType) {
    await this.initialize();
    
    const transaction = this.db.transaction(['files'], 'readonly');
    const store = transaction.objectStore('files');
    const index = store.index('fileType');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(fileType);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Get file versions
  async getFileVersions(fileId) {
    await this.initialize();
    
    const transaction = this.db.transaction(['fileVersions'], 'readonly');
    const store = transaction.objectStore('fileVersions');
    const index = store.index('fileId');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(fileId);
      
      request.onsuccess = () => {
        const versions = request.result.sort((a, b) => b.versionNumber - a.versionNumber);
        resolve(versions);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  // Delete file
  async deleteFile(fileId) {
    await this.initialize();
    
    const transaction = this.db.transaction(['files', 'fileVersions', 'syncStatus'], 'readwrite');
    const filesStore = transaction.objectStore('files');
    const versionsStore = transaction.objectStore('fileVersions');
    const syncStore = transaction.objectStore('syncStatus');

    try {
      // Get file info first
      const file = await this.getRecord(filesStore, fileId);
      if (!file) {
        throw new Error('File not found');
      }

      // Delete file versions
      const versionsIndex = versionsStore.index('fileId');
      const versionsRequest = versionsIndex.getAll(fileId);
      
      versionsRequest.onsuccess = () => {
        const versions = versionsRequest.result;
        versions.forEach(version => {
          versionsStore.delete(version.id);
        });
      };

      // Delete sync status
      syncStore.delete(fileId);
      
      // Delete main file
      await this.deleteRecord(filesStore, fileId);
      
      console.log(`Deleted file: ${file.fileName} and all its versions`);
      return true;
      
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  // Update sync status
  async updateSyncStatus(fileId, status, lastSyncTime = null) {
    await this.initialize();
    
    const transaction = this.db.transaction(['syncStatus'], 'readwrite');
    const store = transaction.objectStore('syncStatus');

    const syncRecord = {
      fileId: fileId,
      syncStatus: status, // 'pending', 'syncing', 'synced', 'error'
      lastSyncTime: lastSyncTime || new Date().toISOString(),
      attempts: 0
    };

    try {
      // Check if record exists
      const existing = await this.getRecord(store, fileId);
      if (existing) {
        syncRecord.attempts = existing.attempts + (status === 'error' ? 1 : 0);
        await this.updateRecord(store, syncRecord);
      } else {
        await this.addRecord(store, syncRecord);
      }
      
      return syncRecord;
    } catch (error) {
      console.error('Error updating sync status:', error);
      throw error;
    }
  }

  // Get sync status
  async getSyncStatus(fileId) {
    await this.initialize();
    
    const transaction = this.db.transaction(['syncStatus'], 'readonly');
    const store = transaction.objectStore('syncStatus');
    
    return this.getRecord(store, fileId);
  }

  // Search files
  async searchFiles(searchTerm, fileType = null) {
    await this.initialize();
    
    let files = fileType ? await this.getFilesByType(fileType) : await this.getAllFiles();
    
    if (!searchTerm) return files;
    
    const term = searchTerm.toLowerCase();
    
    return files.filter(file => 
      file.fileName.toLowerCase().includes(term) ||
      file.content.toLowerCase().includes(term) ||
      (file.parsedData && file.parsedData.some(item => 
        item.original && item.original.toLowerCase().includes(term)
      ))
    );
  }

  // Get database statistics
  async getStats() {
    await this.initialize();
    
    const [allFiles, dfFiles, dmFiles] = await Promise.all([
      this.getAllFiles(),
      this.getFilesByType('routesets_definitions'),
      this.getFilesByType('routesets_digitmaps')
    ]);

    const totalSize = allFiles.reduce((sum, file) => sum + (file.metadata?.size || 0), 0);
    const modifiedFiles = allFiles.filter(file => file.status === 'modified').length;
    
    return {
      totalFiles: allFiles.length,
      dfFiles: dfFiles.length,
      dmFiles: dmFiles.length,
      modifiedFiles: modifiedFiles,
      totalSize: totalSize,
      lastUpdated: Math.max(...allFiles.map(file => new Date(file.lastModified).getTime()))
    };
  }

  // Utility methods
  parseContent(content) {
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

  calculateChanges(oldContent, newContent) {
    if (!oldContent || !newContent) return { linesAdded: 0, linesRemoved: 0, linesModified: 0 };
    
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    return {
      linesAdded: Math.max(0, newLines.length - oldLines.length),
      linesRemoved: Math.max(0, oldLines.length - newLines.length),
      linesModified: Math.min(oldLines.length, newLines.length),
      oldLength: oldContent.length,
      newLength: newContent.length
    };
  }

  // Helper methods for IndexedDB operations
  async addRecord(store, record) {
    return new Promise((resolve, reject) => {
      const request = store.add(record);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async updateRecord(store, record) {
    return new Promise((resolve, reject) => {
      const request = store.put(record);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getRecord(store, key) {
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteRecord(store, key) {
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Helper methods for IndexedDB operations with proper transaction handling
  async addRecordWithTransaction(store, record) {
    return new Promise((resolve, reject) => {
      const request = store.add(record);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async updateRecordWithTransaction(store, record) {
    return new Promise((resolve, reject) => {
      const request = store.put(record);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async waitForTransaction(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(new Error('Transaction aborted'));
    });
  }

  // Clear all data (for testing/reset)
  async clearDatabase() {
    await this.initialize();
    
    const transaction = this.db.transaction(['files', 'fileVersions', 'syncStatus'], 'readwrite');
    
    try {
      await Promise.all([
        this.clearStore(transaction.objectStore('files')),
        this.clearStore(transaction.objectStore('fileVersions')),
        this.clearStore(transaction.objectStore('syncStatus'))
      ]);
      
      console.log('Database cleared successfully');
      return true;
    } catch (error) {
      console.error('Error clearing database:', error);
      throw error;
    }
  }

  async clearStore(store) {
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// Export singleton instance
export const fileDatabase = new FileDatabase();
