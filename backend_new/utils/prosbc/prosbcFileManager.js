// Backend ProSBC File API utilities
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { prosbcLogin } from './login.js';
import { selectConfiguration } from './prosbcConfigSelector.js';
import { fetchLiveConfigIds } from './prosbcConfigLiveFetcher.js';
import { getInstanceContext } from './multiInstanceManager.js';

// Session management variables
const sessionCookies = new Map();
const lastLoginTimes = new Map();
const SESSION_TTL_MS = 20 * 60 * 1000; // 20 minutes
const loginLocks = new Map();

// Helper function to validate if existing session is still active
async function validateSession(baseURL, sessionCookie) {
  try {
    const response = await fetch(`${baseURL}/`, {
      headers: {
        'Cookie': `_WebOAMP_session=${sessionCookie}`,
        'User-Agent': 'Mozilla/5.0 (compatible; ProSBC-Automation)'
      },
      timeout: 5000
    });
    
    // If we get a successful response or redirect (not auth error), session is valid
    return response.status !== 401 && response.status !== 403;
  } catch (error) {
    // If request fails, assume session is invalid
    return false;
  }
}

// Clear session cache for a specific instance or all instances
const clearSessionCache = (instanceId = null) => {
  if (instanceId) {
    const sessionKey = instanceId || 'default';
    sessionCookies.delete(sessionKey);
    lastLoginTimes.delete(sessionKey);
    loginLocks.delete(sessionKey);
    console.log(`[ProSBC FileAPI] Cleared session cache for instance: ${sessionKey}`);
  } else {
    sessionCookies.clear();
    lastLoginTimes.clear();
    loginLocks.clear();
    console.log('[ProSBC FileAPI] Cleared all session caches');
  }
};

class ProSBCFileAPI {
  constructor(instanceId = null) {
    // Support both old env-based and new instance-based initialization
    if (instanceId) {
      this.instanceId = instanceId;
      this.instanceContext = null; // Will be loaded on first use
      this.baseURL = null; // Will be set from instance context
    } else {
      // Fallback to environment variables for backward compatibility
      this.baseURL = process.env.PROSBC_BASE_URL;
      this.instanceId = null;
      this.instanceContext = null;
    }
    this.sessionCookies = null;
    this.selectedConfigId = null;
    this.configs = null;
    this.configSelectionDone = false;
    
    // Hardcoded config mappings for ProSBC1 to avoid HTML parsing issues
    // Each mapping includes:
    // - id: configuration ID (used for /configurations/{id}/choose_redirect)
    // - dbId: database ID (used for /file_dbs/{dbId}/edit after redirect)
    // - name: configuration name
    this.prosbc1ConfigMappings = {
      'config_052421-1': { id: '2', dbId: '2', name: 'config_052421-1' },
      'config_060620221': { id: '3', dbId: '3', name: 'config_060620221' },
      'config_1': { id: '1', dbId: '1', name: 'config_1' },
      'config_1-BU': { id: '5', dbId: '3', name: 'config_1-BU' }, // Config 5 maps to database 3
      'config_301122-1': { id: '4', dbId: '4', name: 'config_301122-1' },
      'config_demo': { id: '6', dbId: '6', name: 'config_demo' },
      'config_090325-1': { id: '7', dbId: '7', name: 'config_090325-1' },
      // Also support lookup by ID
      '1': { id: '1', dbId: '1', name: 'config_1' },
      '2': { id: '2', dbId: '2', name: 'config_052421-1' },
      '3': { id: '3', dbId: '3', name: 'config_060620221' },
      '4': { id: '4', dbId: '4', name: 'config_301122-1' },
      '5': { id: '5', dbId: '3', name: 'config_1-BU' }, // Config 5 maps to database 3
      '6': { id: '6', dbId: '6', name: 'config_demo' },
      '7': { id: '7', dbId: '7', name: 'config_090325-1' }
    };
  }

  // Load instance context and credentials
  async loadInstanceContext() {
    if (this.instanceContext) return this.instanceContext;
    
    if (this.instanceId) {
      this.instanceContext = await getInstanceContext(this.instanceId);
      this.baseURL = this.instanceContext.baseUrl;
      console.log(`[ProSBC FileAPI] Loaded context for instance: ${this.instanceContext.name} (${this.baseURL})`);
    } else {
      // Use environment variables as fallback
      this.instanceContext = {
        baseUrl: process.env.PROSBC_BASE_URL,
        username: process.env.PROSBC_USERNAME,
        password: process.env.PROSBC_PASSWORD,
        name: 'Environment-based',
        id: 'env'
      };
      this.baseURL = this.instanceContext.baseUrl;
      console.log(`[ProSBC FileAPI] Using environment-based configuration: ${this.baseURL}`);
    }
    
    return this.instanceContext;
  }

  getBasicAuthHeader() {
    // Use instance context if available, fallback to environment
    if (this.instanceContext) {
      const credentials = Buffer.from(`${this.instanceContext.username}:${this.instanceContext.password}`).toString('base64');
      return `Basic ${credentials}`;
    } else {
      const username = process.env.PROSBC_USERNAME;
      const password = process.env.PROSBC_PASSWORD;
      const credentials = Buffer.from(`${username}:${password}`).toString('base64');
      return `Basic ${credentials}`;
    }
  }

  async getSessionCookie() {
    // Ensure instance context is loaded
    await this.loadInstanceContext();
    
    const sessionKey = this.instanceId || 'default';
    let sessionCookie = sessionCookies.get(sessionKey);
    let lastLoginTime = lastLoginTimes.get(sessionKey) || 0;
    
    // Check if login is already in progress for this instance
    if (loginLocks.get(sessionKey)) {
      console.log(`[ProSBC FileAPI] Login already in progress for ${sessionKey}, waiting...`);
      // Wait for existing login to complete
      while (loginLocks.get(sessionKey)) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      // Re-check session after waiting
      sessionCookie = sessionCookies.get(sessionKey);
      lastLoginTime = lastLoginTimes.get(sessionKey) || 0;
    }
    
    // Refresh session if expired or not set
    if (!sessionCookie || (Date.now() - lastLoginTime > SESSION_TTL_MS)) {
      // If we have a session cookie but it's within TTL, validate it first
      if (sessionCookie && (Date.now() - lastLoginTime <= SESSION_TTL_MS)) {
        console.log(`[ProSBC FileAPI] Validating existing session for ${sessionKey}...`);
        const isValid = await validateSession(this.baseURL, sessionCookie);
        if (isValid) {
          console.log(`[ProSBC FileAPI] Session still valid for ${sessionKey}, reusing...`);
          // Update last login time to extend TTL
          lastLoginTimes.set(sessionKey, Date.now());
        } else {
          console.log(`[ProSBC FileAPI] Session expired for ${sessionKey}, will login...`);
          sessionCookie = null; // Force login
        }
      }
      
      // Proceed with login if session is invalid or expired
      if (!sessionCookie) {
        // Acquire login lock
        if (loginLocks.get(sessionKey)) {
          console.log(`[ProSBC FileAPI] Another login is already in progress for ${sessionKey}, waiting...`);
          // Wait for existing login to complete
          while (loginLocks.get(sessionKey)) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          // Re-check session after waiting
          sessionCookie = sessionCookies.get(sessionKey);
          lastLoginTime = lastLoginTimes.get(sessionKey) || 0;
        }
        
        // Double-check after acquiring lock
        if (!sessionCookie || (Date.now() - lastLoginTime > SESSION_TTL_MS)) {
          loginLocks.set(sessionKey, true);
          try {
            console.log(`[ProSBC FileAPI] Logging in to ProSBC instance: ${sessionKey}...`);
            sessionCookie = await prosbcLogin(this.baseURL, this.instanceContext.username, this.instanceContext.password);
            sessionCookies.set(sessionKey, sessionCookie);
            lastLoginTimes.set(sessionKey, Date.now());
            console.log(`[ProSBC FileAPI] Obtained ProSBC session cookie for: ${sessionKey}`);
          } finally {
            // Release login lock
            loginLocks.delete(sessionKey);
          }
        } else {
          console.log(`[ProSBC FileAPI] Session refreshed by another request for ${sessionKey}`);
        }
      }
    }
    
    this.sessionCookie = sessionCookie;
    return sessionCookie;
  }

  // Helper to get configuration name for REST API
  async getConfigName(configId) {
    if (!configId) return null;
    
    // For ProSBC1, use hardcoded mappings
    if (this.instanceId && this.instanceId.toLowerCase() === 'prosbc1') {
      const mappedConfig = this.resolveProsbc1Config(configId);
      if (mappedConfig) {
        console.log(`[ProSBC1 Config Name] Using hardcoded mapping: '${configId}' → Name: ${mappedConfig.name}`);
        return mappedConfig.name;
      }
    }
    
    // Ensure we have fetched the live configs
    if (!this.configs) {
      const sessionCookie = await this.getSessionCookie();
      this.configs = await fetchLiveConfigIds(this.baseURL, sessionCookie);
    }
    
    // Try to find a config that matches the provided configId
    const matchingConfig = this.configs.find(cfg => {
      // Direct match by name or ID
      if (cfg.name === configId || cfg.id === configId) {
        return true;
      }
      // Try pattern matching for config names like "config_062425"
      if (cfg.name.toLowerCase().includes(configId.toLowerCase()) || 
          configId.toLowerCase().includes(cfg.name.toLowerCase())) {
        return true;
      }
      return false;
    });
    
    if (matchingConfig) {
      console.log(`[Config Name Mapping] Mapped '${configId}' to config name '${matchingConfig.name}'`);
      return matchingConfig.name;
    }
    
    // If no match found, try to use the configId as the config name directly
    console.warn(`[Config Name Mapping] Could not map '${configId}' to any ProSBC config, using as-is`);
    return configId;
  }

