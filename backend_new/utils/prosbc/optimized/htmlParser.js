// Optimized HTML parser for ProSBC file listings with better performance
import { JSDOM } from 'jsdom';

/**
 * Optimized HTML parser for ProSBC responses
 * Uses streaming, caching, and regex optimizations
 */
class OptimizedHTMLParser {
  constructor() {
    this.regexCache = new Map();
    this.sectionCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get cached regex pattern
   */
  getRegex(pattern, flags = 'g') {
    const key = `${pattern}:${flags}`;
    if (!this.regexCache.has(key)) {
      this.regexCache.set(key, new RegExp(pattern, flags));
    }
    return this.regexCache.get(key);
  }

  /**
   * Parse file table with optimized regex and chunking
   */
  parseFileTable(html, sectionTitle, fileType) {
    try {
      // Use cached result if available
      const cacheKey = `${sectionTitle}:${fileType}:${this.hashString(html.substring(0, 1000))}`;
      const cached = this.sectionCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.files;
      }

      const files = [];
      
      // Try efficient regex parsing first
      const regexFiles = this.parseWithRegex(html, sectionTitle, fileType);
      if (regexFiles.length > 0) {
        // Cache successful result
        this.sectionCache.set(cacheKey, {
          files: regexFiles,
          timestamp: Date.now()
        });
        return regexFiles;
      }

      // Fallback to DOM parsing for complex cases
      console.log(`[OptimizedHTMLParser] Regex parsing failed for ${sectionTitle}, using DOM fallback`);
      const domFiles = this.parseWithDOM(html, sectionTitle, fileType);
      
      // Cache result
      this.sectionCache.set(cacheKey, {
        files: domFiles,
        timestamp: Date.now()
      });
      
      return domFiles;

    } catch (error) {
      console.error(`[OptimizedHTMLParser] Error parsing ${sectionTitle}:`, error.message);
      return [];
    }
  }

  /**
   * Fast regex-based parsing
   */
  parseWithRegex(html, sectionTitle, fileType) {
    const files = [];
    
    // Find the section content efficiently
    const sectionRegex = this.getRegex(
      `<h3[^>]*>${this.escapeRegex(sectionTitle)}</h3>([\\s\\S]*?)(?=<h3|<div class="actions"|$)`,
      'i'
    );
    
    const sectionMatch = sectionRegex.exec(html);
    if (!sectionMatch) {
      return files;
    }
    
    const sectionContent = sectionMatch[1];
    
    // Optimized row parsing regex
    const rowRegex = this.getRegex(
      `<tr>\\s*<td>([^<]+)</td>\\s*` +
      `<td><a href="/file_dbs/(\\d+)/${fileType}/(\\d+)/edit"[^>]*>Update</a></td>\\s*` +
      `<td><a href="/file_dbs/\\d+/${fileType}/(\\d+)/export"[^>]*>Export</a></td>\\s*` +
      `<td><a href="/file_dbs/\\d+/${fileType}/(\\d+)"[^>]*onclick[^>]*>Delete</a></td>\\s*` +
      `</tr>`
    );

    let match;
    while ((match = rowRegex.exec(sectionContent)) !== null) {
      const [, fileName, dbId, updateId, exportId, deleteId] = match;
      
      files.push({
        id: updateId,
        name: fileName.trim(),
        type: fileType,
        configId: dbId,
        updateUrl: `/file_dbs/${dbId}/${fileType}/${updateId}/edit`,
        exportUrl: `/file_dbs/${dbId}/${fileType}/${exportId}/export`,
        deleteUrl: `/file_dbs/${dbId}/${fileType}/${deleteId}`
      });
    }
    
    return files;
  }

