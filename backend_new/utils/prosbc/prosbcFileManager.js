// Backend ProSBC File API utilities
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
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

  // Fetch configs and select the active one (or a specific one if set)
  // Accepts configId (string/number) to override selection for this operation
  async ensureConfigSelected(configId = null) {
    // If configId is provided and different, always reselect
    if (this.configSelectionDone && (!configId || configId === this.selectedConfigId)) return;
    
    // Ensure instance context is loaded
    await this.loadInstanceContext();
    
    const sessionCookie = await this.getSessionCookie();
    // Fetch live configs
    this.configs = await fetchLiveConfigIds(this.baseURL, sessionCookie);
    // Pick config: use configId if set, else pick the active one
    let configToSelect = configId || this.selectedConfigId;
    if (!configToSelect) {
      const active = this.configs.find(cfg => cfg.active);
      configToSelect = active ? active.id : (this.configs[0] && this.configs[0].id);
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

  async uploadDfFile(filePath, onProgress, configId = null) {
    try {
      await this.ensureConfigSelected(configId);
      const dbId = this.selectedConfigId ;
      const fileName = filePath.split('/').pop();
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
        /authenticity_token['"]\s*:\s*['"]([^'"]+)['"]/
      ];
      for (const pattern of patterns) {
        const match = formHTML.match(pattern);
        if (match) {
          csrfToken = match[1];
          break;
        }
      }
      if (!csrfToken) {
        console.error('[CSRF Extraction] Raw HTML:', formHTML.substring(0, 1000));
        throw new Error('Could not find CSRF token in upload form');
      }
      onProgress?.(75, 'Uploading file...');
      const formData = new FormData();
      formData.append('authenticity_token', csrfToken);
      formData.append('tbgw_routesets_definition[file]', fs.createReadStream(filePath));
      formData.append('tbgw_routesets_definition[tbgw_files_db_id]', dbId);
      formData.append('commit', 'Import');
      const uploadHeaders = await this.getCommonHeaders();
      uploadHeaders['Referer'] = `${this.baseURL}/file_dbs/${dbId}/routesets_definitions/new`;
      const uploadResponse = await fetch(`${this.baseURL}/file_dbs/${dbId}/routesets_definitions`, {
        method: 'POST',
        headers: uploadHeaders,
        body: formData
      });
      onProgress?.(100, 'Upload complete!');
      if (uploadResponse.ok || uploadResponse.status === 302) {
        return { success: true, message: 'DF file uploaded successfully!' };
      } else {
        const errorText = await uploadResponse.text();
        throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText.substring(0, 200)}`);
      }
    } catch (error) {
      throw error;
    }
  }

  async uploadDmFile(filePath, onProgress, configId = null) {
    try {
      await this.ensureConfigSelected(configId);
      const dbId = this.selectedConfigId || '1';
      const fileName = filePath.split('/').pop();
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
      const csrfMatch = formHTML.match(/name="authenticity_token"[^>]*value="([^"]+)"/);
      if (!csrfMatch) throw new Error('Could not find CSRF token in upload form');
      const csrfToken = csrfMatch[1];
      onProgress?.(75, 'Uploading file...');
      const formData = new FormData();
      formData.append('authenticity_token', csrfToken);
      formData.append('tbgw_routesets_digitmap[file]', fs.createReadStream(filePath));
      formData.append('tbgw_routesets_digitmap[tbgw_files_db_id]', dbId);
      formData.append('commit', 'Import');
      const uploadHeaders = await this.getCommonHeaders();
      uploadHeaders['Referer'] = `${this.baseURL}/file_dbs/${dbId}/routesets_digitmaps/new`;
      const uploadResponse = await fetch(`${this.baseURL}/file_dbs/${dbId}/routesets_digitmaps`, {
        method: 'POST',
        headers: uploadHeaders,
        body: formData
      });
      onProgress?.(100, 'Upload complete!');
      if (uploadResponse.ok || uploadResponse.status === 302) {
        return { success: true, message: 'DM file uploaded successfully!' };
      } else {
        const errorText = await uploadResponse.text();
        throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText.substring(0, 200)}`);
      }
    } catch (error) {
      throw error;
    }
  }

  async listDfFiles(configId = null) {
    try {
      await this.ensureConfigSelected(configId);
      const dbId = this.selectedConfigId || '3';
      console.log('[ProSBC] Fetching DF files list...');
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
      const dbId = this.selectedConfigId || '3';
      console.log('[ProSBC] Fetching DM files list...');
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
      console.log('[ProSBC] Section HTML preview:', sectionHtml.substring(0, 500));
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
      const dbId = configId || '1';
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
      const dbId = configId || '1';
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
      const dbId = configId || '1';
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
      const dbId = configId || '1';
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
