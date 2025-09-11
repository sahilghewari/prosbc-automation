// Hyper-optimized ProSBC File API - MINIMAL endpoint calls after switching
import { hyperOptimizedSwitcher } from './hyperOptimizedSwitcher.js';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

/**
 * Hyper-optimized ProSBC File API that minimizes endpoint calls to absolute minimum
 * 
 * STRATEGY:
 * - Switch once: Cached for 30 minutes
 * - File lists: Cached for 15 minutes with aggressive reuse
 * - Session reuse: No additional session calls after switch
 * - Direct file operations: Use cached session + config state
 * 
 * RESULT: After initial switch, most operations = 0-1 endpoint calls
 */
export class HyperOptimizedProSBCFileAPI {
  constructor(instanceId) {
    this.instanceId = instanceId;
    this.fileCache = new Map(); // Aggressive file list caching
    this.htmlCache = new Map(); // Cache raw HTML to avoid re-fetching
    this.cacheTimeout = 15 * 60 * 1000; // 15 minutes for file lists
    this.htmlCacheTimeout = 30 * 60 * 1000; // 30 minutes for HTML
    this.callCounter = 0;
  }

  /**
   * Switch instance with hyper optimization
   */
  async switchInstance(configId = null) {
    console.log(`[HyperOptimized FileAPI] Switching ${this.instanceId} to config: ${configId || 'auto'}`);
    this.callCounter = 0;
    
    const result = await hyperOptimizedSwitcher.switchInstance(this.instanceId, configId);
    this.callCounter += result.apiCallsUsed;
    
    console.log(`[HyperOptimized FileAPI] Switch completed with ${result.apiCallsUsed} endpoint calls`);
    return result;
  }

  /**
   * Get DF files with hyper optimization
   */
  async getDFFiles(configId = null) {
    return this.getFileListHyperOptimized('routesets_definitions', 'Routesets Definition', configId);
  }

  /**
   * Get DM files with hyper optimization
   */
  async getDMFiles(configId = null) {
    return this.getFileListHyperOptimized('routesets_digitmaps', 'Routesets Digitmap', configId);
  }

  /**
   * Get file list with MAXIMUM optimization
   */
  async getFileListHyperOptimized(fileType, sectionName, configId = null) {
    console.log(`[HyperOptimized FileAPI] Getting ${fileType} files`);
    const startTime = Date.now();
    this.callCounter = 0;

    try {
      // Step 1: Ensure we have active state (0 endpoint calls if cached)
      const activeState = await this.ensureActiveState(configId);
      
      // Step 2: Check file cache (0 endpoint calls)
      const cacheKey = `${this.instanceId}:${activeState.selectedConfig.id}:${fileType}`;
      const cached = this.fileCache.get(cacheKey);
      
      if (cached && this.isCacheValid(cached.timestamp)) {
        console.log(`[HyperOptimized FileAPI] ✓ Using cached ${fileType} files (${cached.files.length} files) - 0 endpoint calls`);
        return cached.files;
      }

      // Step 3: Check HTML cache (0 endpoint calls if cached)
      const htmlCacheKey = `${this.instanceId}:${activeState.selectedConfig.dbId}:html`;
      let html = null;
      const cachedHtml = this.htmlCache.get(htmlCacheKey);
      
      if (cachedHtml && this.isHtmlCacheValid(cachedHtml.timestamp)) {
        console.log(`[HyperOptimized FileAPI] ✓ Using cached HTML - 0 endpoint calls`);
        html = cachedHtml.content;
      } else {
        // Step 4: Fetch HTML only if needed (1 endpoint call)
        console.log(`[HyperOptimized FileAPI] Fetching file database HTML...`);
        html = await this.fetchFileDatabase(activeState);
        this.callCounter++;
        
        // Cache the HTML for reuse
        this.htmlCache.set(htmlCacheKey, {
          content: html,
          timestamp: Date.now()
        });
      }

      // Step 5: Parse files (0 endpoint calls)
      const files = await this.parseFilesOptimized(html, sectionName, fileType, activeState.selectedConfig.dbId);
      
      // Step 6: Cache files (0 endpoint calls)
      this.fileCache.set(cacheKey, {
        files,
        timestamp: Date.now()
      });

      const endTime = Date.now();
      console.log(`[HyperOptimized FileAPI] ✓ Retrieved ${files.length} ${fileType} files in ${endTime - startTime}ms with ${this.callCounter} endpoint calls`);
      
      return files;

    } catch (error) {
      console.error(`[HyperOptimized FileAPI] Failed to get ${fileType} files:`, error.message);
      
      // Clear only the specific cache that failed
      this.invalidateFileCache(configId, fileType);
      
      throw new Error(`Failed to get ${fileType} files: ${error.message}`);
    }
  }

