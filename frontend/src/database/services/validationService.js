/**
 * Validation Service
 * Handles validation for NAP configurations, file structures, and data integrity
 */

class ValidationService {
  constructor() {
    this.csvMaxRows = parseInt(process.env.CSV_MAX_ROWS) || 10000;
    this.csvMaxColumns = parseInt(process.env.CSV_MAX_COLUMNS) || 100;
    this.requiredHeaders = {
      'DF': ['prefix', 'length', 'context'],
      'DM': ['digit_pattern', 'route', 'description'],
      'Routeset': ['route_name', 'destination', 'priority']
    };
  }

  async validateNapConfig(configJson) {
    try {
      const validation = {
        is_valid: true,
        errors: [],
        warnings: [],
        last_validated: new Date()
      };

      // Basic structure validation
      if (!configJson || typeof configJson !== 'object') {
        validation.is_valid = false;
        validation.errors.push('NAP configuration must be a valid JSON object');
        return validation;
      }

      // Required fields validation
      const requiredFields = ['name', 'description', 'type'];
      for (const field of requiredFields) {
        if (!configJson[field]) {
          validation.errors.push(`Missing required field: ${field}`);
        }
      }

      // NAP type validation
      const validTypes = ['access', 'trunk', 'emergency', 'test'];
      if (configJson.type && !validTypes.includes(configJson.type)) {
        validation.warnings.push(`Unknown NAP type: ${configJson.type}. Valid types: ${validTypes.join(', ')}`);
      }

      // Configuration structure validation
      await this.validateNapStructure(configJson, validation);

      // Business logic validation
      await this.validateNapBusinessRules(configJson, validation);

      validation.is_valid = validation.errors.length === 0;
      return validation;
      
    } catch (error) {
      console.error('❌ Error validating NAP config:', error);
      return {
        is_valid: false,
        errors: [`Validation error: ${error.message}`],
        warnings: [],
        last_validated: new Date()
      };
    }
  }

  async validateNapStructure(config, validation) {
    // Validate routing configuration
    if (config.routing) {
      if (!Array.isArray(config.routing.routes)) {
        validation.errors.push('Routing routes must be an array');
      } else {
        config.routing.routes.forEach((route, index) => {
          if (!route.pattern) {
            validation.errors.push(`Route ${index + 1}: Missing pattern`);
          }
          if (!route.destination) {
            validation.errors.push(`Route ${index + 1}: Missing destination`);
          }
          if (route.priority && (route.priority < 1 || route.priority > 100)) {
            validation.warnings.push(`Route ${index + 1}: Priority should be between 1-100`);
          }
        });
      }
    }

    // Validate digit manipulation
    if (config.digit_manipulation) {
      if (!Array.isArray(config.digit_manipulation.rules)) {
        validation.errors.push('Digit manipulation rules must be an array');
      } else {
        config.digit_manipulation.rules.forEach((rule, index) => {
          if (!rule.pattern) {
            validation.errors.push(`Digit rule ${index + 1}: Missing pattern`);
          }
          if (!rule.action) {
            validation.errors.push(`Digit rule ${index + 1}: Missing action`);
          }
          if (rule.action && !['add', 'remove', 'replace', 'none'].includes(rule.action)) {
            validation.errors.push(`Digit rule ${index + 1}: Invalid action '${rule.action}'`);
          }
        });
      }
    }

    // Validate number plans
    if (config.number_plans) {
      if (!Array.isArray(config.number_plans)) {
        validation.errors.push('Number plans must be an array');
      } else {
        config.number_plans.forEach((plan, index) => {
          if (!plan.name) {
            validation.errors.push(`Number plan ${index + 1}: Missing name`);
          }
          if (!plan.prefix) {
            validation.errors.push(`Number plan ${index + 1}: Missing prefix`);
          }
          if (plan.min_length && plan.max_length && plan.min_length > plan.max_length) {
            validation.errors.push(`Number plan ${index + 1}: min_length cannot be greater than max_length`);
          }
        });
      }
    }
  }

