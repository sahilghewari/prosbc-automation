// Enhanced File Storage Service with separate handling for DF and DM files
import { fileDatabase } from './fileDatabase.js';
import { prosbcFileAPI } from './prosbcFileApi.js';

export class EnhancedFileStorageService {
  constructor() {
    this.syncQueue = [];
    this.isSyncing = false;
    this.storageStructure = {
      df: {
        directory: 'definition_files',
        prefix: 'DF_',
        extension: '.csv',
        type: 'routesets_definitions'
      },
      dm: {
        directory: 'digit_maps',
        prefix: 'DM_',
        extension: '.csv',
        type: 'routesets_digitmaps'
      }
    };
  }

  // Create directory structure for organized file storage
  createDirectoryStructure() {
    const structure = {
      root: 'prosbc_files',
      directories: {
        definition_files: {
          path: 'prosbc_files/definition_files',
          description: 'ProSBC Definition Files (DF)',
          subdirectories: {
            active: 'prosbc_files/definition_files/active',
            archived: 'prosbc_files/definition_files/archived',
            modified: 'prosbc_files/definition_files/modified',
            backup: 'prosbc_files/definition_files/backup'
          }
        },
        digit_maps: {
          path: 'prosbc_files/digit_maps',
          description: 'ProSBC Digit Map Files (DM)',
          subdirectories: {
            active: 'prosbc_files/digit_maps/active',
            archived: 'prosbc_files/digit_maps/archived',
            modified: 'prosbc_files/digit_maps/modified',
            backup: 'prosbc_files/digit_maps/backup'
          }
        },
        exports: {
          path: 'prosbc_files/exports',
          description: 'Exported file packages',
          subdirectories: {
            daily: 'prosbc_files/exports/daily',
            manual: 'prosbc_files/exports/manual',
            backups: 'prosbc_files/exports/backups'
          }
        },
        logs: {
          path: 'prosbc_files/logs',
          description: 'Operation logs and history'
        }
      }
    };
    
    return structure;
  }

  // Fetch and store files with enhanced separation
  async fetchAndStoreFilesSeparately(onProgress = null) {
    try {
      onProgress?.(5, 'Initializing file storage structure...');
      
      const structure = this.createDirectoryStructure();
      
      onProgress?.(10, 'Fetching file lists from ProSBC...');
      
      // Get file lists from ProSBC
      const [dfResult, dmResult] = await Promise.all([
        prosbcFileAPI.listDfFiles(),
        prosbcFileAPI.listDmFiles()
      ]);

      if (!dfResult.success || !dmResult.success) {
        throw new Error('Failed to fetch file lists from ProSBC');
      }

      onProgress?.(20, 'Processing DF files...');
      
      // Process DF files separately
      const dfResults = await this.processDfFiles(dfResult.files, onProgress);
      
      onProgress?.(60, 'Processing DM files...');
      
      // Process DM files separately
      const dmResults = await this.processDmFiles(dmResult.files, onProgress);

      onProgress?.(90, 'Finalizing storage...');

      // Create summary
      const summary = {
        structure: structure,
        df: dfResults,
        dm: dmResults,
        timestamp: new Date().toISOString(),
        stats: {
          totalFiles: dfResults.stored.length + dmResults.stored.length,
          dfFiles: dfResults.stored.length,
          dmFiles: dmResults.stored.length,
          errors: dfResults.errors.length + dmResults.errors.length
        }
      };

      onProgress?.(100, 'File storage completed!');

      return {
        success: true,
        summary: summary,
        message: `Successfully stored ${summary.stats.totalFiles} files (${summary.stats.dfFiles} DF, ${summary.stats.dmFiles} DM)`
      };

    } catch (error) {
      console.error('Enhanced fetch and store error:', error);
      throw error;
    }
  }