  /**
   * Ensure we have active state with minimal calls
   */
  async ensureActiveState(configId = null) {
    const activeState = hyperOptimizedSwitcher.getActiveState();
    
    // If we have active state and it matches what we need
    if (activeState && 
        activeState.instanceId === this.instanceId &&
        (!configId || activeState.configId === configId)) {
      return activeState;
    }

    // Need to switch - this may be 0-2 endpoint calls depending on cache
    const switchResult = await this.switchInstance(configId);
    return {
      instanceId: switchResult.instanceId,
      selectedConfig: switchResult.selectedConfig,
      sessionCookie: switchResult.sessionCookie,
      baseUrl: switchResult.baseUrl
    };
  }

  /**
   * Fetch file database with session reuse
   */
  async fetchFileDatabase(activeState) {
    const url = `${activeState.baseUrl}/file_dbs/${activeState.selectedConfig.dbId}/edit`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Cookie': activeState.sessionCookie,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    
    // Quick validation
    if (html.includes('Configuration Management') || html.includes('choose_redirect')) {
      throw new Error('Got configuration page - config selection may have expired');
    }

    console.log(`[HyperOptimized FileAPI] ✓ Fetched file database (${html.length} bytes)`);
    return html;
  }

  /**
   * Optimized file parsing with caching
   */
  async parseFilesOptimized(html, sectionName, fileType, configId) {
    console.log(`[HyperOptimized FileAPI] Parsing ${sectionName} files...`);
    
    // Use the fastest method first
    try {
      const files = this.parseWithRegexOptimized(html, sectionName, fileType, configId);
      if (files.length > 0) {
        return files;
      }
    } catch (error) {
      console.warn(`[HyperOptimized FileAPI] Regex parsing failed, trying DOM...`);
    }

    // Fallback to DOM parsing
    try {
      const files = this.parseWithDOMOptimized(html, sectionName, fileType, configId);
      return files;
    } catch (error) {
      console.warn(`[HyperOptimized FileAPI] DOM parsing failed:`, error.message);
      return [];
    }
  }

  /**
   * Optimized regex parsing
   */
  parseWithRegexOptimized(html, sectionName, fileType, configId) {
    const files = [];
    
    // Find section with flexible matching
    const sectionPattern = new RegExp(`${sectionName.replace(/\s+/g, '\\s*')}:?\\s*</legend>([\\s\\S]*?)(?=<legend|</fieldset|$)`, 'i');
    const sectionMatch = html.match(sectionPattern);
    
    if (!sectionMatch) {
      throw new Error(`Section "${sectionName}" not found`);
    }

    // Extract file URLs and names efficiently
    const filePattern = new RegExp(`/file_dbs/${configId}/${fileType}/(\\d+)(/edit)?[^>]*>([^<]+\\.(csv|txt|dat))<`, 'gi');
    let match;
    
    while ((match = filePattern.exec(sectionMatch[1])) !== null) {
      const fileId = match[1];
      const fileName = match[3].trim();
      
      files.push({
        id: fileId,
        name: fileName,
        type: fileType,
        configId: configId,
        updateUrl: `/file_dbs/${configId}/${fileType}/${fileId}/edit`,
        exportUrl: `/file_dbs/${configId}/${fileType}/${fileId}/export`,
        deleteUrl: `/file_dbs/${configId}/${fileType}/${fileId}`
      });
    }

    return files;
  }