  /**
   * DOM-based parsing fallback
   */
  parseWithDOM(html, sectionTitle, fileType) {
    const files = [];
    
    try {
      // Use JSDOM with minimal options for performance
      const dom = new JSDOM(html, {
        contentType: 'text/html',
        includeNodeLocations: false,
        storageQuota: 10000000
      });
      
      const document = dom.window.document;
      
      // Find section by title
      const headings = document.querySelectorAll('h3');
      let targetSection = null;
      
      for (const heading of headings) {
        if (heading.textContent.trim() === sectionTitle) {
          targetSection = heading.nextElementSibling;
          break;
        }
      }
      
      if (!targetSection) {
        return files;
      }

      // Find table rows in the section
      const rows = targetSection.querySelectorAll('tr');
      
      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 4) {
          const fileName = cells[0]?.textContent?.trim();
          const updateLink = cells[1]?.querySelector('a[href*="/edit"]');
          const exportLink = cells[2]?.querySelector('a[href*="/export"]');
          const deleteLink = cells[3]?.querySelector('a[href*="onclick"]');
          
          if (fileName && updateLink) {
            // Extract IDs from URLs
            const updateMatch = updateLink.href.match(/\/file_dbs\/(\d+)\/[^\/]+\/(\d+)\/edit/);
            const exportMatch = exportLink?.href.match(/\/file_dbs\/\d+\/[^\/]+\/(\d+)\/export/);
            const deleteMatch = deleteLink?.href.match(/\/file_dbs\/\d+\/[^\/]+\/(\d+)/);
            
            if (updateMatch) {
              const [, dbId, updateId] = updateMatch;
              const exportId = exportMatch?.[1] || updateId;
              const deleteId = deleteMatch?.[1] || updateId;
              
              files.push({
                id: updateId,
                name: fileName,
                type: fileType,
                configId: dbId,
                updateUrl: `/file_dbs/${dbId}/${fileType}/${updateId}/edit`,
                exportUrl: `/file_dbs/${dbId}/${fileType}/${exportId}/export`,
                deleteUrl: `/file_dbs/${dbId}/${fileType}/${deleteId}`
              });
            }
          }
        }
      }
      
      // Clean up DOM
      dom.window.close();
      
    } catch (error) {
      console.error('[OptimizedHTMLParser] DOM parsing error:', error.message);
    }
    
    return files;
  }

  /**
   * Parse configuration selection page
   */
  parseConfigSelection(html) {
    try {
      // Try regex first for performance
      const configs = [];
      
      const optionRegex = this.getRegex(
        `<option value="(\\d+)"[^>]*>([^<]+)</option>`
      );
      
      let match;
      while ((match = optionRegex.exec(html)) !== null) {
        const [, id, name] = match;
        configs.push({
          id: id.trim(),
          name: name.trim()
        });
      }
      
      if (configs.length > 0) {
        return configs;
      }
      
      // Fallback to DOM parsing
      const dom = new JSDOM(html, { contentType: 'text/html' });
      const options = dom.window.document.querySelectorAll('option[value]');
      
      for (const option of options) {
        const id = option.getAttribute('value');
        const name = option.textContent?.trim();
        
        if (id && name && id !== '' && name !== '') {
          configs.push({ id, name });
        }
      }
      
      dom.window.close();
      return configs;
      
    } catch (error) {
      console.error('[OptimizedHTMLParser] Config parsing error:', error.message);
      return [];
    }
  }

  /**
   * Parse NAP table efficiently
   */
  parseNAPTable(html) {
    try {
      const naps = [];
      
      // Optimized NAP row regex
      const napRegex = this.getRegex(
        `<tr[^>]*>\\s*<td[^>]*>(\\d+)</td>\\s*<td[^>]*>([^<]*)</td>\\s*<td[^>]*>([^<]*)</td>\\s*<td[^>]*>([^<]*)</td>\\s*<td[^>]*>([^<]*)</td>\\s*<td[^>]*>.*?href="[^"]*/(\\d+)/edit"[^>]*>.*?</tr>`,
        'g'
      );
      
      let match;
      while ((match = napRegex.exec(html)) !== null) {
        const [, id, name, description, carrier, location, editId] = match;
        
        naps.push({
          id: editId || id,
          name: name?.trim() || '',
          description: description?.trim() || '',
          carrier: carrier?.trim() || '',
          location: location?.trim() || '',
          rawId: id
        });
      }
      
      return naps;
      
    } catch (error) {
      console.error('[OptimizedHTMLParser] NAP parsing error:', error.message);
      return [];
    }
  }

  /**
   * Escape regex special characters
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Simple hash function for caching
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.sectionCache.clear();
    console.log('[OptimizedHTMLParser] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      regexCacheSize: this.regexCache.size,
      sectionCacheSize: this.sectionCache.size,
      cacheTimeout: this.cacheTimeout
    };
  }
}

// Global parser instance
export const htmlParser = new OptimizedHTMLParser();

export default htmlParser;