  // Process Definition Files (DF) with specific handling
  async processDfFiles(dfFiles, onProgress) {
    const results = {
      stored: [],
      errors: [],
      metadata: {
        type: 'definition_files',
        totalCount: dfFiles.length,
        processedAt: new Date().toISOString()
      }
    };

    console.log(`Processing ${dfFiles.length} DF files...`);

    for (let i = 0; i < dfFiles.length; i++) {
      const file = dfFiles[i];
      const progressPercent = 20 + (i / dfFiles.length) * 40;
      
      try {
        onProgress?.(progressPercent, `Processing DF file: ${file.name}`);

        // Get file content
        const contentResult = await prosbcFileAPI.getFileContent('routesets_definitions', file.id);
        
        if (!contentResult.success) {
          results.errors.push(`Failed to fetch content for DF file: ${file.name}`);
          continue;
        }

        // Enhanced DF file processing
        const enhancedFileData = this.enhanceDfFileData(file, contentResult);
        
        // Store in database with DF-specific categorization
        const storedFile = await this.storeDfFile(enhancedFileData);
        
        results.stored.push({
          originalFile: file,
          storedFile: storedFile,
          category: this.categorizeDfFile(enhancedFileData),
          storageLocation: this.getDfStorageLocation(enhancedFileData)
        });

        console.log(`✅ Stored DF file: ${file.name}`);

      } catch (error) {
        console.error(`❌ Error processing DF file ${file.name}:`, error);
        results.errors.push(`Error processing DF file ${file.name}: ${error.message}`);
      }
    }

    return results;
  }

  // Process Digit Map Files (DM) with specific handling
  async processDmFiles(dmFiles, onProgress) {
    const results = {
      stored: [],
      errors: [],
      metadata: {
        type: 'digit_maps',
        totalCount: dmFiles.length,
        processedAt: new Date().toISOString()
      }
    };

    console.log(`Processing ${dmFiles.length} DM files...`);

    for (let i = 0; i < dmFiles.length; i++) {
      const file = dmFiles[i];
      const progressPercent = 60 + (i / dmFiles.length) * 30;
      
      try {
        onProgress?.(progressPercent, `Processing DM file: ${file.name}`);

        // Get file content
        const contentResult = await prosbcFileAPI.getFileContent('routesets_digitmaps', file.id);
        
        if (!contentResult.success) {
          results.errors.push(`Failed to fetch content for DM file: ${file.name}`);
          continue;
        }

        // Enhanced DM file processing
        const enhancedFileData = this.enhanceDmFileData(file, contentResult);
        
        // Store in database with DM-specific categorization
        const storedFile = await this.storeDmFile(enhancedFileData);
        
        results.stored.push({
          originalFile: file,
          storedFile: storedFile,
          category: this.categorizeDmFile(enhancedFileData),
          storageLocation: this.getDmStorageLocation(enhancedFileData)
        });

        console.log(`✅ Stored DM file: ${file.name}`);

      } catch (error) {
        console.error(`❌ Error processing DM file ${file.name}:`, error);
        results.errors.push(`Error processing DM file ${file.name}: ${error.message}`);
      }
    }

    return results;
  }

  // Enhance DF file data with additional metadata
  enhanceDfFileData(file, contentResult) {
    const parsedContent = this.parseDfContent(contentResult.content);
    
    return {
      fileName: file.name,
      fileType: 'routesets_definitions',
      prosbcId: file.id,
      content: contentResult.content,
      parsedData: parsedContent.entries,
      status: 'stored',
      category: 'definition_file',
      dfSpecific: {
        routesetCount: parsedContent.routesetCount,
        priorityLevels: parsedContent.priorityLevels,
        weightDistribution: parsedContent.weightDistribution,
        remappingRules: parsedContent.remappingRules,
        complexity: this.calculateDfComplexity(parsedContent)
      },
      metadata: {
        ...file.metadata,
        size: contentResult.content ? contentResult.content.length : 0,
        lineCount: contentResult.content ? contentResult.content.split('\n').length : 0,
        isCSV: contentResult.isCsvFile || false,
        fetchedAt: new Date().toISOString(),
        storageType: 'definition_file',
        prosbcUpdateUrl: file.updateUrl,
        prosbcExportUrl: file.exportUrl,
        prosbcDeleteUrl: file.deleteUrl
      }
    };
  }

