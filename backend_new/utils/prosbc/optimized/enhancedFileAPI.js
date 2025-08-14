// Enhanced ProSBC File API that fixes parsing and API call issues
import { enhancedSwitcher } from './enhancedSwitcher.js';
import { sessionPool } from './sessionPool.js';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

/**
 * Enhanced ProSBC File API that addresses:
 * 1. HTML parsing issues causing empty file lists
 * 2. Config selection failures
 * 3. Excessive API calls during switching
 * 4. Session management problems
 */
export class EnhancedProSBCFileAPI {
  constructor(instanceId) {
    this.instanceId = instanceId;
    this.currentConfig = null;
    this.fileCache = new Map(); // cache file lists
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes for file lists
  }

  /**
   * Switch to a specific ProSBC instance and config
   */
  async switchInstance(configId = null) {
    console.log(`[Enhanced FileAPI] Switching to ${this.instanceId}, config: ${configId || 'auto'}`);
    
    const result = await enhancedSwitcher.switchInstance(this.instanceId, configId);
    this.currentConfig = result.selectedConfig;
    
    // Clear file cache when switching
    this.clearFileCache();
    
    return result;
  }

  /**
   * Get DF (Definition Files) list with enhanced parsing
   */
  async getDFFiles(configId = null) {
    return this.getFileList('routesets_definitions', 'Routesets Definition', configId);
  }

  /**
   * Get DM (Digitmap Files) list with enhanced parsing
   */
  async getDMFiles(configId = null) {
    return this.getFileList('routesets_digitmaps', 'Routesets Digitmap', configId);
  }

  /**
   * Get file list with enhanced parsing and caching
   */
  async getFileList(fileType, sectionName, configId = null) {
    console.log(`[Enhanced FileAPI] Getting ${fileType} files for ${this.instanceId}`);
    
    try {
      // Ensure we're on the right instance/config
      if (!this.currentConfig || (configId && this.currentConfig.id !== configId)) {
        await this.switchInstance(configId);
      }

      // Check cache first
      const cacheKey = `${this.instanceId}:${this.currentConfig.id}:${fileType}`;
      const cached = this.fileCache.get(cacheKey);
      
      if (cached && this.isCacheValid(cached.timestamp)) {
        console.log(`[Enhanced FileAPI] Using cached ${fileType} files (${cached.files.length} files)`);
        return cached.files;
      }

      // Get fresh session
      const sessionCookie = await this.getCurrentSession();
      
      // Fetch file database page with enhanced error handling
      const html = await this.fetchFileDatabase(sessionCookie);
      
      // Parse files with enhanced parsing
      const files = await this.parseFilesEnhanced(html, sectionName, fileType);
      
      // Cache the results
      this.fileCache.set(cacheKey, {
        files,
        timestamp: Date.now()
      });

      console.log(`[Enhanced FileAPI] Retrieved ${files.length} ${fileType} files`);
      return files;

    } catch (error) {
      console.error(`[Enhanced FileAPI] Failed to get ${fileType} files:`, error.message);
      
      // Clear cache on error
      this.clearFileCache();
      
      throw new Error(`Failed to get ${fileType} files: ${error.message}`);
    }
  }

  /**
   * Get current session cookie
   */
  async getCurrentSession() {
    if (!this.currentConfig) {
      throw new Error('No active configuration - call switchInstance first');
    }

    const instanceContext = await enhancedSwitcher.getInstanceContextCached(this.instanceId);
    
    return await sessionPool.getSession(this.instanceId, {
      baseUrl: instanceContext.baseUrl,
      username: instanceContext.username,
      password: instanceContext.password
    });
  }