  async validateNapBusinessRules(config, validation) {
    // Check for duplicate route patterns
    if (config.routing && config.routing.routes) {
      const patterns = config.routing.routes.map(r => r.pattern);
      const duplicates = patterns.filter((item, index) => patterns.indexOf(item) !== index);
      if (duplicates.length > 0) {
        validation.warnings.push(`Duplicate route patterns found: ${duplicates.join(', ')}`);
      }
    }

    // Check for overlapping number plans
    if (config.number_plans && config.number_plans.length > 1) {
      for (let i = 0; i < config.number_plans.length; i++) {
        for (let j = i + 1; j < config.number_plans.length; j++) {
          const plan1 = config.number_plans[i];
          const plan2 = config.number_plans[j];
          
          if (plan1.prefix === plan2.prefix) {
            validation.warnings.push(`Overlapping number plans: ${plan1.name} and ${plan2.name} have same prefix`);
          }
        }
      }
    }

    // Validate capacity limits
    if (config.capacity) {
      if (config.capacity.max_calls && config.capacity.max_calls > 10000) {
        validation.warnings.push('Max calls exceeds recommended limit of 10,000');
      }
      if (config.capacity.cps && config.capacity.cps > 1000) {
        validation.warnings.push('CPS exceeds recommended limit of 1,000');
      }
    }
  }

  async validateFileStructure(content, fileType) {
    try {
      const validation = {
        is_valid: true,
        row_count: 0,
        column_count: 0,
        errors: [],
        warnings: [],
        last_validated: new Date(),
        csv_structure: {
          headers: [],
          sample_rows: []
        }
      };

      if (!content || typeof content !== 'string') {
        validation.is_valid = false;
        validation.errors.push('File content must be a valid string');
        return validation;
      }

      // Parse CSV content
      const lines = content.trim().split('\n');
      if (lines.length === 0) {
        validation.is_valid = false;
        validation.errors.push('File is empty');
        return validation;
      }

      validation.row_count = lines.length - 1; // Excluding header
      
      // Validate row count
      if (validation.row_count > this.csvMaxRows) {
        validation.is_valid = false;
        validation.errors.push(`Too many rows: ${validation.row_count} > ${this.csvMaxRows}`);
      }

      // Parse headers
      const headers = this.parseCSVLine(lines[0]);
      validation.csv_structure.headers = headers;
      validation.column_count = headers.length;

      // Validate column count
      if (validation.column_count > this.csvMaxColumns) {
        validation.is_valid = false;
        validation.errors.push(`Too many columns: ${validation.column_count} > ${this.csvMaxColumns}`);
      }

      // Validate required headers for file type
      if (this.requiredHeaders[fileType]) {
        const required = this.requiredHeaders[fileType];
        const missing = required.filter(h => !headers.some(header => 
          header.toLowerCase().includes(h.toLowerCase())
        ));
        
        if (missing.length > 0) {
          validation.warnings.push(`Missing recommended headers for ${fileType}: ${missing.join(', ')}`);
        }
      }

      // Validate data consistency
      await this.validateDataConsistency(lines, headers, validation);

      // Get sample rows
      const sampleRowCount = Math.min(5, lines.length - 1);
      for (let i = 1; i <= sampleRowCount; i++) {
        const rowData = this.parseCSVLine(lines[i]);
        validation.csv_structure.sample_rows.push(rowData);
      }

      // File type specific validation
      await this.validateFileTypeSpecific(lines, headers, fileType, validation);

      validation.is_valid = validation.errors.length === 0;
      return validation;
      
    } catch (error) {
      console.error('❌ Error validating file structure:', error);
      return {
        is_valid: false,
        row_count: 0,
        column_count: 0,
        errors: [`File validation error: ${error.message}`],
        warnings: [],
        last_validated: new Date(),
        csv_structure: { headers: [], sample_rows: [] }
      };
    }
  }

  async validateDataConsistency(lines, headers, validation) {
    const expectedColumnCount = headers.length;
    const inconsistentRows = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue; // Skip empty lines
      
      const rowData = this.parseCSVLine(lines[i]);
      if (rowData.length !== expectedColumnCount) {
        inconsistentRows.push({
          row: i + 1,
          expected: expectedColumnCount,
          actual: rowData.length
        });
      }
    }

    if (inconsistentRows.length > 0) {
      if (inconsistentRows.length > 10) {
        validation.errors.push(`${inconsistentRows.length} rows have inconsistent column counts`);
      } else {
        validation.warnings.push(`Inconsistent column counts in rows: ${inconsistentRows.map(r => r.row).join(', ')}`);
      }
    }