  // Enhance DM file data with additional metadata
  enhanceDmFileData(file, contentResult) {
    const parsedContent = this.parseDmContent(contentResult.content);
    
    return {
      fileName: file.name,
      fileType: 'routesets_digitmaps',
      prosbcId: file.id,
      content: contentResult.content,
      parsedData: parsedContent.entries,
      status: 'stored',
      category: 'digit_map',
      dmSpecific: {
        numberPatterns: parsedContent.numberPatterns,
        routesetMappings: parsedContent.routesetMappings,
        calledNumbers: parsedContent.calledNumbers,
        callingNumbers: parsedContent.callingNumbers,
        complexity: this.calculateDmComplexity(parsedContent)
      },
      metadata: {
        ...file.metadata,
        size: contentResult.content ? contentResult.content.length : 0,
        lineCount: contentResult.content ? contentResult.content.split('\n').length : 0,
        isCSV: contentResult.isCsvFile || false,
        fetchedAt: new Date().toISOString(),
        storageType: 'digit_map',
        prosbcUpdateUrl: file.updateUrl,
        prosbcExportUrl: file.exportUrl,
        prosbcDeleteUrl: file.deleteUrl
      }
    };
  }

  // Parse DF content with specific analysis
  parseDfContent(content) {
    if (!content || content.trim() === '') {
      return { entries: [], routesetCount: 0, priorityLevels: [], weightDistribution: {}, remappingRules: [] };
    }

    const lines = content.split('\n').filter(line => line.trim());
    const entries = [];
    const routesets = new Set();
    const priorities = new Set();
    const weights = {};
    const remappingRules = [];

    lines.forEach((line, index) => {
      if (index === 0 && line.toLowerCase().includes('routeset')) {
        return; // Skip header
      }

      const fields = line.split(',').map(field => field.trim().replace(/^"|"$/g, ''));
      
      if (fields.length >= 3) {
        const entry = {
          id: index,
          original: line,
          data: fields,
          routeset_name: fields[0] || '',
          priority: fields[1] || '',
          weight: fields[2] || '',
          remapped_called: fields[3] || '',
          remapped_calling: fields[4] || ''
        };

        entries.push(entry);
        
        if (entry.routeset_name) routesets.add(entry.routeset_name);
        if (entry.priority) priorities.add(entry.priority);
        if (entry.weight) {
          weights[entry.weight] = (weights[entry.weight] || 0) + 1;
        }
        if (entry.remapped_called) remappingRules.push(entry.remapped_called);
      }
    });

    return {
      entries,
      routesetCount: routesets.size,
      priorityLevels: Array.from(priorities).sort((a, b) => parseInt(a) - parseInt(b)),
      weightDistribution: weights,
      remappingRules: Array.from(new Set(remappingRules))
    };
  }

  // Parse DM content with specific analysis
  parseDmContent(content) {
    if (!content || content.trim() === '') {
      return { entries: [], numberPatterns: [], routesetMappings: {}, calledNumbers: [], callingNumbers: [] };
    }

    const lines = content.split('\n').filter(line => line.trim());
    const entries = [];
    const numberPatterns = new Set();
    const routesetMappings = {};
    const calledNumbers = new Set();
    const callingNumbers = new Set();

    lines.forEach((line, index) => {
      if (index === 0 && line.toLowerCase().includes('called')) {
        return; // Skip header
      }

      const fields = line.split(',').map(field => field.trim().replace(/^"|"$/g, ''));
      
      if (fields.length >= 2) {
        const entry = {
          id: index,
          original: line,
          data: fields,
          called: fields[0] || '',
          calling: fields[1] || '',
          routeset_name: fields[2] || ''
        };

        entries.push(entry);
        
        if (entry.called) {
          calledNumbers.add(entry.called);
          numberPatterns.add(this.extractNumberPattern(entry.called));
        }
        if (entry.calling) {
          callingNumbers.add(entry.calling);
        }
        if (entry.routeset_name) {
          if (!routesetMappings[entry.routeset_name]) {
            routesetMappings[entry.routeset_name] = [];
          }
          routesetMappings[entry.routeset_name].push(entry);
        }
      }
    });

    return {
      entries,
      numberPatterns: Array.from(numberPatterns),
      routesetMappings,
      calledNumbers: Array.from(calledNumbers),
      callingNumbers: Array.from(callingNumbers)
    };
  }

