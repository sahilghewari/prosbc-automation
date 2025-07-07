/**
 * DM/DF File Management Service
 * Handles CSV file parsing, validation, and database operations for Digit Map and Dial Format files
 */

export class DMDFFileService {
  constructor(dbService) {
    this.dbService = dbService;
  }

  /**
   * Parse CSV content and extract metadata
   */
  parseCSVContent(content, fileType) {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      throw new Error('Empty file');
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const data = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    });

    // Extract metadata based on file type
    let metadata = {};
    if (fileType === 'dm') {
      metadata = this.extractDigitMapMetadata(data, headers);
    } else if (fileType === 'df') {
      metadata = this.extractDialFormatMetadata(data, headers);
    }

    return {
      headers,
      data,
      metadata,
      rowCount: data.length
    };
  }

  /**
   * Extract metadata from Digit Map CSV
   */
  extractDigitMapMetadata(data, headers) {
    const routesetNames = [...new Set(data.map(row => row.routeset_name).filter(Boolean))];
    const calledNumbers = data.map(row => row.called).filter(Boolean);
    const callingNumbers = data.map(row => row.calling).filter(Boolean);

    return {
      routesetNames,
      totalRoutesets: routesetNames.length,
      totalCalledNumbers: calledNumbers.length,
      totalCallingNumbers: callingNumbers.length,
      hasHeaders: headers.includes('called') && headers.includes('calling') && headers.includes('routeset_name'),
      expectedFormat: 'called,calling,routeset_name'
    };
  }

  /**
   * Extract metadata from Dial Format CSV
   */
  extractDialFormatMetadata(data, headers) {
    const routesetNames = [...new Set(data.map(row => row.routeset_name).filter(Boolean))];
    const priorities = data.map(row => parseInt(row.priority)).filter(p => !isNaN(p));
    const weights = data.map(row => parseInt(row.weight)).filter(w => !isNaN(w));

    return {
      routesetNames,
      totalRoutesets: routesetNames.length,
      priorityRange: priorities.length > 0 ? { min: Math.min(...priorities), max: Math.max(...priorities) } : null,
      weightRange: weights.length > 0 ? { min: Math.min(...weights), max: Math.max(...weights) } : null,
      hasHeaders: headers.includes('routeset_name') && headers.includes('priority') && headers.includes('weight'),
      expectedFormat: 'routeset_name,priority,weight,remapped_called,remapped_calling'
    };
  }

  /**
   * Validate file content based on type
   */
  validateFile(parsedContent, fileType) {
    const errors = [];
    const warnings = [];
    
    if (fileType === 'dm') {
      const validation = this.validateDigitMap(parsedContent);
      errors.push(...validation.errors);
      warnings.push(...validation.warnings);
    } else if (fileType === 'df') {
      const validation = this.validateDialFormat(parsedContent);
      errors.push(...validation.errors);
      warnings.push(...validation.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: this.calculateValidationScore(errors, warnings)
    };
  }

  /**
   * Validate Digit Map file
   */
  validateDigitMap(parsedContent) {
    const errors = [];
    const warnings = [];
    const { headers, data, metadata } = parsedContent;

    // Check required headers
    const requiredHeaders = ['called', 'calling', 'routeset_name'];
    const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
    if (missingHeaders.length > 0) {
      errors.push(`Missing required headers: ${missingHeaders.join(', ')}`);
    }

    // Check data integrity
    data.forEach((row, index) => {
      if (!row.routeset_name) {
        warnings.push(`Row ${index + 2}: Missing routeset_name`);
      }
      if (!row.called && !row.calling) {
        warnings.push(`Row ${index + 2}: Both called and calling are empty`);
      }
    });

    // Check routeset consistency
    if (metadata.totalRoutesets === 0) {
      errors.push('No valid routeset names found');
    } else if (metadata.totalRoutesets > 10) {
      warnings.push(`High number of routesets (${metadata.totalRoutesets}). Consider splitting the file.`);
    }

    return { errors, warnings };
  }

  /**
   * Validate Dial Format file
   */
  validateDialFormat(parsedContent) {
    const errors = [];
    const warnings = [];
    const { headers, data, metadata } = parsedContent;

    // Check required headers
    const requiredHeaders = ['routeset_name', 'priority', 'weight'];
    const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
    if (missingHeaders.length > 0) {
      errors.push(`Missing required headers: ${missingHeaders.join(', ')}`);
    }

    // Check data integrity
    data.forEach((row, index) => {
      if (!row.routeset_name) {
        errors.push(`Row ${index + 2}: Missing routeset_name`);
      }
      if (row.priority && isNaN(parseInt(row.priority))) {
        errors.push(`Row ${index + 2}: Invalid priority value '${row.priority}'`);
      }
      if (row.weight && isNaN(parseInt(row.weight))) {
        errors.push(`Row ${index + 2}: Invalid weight value '${row.weight}'`);
      }
    });

    // Check priority and weight ranges
    if (metadata.priorityRange) {
      if (metadata.priorityRange.min < 0 || metadata.priorityRange.max > 100) {
        warnings.push(`Priority values outside recommended range (0-100): ${metadata.priorityRange.min}-${metadata.priorityRange.max}`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Calculate validation score (0-100)
   */
  calculateValidationScore(errors, warnings) {
    let score = 100;
    score -= errors.length * 20; // Each error reduces score by 20
    score -= warnings.length * 5; // Each warning reduces score by 5
    return Math.max(0, score);
  }

  /**
   * Upload and process file
   */
  async uploadFile(file, fileType, metadata = {}) {
    try {
      // Read file content
      const content = await this.readFileContent(file);
      
      // Parse CSV
      const parsedContent = this.parseCSVContent(content, fileType);
      
      // Validate content
      const validation = this.validateFile(parsedContent, fileType);
      
      // Create file record
      const fileData = {
        filename: file.name,
        original_filename: file.name,
        content: content,
        content_type: 'csv',
        file_size: file.size,
        status: validation.isValid ? 'validated' : 'uploaded',
        validation_score: validation.score,
        validation_errors: validation.errors,
        validation_warnings: validation.warnings,
        parsed_metadata: parsedContent.metadata,
        row_count: parsedContent.rowCount,
        uploaded_by: 'admin',
        source: 'gui',
        ...metadata
      };

      // Save to database
      const result = fileType === 'dm' 
        ? await this.dbService.createDigitMap(fileData)
        : await this.dbService.createDialFormat(fileData);

      return {
        success: result.success,
        file: result.digitMap || result.dialFormat,
        validation,
        parsedContent,
        error: result.error
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        validation: { isValid: false, errors: [error.message], warnings: [] }
      };
    }
  }

  /**
   * Read file content as text
   */
  readFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Generate mapping suggestions based on NAP and available files
   */
  async generateMappingSuggestions(napId) {
    try {
      // Get DM and DF files for this NAP
      const dmResult = await this.dbService.listDigitMaps({ nap_id: napId, status: 'validated' });
      const dfResult = await this.dbService.listDialFormats({ nap_id: napId, status: 'validated' });

      const suggestions = [];
      
      if (dmResult.success && dfResult.success) {
        const dmFiles = dmResult.digitMaps || [];
        const dfFiles = dfResult.dialFormats || [];

        // Create suggestions based on matching routeset names
        dmFiles.forEach(dm => {
          const matchingDFs = dfFiles.filter(df => 
            dm.parsed_metadata?.routesetNames?.some(route => 
              df.parsed_metadata?.routesetNames?.includes(route)
            )
          );

          matchingDFs.forEach(df => {
            suggestions.push({
              nap_id: napId,
              digitmap_file_id: dm.id,
              dialformat_file_id: df.id,
              confidence: this.calculateMappingConfidence(dm, df),
              shared_routesets: this.getSharedRoutesets(dm, df),
              dm_filename: dm.filename,
              df_filename: df.filename
            });
          });
        });
      }

      return {
        success: true,
        suggestions: suggestions.sort((a, b) => b.confidence - a.confidence)
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        suggestions: []
      };
    }
  }

  /**
   * Calculate confidence score for mapping suggestion
   */
  calculateMappingConfidence(dmFile, dfFile) {
    let confidence = 0;
    
    // Base confidence if both files exist
    confidence += 30;
    
    // Boost confidence for shared routesets
    const sharedRoutesets = this.getSharedRoutesets(dmFile, dfFile);
    confidence += sharedRoutesets.length * 20;
    
    // Boost confidence for validation scores
    if (dmFile.validation_score) confidence += dmFile.validation_score * 0.2;
    if (dfFile.validation_score) confidence += dfFile.validation_score * 0.2;
    
    // Boost confidence for similar file sizes
    if (dmFile.file_size && dfFile.file_size) {
      const sizeRatio = Math.min(dmFile.file_size, dfFile.file_size) / Math.max(dmFile.file_size, dfFile.file_size);
      confidence += sizeRatio * 10;
    }
    
    return Math.min(100, confidence);
  }

  /**
   * Get shared routesets between DM and DF files
   */
  getSharedRoutesets(dmFile, dfFile) {
    const dmRoutesets = dmFile.parsed_metadata?.routesetNames || [];
    const dfRoutesets = dfFile.parsed_metadata?.routesetNames || [];
    
    return dmRoutesets.filter(route => dfRoutesets.includes(route));
  }
}

export default DMDFFileService;
