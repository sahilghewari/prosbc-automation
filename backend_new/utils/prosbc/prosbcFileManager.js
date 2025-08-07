// Backend ProSBC File API utilities
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { prosbcLogin } from './login.js';
import { selectConfiguration } from './prosbcConfigSelector.js';
import { fetchLiveConfigIds } from './prosbcConfigLiveFetcher.js';
import { getInstanceContext } from './multiInstanceManager.js';

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
    if (this.sessionCookie) return this.sessionCookie;
    
    // Ensure instance context is loaded
    await this.loadInstanceContext();
    
    const username = this.instanceContext.username;
    const password = this.instanceContext.password;
    const baseUrl = this.baseURL;
    
    this.sessionCookie = await prosbcLogin(baseUrl, username, password);
    return this.sessionCookie;
  }

  // Helper to get configuration name for REST API
  async getConfigName(configId) {
    if (!configId) return null;
    
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
      for (const testDbId of ['1', '2', '3', '4', '5']) {
        try {
          console.log(`[Update REST API] Searching for '${fileName}' in DB ID ${testDbId}...`);
          const testResponse = await fetch(`${this.baseURL}/file_dbs/${testDbId}/edit`, {
            method: 'GET',
            headers: await this.getCommonHeaders()
          });
          
          if (testResponse.ok) {
            const testHtml = await testResponse.text();
            console.log(`[Update REST API] DB ID ${testDbId} response length: ${testHtml.length}`);
            
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
        
        // Verify the update by fetching the file content to see if it changed
        try {
          const verifyResponse = await fetch(`${this.baseURL}/file_dbs/${dbId}/${fileType}/${fileDetails.id}/export`, {
            method: 'GET',
            headers: await this.getCommonHeaders()
          });
          if (verifyResponse.ok) {
            const updatedContent = await verifyResponse.text();
            if (updatedContent.trim() === fileContent.trim()) {
              console.log(`[Update REST API] ✓ Verification successful: File content matches what we sent`);
              return { 
                success: true, 
                message: `File '${fileName}' updated successfully via REST API`,
                status: response.status
              };
            } else {
              console.warn(`[Update REST API] ✗ Verification failed: File content doesn't match what we sent`);
              console.log(`[Update REST API] Expected content length: ${fileContent.length}, Actual: ${updatedContent.length}`);
              // Fall back to CSRF-based update
              console.log(`[Update REST API] Falling back to CSRF-based update method...`);
              return await this.updateFileCSRF(fileType, fileDetails.id, fileContent, fileName, dbId);
            }
          } else {
            console.warn(`[Update REST API] Could not verify update (export failed: ${verifyResponse.status}), assuming success`);
            return { 
              success: true, 
              message: `File '${fileName}' updated successfully via REST API (unverified)`,
              status: response.status
            };
          }
        } catch (verifyError) {
          console.warn(`[Update REST API] Verification error:`, verifyError.message);
          return { 
            success: true, 
            message: `File '${fileName}' updated successfully via REST API (verification failed)`,
            status: response.status
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

  // Helper to convert frontend config identifier to ProSBC numeric config ID
  async getNumericConfigId(configId) {
    if (!configId) return null;
    
    // If it's already numeric, return as is
    if (/^\d+$/.test(configId.toString())) {
      return configId.toString();
    }
    
    // Ensure we have fetched the live configs
    if (!this.configs) {
      const sessionCookie = await this.getSessionCookie();
      this.configs = await fetchLiveConfigIds(this.baseURL, sessionCookie);
    }
    
    // Try to find a config that matches the provided configId
    // This could be by name or by a pattern
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
    // Convert frontend config ID to numeric ID
    const numericConfigId = await this.getNumericConfigId(configId);
    
    // If configId is provided and different, always reselect
    if (this.configSelectionDone && (!numericConfigId || numericConfigId === this.selectedConfigId)) return;
    
    // Ensure instance context is loaded
    await this.loadInstanceContext();
    
    const sessionCookie = await this.getSessionCookie();
    // Fetch live configs
    this.configs = await fetchLiveConfigIds(this.baseURL, sessionCookie);
    console.log(`[Config Selection] Available configs from ProSBC:`, this.configs);
    
    // Pick config: use numericConfigId if set, else pick the active one
    let configToSelect = numericConfigId || this.selectedConfigId;
    if (!configToSelect) {
      const active = this.configs.find(cfg => cfg.active);
      configToSelect = active ? active.id : (this.configs[0] && this.configs[0].id);
      console.log(`[Config Selection] No specific config requested, using: ${configToSelect} (active: ${active ? 'yes' : 'first available'})`);
    } else {
      console.log(`[Config Selection] Selecting specific config: ${configToSelect} (requested: ${configId})`);
    }
    if (!configToSelect) throw new Error('No configuration found to select');
    await selectConfiguration(configToSelect, this.baseURL, sessionCookie);
    this.selectedConfigId = configToSelect;
    this.configSelectionDone = true;
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

  async uploadDfFile(filePath, onProgress, configId = null, originalFileName = null) {
    try {
      await this.ensureConfigSelected(configId);
      const dbId = this.selectedConfigId;
      const fileName = originalFileName || path.basename(filePath);
      console.log(`[Upload DF] Instance: ${this.instanceId}, Config: ${configId || 'auto'} -> DB ID: ${dbId}, File: ${fileName}`);
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
      
      console.log(`[Upload DF] Response status: ${uploadResponse.status}`);
      console.log(`[Upload DF] Response headers:`, Object.fromEntries(uploadResponse.headers.entries()));
      
      const responseText = await uploadResponse.text();
      console.log(`[Upload DF] Response body preview:`, responseText.substring(0, 500));
      
      onProgress?.(100, 'Upload complete!');
      
      // For redirects, check if they contain success indicators
      if (uploadResponse.status === 302 || uploadResponse.status === 301) {
        const location = uploadResponse.headers.get('location');
        console.log(`[Upload DF] Redirect location: ${location}`);
        
        // Check for error messages in the response headers or body
        const setCookieHeader = uploadResponse.headers.get('set-cookie');
        if (setCookieHeader && setCookieHeader.includes('error')) {
          // Try to extract the error message from the session cookie
          const errorMatch = setCookieHeader.match(/error[^:]*:\s*([^&]+)/);
          if (errorMatch) {
            const errorMsg = decodeURIComponent(errorMatch[1]).replace(/\+/g, ' ');
            console.log(`[Upload DF] Server error detected: ${errorMsg}`);
            
            // Check for specific error types
            if (errorMsg.toLowerCase().includes('already been taken') || 
                errorMsg.toLowerCase().includes('name') && errorMsg.toLowerCase().includes('taken')) {
              throw new Error(`File name already exists: ${errorMsg}`);
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

  async uploadDmFile(filePath, onProgress, configId = null, originalFileName = null) {
    try {
      await this.ensureConfigSelected(configId);
      const dbId = this.selectedConfigId;
      const fileName = originalFileName || path.basename(filePath);
      console.log(`[Upload DM] Instance: ${this.instanceId}, Config: ${configId || 'auto'} -> DB ID: ${dbId}, File: ${fileName}`);
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
      
      console.log(`[Upload DM] Response status: ${uploadResponse.status}`);
      console.log(`[Upload DM] Response headers:`, Object.fromEntries(uploadResponse.headers.entries()));
      
      const responseText = await uploadResponse.text();
      console.log(`[Upload DM] Response body preview:`, responseText.substring(0, 500));
      
      onProgress?.(100, 'Upload complete!');
      
      // For redirects, check if they contain success indicators
      if (uploadResponse.status === 302 || uploadResponse.status === 301) {
        const location = uploadResponse.headers.get('location');
        console.log(`[Upload DM] Redirect location: ${location}`);
        
        // Check for error messages in the response headers or body
        const setCookieHeader = uploadResponse.headers.get('set-cookie');
        if (setCookieHeader && setCookieHeader.includes('error')) {
          // Try to extract the error message from the session cookie
          const errorMatch = setCookieHeader.match(/error[^:]*:\s*([^&]+)/);
          if (errorMatch) {
            const errorMsg = decodeURIComponent(errorMatch[1]).replace(/\+/g, ' ');
            console.log(`[Upload DM] Server error detected: ${errorMsg}`);
            
            // Check for specific error types
            if (errorMsg.toLowerCase().includes('already been taken') || 
                errorMsg.toLowerCase().includes('name') && errorMsg.toLowerCase().includes('taken')) {
              throw new Error(`File name already exists: ${errorMsg}`);
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
              console.log(`[Upload DM] WARNING: Could not find file '${fileName}' in the redirect response. Upload may have failed.`);
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
      const dbId = this.selectedConfigId ;
      console.log(`[ProSBC] Fetching DF files list... (DB ID: ${dbId}, Config ID: ${configId})`);
      
      // Debug: Try multiple database IDs to see where files actually are
      for (const testDbId of ['1', '2', '3']) {
        try {
          console.log(`[ProSBC Debug] Checking DB ID ${testDbId} for files...`);
          const testResponse = await fetch(`${this.baseURL}/file_dbs/${testDbId}/edit`, {
            method: 'GET',
            headers: await this.getCommonHeaders()
          });
          if (testResponse.ok) {
            const testHtml = await testResponse.text();
            const testFiles = this.parseFileTable(testHtml, 'Routesets Definition', 'routesets_definitions');
            console.log(`[ProSBC Debug] DB ID ${testDbId} contains ${testFiles.length} DF files:`, testFiles.map(f => f.name));
          } else {
            console.log(`[ProSBC Debug] DB ID ${testDbId} returned status: ${testResponse.status}`);
          }
        } catch (err) {
          console.log(`[ProSBC Debug] DB ID ${testDbId} error:`, err.message);
        }
      }
      
      const response = await fetch(`${this.baseURL}/file_dbs/${dbId}/edit`, {
        method: 'GET',
        headers: await this.getCommonHeaders()
      });
      console.log('[ProSBC] Response status:', response.status);
      if (!response.ok) throw new Error(`Failed to fetch DF files: ${response.status}`);
      const html = await response.text();
      console.log('[ProSBC] HTML length:', html.length);
      console.log('[ProSBC] FULL HTML RESPONSE:');
      console.log(html);
      const files = this.parseFileTable(html, 'Routesets Definition', 'routesets_definitions');
      console.log('[ProSBC] Parsed DF files:', files);
      return { success: true, files };
    } catch (error) {
      console.error('[ProSBC] listDfFiles error:', error);
      throw error;
    }
  }

  async listDmFiles(configId = null) {
    try {
      await this.ensureConfigSelected(configId);
      const dbId = this.selectedConfigId ;
      console.log(`[ProSBC] Fetching DM files list... (DB ID: ${dbId}, Config ID: ${configId})`);
      
      // Debug: Try multiple database IDs to see where files actually are
      for (const testDbId of ['1', '2', '3']) {
        try {
          console.log(`[ProSBC Debug] Checking DB ID ${testDbId} for DM files...`);
          const testResponse = await fetch(`${this.baseURL}/file_dbs/${testDbId}/edit`, {
            method: 'GET',
            headers: await this.getCommonHeaders()
          });
          if (testResponse.ok) {
            const testHtml = await testResponse.text();
            const testFiles = this.parseFileTable(testHtml, 'Routesets Digitmap', 'routesets_digitmaps');
            console.log(`[ProSBC Debug] DB ID ${testDbId} contains ${testFiles.length} DM files:`, testFiles.map(f => f.name));
          } else {
            console.log(`[ProSBC Debug] DB ID ${testDbId} returned status: ${testResponse.status}`);
          }
        } catch (err) {
          console.log(`[ProSBC Debug] DB ID ${testDbId} error:`, err.message);
        }
      }
      
      const response = await fetch(`${this.baseURL}/file_dbs/${dbId}/edit`, {
        method: 'GET',
        headers: await this.getCommonHeaders()
      });
      console.log('[ProSBC] Response status:', response.status);
      if (!response.ok) throw new Error(`Failed to fetch DM files: ${response.status}`);
      const html = await response.text();
      console.log('[ProSBC] HTML length:', html.length);
      console.log('[ProSBC] FULL HTML RESPONSE:');
      console.log(html);
      const files = this.parseFileTable(html, 'Routesets Digitmap', 'routesets_digitmaps');
      console.log('[ProSBC] Parsed DM files:', files);
      return { success: true, files };
    } catch (error) {
      console.error('[ProSBC] listDmFiles error:', error);
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
      // Example row:
      // <td><a href="/file_dbs/3/routesets_digitmaps/61/edit" ...>Update</a></td>
      // <td><a href="/file_dbs/3/routesets_digitmaps/61/export" ...>Export</a></td>
      // <td><a href="/file_dbs/3/routesets_digitmaps/61" ...>Delete</a></td>
      const rowRegex = new RegExp(
        `<tr>\\s*<td>([^<]+)<\\/td>\\s*` +
        `<td><a href=\\"/file_dbs/(\\d+)/(?:${fileType})/(\\d+)/edit\\"[^>]*>Update<\\/a><\\/td>\\s*` +
        `<td><a href=\\"/file_dbs/\\d+/(?:${fileType})/(\\d+)/export\\"[^>]*>Export<\\/a><\\/td>\\s*` +
        `<td><a href=\\"/file_dbs/\\d+/(?:${fileType})/(\\d+)\\"[^>]*onclick=[^>]*>Delete<\\/a><\\/td>\\s*<\\/tr>`,
        'g'
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
export { ProSBCFileAPI };
export default new ProSBCFileAPI();

// Factory function to create instance-specific API clients
export function createProSBCFileAPI(instanceId) {
  return new ProSBCFileAPI(instanceId);
}