  // Extract number pattern from a phone number
  extractNumberPattern(number) {
    if (!number) return '';
    
    // Remove common prefixes and extract pattern
    const cleaned = number.replace(/^1?/, ''); // Remove leading 1
    const areaCode = cleaned.substring(0, 3);
    const exchange = cleaned.substring(3, 6);
    
    return `${areaCode}XXX-XXXX`;
  }

  // Calculate DF complexity score
  calculateDfComplexity(parsedContent) {
    let complexity = 0;
    
    // More routesets = higher complexity
    complexity += parsedContent.routesetCount * 10;
    
    // More priority levels = higher complexity
    complexity += parsedContent.priorityLevels.length * 5;
    
    // More unique remapping rules = higher complexity
    complexity += parsedContent.remappingRules.length * 15;
    
    // Weight distribution variety
    complexity += Object.keys(parsedContent.weightDistribution).length * 3;
    
    return Math.min(complexity, 100); // Cap at 100
  }

  // Calculate DM complexity score
  calculateDmComplexity(parsedContent) {
    let complexity = 0;
    
    // More number patterns = higher complexity
    complexity += parsedContent.numberPatterns.length * 8;
    
    // More routeset mappings = higher complexity
    complexity += Object.keys(parsedContent.routesetMappings).length * 12;
    
    // More unique called numbers = higher complexity
    complexity += parsedContent.calledNumbers.length * 5;
    
    // More unique calling numbers = higher complexity
    complexity += parsedContent.callingNumbers.length * 3;
    
    return Math.min(complexity, 100); // Cap at 100
  }

  // Store DF file with specific handling
  async storeDfFile(fileData) {
    // Create a new transaction for each file to avoid timeout
    await fileDatabase.initialize();
    
    const transaction = fileDatabase.db.transaction(['files', 'fileVersions'], 'readwrite');
    const filesStore = transaction.objectStore('files');
    
    try {
      // Check if file already exists
      const existingFile = await fileDatabase.getFileByProSBCId(fileData.prosbcId, fileData.fileType);
      
      if (existingFile) {
        // Update existing DF file
        const updatedFile = {
          ...existingFile,
          ...fileData,
          id: existingFile.id,
          version: existingFile.version + 1,
          lastModified: new Date().toISOString(),
          createdAt: existingFile.createdAt
        };
        
        await this.putRecord(filesStore, updatedFile);
        console.log(`Updated existing DF file: ${fileData.fileName}`);
        return updatedFile;
      } else {
        // Add new DF file
        const newFile = {
          ...fileData,
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          version: 1
        };
        
        const result = await this.addRecord(filesStore, newFile);
        newFile.id = result;
        console.log(`Stored new DF file: ${fileData.fileName} (ID: ${result})`);
        return newFile;
      }
    } catch (error) {
      console.error('Error storing DF file:', error);
      throw error;
    }
  }