  /**
   * Fetch file database page with validation
   */
  async fetchFileDatabase(sessionCookie) {
    const instanceContext = await enhancedSwitcher.getInstanceContextCached(this.instanceId);
    const url = `${instanceContext.baseUrl}/file_dbs/${this.currentConfig.dbId}/edit`;
    
    console.log(`[Enhanced FileAPI] Fetching file database: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Cookie': sessionCookie,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    
    // Validate we got the right page
    if (html.includes('Configuration Management') || html.includes('choose_redirect')) {
      throw new Error('Got configuration page instead of file database - config selection may have failed');
    }

    if (!html.includes('Routesets Definition') && !html.includes('Routesets Digitmap')) {
      throw new Error('File database page does not contain expected sections');
    }

    console.log(`[Enhanced FileAPI] ✓ File database page loaded successfully (${html.length} bytes)`);
    return html;
  }

  /**
   * Enhanced file parsing with multiple fallback methods
   */
  async parseFilesEnhanced(html, sectionName, fileType) {
    console.log(`[Enhanced FileAPI] Parsing files for section: ${sectionName}`);
    
    // Method 1: Try regex-based parsing first (fastest)
    try {
      const regexFiles = this.parseFilesWithRegex(html, sectionName, fileType);
      if (regexFiles.length > 0) {
        console.log(`[Enhanced FileAPI] ✓ Regex parsing found ${regexFiles.length} files`);
        return regexFiles;
      }
    } catch (error) {
      console.warn(`[Enhanced FileAPI] Regex parsing failed:`, error.message);
    }

    // Method 2: Try DOM-based parsing
    try {
      const domFiles = await this.parseFilesWithDOM(html, sectionName, fileType);
      if (domFiles.length > 0) {
        console.log(`[Enhanced FileAPI] ✓ DOM parsing found ${domFiles.length} files`);
        return domFiles;
      }
    } catch (error) {
      console.warn(`[Enhanced FileAPI] DOM parsing failed:`, error.message);
    }

    // Method 3: Try line-by-line parsing
    try {
      const lineFiles = this.parseFilesLineByLine(html, sectionName, fileType);
      if (lineFiles.length > 0) {
        console.log(`[Enhanced FileAPI] ✓ Line parsing found ${lineFiles.length} files`);
        return lineFiles;
      }
    } catch (error) {
      console.warn(`[Enhanced FileAPI] Line parsing failed:`, error.message);
    }

    console.warn(`[Enhanced FileAPI] All parsing methods failed for ${sectionName}`);
    return [];
  }

  /**
   * Parse files using regex patterns
   */
  parseFilesWithRegex(html, sectionName, fileType) {
    const files = [];
    
    // Find the section
    const sectionPattern = new RegExp(`${sectionName}:?\\s*</legend>([\\s\\S]*?)(?=<legend|$)`, 'i');
    const sectionMatch = html.match(sectionPattern);
    
    if (!sectionMatch) {
      throw new Error(`Section "${sectionName}" not found in HTML`);
    }

    const sectionContent = sectionMatch[1];
    
    // Parse table rows
    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const rows = sectionContent.match(rowPattern) || [];
    
    for (const row of rows) {
      try {
        const file = this.parseFileRow(row, fileType);
        if (file) {
          files.push(file);
        }
      } catch (error) {
        console.debug(`[Enhanced FileAPI] Failed to parse row:`, error.message);
      }
    }

    return files;
  }

  /**
   * Parse files using DOM
   */
  async parseFilesWithDOM(html, sectionName, fileType) {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const files = [];

    // Find the legend for this section
    const legends = document.querySelectorAll('legend');
    let targetTable = null;

    for (const legend of legends) {
      if (legend.textContent.includes(sectionName)) {
        // Find the table after this legend
        let sibling = legend.parentElement.nextElementSibling;
        while (sibling) {
          if (sibling.tagName === 'TABLE') {
            targetTable = sibling;
            break;
          }
          sibling = sibling.nextElementSibling;
        }
        break;
      }
    }

    if (!targetTable) {
      throw new Error(`Table for section "${sectionName}" not found`);
    }

    // Parse table rows
    const rows = targetTable.querySelectorAll('tr');
    
    for (const row of rows) {
      try {
        const file = this.parseFileRowDOM(row, fileType);
        if (file) {
          files.push(file);
        }
      } catch (error) {
        console.debug(`[Enhanced FileAPI] Failed to parse DOM row:`, error.message);
      }
    }

    return files;
  }

  /**
   * Parse files line by line
   */
  parseFilesLineByLine(html, sectionName, fileType) {
    const files = [];
    const lines = html.split('\n');
    let inSection = false;
    let inTable = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if we're entering the target section
      if (line.includes(sectionName) && line.includes('legend')) {
        inSection = true;
        continue;
      }
      
      // Check if we're entering a table
      if (inSection && line.includes('<table')) {
        inTable = true;
        continue;
      }
      
      // Check if we're leaving the section
      if (inSection && line.includes('</fieldset>')) {
        break;
      }
      
      // Parse table rows
      if (inSection && inTable && line.includes('<tr') && !line.includes('<th')) {
        try {
          // Collect the full row (might span multiple lines)
          let fullRow = line;
          let j = i + 1;
          while (j < lines.length && !lines[j].includes('</tr>')) {
            fullRow += lines[j];
            j++;
          }
          if (j < lines.length) {
            fullRow += lines[j];
            i = j; // Skip ahead
          }
          
          const file = this.parseFileRow(fullRow, fileType);
          if (file) {
            files.push(file);
          }
        } catch (error) {
          console.debug(`[Enhanced FileAPI] Failed to parse line row:`, error.message);
        }
      }
    }

    return files;
  }

  /**
   * Parse individual file row from HTML
   */
  parseFileRow(rowHtml, fileType) {
    // Extract file ID
    const idMatch = rowHtml.match(/\/file_dbs\/\d+\/[^\/]+\/(\d+)/);
    if (!idMatch) return null;
    
    const fileId = idMatch[1];
    
    // Extract file name
    const nameMatch = rowHtml.match(/>([^<>]+\.csv)</) || rowHtml.match(/>([^<>]+\.[a-zA-Z0-9]+)</);
    if (!nameMatch) return null;
    
    const fileName = nameMatch[1].trim();
    
    // Extract config ID from URLs
    const configMatch = rowHtml.match(/\/file_dbs\/(\d+)\//);
    const configId = configMatch ? configMatch[1] : this.currentConfig?.dbId || '1';
    
    return {
      id: fileId,
      name: fileName,
      type: fileType,
      configId: configId,
      updateUrl: `/file_dbs/${configId}/${fileType}/${fileId}/edit`,
      exportUrl: `/file_dbs/${configId}/${fileType}/${fileId}/export`,
      deleteUrl: `/file_dbs/${configId}/${fileType}/${fileId}`
    };
  }

  /**
   * Parse individual file row from DOM element
   */
  parseFileRowDOM(row, fileType) {
    const cells = row.querySelectorAll('td');
    if (cells.length < 2) return null;
    
    // Find file link
    const links = row.querySelectorAll('a');
    for (const link of links) {
      const href = link.getAttribute('href');
      if (href && href.includes('/edit')) {
        const idMatch = href.match(/\/(\d+)\/edit$/);
        if (idMatch) {
          const fileId = idMatch[1];
          const fileName = link.textContent.trim();
          
          const configMatch = href.match(/\/file_dbs\/(\d+)\//);
          const configId = configMatch ? configMatch[1] : this.currentConfig?.dbId || '1';
          
          return {
            id: fileId,
            name: fileName,
            type: fileType,
            configId: configId,
            updateUrl: `/file_dbs/${configId}/${fileType}/${fileId}/edit`,
            exportUrl: `/file_dbs/${configId}/${fileType}/${fileId}/export`,
            deleteUrl: `/file_dbs/${configId}/${fileType}/${fileId}`
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Check if cache is valid
   */
  isCacheValid(timestamp) {
    return (Date.now() - timestamp) < this.cacheTimeout;
  }

  /**
   * Clear file cache
   */
  clearFileCache() {
    this.fileCache.clear();
    console.log(`[Enhanced FileAPI] File cache cleared`);
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      instanceId: this.instanceId,
      currentConfig: this.currentConfig,
      cacheSize: this.fileCache.size,
      isActive: this.currentConfig !== null
    };
  }
}

/**
 * Factory function to create enhanced file API instances
 */
export function createEnhancedProSBCFileAPI(instanceId) {
  return new EnhancedProSBCFileAPI(instanceId);
}

export default EnhancedProSBCFileAPI;