    // Check for completely empty rows
    const emptyRows = [];
    for (let i = 1; i < lines.length; i++) {
      const rowData = this.parseCSVLine(lines[i]);
      if (rowData.every(cell => !cell.trim())) {
        emptyRows.push(i + 1);
      }
    }

    if (emptyRows.length > 0) {
      validation.warnings.push(`Empty rows found: ${emptyRows.join(', ')}`);
    }
  }

  async validateFileTypeSpecific(lines, headers, fileType, validation) {
    switch (fileType.toUpperCase()) {
      case 'DF':
        await this.validateDFFile(lines, headers, validation);
        break;
      case 'DM':
        await this.validateDMFile(lines, headers, validation);
        break;
      case 'ROUTESET':
        await this.validateRoutesetFile(lines, headers, validation);
        break;
    }
  }

  async validateDFFile(lines, headers, validation) {
    // Validate DF (Dial Plan/Definition File) specific rules
    const prefixIndex = headers.findIndex(h => h.toLowerCase().includes('prefix'));
    const lengthIndex = headers.findIndex(h => h.toLowerCase().includes('length'));
    
    if (prefixIndex === -1) {
      validation.warnings.push('No prefix column found in DF file');
      return;
    }

    const prefixes = new Set();
    const duplicates = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const rowData = this.parseCSVLine(lines[i]);
      const prefix = rowData[prefixIndex];
      
      if (prefix) {
        if (prefixes.has(prefix)) {
          duplicates.push(prefix);
        } else {
          prefixes.add(prefix);
        }

        // Validate prefix format
        if (!/^\d+$/.test(prefix)) {
          validation.warnings.push(`Row ${i + 1}: Invalid prefix format '${prefix}' (should be numeric)`);
        }

        // Validate length if present
        if (lengthIndex !== -1) {
          const length = rowData[lengthIndex];
          if (length && (isNaN(length) || parseInt(length) < 1 || parseInt(length) > 20)) {
            validation.warnings.push(`Row ${i + 1}: Invalid length '${length}' (should be 1-20)`);
          }
        }
      }
    }

    if (duplicates.length > 0) {
      validation.warnings.push(`Duplicate prefixes found: ${[...new Set(duplicates)].join(', ')}`);
    }
  }

  async validateDMFile(lines, headers, validation) {
    // Validate DM (Digit Manipulation) file specific rules
    const patternIndex = headers.findIndex(h => h.toLowerCase().includes('pattern') || h.toLowerCase().includes('digit'));
    const routeIndex = headers.findIndex(h => h.toLowerCase().includes('route') || h.toLowerCase().includes('destination'));
    
    if (patternIndex === -1) {
      validation.warnings.push('No pattern/digit column found in DM file');
    }

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const rowData = this.parseCSVLine(lines[i]);
      
      if (patternIndex !== -1) {
        const pattern = rowData[patternIndex];
        if (pattern && !this.isValidDigitPattern(pattern)) {
          validation.warnings.push(`Row ${i + 1}: Invalid digit pattern '${pattern}'`);
        }
      }

      if (routeIndex !== -1) {
        const route = rowData[routeIndex];
        if (route && !this.isValidRoute(route)) {
          validation.warnings.push(`Row ${i + 1}: Invalid route format '${route}'`);
        }
      }
    }
  }

  async validateRoutesetFile(lines, headers, validation) {
    // Validate Routeset file specific rules
    const routeIndex = headers.findIndex(h => h.toLowerCase().includes('route'));
    const destinationIndex = headers.findIndex(h => h.toLowerCase().includes('destination'));
    const priorityIndex = headers.findIndex(h => h.toLowerCase().includes('priority'));
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const rowData = this.parseCSVLine(lines[i]);
      
      if (priorityIndex !== -1) {
        const priority = rowData[priorityIndex];
        if (priority && (isNaN(priority) || parseInt(priority) < 1 || parseInt(priority) > 100)) {
          validation.warnings.push(`Row ${i + 1}: Invalid priority '${priority}' (should be 1-100)`);
        }
      }

      if (destinationIndex !== -1) {
        const destination = rowData[destinationIndex];
        if (destination && !this.isValidDestination(destination)) {
          validation.warnings.push(`Row ${i + 1}: Invalid destination format '${destination}'`);
        }
      }
    }
  }

  // ========== UTILITY METHODS ==========

  parseCSVLine(line) {
    const result = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      
      if (char === '"' && !inQuotes) {
        inQuotes = true;
      } else if (char === '"' && inQuotes) {
        if (i + 1 < line.length && line[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
      i++;
    }
    
    result.push(currentField.trim());
    return result;
  }

  isValidDigitPattern(pattern) {
    // Basic validation for digit patterns
    // Allows digits, wildcards, and basic regex patterns
    const validPattern = /^[\d*#+\[\]()-]+$/;
    return validPattern.test(pattern);
  }

  isValidRoute(route) {
    // Basic validation for route format
    // Allows alphanumeric, dots, dashes, underscores
    const validRoute = /^[a-zA-Z0-9._-]+$/;
    return validRoute.test(route);
  }

  isValidDestination(destination) {
    // Basic validation for destination format
    // Allows IP addresses, hostnames, or SIP URIs
    const ipPattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const hostnamePattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    const sipPattern = /^sip:[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/;
    
    return ipPattern.test(destination) || hostnamePattern.test(destination) || sipPattern.test(destination);
  }

  async validateMapping(mappingData) {
    try {
      const validation = {
        is_valid: true,
        errors: [],
        warnings: [],
        last_validated: new Date()
      };

      // Validate required fields
      if (!mappingData.nap_reference) {
        validation.errors.push('NAP reference is required');
      }

      if (!mappingData.digitmap_file_id && !mappingData.definition_file_id) {
        validation.errors.push('At least one file (digitmap or definition) must be mapped');
      }

      // Validate mapping configuration
      if (mappingData.mapping_config) {
        await this.validateMappingConfig(mappingData.mapping_config, validation);
      }

      validation.is_valid = validation.errors.length === 0;
      return validation;
      
    } catch (error) {
      console.error('❌ Error validating mapping:', error);
      return {
        is_valid: false,
        errors: [`Mapping validation error: ${error.message}`],
        warnings: [],
        last_validated: new Date()
      };
    }
  }

  async validateMappingConfig(config, validation) {
    // Validate column mappings
    if (config.digitmap_mapping && config.digitmap_mapping.column_mappings) {
      config.digitmap_mapping.column_mappings.forEach((mapping, index) => {
        if (!mapping.source_column) {
          validation.errors.push(`Digitmap mapping ${index + 1}: Missing source column`);
        }
        if (!mapping.target_field) {
          validation.errors.push(`Digitmap mapping ${index + 1}: Missing target field`);
        }
      });
    }

    if (config.definition_mapping && config.definition_mapping.column_mappings) {
      config.definition_mapping.column_mappings.forEach((mapping, index) => {
        if (!mapping.source_column) {
          validation.errors.push(`Definition mapping ${index + 1}: Missing source column`);
        }
        if (!mapping.target_field) {
          validation.errors.push(`Definition mapping ${index + 1}: Missing target field`);
        }
      });
    }
  }

  async validateBulkOperation(files, operation) {
    try {
      const validation = {
        is_valid: true,
        files_validated: 0,
        errors: [],
        warnings: [],
        file_results: {}
      };

      for (const file of files) {
        try {
          const fileValidation = await this.validateFileStructure(file.content, file.type);
          validation.file_results[file.file_id] = fileValidation;
          validation.files_validated++;

          if (!fileValidation.is_valid) {
            validation.errors.push(`File ${file.file_id}: ${fileValidation.errors.join(', ')}`);
          }

          if (fileValidation.warnings.length > 0) {
            validation.warnings.push(`File ${file.file_id}: ${fileValidation.warnings.join(', ')}`);
          }

        } catch (error) {
          validation.errors.push(`File ${file.file_id}: Validation failed - ${error.message}`);
        }
      }

      validation.is_valid = validation.errors.length === 0;
      return validation;
      
    } catch (error) {
      console.error('❌ Error validating bulk operation:', error);
      throw new Error(`Bulk validation failed: ${error.message}`);
    }
  }
}

export default ValidationService;