  // Store DM file with specific handling
  async storeDmFile(fileData) {
    // Create a new transaction for each file to avoid timeout
    await fileDatabase.initialize();
    
    const transaction = fileDatabase.db.transaction(['files', 'fileVersions'], 'readwrite');
    const filesStore = transaction.objectStore('files');
    
    try {
      // Check if file already exists
      const existingFile = await fileDatabase.getFileByProSBCId(fileData.prosbcId, fileData.fileType);
      
      if (existingFile) {
        // Update existing DM file
        const updatedFile = {
          ...existingFile,
          ...fileData,
          id: existingFile.id,
          version: existingFile.version + 1,
          lastModified: new Date().toISOString(),
          createdAt: existingFile.createdAt
        };
        
        await this.putRecord(filesStore, updatedFile);
        console.log(`Updated existing DM file: ${fileData.fileName}`);
        return updatedFile;
      } else {
        // Add new DM file
        const newFile = {
          ...fileData,
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          version: 1
        };
        
        const result = await this.addRecord(filesStore, newFile);
        newFile.id = result;
        console.log(`Stored new DM file: ${fileData.fileName} (ID: ${result})`);
        return newFile;
      }
    } catch (error) {
      console.error('Error storing DM file:', error);
      throw error;
    }
  }

  // Categorize DF files
  categorizeDfFile(fileData) {
    const complexity = fileData.dfSpecific.complexity;
    const routesetCount = fileData.dfSpecific.routesetCount;
    
    if (complexity > 70) return 'complex';
    if (complexity > 40) return 'moderate';
    if (routesetCount > 5) return 'multi_routeset';
    return 'simple';
  }

  // Categorize DM files
  categorizeDmFile(fileData) {
    const complexity = fileData.dmSpecific.complexity;
    const patternCount = fileData.dmSpecific.numberPatterns.length;
    
    if (complexity > 70) return 'complex';
    if (complexity > 40) return 'moderate';
    if (patternCount > 10) return 'multi_pattern';
    return 'simple';
  }

  // Get DF storage location
  getDfStorageLocation(fileData) {
    const category = this.categorizeDfFile(fileData);
    const basePath = 'prosbc_files/definition_files';
    
    switch (category) {
      case 'complex':
        return `${basePath}/active/complex`;
      case 'moderate':
        return `${basePath}/active/moderate`;
      case 'multi_routeset':
        return `${basePath}/active/multi_routeset`;
      default:
        return `${basePath}/active/simple`;
    }
  }

  // Get DM storage location
  getDmStorageLocation(fileData) {
    const category = this.categorizeDmFile(fileData);
    const basePath = 'prosbc_files/digit_maps';
    
    switch (category) {
      case 'complex':
        return `${basePath}/active/complex`;
      case 'moderate':
        return `${basePath}/active/moderate`;
      case 'multi_pattern':
        return `${basePath}/active/multi_pattern`;
      default:
        return `${basePath}/active/simple`;
    }
  }

  // Get files by category
  async getFilesByCategory(category, fileType = null) {
    await fileDatabase.initialize();
    
    let files = fileType ? 
      await fileDatabase.getFilesByType(fileType) : 
      await fileDatabase.getAllFiles();
    
    return files.filter(file => {
      if (file.fileType === 'routesets_definitions') {
        return this.categorizeDfFile(file) === category;
      } else if (file.fileType === 'routesets_digitmaps') {
        return this.categorizeDmFile(file) === category;
      }
      return false;
    });
  }