  /**
   * Optimized DOM parsing
   */
  parseWithDOMOptimized(html, sectionName, fileType, configId) {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const files = [];

    // Find the section
    const legends = document.querySelectorAll('legend');
    let targetSection = null;

    for (const legend of legends) {
      if (legend.textContent.includes(sectionName)) {
        targetSection = legend.parentElement;
        break;
      }
    }

    if (!targetSection) {
      throw new Error(`Section "${sectionName}" not found in DOM`);
    }

    // Find all file links in this section
    const links = targetSection.querySelectorAll('a[href*="/edit"]');
    
    for (const link of links) {
      const href = link.getAttribute('href');
      const idMatch = href.match(new RegExp(`/file_dbs/${configId}/${fileType}/(\\d+)/edit`));
      
      if (idMatch) {
        const fileId = idMatch[1];
        const fileName = link.textContent.trim();
        
        files.push({
          id: fileId,
          name: fileName,
          type: fileType,
          configId: configId,
          updateUrl: `/file_dbs/${configId}/${fileType}/${fileId}/edit`,
          exportUrl: `/file_dbs/${configId}/${fileType}/${fileId}/export`,
          deleteUrl: `/file_dbs/${configId}/${fileType}/${fileId}`
        });
      }
    }

    return files;
  }

  /**
   * Check if cache is valid
   */
  isCacheValid(timestamp) {
    return (Date.now() - timestamp) < this.cacheTimeout;
  }

  /**
   * Check if HTML cache is valid (longer timeout)
   */
  isHtmlCacheValid(timestamp) {
    return (Date.now() - timestamp) < this.htmlCacheTimeout;
  }

  /**
   * Invalidate specific cache
   */
  invalidateFileCache(configId = null, fileType = null) {
    if (configId && fileType) {
      const cacheKey = `${this.instanceId}:${configId}:${fileType}`;
      this.fileCache.delete(cacheKey);
    } else {
      // Clear all cache for this instance
      for (const key of this.fileCache.keys()) {
        if (key.startsWith(`${this.instanceId}:`)) {
          this.fileCache.delete(key);
        }
      }
      
      for (const key of this.htmlCache.keys()) {
        if (key.startsWith(`${this.instanceId}:`)) {
          this.htmlCache.delete(key);
        }
      }
    }
    
    console.log(`[HyperOptimized FileAPI] Cache invalidated for ${this.instanceId}:${configId || 'all'}:${fileType || 'all'}`);
  }

  /**
   * Clear all cache
   */
  clearAllCache() {
    this.fileCache.clear();
    this.htmlCache.clear();
    console.log(`[HyperOptimized FileAPI] All cache cleared for ${this.instanceId}`);
  }

  /**
   * Get status and statistics
   */
  getStatus() {
    const activeState = hyperOptimizedSwitcher.getActiveState();
    
    return {
      instanceId: this.instanceId,
      activeState: activeState ? {
        instance: activeState.instanceId,
        config: activeState.configName,
        age: Math.round((Date.now() - activeState.timestamp) / 1000)
      } : null,
      fileCacheSize: this.fileCache.size,
      htmlCacheSize: this.htmlCache.size,
      lastCallCounter: this.callCounter,
      isActive: activeState?.instanceId === this.instanceId
    };
  }

  /**
   * Prefetch files for better performance
   */
  async prefetchFiles(configId = null) {
    console.log(`[HyperOptimized FileAPI] Prefetching files for ${this.instanceId}:${configId || 'auto'}`);
    
    try {
      // This will cache both DF and DM files in one HTML fetch
      const [dfFiles, dmFiles] = await Promise.all([
        this.getDFFiles(configId),
        this.getDMFiles(configId)
      ]);
      
      console.log(`[HyperOptimized FileAPI] ✓ Prefetched ${dfFiles.length} DF files and ${dmFiles.length} DM files`);
      return { dfFiles, dmFiles };
    } catch (error) {
      console.error(`[HyperOptimized FileAPI] Prefetch failed:`, error.message);
      throw error;
    }
  }
}

/**
 * Factory function to create hyper-optimized file API instances
 */
export function createHyperOptimizedProSBCFileAPI(instanceId) {
  return new HyperOptimizedProSBCFileAPI(instanceId);
}

export default HyperOptimizedProSBCFileAPI;