  // REST API-based delete method using file ID and standard ProSBC REST endpoints
  async deleteFileRestAPI(fileType, fileName, configId = null, fileId = null) {
    try {
      // Ensure instance context is loaded
      await this.loadInstanceContext();
      
      // Ensure config is selected and get the actual config ID (same logic as file listing)
      await this.ensureConfigSelected(configId);
      const dbId = this.selectedConfigId;
      
      // If we don't have fileId, we need to find it by looking up the file
      if (!fileId) {
        console.log(`[Delete REST API] Looking up file ID for: ${fileName}`);
        // Use the appropriate file listing method
        const files = fileType === 'routesets_definitions' ? 
          await this.listDfFiles(configId) : 
          await this.listDmFiles(configId);
        const file = files.files?.find(f => f.name === fileName);
        if (!file) {
          throw new Error(`File '${fileName}' not found in file listing`);
        }
        fileId = file.id;
        console.log(`[Delete REST API] Found file ID: ${fileId} for ${fileName}`);
      }
      
      // Use the same endpoint format as the web interface
      const endpoint = `/file_dbs/${dbId}/${fileType}/${fileId}`;
      const deleteUrl = `${this.baseURL}${endpoint}`;
      
      console.log(`[Delete REST API] Instance: ${this.instanceId}, File: ${fileName}, ID: ${fileId}, Type: ${fileType}, DB ID: ${dbId}`);
      console.log(`[Delete REST API] Deleting: ${deleteUrl}`);
      
      // Try REST API DELETE first
      const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          'Authorization': this.getBasicAuthHeader(),
          'User-Agent': 'Mozilla/5.0 (Node.js)',
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`[Delete REST API] Response status: ${response.status}`);
      
      if (response.ok) {
        console.log(`[Delete REST API] Successfully deleted: ${fileName}`);
        return { 
          success: true, 
          message: `File '${fileName}' deleted successfully`,
          status: response.status
        };
      } else {
        // If REST API DELETE doesn't work, fall back to form-based POST delete
        console.log(`[Delete REST API] DELETE method failed (${response.status}), trying form-based approach...`);
        return await this.deleteFileFormBased(fileType, fileId, fileName, configId);
      }
    } catch (error) {
      console.error('[Delete REST API] Error:', error);
      throw error;
    }
  }

  // Form-based delete using Basic Auth (no CSRF needed for REST API)
  async deleteFileFormBased(fileType, fileId, fileName, configId = null) {
    try {
      const dbId = configId ;
      const endpoint = `/file_dbs/${dbId}/${fileType}/${fileId}`;
      const deleteUrl = `${this.baseURL}${endpoint}`;
      
      console.log(`[Delete Form API] Trying form-based delete: ${deleteUrl}`);
      
      // Use form-based POST with _method=delete (common Rails pattern)
      const params = new URLSearchParams();
      params.append('_method', 'delete');
      
      const response = await fetch(deleteUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': this.getBasicAuthHeader(),
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Node.js)'
        },
        body: params.toString()
      });
      
      console.log(`[Delete Form API] Response status: ${response.status}`);
      
      if (response.ok || response.status === 302) {
        console.log(`[Delete Form API] Successfully deleted: ${fileName}`);
        return { 
          success: true, 
          message: `File '${fileName}' deleted successfully`,
          status: response.status
        };
      } else {
        const responseText = await response.text();
        console.error(`[Delete Form API] Delete failed:`, responseText.substring(0, 300));
        
        if (response.status === 404) {
          throw new Error(`File '${fileName}' not found`);
        } else if (response.status === 401) {
          throw new Error('Authentication failed');
        } else {
          throw new Error(`Delete failed: ${response.status} - ${responseText.substring(0, 200)}`);
        }
      }
    } catch (error) {
      console.error('[Delete Form API] Error:', error);
      throw error;
    }
  }

  // REST API-based update method using PUT with file content
  async updateFileRestAPI(fileType, fileName, fileContent, configId = null) {
    try {
      // Ensure instance context is loaded
      await this.loadInstanceContext();
      
      // Ensure config is selected and get the actual config ID (same logic as file listing)
      await this.ensureConfigSelected(configId);
      let dbId = this.selectedConfigId ;
      
      // Find which database ID actually contains the file and get the file details
      let actualDbId = null;
      let fileDetails = null;
      
      // Try all possible database IDs more thoroughly
      // For ProSBC1 with many configs, check more database IDs
      const dbIdsToSearch = (this.instanceId && this.instanceId.toLowerCase() === 'prosbc1') ? 
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] : 
        ['1', '2', '3', '4', '5'];
      
      console.log(`[Update REST API] Instance ${this.instanceId}: Searching for '${fileName}' across ${dbIdsToSearch.length} database IDs...`);
      
      for (const testDbId of dbIdsToSearch) {
        try {
          console.log(`[Update REST API] Searching for '${fileName}' in DB ID ${testDbId}...`);
          const testResponse = await fetch(`${this.baseURL}/file_dbs/${testDbId}/edit`, {
            method: 'GET',
            headers: await this.getCommonHeaders()
          });
          
          if (testResponse.ok) {
            const testHtml = await testResponse.text();
            
            // Check if this response contains any content
            if (testHtml.length < 1000) {
              console.log(`[Update REST API] DB ID ${testDbId} appears to be empty (too short)`);
              continue;
            }
            
            const sectionTitle = fileType === 'routesets_definitions' ? 'Routesets Definition' : 'Routesets Digitmap';
            const testFiles = this.parseFileTable(testHtml, sectionTitle, fileType);
            console.log(`[Update REST API] DB ID ${testDbId} contains ${testFiles.length} ${fileType} files`);
            
            if (testFiles.length > 0) {
              console.log(`[Update REST API] DB ID ${testDbId} file names:`, testFiles.map(f => f.name).slice(0, 5));
            }
            
            const foundFile = testFiles.find(f => f.name === fileName);
            if (foundFile) {
              actualDbId = testDbId;
              fileDetails = foundFile;
              console.log(`[Update REST API] ✓ Found '${fileName}' in DB ID ${testDbId} with file ID: ${foundFile.id}`);
              break;
            }
          } else {
            console.log(`[Update REST API] DB ID ${testDbId} returned status: ${testResponse.status}`);
          }
        } catch (err) {
          console.log(`[Update REST API] Error checking DB ID ${testDbId}:`, err.message);
        }
      }
      
      if (actualDbId && fileDetails) {
        dbId = actualDbId;
        console.log(`[Update REST API] ✓ Using DB ID ${dbId} where file was found`);
      } else {
        // Let's also try to search by listing files with the correct API
        console.log(`[Update REST API] File not found via direct search, trying file listing APIs...`);
        try {
          const files = fileType === 'routesets_definitions' ? 
            await this.listDfFiles(configId) : 
            await this.listDmFiles(configId);
          
          console.log(`[Update REST API] File listing API returned ${files.files?.length || 0} files`);
          const foundFile = files.files?.find(f => f.name === fileName);
          if (foundFile) {
            fileDetails = foundFile;
            dbId = foundFile.configId;
            console.log(`[Update REST API] ✓ Found '${fileName}' via file listing API in DB ID ${dbId} with file ID: ${foundFile.id}`);
          } else {
            throw new Error(`File '${fileName}' not found in any database ID or file listing API`);
          }
        } catch (apiError) {
          console.error(`[Update REST API] File listing API error:`, apiError.message);
          throw new Error(`File '${fileName}' not found in any database ID`);
        }
      }
      
      // Get configuration name for REST API
      const configName = await this.getConfigName(configId);
      if (!configName) {
        throw new Error('Could not determine configuration name for REST API');
      }
      
      // Use the file ID instead of file name in the REST API endpoint
      let endpoint;
      if (fileType === 'routesets_digitmaps' || fileType === 'dm') {
        endpoint = `/configurations/${configName}/file_dbs/${dbId}/routesets_digitmaps/${fileDetails.id}`;
      } else if (fileType === 'routesets_definitions' || fileType === 'df') {
        endpoint = `/configurations/${configName}/file_dbs/${dbId}/routesets_definitions/${fileDetails.id}`;
      } else {
        throw new Error(`Unsupported file type: ${fileType}`);
      }
      
      const updateUrl = `${this.baseURL}${endpoint}`;
      console.log(`[Update REST API] Instance: ${this.instanceId}, Config: ${configName}, DB ID: ${dbId}, File ID: ${fileDetails.id}, Endpoint: ${endpoint}`);
      console.log(`[Update REST API] Updating: ${updateUrl}`);
      
      // Prepare the REST API payload
      const payload = {
        name: fileName,
        content: fileContent,
        type: 'csv'
      };
      
      const response = await fetch(updateUrl, {
        method: 'PUT',
        headers: {
          'Accept': 'application/json',
          'Authorization': this.getBasicAuthHeader(),
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Node.js)'
        },
        body: JSON.stringify(payload)
      });
      
      console.log(`[Update REST API] Response status: ${response.status}`);
      const responseText = await response.text();
      console.log(`[Update REST API] Response body:`, responseText);
      
      if (response.ok) {
        console.log(`[Update REST API] REST API reports success, but let's verify the file was actually updated...`);
        
        // Wait a moment for the update to propagate
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify the update by fetching the file content to see if it changed
        try {
          const verifyResponse = await fetch(`${this.baseURL}/file_dbs/${dbId}/${fileType}/${fileDetails.id}/export`, {
            method: 'GET',
            headers: await this.getCommonHeaders()
          });
          if (verifyResponse.ok) {
            const updatedContent = await verifyResponse.text();
            const originalContentTrimmed = fileContent.trim();
            const updatedContentTrimmed = updatedContent.trim();
            
            // More robust content comparison
            if (updatedContentTrimmed === originalContentTrimmed) {
              console.log(`[Update REST API] ✓ Verification successful: File content matches what we sent`);
              return { 
                success: true, 
                message: `File '${fileName}' updated successfully via REST API`,
                status: response.status,
                verified: true
              };
            } else {
              console.warn(`[Update REST API] Verification failed: content mismatch, falling back to CSRF method`);
              
              // Try the CSRF-based update as fallback
              const fallbackResult = await this.updateFileCSRF(fileType, fileDetails.id, fileContent, fileName, dbId);
              if (fallbackResult.success) {
                return {
                  ...fallbackResult,
                  fallbackUsed: true,
                  message: `File '${fileName}' updated successfully using fallback method`
                };
              } else {
                return { 
                  success: false, 
                  message: `File '${fileName}' update verification failed and fallback also failed`,
                  verified: false
                };
              }
            }
          } else {
            console.warn(`[Update REST API] Could not verify update (export failed: ${verifyResponse.status}), assuming success`);
            return { 
              success: true, 
              message: `File '${fileName}' updated successfully via REST API (unverified)`,
              status: response.status,
              verified: null
            };
          }
        } catch (verifyError) {
          console.warn(`[Update REST API] Verification error:`, verifyError.message);
          return { 
            success: true, 
            message: `File '${fileName}' updated successfully via REST API (verification failed)`,
            status: response.status,
            verified: null
          };
        }
      } else {
        const responseText = await response.text();
        console.error(`[Update REST API] Update failed:`, responseText.substring(0, 300));
        
        if (response.status === 404) {
          throw new Error(`File '${fileName}' not found`);
        } else if (response.status === 401) {
          throw new Error('Authentication failed');
        } else {
          throw new Error(`Update failed: ${response.status} - ${responseText.substring(0, 200)}`);
        }
      }
    } catch (error) {
      console.error('[Update REST API] Error:', error);
      throw error;
    }
  }

  // CSRF-based update method as fallback when REST API doesn't work
  async updateFileCSRF(fileType, fileId, fileContent, fileName, dbId) {
    try {
      console.log(`[Update CSRF] Attempting CSRF-based update for file ID: ${fileId}, DB ID: ${dbId}`);
      
      // Create a temporary file with the content
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const tempFilePath = path.join(tempDir, `temp_${Date.now()}_${fileName}`);
      fs.writeFileSync(tempFilePath, fileContent);
      
      try {
        // Use the existing updateFile method which uses CSRF
        const result = await this.updateFile(fileType, fileId, tempFilePath, null, dbId);
        console.log(`[Update CSRF] CSRF update result:`, result);
        return result;
      } finally {
        // Clean up temp file
        try {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        } catch (cleanupError) {
          console.warn(`[Update CSRF] Could not clean up temp file:`, cleanupError.message);
        }
      }
    } catch (error) {
      console.error('[Update CSRF] Error:', error);
      throw error;
    }
  }

  // Helper method to extract the actual database ID from the file database page
  extractDatabaseIdFromHtml(html) {
    // Look for file_dbs/{id}/ patterns in the HTML to determine the actual database ID being used
    const patterns = [
      /\/file_dbs\/(\d+)\/routesets_definitions\/new/,
      /\/file_dbs\/(\d+)\/routesets_digitmaps\/new/,
      /\/file_dbs\/(\d+)\/[^\/]+\/\d+\/edit/,
      /href="\/file_dbs\/(\d+)\//
    ];
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        const dbId = match[1];
        console.log(`[Database ID Extraction] Found database ID: ${dbId} from pattern: ${pattern.source}`);
        return dbId;
      }
    }
    
    console.warn(`[Database ID Extraction] Could not extract database ID from HTML`);
    return null;
  }
  // Helper method specifically for ProSBC1 to resolve config using hardcoded mappings
  resolveProsbc1Config(configId) {
    if (!this.instanceId || this.instanceId.toLowerCase() !== 'prosbc1') {
      return null; // Only works for ProSBC1
    }
    
    if (!configId) {
      // Return default config if none specified
      return this.prosbc1ConfigMappings['config_1'];
    }
    
    // Convert to string for consistent lookup
    const configKey = configId.toString();
    
    // Direct lookup in hardcoded mappings
    const mappedConfig = this.prosbc1ConfigMappings[configKey];
    if (mappedConfig) {
      console.log(`[ProSBC1 Config] Mapped '${configId}' to ID: ${mappedConfig.id}, Name: ${mappedConfig.name}`);
      return mappedConfig;
    }
    
    // Try partial name matching for flexibility
    for (const [key, config] of Object.entries(this.prosbc1ConfigMappings)) {
      if (key.toLowerCase().includes(configKey.toLowerCase()) || 
          configKey.toLowerCase().includes(key.toLowerCase())) {
        console.log(`[ProSBC1 Config] Partial match '${configId}' to ID: ${config.id}, Name: ${config.name}`);
        return config;
      }
    }
    
    console.warn(`[ProSBC1 Config] No mapping found for '${configId}', available configs:`, 
      Object.keys(this.prosbc1ConfigMappings).filter(k => k.startsWith('config_')));
    
    // Fallback to config_1 as default
    return this.prosbc1ConfigMappings['config_1'];
  }

  async getNumericConfigId(configId) {
    if (!configId) return null;
    
    // For ProSBC1, use hardcoded mappings instead of HTML parsing
    if (this.instanceId && this.instanceId.toLowerCase() === 'prosbc1') {
      const mappedConfig = this.resolveProsbc1Config(configId);
      if (mappedConfig) {
        console.log(`[ProSBC1 Config] Using hardcoded mapping: '${configId}' → ID: ${mappedConfig.id}`);
        return mappedConfig.id;
      }
    }
    
    // If it's already numeric, return as is
    if (/^\d+$/.test(configId.toString())) {
      return configId.toString();
    }
    
    // For other instances, use the existing live config fetching logic
    if (!this.configs) {
      const sessionCookie = await this.getSessionCookie();
      this.configs = await fetchLiveConfigIds(this.baseURL, sessionCookie);
    }
    
    // Try to find a config that matches the provided configId
    const matchingConfig = this.configs.find(cfg => {
      // Direct match by name or ID
      if (cfg.name === configId || cfg.id === configId) {
        return true;
      }
      // Try pattern matching for config names like "config_062425"
      if (cfg.name.toLowerCase().includes(configId.toLowerCase()) || 
          configId.toLowerCase().includes(cfg.name.toLowerCase())) {
        return true;
      }
      return false;
    });
    
    if (matchingConfig) {
      console.log(`[Config Mapping] Mapped '${configId}' to ProSBC config ID '${matchingConfig.id}' (name: '${matchingConfig.name}')`);
      return matchingConfig.id;
    }
    
    // If no match found, log available configs for debugging
    console.warn(`[Config Mapping] Could not map '${configId}' to any ProSBC config.`);
    console.warn(`[Config Mapping] Available configs:`, this.configs.map(cfg => `${cfg.id}: ${cfg.name}`));
    
    // Return the original configId as fallback
    return configId;
  }

  // Fetch configs and select the active one (or a specific one if set)
  // Accepts configId (string/number) to override selection for this operation
  async ensureConfigSelected(configId = null) {
    // For ProSBC1, use hardcoded mappings and skip complex HTML parsing
    if (this.instanceId && this.instanceId.toLowerCase() === 'prosbc1') {
      const mappedConfig = this.resolveProsbc1Config(configId);
      if (mappedConfig) {
        // If we already have the same config selected, no need to reselect
        if (this.configSelectionDone && this.selectedConfigId === mappedConfig.dbId) {
          console.log(`[ProSBC1 Config] Config ${mappedConfig.id} (${mappedConfig.name}) already selected, using DB ID: ${mappedConfig.dbId}`);
          return;
        }
        
        console.log(`[ProSBC1 Config] Using hardcoded config: ID=${mappedConfig.id}, DB ID=${mappedConfig.dbId}, Name=${mappedConfig.name}`);
        
        // Ensure instance context is loaded
        await this.loadInstanceContext();
        const sessionCookie = await this.getSessionCookie();
        
        try {
          // Select the configuration using the hardcoded configuration ID
          await selectConfiguration(mappedConfig.id, this.baseURL, sessionCookie);

          // After configuration selection, verify that the expected file_dbs page returns file content
          const verifyUrl = `${this.baseURL}/file_dbs/${mappedConfig.dbId}/edit`;
          const verifyResp = await fetch(verifyUrl, { method: 'GET', headers: await this.getCommonHeaders() });
          const verifyHtml = await verifyResp.text();

          // If we unexpectedly received the configuration selection page or the section is missing, probe nearby DB IDs
          const hasRoutesetSection = verifyHtml.includes('Routesets Definition') || verifyHtml.includes('Routesets Definition:');
          const looksLikeConfigPage = verifyHtml.includes('configurations_list') && !hasRoutesetSection;

          if (!verifyResp.ok || looksLikeConfigPage || !hasRoutesetSection) {
            console.log(`[ProSBC1 Config] After selecting mapped config ${mappedConfig.id}, verification for DB ${mappedConfig.dbId} failed (looksLikeConfig=${looksLikeConfigPage}, hasRoutesetSection=${hasRoutesetSection}). Probing alternative DB IDs.`);

            // Probe DB IDs 1..10 to find the actual DB with routesets_definitions present
            let foundDb = null;
            for (let probe = 1; probe <= 10; probe++) {
              try {
                const probeUrl = `${this.baseURL}/file_dbs/${probe}/edit`;
                const resp = await fetch(probeUrl, { method: 'GET', headers: await this.getCommonHeaders() });
                if (!resp.ok) continue;
                const h = await resp.text();
                const hasSection = h.includes('Routesets Definition') || h.includes('Routesets Definition:');
                if (hasSection) {
                  foundDb = probe;
                  console.log(`[ProSBC1 Config] Probe success: DB ID ${probe} contains Routesets Definition section`);
                  break;
                }
              } catch (probeErr) {
                // ignore and continue
              }
            }

            if (foundDb) {
              this.selectedConfigId = String(foundDb);
              this.configSelectionDone = true;
              console.log(`[ProSBC1 Config] ✓ Found DB ID ${foundDb} after probing; using DB ID ${foundDb} for file operations`);
              return;
            }

            // If probing failed, fallback to the mapped DB ID but surface a warning
            console.warn(`[ProSBC1 Config] Probing DB IDs did not find a routesets_definitions section; falling back to mapped DB ID ${mappedConfig.dbId}`);
            this.selectedConfigId = mappedConfig.dbId;
            this.configSelectionDone = true;
            return;
          }

          // If verification passed, use mapped DB ID
          this.selectedConfigId = mappedConfig.dbId;
          this.configSelectionDone = true;
          console.log(`[ProSBC1 Config] ✓ Successfully selected config ${mappedConfig.id} (${mappedConfig.name}), using database ID: ${mappedConfig.dbId}`);
          return;
        } catch (selectError) {
          console.error(`[ProSBC1 Config] Failed to select hardcoded config ${mappedConfig.id}:`, selectError);
          throw selectError;
        }
      }
    }
    
    // For other instances, use the original logic
    // Convert frontend config ID to numeric ID
    const numericConfigId = await this.getNumericConfigId(configId);
    
    // If configId is provided and different, always reselect
    if (this.configSelectionDone && (!numericConfigId || numericConfigId === this.selectedConfigId)) return;
    
    // Ensure instance context is loaded
    await this.loadInstanceContext();
    
    const sessionCookie = await this.getSessionCookie();
    // Fetch live configs
    this.configs = await fetchLiveConfigIds(this.baseURL, sessionCookie);
    
    // Pick config: use numericConfigId if set, else pick the active one
    let configToSelect = numericConfigId || this.selectedConfigId;
    if (!configToSelect) {
      const active = this.configs.find(cfg => cfg.active);
      configToSelect = active ? active.id : (this.configs[0] && this.configs[0].id);
    } else {
      const selectedConfig = this.configs.find(cfg => cfg.id === configToSelect);
      if (!selectedConfig) {
        console.warn(`[Config Selection] Config ${configToSelect} not found in available configs`);
      }
    }
    if (!configToSelect) throw new Error('No configuration found to select');
    
    console.log(`[Config Selection] Selecting config ${configToSelect} on instance ${this.instanceId}`);
    
    try {
      await selectConfiguration(configToSelect, this.baseURL, sessionCookie);
      this.selectedConfigId = configToSelect;
      this.configSelectionDone = true;
      console.log(`[Config Selection] ✓ Config ${configToSelect} selected for ${this.instanceId}`);
      
      // Verify the selection worked by checking a simple endpoint and extract the actual database ID
      const verifyResponse = await fetch(`${this.baseURL}/file_dbs/1/edit`, {
        method: 'GET',
        headers: await this.getCommonHeaders()
      });
      
      if (verifyResponse.ok) {
        const verifyHtml = await verifyResponse.text();
        if (verifyHtml.includes('configurations_list') || verifyHtml.includes('Configuration')) {
        console.warn(`[Config Selection] Config selection verification failed for ${this.instanceId}`);
          console.warn(`[Config Selection] This suggests ProSBC ${this.instanceId} has issues with config selection or session state`);
          
          // Try to re-login and select again
          console.log(`[Config Selection] Attempting to re-login and retry config selection...`);
          this.sessionCookie = null; // Force re-login
          const newSessionCookie = await this.getSessionCookie();
          await selectConfiguration(configToSelect, this.baseURL, newSessionCookie);
          console.log(`[Config Selection] Retry completed for ${this.instanceId}`);
        } else {
          console.log(`[Config Selection] ✓ Config selection verified for ${this.instanceId}`);
          
          // Extract the actual database ID from the HTML
          const actualDbId = this.extractDatabaseIdFromHtml(verifyHtml);
          if (actualDbId) {
            this.selectedConfigId = actualDbId;
            console.log(`[Config Selection] ✓ Extracted actual database ID: ${actualDbId} for config ${configToSelect}`);
          } else {
            console.warn(`[Config Selection] Could not extract database ID, using config ID ${configToSelect} as fallback`);
            this.selectedConfigId = configToSelect;
          }
        }
      }
    } catch (selectError) {
      console.error(`[Config Selection] Failed to select config ${configToSelect} for instance ${this.instanceId}:`, selectError);
      throw selectError;
    }
  }

  async getCommonHeaders() {
    const sessionCookie = await this.getSessionCookie();
    return {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Node.js)',
      'Cache-Control': 'no-cache',
      'Cookie': `_WebOAMP_session=${sessionCookie}`
    };
  }

  async login() {
    return { success: true, message: 'Using basic authentication' };
  }

  // Debug method specifically for ProSBC1 to analyze configuration and database structure
  async debugProSBC1Configuration() {
    if (!this.instanceId || this.instanceId.toLowerCase() !== 'prosbc1') {
      console.log(`[Debug] This method is specifically for ProSBC1, current instance: ${this.instanceId}`);
      return;
    }
    
    try {
      console.log(`[ProSBC1 Debug] Starting comprehensive analysis...`);
      
      // Load instance context and configs
      await this.loadInstanceContext();
      const sessionCookie = await this.getSessionCookie();
      this.configs = await fetchLiveConfigIds(this.baseURL, sessionCookie);
      
      console.log(`[ProSBC1] Loaded ${this.configs.length} configurations`);
      
      // Check which database IDs are accessible and contain files
      const dbResults = [];
      for (const dbId of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']) {
        try {
          const response = await fetch(`${this.baseURL}/file_dbs/${dbId}/edit`, {
            method: 'GET',
            headers: await this.getCommonHeaders()
          });
          
          const result = {
            dbId,
            status: response.status,
            accessible: response.ok,
            dfFiles: 0,
            dmFiles: 0,
            htmlLength: 0
          };
          
          if (response.ok) {
            const html = await response.text();
            result.htmlLength = html.length;
            
            const dfFiles = this.parseFileTable(html, 'Routesets Definition', 'routesets_definitions');
            const dmFiles = this.parseFileTable(html, 'Routesets Digitmap', 'routesets_digitmaps');
            
            result.dfFiles = dfFiles.length;
            result.dmFiles = dmFiles.length;
            
            if (dfFiles.length > 0) {
              result.dfFileNames = dfFiles.slice(0, 3).map(f => f.name); // First 3 files
            }
            if (dmFiles.length > 0) {
              result.dmFileNames = dmFiles.slice(0, 3).map(f => f.name); // First 3 files
            }
          }
          
          dbResults.push(result);
          
        } catch (error) {
          dbResults.push({
            dbId,
            error: error.message,
            accessible: false
          });
        }
      }
      
      // Summary
      const accessibleDbs = dbResults.filter(db => db.accessible);
      const dbsWithFiles = dbResults.filter(db => db.accessible && (db.dfFiles > 0 || db.dmFiles > 0));
      
      console.log(`[ProSBC1] Found ${accessibleDbs.length} accessible DBs, ${dbsWithFiles.length} with files`);
      
      if (this.configs.length > 10) {
        console.warn(`[ProSBC1] ${this.configs.length} configurations may cause config selection issues`);
      }
      
      return {
        totalConfigs: this.configs.length,
        configs: this.configs,
        databaseResults: dbResults,
        accessibleDbs: accessibleDbs.length,
        dbsWithFiles: dbsWithFiles.length
      };
      
    } catch (error) {
      console.error(`[ProSBC1 Debug] Error during analysis:`, error);
      throw error;
    }
  }

  async uploadDfFile(filePath, onProgress, configId = null, originalFileName = null, uploadMode = 'auto') {
    try {
      await this.ensureConfigSelected(configId);
      const dbId = this.selectedConfigId;
      let fileName = originalFileName || path.basename(filePath);
      
      // Handle different upload modes:
      // 'auto' - try update if exists, otherwise create new with unique name if needed
      // 'create' - always create new file, use unique name if file exists
      // 'update' - only update existing file, fail if file doesn't exist
      // 'replace' - update if exists, create if doesn't exist (may overwrite)
      
      console.log(`[Upload DF] Upload mode: ${uploadMode}, file: '${fileName}'`);
      
      let existingFile = null;
      // Skip existence check for direct uploads or when config selection is problematic
      if (uploadMode === 'create' || uploadMode === 'replace') {
        console.log(`[Upload DF] Skipping existence check for ${uploadMode} mode`);
      } else {
        try {
          const existingFiles = await this.listDfFiles(configId);
          existingFile = existingFiles.files?.find(f => f.name === fileName);
          if (existingFile) {
            console.log(`[Upload DF] File '${fileName}' already exists with ID: ${existingFile.id}`);
          } else {
            console.log(`[Upload DF] File '${fileName}' does not exist`);
          }
        } catch (listError) {
          console.log(`[Upload DF] Could not check existing files (${listError.message}), proceeding with direct upload...`);
        }
      }
      
      // Handle upload based on mode
      if (uploadMode === 'update') {
        if (!existingFile) {
          throw new Error(`Cannot update: File '${fileName}' does not exist`);
        }
        console.log(`[Upload DF] Update mode: updating existing file '${fileName}'`);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const updateResult = await this.updateFileRestAPI('routesets_definitions', fileName, fileContent, configId);
        if (updateResult.success) {
          return { success: true, message: `DF file '${fileName}' updated successfully!` };
        } else {
          throw new Error(`Failed to update file '${fileName}': ${updateResult.message || 'Unknown error'}`);
        }
      } else if (uploadMode === 'create') {
        if (existingFile) {
          // Generate unique name for new file
          const timestamp = Date.now();
          fileName = fileName.replace(/\.csv$/i, `_${timestamp}.csv`);
          console.log(`[Upload DF] Create mode: using unique filename '${fileName}' to avoid conflict`);
        } else {
          console.log(`[Upload DF] Create mode: creating new file '${fileName}'`);
        }
      } else if (uploadMode === 'replace') {
        if (existingFile) {
          console.log(`[Upload DF] Replace mode: updating existing file '${fileName}'`);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          const updateResult = await this.updateFileRestAPI('routesets_definitions', fileName, fileContent, configId);
          if (updateResult.success) {
            return { success: true, message: `DF file '${fileName}' replaced successfully!` };
          } else {
            console.log(`[Upload DF] Update failed in replace mode, will create new file...`);
          }
        } else {
          console.log(`[Upload DF] Replace mode: file doesn't exist, creating new file '${fileName}'`);
        }
        } else { // auto mode (default behavior)
          console.log(`[Upload DF] Auto mode: proceeding with direct upload of '${fileName}'`);
        }      console.log(`[Upload DF] Instance: ${this.instanceId}, Config: ${configId || 'auto'} -> DB ID: ${dbId}, File: ${fileName}`);
      onProgress?.(25, 'Getting upload form...');
      const newDfResponse = await fetch(`${this.baseURL}/file_dbs/${dbId}/routesets_definitions/new`, {
        method: 'GET',
        headers: await this.getCommonHeaders()
      });
      if (!newDfResponse.ok) {
        const errorText = await newDfResponse.text();
        throw new Error(`Failed to get DF upload form: ${newDfResponse.status} - ${errorText.substring(0, 200)}`);
      }
      onProgress?.(50, 'Extracting security token...');
      const formHTML = await newDfResponse.text();
      // Try multiple patterns for CSRF extraction
      let csrfToken = null;
      const patterns = [
        /name="authenticity_token"[^>]*value="([^"]+)"/,
        /name='authenticity_token'[^>]*value='([^"]+)'/,
        /name="csrf-token"[^>]*content="([^"]+)"/,
        /<meta[^>]*name="csrf-token"[^>]*content="([^"]+)"/,
        /authenticity_token['"]\s*:\s*['"]([^'"]+)['"]/,
        // Additional patterns for different ProSBC versions
        /<input[^>]*name="authenticity_token"[^>]*value="([^"]+)"[^>]*>/,
        /<input[^>]*value="([^"]+)"[^>]*name="authenticity_token"[^>]*>/,
        /csrf[_-]?token['"]\s*[:=]\s*['"]([^'"]+)['"]/i,
        /_token['"]\s*[:=]\s*['"]([^'"]+)['"]/
      ];
      
      console.log('[CSRF Debug] Searching for CSRF token...');
      for (const pattern of patterns) {
        const match = formHTML.match(pattern);
        if (match) {
          csrfToken = match[1];
          console.log(`[CSRF Debug] Found token with pattern: ${pattern.source}`);
          break;
        }
      }
      
      if (!csrfToken) {
        console.error('[CSRF Extraction] Raw HTML:', formHTML.substring(0, 1500));
        console.log('[CSRF Debug] Trying to find any hidden input fields...');
        const hiddenInputs = formHTML.match(/<input[^>]*type="hidden"[^>]*>/gi) || [];
        console.log('[CSRF Debug] Hidden inputs found:', hiddenInputs);
        
        // Last resort: try to extract any token-like value from hidden inputs
        const tokenPattern = /<input[^>]*type="hidden"[^>]*value="([A-Za-z0-9+\/=_-]{20,})"[^>]*>/i;
        const tokenMatch = formHTML.match(tokenPattern);
        if (tokenMatch) {
          csrfToken = tokenMatch[1];
          console.log('[CSRF Debug] Using fallback token from hidden input');
        }
      }
      
      if (!csrfToken) {
        console.warn('[CSRF Warning] Could not find CSRF token, attempting upload without token as fallback');
        // Continue without CSRF token as some ProSBC versions might not require it
        csrfToken = '';
      }
      
      onProgress?.(75, 'Uploading file...');
      const formData = new FormData();
      if (csrfToken) {
        formData.append('authenticity_token', csrfToken);
      }
      // Use buffer instead of stream to avoid redirect issues with node-fetch
      const fileBuffer = fs.readFileSync(filePath);
      formData.append('tbgw_routesets_definition[file]', fileBuffer, fileName);
      formData.append('tbgw_routesets_definition[tbgw_files_db_id]', dbId);
      formData.append('commit', 'Import');
      const uploadHeaders = await this.getCommonHeaders();
      uploadHeaders['Referer'] = `${this.baseURL}/file_dbs/${dbId}/routesets_definitions/new`;
      const uploadResponse = await fetch(`${this.baseURL}/file_dbs/${dbId}/routesets_definitions`, {
        method: 'POST',
        headers: uploadHeaders,
        body: formData,
        redirect: 'manual' // Handle redirects manually to avoid stream issues
      });
      
      const responseText = await uploadResponse.text();
      
      onProgress?.(100, 'Upload complete!');
      
      // For redirects, check if they contain success indicators
      if (uploadResponse.status === 302 || uploadResponse.status === 301) {
        const location = uploadResponse.headers.get('location');
        console.log(`[Upload DF] Redirect location: ${location}`);
        
        // Check for success and error messages in the response headers
        const setCookieHeader = uploadResponse.headers.get('set-cookie');
        
        // First check for success messages in the session cookie
        if (setCookieHeader && setCookieHeader.includes('notice')) {
          const successMatch = setCookieHeader.match(/notice[^:]*:\s*([^&]+)/);
          if (successMatch) {
            const successMsg = decodeURIComponent(successMatch[1]).replace(/\+/g, ' ');
            if (successMsg.toLowerCase().includes('successfully imported') || 
                successMsg.toLowerCase().includes('successfully') || 
                successMsg.toLowerCase().includes('imported')) {
              console.log(`[Upload DF] ✓ SUCCESS detected from session cookie: ${successMsg}`);
              return { success: true, message: `DF file '${fileName}' uploaded successfully: ${successMsg}` };
            }
          }
        }
        
        // Check for error messages in the response headers or body
        if (setCookieHeader && setCookieHeader.includes('error')) {
          // Try to extract the error message from the session cookie
          const errorMatch = setCookieHeader.match(/error[^:]*:\s*([^&]+)/);
          if (errorMatch) {
            const errorMsg = decodeURIComponent(errorMatch[1]).replace(/\+/g, ' ');
            console.log(`[Upload DF] Server error detected: ${errorMsg}`);
            
            // Check for specific error types
            if (errorMsg.toLowerCase().includes('already been taken') || 
                errorMsg.toLowerCase().includes('name') && errorMsg.toLowerCase().includes('taken')) {
              
              console.log(`[Upload DF] File name conflict detected: ${errorMsg}`);
              console.log(`[Upload DF] Attempting to handle name conflict by generating unique name...`);
              
              // Generate unique name and retry
              const timestamp = Date.now();
              const uniqueFileName = fileName.replace(/\.csv$/i, `_${timestamp}.csv`);
              console.log(`[Upload DF] Retrying upload with unique name: ${uniqueFileName}`);
              
              try {
                return await this.uploadDfFile(filePath, onProgress, configId, uniqueFileName, 'create');
              } catch (retryError) {
                console.log(`[Upload DF] Unique name retry also failed: ${retryError.message}`);
                // If unique name also fails, try to update the existing file
                try {
                  console.log(`[Upload DF] Attempting to update existing file instead...`);
                  const fileContent = fs.readFileSync(filePath, 'utf8');
                  const updateResult = await this.updateFileRestAPI('routesets_definitions', fileName, fileContent, configId);
                  if (updateResult.success) {
                    console.log(`[Upload DF] Successfully updated existing file '${fileName}' via REST API`);
                    return { success: true, message: `DF file '${fileName}' updated successfully!` };
                  } else {
                    throw new Error(`Both unique name upload and file update failed: ${errorMsg}`);
                  }
                } catch (updateError) {
                  throw new Error(`File name already exists and all retry methods failed: ${errorMsg}`);
                }
              }
            } else {
              throw new Error(`Upload failed: ${errorMsg}`);
            }
          }
        }
        
        // Follow the redirect to check for success
        if (location) {
          const redirectUrl = location.startsWith('http') ? location : `${this.baseURL}${location}`;
          console.log(`[Upload DF] Following redirect to: ${redirectUrl}`);
          
          try {
            const redirectResponse = await fetch(redirectUrl, {
              method: 'GET',
              headers: await this.getCommonHeaders()
            });
            const redirectText = await redirectResponse.text();
            console.log(`[Upload DF] Redirect response preview:`, redirectText.substring(0, 500));
            
            // Check for error messages in the redirect page
            if (redirectText.includes('error') || redirectText.includes('failed') || 
                redirectText.includes('already been taken') || redirectText.includes('Name has already been taken')) {
              // Try to extract specific error message from HTML
              const errorMatch = redirectText.match(/<div[^>]*class="[^"]*error[^"]*"[^>]*>([^<]+)<\/div>/i) ||
                                redirectText.match(/<p[^>]*class="[^"]*error[^"]*"[^>]*>([^<]+)<\/p>/i) ||
                                redirectText.match(/error[^:]*:\s*([^<\n]+)/i);
              
              if (errorMatch) {
                const errorMsg = errorMatch[1].trim();
                console.log(`[Upload DF] Error found in redirect page: ${errorMsg}`);
                throw new Error(`Upload failed: ${errorMsg}`);
              } else {
                throw new Error(`Upload failed: Server reported an error but details could not be extracted`);
              }
            }
            
            // Check for success indicators in the redirect response
            if (redirectText.includes('successfully') || redirectText.includes('imported') || 
                redirectText.includes('uploaded') || redirectResponse.url.includes('edit')) {
              return { success: true, message: 'DF file uploaded successfully!' };
            }
            
            // Check if we can see our uploaded file in the file listing
            if (redirectText.includes(fileName)) {
              console.log(`[Upload DF] SUCCESS: Found uploaded file '${fileName}' in the file listing!`);
              return { success: true, message: `DF file '${fileName}' uploaded and verified in ProSBC!` };
            } else {
              console.log(`[Upload DF] File '${fileName}' not found in redirect response, checking all database IDs...`);
              
              // Try to find the file in any database ID as verification
              // For ProSBC1 with many configs, check more database IDs
              const dbIdsToVerify = (this.instanceId && this.instanceId.toLowerCase() === 'prosbc1') ? 
                ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] : 
                ['1', '2', '3', '4', '5'];
              
              console.log(`[Upload DF] Instance ${this.instanceId}: Verifying upload across ${dbIdsToVerify.length} database IDs...`);
              
              try {
                for (const testDbId of dbIdsToVerify) {
                  const testResponse = await fetch(`${this.baseURL}/file_dbs/${testDbId}/edit`, {
                    method: 'GET',
                    headers: await this.getCommonHeaders()
                  });
                  if (testResponse.ok) {
                    const testHtml = await testResponse.text();
                    if (testHtml.includes(fileName)) {
                      console.log(`[Upload DF] ✓ SUCCESS: Found uploaded file '${fileName}' in DB ID ${testDbId}!`);
                      return { success: true, message: `DF file '${fileName}' uploaded and verified in ProSBC DB ID ${testDbId}!` };
                    }
                  }
                }
                console.log(`[Upload DF] File '${fileName}' not found in any database ID during verification`);
              } catch (verifyError) {
                console.log(`[Upload DF] Verification check failed: ${verifyError.message}`);
              }
              
              console.log(`[Upload DF] WARNING: Could not find file '${fileName}' in the redirect response. Upload may have failed.`);
            }
          } catch (redirectError) {
            console.error(`[Upload DF] Error following redirect:`, redirectError);
          }
        }
        
        return { success: true, message: 'DF file upload completed (redirect received)' };
      } else if (uploadResponse.ok) {
        // Check response content for success indicators
        if (responseText.includes('successfully') || responseText.includes('imported') || 
            responseText.includes('uploaded')) {
          return { success: true, message: 'DF file uploaded successfully!' };
        }
        return { success: true, message: 'DF file upload completed' };
      } else {
        throw new Error(`Upload failed: ${uploadResponse.status} - ${responseText.substring(0, 200)}`);
      }
    } catch (error) {
      throw error;
    }
  }

  async uploadDmFile(filePath, onProgress, configId = null, originalFileName = null, uploadMode = 'auto') {
    try {
      await this.ensureConfigSelected(configId);
      const dbId = this.selectedConfigId;
      let fileName = originalFileName || path.basename(filePath);
      
      // Handle different upload modes:
      // 'auto' - try update if exists, otherwise create new with unique name if needed
      // 'create' - always create new file, use unique name if file exists
      // 'update' - only update existing file, fail if file doesn't exist
      // 'replace' - update if exists, create if doesn't exist (may overwrite)
      
      console.log(`[Upload DM] Upload mode: ${uploadMode}, file: '${fileName}'`);
      
      let existingFile = null;
      // Skip existence check for direct uploads or when config selection is problematic
      if (uploadMode === 'create' || uploadMode === 'replace') {
        console.log(`[Upload DM] Skipping existence check for ${uploadMode} mode`);
      } else {
        try {
          const existingFiles = await this.listDmFiles(configId);
          existingFile = existingFiles.files?.find(f => f.name === fileName);
          if (existingFile) {
            console.log(`[Upload DM] File '${fileName}' already exists with ID: ${existingFile.id}`);
          } else {
            console.log(`[Upload DM] File '${fileName}' does not exist`);
          }
        } catch (listError) {
          console.log(`[Upload DM] Could not check existing files (${listError.message}), proceeding with direct upload...`);
        }
      }
      
      // Handle upload based on mode
      if (uploadMode === 'update') {
        if (!existingFile) {
          throw new Error(`Cannot update: File '${fileName}' does not exist`);
        }
        console.log(`[Upload DM] Update mode: updating existing file '${fileName}'`);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const updateResult = await this.updateFileRestAPI('routesets_digitmaps', fileName, fileContent, configId);
        if (updateResult.success) {
          return { success: true, message: `DM file '${fileName}' updated successfully!` };
        } else {
          throw new Error(`Failed to update file '${fileName}': ${updateResult.message || 'Unknown error'}`);
        }
      } else if (uploadMode === 'create') {
        if (existingFile) {
          // Generate unique name for new file
          const timestamp = Date.now();
          fileName = fileName.replace(/\.csv$/i, `_${timestamp}.csv`);
          console.log(`[Upload DM] Create mode: using unique filename '${fileName}' to avoid conflict`);
        } else {
          console.log(`[Upload DM] Create mode: creating new file '${fileName}'`);
        }
      } else if (uploadMode === 'replace') {
        if (existingFile) {
          console.log(`[Upload DM] Replace mode: updating existing file '${fileName}'`);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          const updateResult = await this.updateFileRestAPI('routesets_digitmaps', fileName, fileContent, configId);
          if (updateResult.success) {
            return { success: true, message: `DM file '${fileName}' replaced successfully!` };
          } else {
            console.log(`[Upload DM] Update failed in replace mode, will create new file...`);
          }
        } else {
          console.log(`[Upload DM] Replace mode: file doesn't exist, creating new file '${fileName}'`);
        }
        } else { // auto mode (default behavior)
          console.log(`[Upload DM] Auto mode: proceeding with direct upload of '${fileName}'`);
        }      console.log(`[Upload DM] Instance: ${this.instanceId}, Config: ${configId || 'auto'} -> DB ID: ${dbId}, File: ${fileName}`);
      onProgress?.(25, 'Getting upload form...');
      const newDmResponse = await fetch(`${this.baseURL}/file_dbs/${dbId}/routesets_digitmaps/new`, {
        method: 'GET',
        headers: await this.getCommonHeaders()
      });
      if (!newDmResponse.ok) {
        const errorText = await newDmResponse.text();
        throw new Error(`Failed to get DM upload form: ${newDmResponse.status} - ${errorText.substring(0, 200)}`);
      }
      onProgress?.(50, 'Extracting security token...');
      const formHTML = await newDmResponse.text();
      
      // Try multiple patterns for CSRF extraction (same as DF upload)
      let csrfToken = null;
      const patterns = [
        /name="authenticity_token"[^>]*value="([^"]+)"/,
        /name='authenticity_token'[^>]*value='([^"]+)'/,
        /name="csrf-token"[^>]*content="([^"]+)"/,
        /<meta[^>]*name="csrf-token"[^>]*content="([^"]+)"/,
        /authenticity_token['"]\s*:\s*['"]([^'"]+)['"]/,
        // Additional patterns for different ProSBC versions
        /<input[^>]*name="authenticity_token"[^>]*value="([^"]+)"[^>]*>/,
        /<input[^>]*value="([^"]+)"[^>]*name="authenticity_token"[^>]*>/,
        /csrf[_-]?token['"]\s*[:=]\s*['"]([^'"]+)['"]/i,
        /_token['"]\s*[:=]\s*['"]([^'"]+)['"]/
      ];
      
      console.log('[DM CSRF Debug] Searching for CSRF token...');
      for (const pattern of patterns) {
        const match = formHTML.match(pattern);
        if (match) {
          csrfToken = match[1];
          console.log(`[DM CSRF Debug] Found token with pattern: ${pattern.source}`);
          break;
        }
      }
      
      if (!csrfToken) {
        console.error('[DM CSRF Extraction] Raw HTML:', formHTML.substring(0, 1500));
        console.log('[DM CSRF Debug] Trying to find any hidden input fields...');
        const hiddenInputs = formHTML.match(/<input[^>]*type="hidden"[^>]*>/gi) || [];
        console.log('[DM CSRF Debug] Hidden inputs found:', hiddenInputs);
        
        // Last resort: try to extract any token-like value from hidden inputs
        const tokenPattern = /<input[^>]*type="hidden"[^>]*value="([A-Za-z0-9+\/=_-]{20,})"[^>]*>/i;
        const tokenMatch = formHTML.match(tokenPattern);
        if (tokenMatch) {
          csrfToken = tokenMatch[1];
          console.log('[DM CSRF Debug] Using fallback token from hidden input');
        }
      }
      
      if (!csrfToken) {
        console.warn('[DM CSRF Warning] Could not find CSRF token, attempting upload without token as fallback');
        // Continue without CSRF token as some ProSBC versions might not require it
        csrfToken = '';
      }
      
      onProgress?.(75, 'Uploading file...');
      const formData = new FormData();
      if (csrfToken) {
        formData.append('authenticity_token', csrfToken);
      }
      // Use buffer instead of stream to avoid redirect issues with node-fetch
      const fileBuffer = fs.readFileSync(filePath);
      formData.append('tbgw_routesets_digitmap[file]', fileBuffer, fileName);
      formData.append('tbgw_routesets_digitmap[tbgw_files_db_id]', dbId);
      formData.append('commit', 'Import');
      const uploadHeaders = await this.getCommonHeaders();
      uploadHeaders['Referer'] = `${this.baseURL}/file_dbs/${dbId}/routesets_digitmaps/new`;
      const uploadResponse = await fetch(`${this.baseURL}/file_dbs/${dbId}/routesets_digitmaps`, {
        method: 'POST',
        headers: uploadHeaders,
        body: formData,
        redirect: 'manual' // Handle redirects manually to avoid stream issues
      });
      
      const responseText = await uploadResponse.text();
      
      onProgress?.(100, 'Upload complete!');
      
      // For redirects, check if they contain success indicators
      if (uploadResponse.status === 302 || uploadResponse.status === 301) {
        const location = uploadResponse.headers.get('location');
        console.log(`[Upload DM] Redirect location: ${location}`);
        
        // Check for success and error messages in the response headers
        const setCookieHeader = uploadResponse.headers.get('set-cookie');
        
        // First check for success messages in the session cookie
        if (setCookieHeader && setCookieHeader.includes('notice')) {
          const successMatch = setCookieHeader.match(/notice[^:]*:\s*([^&]+)/);
          if (successMatch) {
            const successMsg = decodeURIComponent(successMatch[1]).replace(/\+/g, ' ');
            if (successMsg.toLowerCase().includes('successfully imported') || 
                successMsg.toLowerCase().includes('successfully') || 
                successMsg.toLowerCase().includes('imported')) {
              console.log(`[Upload DM] ✓ SUCCESS detected from session cookie: ${successMsg}`);
              return { success: true, message: `DM file '${fileName}' uploaded successfully: ${successMsg}` };
            }
          }
        }
        
        // Check for error messages in the response headers or body
        if (setCookieHeader && setCookieHeader.includes('error')) {
          // Try to extract the error message from the session cookie
          const errorMatch = setCookieHeader.match(/error[^:]*:\s*([^&]+)/);
          if (errorMatch) {
            const errorMsg = decodeURIComponent(errorMatch[1]).replace(/\+/g, ' ');
            console.log(`[Upload DM] Server error detected: ${errorMsg}`);
            
            // Check for specific error types
            if (errorMsg.toLowerCase().includes('already been taken') || 
                errorMsg.toLowerCase().includes('name') && errorMsg.toLowerCase().includes('taken')) {
              
              console.log(`[Upload DM] File name conflict detected: ${errorMsg}`);
              console.log(`[Upload DM] Attempting to handle name conflict by generating unique name...`);
              
              // Generate unique name and retry
              const timestamp = Date.now();
              const uniqueFileName = fileName.replace(/\.csv$/i, `_${timestamp}.csv`);
              console.log(`[Upload DM] Retrying upload with unique name: ${uniqueFileName}`);
              
              try {
                return await this.uploadDmFile(filePath, onProgress, configId, uniqueFileName, 'create');
              } catch (retryError) {
                console.log(`[Upload DM] Unique name retry also failed: ${retryError.message}`);
                // If unique name also fails, try to update the existing file
                try {
                  console.log(`[Upload DM] Attempting to update existing file instead...`);
                  const fileContent = fs.readFileSync(filePath, 'utf8');
                  const updateResult = await this.updateFileRestAPI('routesets_digitmaps', fileName, fileContent, configId);
                  if (updateResult.success) {
                    console.log(`[Upload DM] Successfully updated existing file '${fileName}' via REST API`);
                    return { success: true, message: `DM file '${fileName}' updated successfully!` };
                  } else {
                    throw new Error(`Both unique name upload and file update failed: ${errorMsg}`);
                  }
                } catch (updateError) {
                  throw new Error(`File name already exists and all retry methods failed: ${errorMsg}`);
                }
              }
            } else {
              throw new Error(`Upload failed: ${errorMsg}`);
            }
          }
        }
        
        // Follow the redirect to check for success
        if (location) {
          const redirectUrl = location.startsWith('http') ? location : `${this.baseURL}${location}`;
          console.log(`[Upload DM] Following redirect to: ${redirectUrl}`);
          
          try {
            const redirectResponse = await fetch(redirectUrl, {
              method: 'GET',
              headers: await this.getCommonHeaders()
            });
            const redirectText = await redirectResponse.text();
            console.log(`[Upload DM] Redirect response preview:`, redirectText.substring(0, 500));
            
            // Check for error messages in the redirect page
            if (redirectText.includes('error') || redirectText.includes('failed') || 
                redirectText.includes('already been taken') || redirectText.includes('Name has already been taken')) {
              // Try to extract specific error message from HTML
              const errorMatch = redirectText.match(/<div[^>]*class="[^"]*error[^"]*"[^>]*>([^<]+)<\/div>/i) ||
                                redirectText.match(/<p[^>]*class="[^"]*error[^"]*"[^>]*>([^<]+)<\/p>/i) ||
                                redirectText.match(/error[^:]*:\s*([^<\n]+)/i);
              
              if (errorMatch) {
                const errorMsg = errorMatch[1].trim();
                console.log(`[Upload DM] Error found in redirect page: ${errorMsg}`);
                throw new Error(`Upload failed: ${errorMsg}`);
              } else {
                throw new Error(`Upload failed: Server reported an error but details could not be extracted`);
              }
            }
            
            // Check for success indicators in the redirect response
            if (redirectText.includes('successfully') || redirectText.includes('imported') || 
                redirectText.includes('uploaded') || redirectResponse.url.includes('edit')) {
              return { success: true, message: 'DM file uploaded successfully!' };
            }
            
            // Check if we can see our uploaded file in the file listing
            if (redirectText.includes(fileName)) {
              console.log(`[Upload DM] SUCCESS: Found uploaded file '${fileName}' in the file listing!`);
              return { success: true, message: `DM file '${fileName}' uploaded and verified in ProSBC!` };
            } else {
              console.log(`[Upload DM] Upload completed successfully (redirect received)`);
              return { success: true, message: `DM file '${fileName}' uploaded successfully!` };
            }
          } catch (redirectError) {
            console.error(`[Upload DM] Error following redirect:`, redirectError);
          }
        }
        
        return { success: true, message: 'DM file upload completed (redirect received)' };
      } else if (uploadResponse.ok) {
        // Check response content for success indicators
        if (responseText.includes('successfully') || responseText.includes('imported') || 
            responseText.includes('uploaded')) {
          return { success: true, message: 'DM file uploaded successfully!' };
        }
        return { success: true, message: 'DM file upload completed' };
      } else {
        throw new Error(`Upload failed: ${uploadResponse.status} - ${responseText.substring(0, 200)}`);
      }
    } catch (error) {
      throw error;
    }
  }

  async listDfFiles(configId = null) {
    try {
      await this.ensureConfigSelected(configId);
      let dbId = this.selectedConfigId;
      console.log(`[ProSBC] Instance: ${this.instanceId}, Fetching DF files list... (DB ID: ${dbId}, Config ID: ${configId})`);
      
      // For ProSBC1, the database ID is already correctly set by ensureConfigSelected
      if (this.instanceId && this.instanceId.toLowerCase() === 'prosbc1') {
        console.log(`[ProSBC1] Using database ID: ${dbId} for config ${configId}`);
      } else {
        // For other instances, try to get the correct database ID by checking the file_dbs index
        try {
          const indexResponse = await fetch(`${this.baseURL}/file_dbs`, {
            method: 'GET',
            headers: await this.getCommonHeaders()
          });
          
          if (indexResponse.ok) {
            const indexHtml = await indexResponse.text();
            const actualDbId = this.extractDatabaseIdFromHtml(indexHtml);
            if (actualDbId && actualDbId !== dbId) {
              console.log(`[ProSBC] Instance: ${this.instanceId}, Found actual DB ID ${actualDbId} different from config ID ${dbId}`);
              dbId = actualDbId;
              this.selectedConfigId = actualDbId;
            }
          }
        } catch (indexError) {
          console.log(`[ProSBC] Could not check file_dbs index: ${indexError.message}`);
        }
      }
      
      const response = await fetch(`${this.baseURL}/file_dbs/${dbId}/edit`, {
        method: 'GET',
        headers: await this.getCommonHeaders()
      });
      if (!response.ok) throw new Error(`Failed to fetch DF files: ${response.status}`);
      const html = await response.text();
      
      // Check if we're getting the right page (should contain file database content)
      if (html.includes('configurations_list') || html.includes('Configuration')) {
        console.warn(`[ProSBC] Config selection may have failed for ${this.instanceId}`);
      }
      
      const files = this.parseFileTable(html, 'Routesets Definition', 'routesets_definitions');
      console.log(`[ProSBC] Instance: ${this.instanceId}, Parsed ${(files || []).length} DF files`);
      return { success: true, files };
    } catch (error) {
      console.error(`[ProSBC] Instance: ${this.instanceId}, listDfFiles error:`, error);
      throw error;
    }
  }

  async listDmFiles(configId = null) {
    try {
      await this.ensureConfigSelected(configId);
      let dbId = this.selectedConfigId;
      console.log(`[ProSBC] Instance: ${this.instanceId}, Fetching DM files list... (DB ID: ${dbId}, Config ID: ${configId})`);
      
      // For ProSBC1, the database ID is already correctly set by ensureConfigSelected
      if (this.instanceId && this.instanceId.toLowerCase() === 'prosbc1') {
        console.log(`[ProSBC1] Using database ID: ${dbId} for config ${configId}`);
      } else {
        // For other instances, try to get the correct database ID by checking the file_dbs index
        try {
          const indexResponse = await fetch(`${this.baseURL}/file_dbs`, {
            method: 'GET',
            headers: await this.getCommonHeaders()
          });
          
          if (indexResponse.ok) {
            const indexHtml = await indexResponse.text();
            const actualDbId = this.extractDatabaseIdFromHtml(indexHtml);
            if (actualDbId && actualDbId !== dbId) {
              console.log(`[ProSBC] Instance: ${this.instanceId}, Found actual DB ID ${actualDbId} different from config ID ${dbId}`);
              dbId = actualDbId;
              this.selectedConfigId = actualDbId;
            }
          }
        } catch (indexError) {
          console.log(`[ProSBC] Could not check file_dbs index: ${indexError.message}`);
        }
      }
      
      const response = await fetch(`${this.baseURL}/file_dbs/${dbId}/edit`, {
        method: 'GET',
        headers: await this.getCommonHeaders()
      });
      if (!response.ok) throw new Error(`Failed to fetch DM files: ${response.status}`);
      const html = await response.text();
      
      // Check if we're getting the right page (should contain file database content)
      if (html.includes('configurations_list') || html.includes('Configuration')) {
        console.warn(`[ProSBC] Config selection may have failed for ${this.instanceId}`);
      }
      
      const files = this.parseFileTable(html, 'Routesets Digitmap', 'routesets_digitmaps');
      console.log(`[ProSBC] Instance: ${this.instanceId}, Parsed ${(files || []).length} DM files`);
      return { success: true, files };
    } catch (error) {
      console.error(`[ProSBC] Instance: ${this.instanceId}, listDmFiles error:`, error);
      throw error;
    }
  }

  async getSystemStatus() {
    try {
      const response = await fetch(`${this.baseURL}/dashboard`, {
        method: 'GET',
        headers: await this.getCommonHeaders()
      });
      return {
        isOnline: response.ok,
        status: response.ok ? 'Online' : 'Offline',
        statusCode: response.status
      };
    } catch (error) {
      return {
        isOnline: false,
        status: 'Error',
        statusCode: 0,
        error: error.message
      };
    }
  }

  parseFileTable(html, sectionTitle, fileType) {
    const files = [];
    try {
      console.log(`[ProSBC] Parsing file table for section: ${sectionTitle}`);
      // Log all legend texts found for debugging
      const legendRegex = /<legend>([^<]+)<\/legend>/g;
      let legendMatch;
      const legends = [];
      while ((legendMatch = legendRegex.exec(html)) !== null) {
        legends.push(legendMatch[1].trim());
      }
      console.log('[ProSBC] Legends found in HTML:', legends);
      // Escape special regex characters in sectionTitle
      function escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
      // Try strict match first (colon optional, whitespace flexible)
      let sectionRegex = new RegExp(`<fieldset>\s*<legend>\s*${escapeRegExp(sectionTitle)}\s*:?[\s\n]*<\/legend>([\s\S]*?)<\/fieldset>`, 'i');
      let sectionMatch = html.match(sectionRegex);
      // If not found, try fuzzy match: find legend containing sectionTitle (ignore colon, whitespace, case)
      if (!sectionMatch) {
        const norm = s => s.replace(/:/g, '').replace(/\s+/g, '').toLowerCase();
        const normTitle = norm(sectionTitle);
        let bestLegend = null;
        for (const legend of legends) {
          if (norm(legend).includes(normTitle) || normTitle.includes(norm(legend))) {
            bestLegend = legend;
            console.log(`[ProSBC] Fuzzy legend match used: '${legend}' for section '${sectionTitle}'`);
            // Find the corresponding fieldset
            const legendEscaped = escapeRegExp(legend);
            const legendRegex = new RegExp(`<legend>\s*${legendEscaped}\s*<\/legend>`, 'i');
            const legendPos = html.search(legendRegex);
            if (legendPos !== -1) {
              const fieldsetStart = html.lastIndexOf('<fieldset', legendPos);
              const fieldsetEnd = html.indexOf('</fieldset>', legendPos);
              if (fieldsetStart !== -1 && fieldsetEnd !== -1) {
                const legendEnd = html.indexOf('</legend>', legendPos);
                if (legendEnd !== -1 && legendEnd < fieldsetEnd) {
                  const sectionHtml = html.substring(legendEnd + 9, fieldsetEnd);
                  sectionMatch = [null, sectionHtml];
                  break;
                }
              }
            }
          }
        }
        // If still not found, try the first legend as a fallback
        if (!sectionMatch && legends.length > 0) {
          bestLegend = legends[0];
          console.log(`[ProSBC] Fallback to first legend: '${bestLegend}' for section '${sectionTitle}'`);
          const legendEscaped = escapeRegExp(bestLegend);
          const legendRegex = new RegExp(`<legend>\s*${legendEscaped}\s*<\/legend>`, 'i');
          const legendPos = html.search(legendRegex);
          if (legendPos !== -1) {
            const fieldsetStart = html.lastIndexOf('<fieldset', legendPos);
            const fieldsetEnd = html.indexOf('</fieldset>', legendPos);
            if (fieldsetStart !== -1 && fieldsetEnd !== -1) {
              const legendEnd = html.indexOf('</legend>', legendPos);
              if (legendEnd !== -1 && legendEnd < fieldsetEnd) {
                const sectionHtml = html.substring(legendEnd + 9, fieldsetEnd);
                sectionMatch = [null, sectionHtml];
              }
            }
          }
        }
      }
      if (!sectionMatch) {
        console.log('[ProSBC] Section not found:', sectionTitle);
        return files;
      }
      const sectionHtml = sectionMatch[1];
      // Robustly parse file rows for all configIds
      // Clear the files array since we found the section
      files.length = 0;
      // Match all file rows for the given fileType (routesets_definitions or routesets_digitmaps)
      // More flexible regex to handle variations in HTML structure
      const rowRegex = new RegExp(
        `<tr>[\\s\\S]*?<td[^>]*>([^<]+)<\\/td>[\\s\\S]*?` +
        `<td[^>]*><a[^>]*href=\\"/file_dbs/(\\d+)/(?:${fileType})/(\\d+)/edit\\"[^>]*>Update<\\/a><\\/td>[\\s\\S]*?` +
        `<td[^>]*><a[^>]*href=\\"/file_dbs/\\d+/(?:${fileType})/(\\d+)/export\\"[^>]*>Export<\\/a><\\/td>[\\s\\S]*?` +
        `<td[^>]*><a[^>]*href=\\"/file_dbs/\\d+/(?:${fileType})/(\\d+)\\"[^>]*>Delete<\\/a><\\/td>[\\s\\S]*?<\\/tr>`,
        'gi'
      );
      let match;
      let rowCount = 0;
      while ((match = rowRegex.exec(sectionHtml)) !== null) {
        rowCount++;
        const [ , fileName, dbId, updateId, exportId, deleteId ] = match;
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
      console.log(`[ProSBC] Found ${rowCount} rows in section: ${sectionTitle}`);
      
      // Debug: If no files found but section exists, log a warning
      if (rowCount === 0 && sectionHtml.length > 0) {
        console.warn(`[ProSBC] No files parsed from section: ${sectionTitle}`);
      }
      
      return files;
    } catch (error) {
      console.error('[ProSBC] parseFileTable error:', error);
      return files;
    }
  }

  async exportFile(fileType, fileId, fileName, outputPath, configId = null) {
    try {
      // Use configId if provided, else default to 1 (legacy fallback)
      const dbId = configId ;
      const response = await fetch(`${this.baseURL}/file_dbs/${dbId}/${fileType}/${fileId}/export`, {
        method: 'GET',
        headers: await this.getCommonHeaders()
      });
      if (!response.ok) throw new Error(`Failed to export file: ${response.status}`);
      const buffer = await response.buffer();
      fs.writeFileSync(outputPath || fileName, buffer);
      return { success: true, message: `File "${fileName}" exported successfully!`, path: outputPath || fileName };
    } catch (error) {
      throw error;
    }
  }

  async deleteFile(fileType, fileId, fileName, configId = null) {
    try {
      console.log('[deleteFile] Params:', { fileType, fileId, fileName, configId });
      let csrfToken = null;
      const dbId = configId ;
      let uploadFormUrl = fileType === 'routesets_definitions'
        ? `${this.baseURL}/file_dbs/${dbId}/routesets_definitions/new`
        : `${this.baseURL}/file_dbs/${dbId}/routesets_digitmaps/new`;
      try {
        const uploadFormResponse = await fetch(uploadFormUrl, {
          method: 'GET',
          headers: await this.getCommonHeaders()
        });
        console.log('[deleteFile] Upload form response status:', uploadFormResponse.status);
        if (uploadFormResponse.ok) {
          const uploadFormHtml = await uploadFormResponse.text();
          const uploadCsrfMatch = uploadFormHtml.match(/name="authenticity_token"[^>]*value="([^"]+)"/);
          if (uploadCsrfMatch) {
            csrfToken = uploadCsrfMatch[1];
            console.log('[deleteFile] CSRF token from upload form:', csrfToken);
          }
        }
      } catch (uploadError) {
        console.error('[deleteFile] Error fetching upload form:', uploadError);
      }
      if (!csrfToken) {
        const mainPageResponse = await fetch(`${this.baseURL}/file_dbs/${dbId}/edit`, {
          method: 'GET',
          headers: await this.getCommonHeaders()
        });
        console.log('[deleteFile] Main page response status:', mainPageResponse.status);
        if (!mainPageResponse.ok) throw new Error(`Failed to get main page: ${mainPageResponse.status}`);
        const html = await mainPageResponse.text();
        const patterns = [
          /name="authenticity_token"[^>]*value="([^"]+)"/,
          /name="csrf-token"[^>]*content="([^"]+)"/,
          /authenticity_token['"]\s*:\s*['"]([^'"]+)['"]/
        ];
        for (const pattern of patterns) {
          const match = html.match(pattern);
          if (match) {
            csrfToken = match[1];
            console.log('[deleteFile] CSRF token from main page:', csrfToken);
            break;
          }
        }
      }
      if (!csrfToken) throw new Error('Could not find CSRF token for delete operation.');
      console.log('[deleteFile] Final CSRF token:', csrfToken);
      // Use URLSearchParams for x-www-form-urlencoded body
      const params = new URLSearchParams();
      params.append('authenticity_token', csrfToken);
      params.append('_method', 'delete');
      if (fileType === 'routesets_definitions') {
        params.append('tbgw_routesets_definition[id]', fileId);
      } else if (fileType === 'routesets_digitmaps') {
        params.append('tbgw_routesets_digitmap[id]', fileId);
      }
      // commit field is not required for delete, omit for now
      const deleteHeaders = await this.getCommonHeaders();
      deleteHeaders['Referer'] = `${this.baseURL}/file_dbs/${dbId}/edit`;
      deleteHeaders['X-Requested-With'] = 'XMLHttpRequest';
      deleteHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
      console.log('[deleteFile] Sending delete request:', `${this.baseURL}/file_dbs/${dbId}/${fileType}/${fileId}`);
      const response = await fetch(`${this.baseURL}/file_dbs/${dbId}/${fileType}/${fileId}`, {
        method: 'POST',
        headers: deleteHeaders,
        body: params.toString()
      });
      console.log('[deleteFile] Delete response status:', response.status);
      if (response.ok || response.status === 302) {
        return { success: true, message: `File "${fileName}" deleted successfully!` };
      } else {
        const errorText = await response.text();
        console.error('[deleteFile] Delete failed:', response.status, errorText.substring(0, 200));
        throw new Error(`Delete failed: ${response.status} - ${errorText.substring(0, 200)}`);
      }
    } catch (error) {
      console.error('[deleteFile] Exception:', error);
      throw error;
    }
  }

  async getFileContent(fileType, fileId, configId = null) {
    try {
      const dbId = configId;
      const exportResponse = await fetch(`${this.baseURL}/file_dbs/${dbId}/${fileType}/${fileId}/export`, {
        method: 'GET',
        headers: await this.getCommonHeaders()
      });
      if (exportResponse.ok) {
        const csvContent = await exportResponse.text();
        return {
          success: true,
          content: csvContent,
          isCsvFile: true,
          found: true
        };
      }
      const response = await fetch(`${this.baseURL}/file_dbs/${dbId}/${fileType}/${fileId}/edit`, {
        method: 'GET',
        headers: await this.getCommonHeaders()
      });
      if (!response.ok) throw new Error(`Failed to get file content: ${response.status}`);
      const html = await response.text();
      let content = '';
      let found = false;
      let textareaMatch = html.match(/<textarea[^>]*name="[^"]*\[uploaded_data\]"[^>]*>([\s\S]*?)<\/textarea>/);
      if (textareaMatch) {
        content = textareaMatch[1];
        found = true;
      }
      if (!found) {
        textareaMatch = html.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/);
        if (textareaMatch) {
          content = textareaMatch[1];
          found = true;
        }
      }
      if (!found) {
        const inputMatch = html.match(/<input[^>]*name="[^"]*\[uploaded_data\]"[^>]*value="([^"]*)"[^>]*>/);
        if (inputMatch) {
          content = inputMatch[1];
          found = true;
        }
      }
      if (!found) {
        const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/);
        if (preMatch) {
          content = preMatch[1];
          found = true;
        }
      }
      if (content) {
        content = content
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
      }
      return {
        success: true,
        content: content,
        html: html,
        found: found,
        isCsvFile: false
      };
    } catch (error) {
      throw error;
    }
  }

  async updateFile(fileType, fileId, updatedFilePath, onProgress = null, configId = null) {
    try {
      const dbId = configId;
      const updatedFileName = updatedFilePath.split('/').pop();
      onProgress?.(10, 'Getting edit form...');
      const editUrl = `/file_dbs/${dbId}/${fileType}/${fileId}/edit`;
      const editResponse = await fetch(`${this.baseURL}${editUrl}`, {
        method: 'GET',
        headers: await this.getCommonHeaders()
      });
      if (!editResponse.ok) {
        const errorText = await editResponse.text();
        throw new Error(`Failed to get edit form: ${editResponse.status} - ${errorText.substring(0, 200)}`);
      }
      const editHtml = await editResponse.text();
      const tokenMatch = editHtml.match(/name="authenticity_token"[^>]*value="([^"]+)"/);
      if (!tokenMatch) throw new Error('Could not find authenticity token in edit form');
      const csrfToken = tokenMatch[1];
      let recordId = fileId;
      const fieldName = fileType === 'routesets_digitmaps' ? 'tbgw_routesets_digitmap' : 'tbgw_routesets_definition';
      const idMatch = editHtml.match(new RegExp(`name="${fieldName}\[id\]"[^>]*value="([^"]+)"`));
      if (idMatch) recordId = idMatch[1];
      onProgress?.(30, 'Preparing update request...');
      const formData = new FormData();
      formData.append('_method', 'put');
      formData.append('authenticity_token', csrfToken);
      if (fileType === 'routesets_digitmaps') {
        formData.append('tbgw_routesets_digitmap[file]', fs.createReadStream(updatedFilePath));
        formData.append('tbgw_routesets_digitmap[id]', recordId);
        formData.append('tbgw_routesets_digitmap[tbgw_files_db_id]', dbId);
      } else {
        formData.append('tbgw_routesets_definition[file]', fs.createReadStream(updatedFilePath));
        formData.append('tbgw_routesets_definition[id]', recordId);
        formData.append('tbgw_routesets_definition[tbgw_files_db_id]', dbId);
      }
      formData.append('commit', 'Update');
      onProgress?.(50, 'Sending update to ProSBC...');
      const updateHeaders = await this.getCommonHeaders();
      updateHeaders['Referer'] = `${this.baseURL}${editUrl}`;
      updateHeaders['X-Requested-With'] = 'XMLHttpRequest';
      const updateResponse = await fetch(`${this.baseURL}/file_dbs/${dbId}/${fileType}/${fileId}`, {
        method: 'POST',
        headers: updateHeaders,
        body: formData,
        redirect: 'manual'
      });
      onProgress?.(80, 'Processing update response...');
      if (updateResponse.ok || updateResponse.status === 302) {
        return {
          success: true,
          message: 'File updated successfully on ProSBC!',
          status: updateResponse.status
        };
      } else {
        const errorText = await updateResponse.text();
        throw new Error(`Update failed: ${updateResponse.status} - ${errorText.substring(0, 200)}`);
      }
    } catch (error) {
      onProgress?.(100, `Update failed: ${error.message}`);
      throw error;
    }
  }
}

// Export both the class and a default instance for backward compatibility
export { ProSBCFileAPI, clearSessionCache };
export default new ProSBCFileAPI();

// Factory function to create instance-specific API clients
export function createProSBCFileAPI(instanceId) {
  return new ProSBCFileAPI(instanceId);
}