  // Get DF statistics
  async getDfStatistics() {
    const dfFiles = await fileDatabase.getFilesByType('routesets_definitions');
    
    const stats = {
      total: dfFiles.length,
      categories: {},
      complexityDistribution: {},
      routesetStats: {
        totalRoutesets: 0,
        averageRoutesets: 0,
        maxRoutesets: 0
      },
      priorityStats: {
        totalPriorities: 0,
        averagePriorities: 0,
        mostCommonPriority: null
      }
    };

    const allPriorities = [];
    let totalRoutesets = 0;
    let maxRoutesets = 0;

    dfFiles.forEach(file => {
      if (file.dfSpecific) {
        // Categories
        const category = this.categorizeDfFile(file);
        stats.categories[category] = (stats.categories[category] || 0) + 1;
        
        // Complexity
        const complexity = Math.floor(file.dfSpecific.complexity / 10) * 10;
        const complexityRange = `${complexity}-${complexity + 9}`;
        stats.complexityDistribution[complexityRange] = (stats.complexityDistribution[complexityRange] || 0) + 1;
        
        // Routesets
        totalRoutesets += file.dfSpecific.routesetCount;
        maxRoutesets = Math.max(maxRoutesets, file.dfSpecific.routesetCount);
        
        // Priorities
        if (file.dfSpecific.priorityLevels) {
          allPriorities.push(...file.dfSpecific.priorityLevels);
        }
      }
    });

    stats.routesetStats.totalRoutesets = totalRoutesets;
    stats.routesetStats.averageRoutesets = dfFiles.length > 0 ? (totalRoutesets / dfFiles.length).toFixed(2) : 0;
    stats.routesetStats.maxRoutesets = maxRoutesets;

    // Priority statistics
    if (allPriorities.length > 0) {
      stats.priorityStats.totalPriorities = new Set(allPriorities).size;
      stats.priorityStats.averagePriorities = (allPriorities.length / dfFiles.length).toFixed(2);
      
      const priorityCounts = {};
      allPriorities.forEach(p => priorityCounts[p] = (priorityCounts[p] || 0) + 1);
      stats.priorityStats.mostCommonPriority = Object.keys(priorityCounts).reduce((a, b) => 
        priorityCounts[a] > priorityCounts[b] ? a : b
      );
    }

    return stats;
  }

  // Get DM statistics
  async getDmStatistics() {
    const dmFiles = await fileDatabase.getFilesByType('routesets_digitmaps');
    
    const stats = {
      total: dmFiles.length,
      categories: {},
      complexityDistribution: {},
      numberStats: {
        totalPatterns: 0,
        averagePatterns: 0,
        maxPatterns: 0,
        totalNumbers: 0
      },
      routesetMappings: {}
    };

    const allRoutesets = new Set();
    let totalPatterns = 0;
    let maxPatterns = 0;
    let totalNumbers = 0;

    dmFiles.forEach(file => {
      if (file.dmSpecific) {
        // Categories
        const category = this.categorizeDmFile(file);
        stats.categories[category] = (stats.categories[category] || 0) + 1;
        
        // Complexity
        const complexity = Math.floor(file.dmSpecific.complexity / 10) * 10;
        const complexityRange = `${complexity}-${complexity + 9}`;
        stats.complexityDistribution[complexityRange] = (stats.complexityDistribution[complexityRange] || 0) + 1;
        
        // Number patterns
        totalPatterns += file.dmSpecific.numberPatterns.length;
        maxPatterns = Math.max(maxPatterns, file.dmSpecific.numberPatterns.length);
        totalNumbers += file.dmSpecific.calledNumbers.length;
        
        // Routeset mappings
        Object.keys(file.dmSpecific.routesetMappings).forEach(routeset => {
          allRoutesets.add(routeset);
          stats.routesetMappings[routeset] = (stats.routesetMappings[routeset] || 0) + 
            file.dmSpecific.routesetMappings[routeset].length;
        });
      }
    });

    stats.numberStats.totalPatterns = totalPatterns;
    stats.numberStats.averagePatterns = dmFiles.length > 0 ? (totalPatterns / dmFiles.length).toFixed(2) : 0;
    stats.numberStats.maxPatterns = maxPatterns;
    stats.numberStats.totalNumbers = totalNumbers;

    return stats;
  }

  // Helper methods for IndexedDB operations
  async addRecord(store, record) {
    return new Promise((resolve, reject) => {
      const request = store.add(record);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async putRecord(store, record) {
    return new Promise((resolve, reject) => {
      const request = store.put(record);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

// Export singleton instance
export const enhancedFileStorageService = new EnhancedFileStorageService();
