// ProSBC File API utilities
export class ProSBCFileAPI {
  constructor() {
    this.baseURL = '/api';
    this.sessionCookies = null;
  }

  // Get basic auth header
  getBasicAuthHeader() {
    const username = import.meta.env.VITE_PROSBC_USERNAME || 'admin';
    const password = import.meta.env.VITE_PROSBC_PASSWORD || 'admin';
    console.log('Using credentials - Username:', username, 'Password length:', password?.length);
    const credentials = btoa(`${username}:${password}`);
    return `Basic ${credentials}`;
  }

  // Get common headers with basic auth
  getCommonHeaders() {
    return {
      'Authorization': this.getBasicAuthHeader(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
      'Cache-Control': 'no-cache'
    };
  }

  // Upload DF (Definition) file
  async uploadDfFile(file, onProgress) {
    try {
      console.log('Starting DF file upload for:', file.name);
      
      onProgress?.(25, 'Getting upload form...');

      // Get the DF upload form with basic auth
      const newDfResponse = await fetch(`${this.baseURL}/file_dbs/1/routesets_definitions/new`, {
        method: 'GET',
        headers: this.getCommonHeaders()
      });

      console.log('DF form response status:', newDfResponse.status);

      if (!newDfResponse.ok) {
        const errorText = await newDfResponse.text();
        console.error('DF form error:', errorText.substring(0, 500));
        throw new Error(`Failed to get DF upload form: ${newDfResponse.status} - ${errorText.substring(0, 200)}`);
      }

      onProgress?.(50, 'Extracting security token...');

      const formHTML = await newDfResponse.text();
      console.log('DF form HTML length:', formHTML.length);
      
      // Debug: Look for form input fields
      const inputMatches = formHTML.match(/<input[^>]*>/g) || [];
      console.log('Form inputs found:', inputMatches.length);
      inputMatches.forEach((input, index) => {
        if (index < 10) { // Log first 10 inputs
          console.log(`Input ${index}:`, input);
        }
      });
      
      const csrfMatch = formHTML.match(/name="authenticity_token"[^>]*value="([^"]+)"/);
      
      if (!csrfMatch) {
        console.error('CSRF token not found in DF form HTML');
        console.log('HTML preview:', formHTML.substring(0, 1000));
        throw new Error('Could not find CSRF token in upload form');
      }

      const csrfToken = csrfMatch[1];
      console.log('DF CSRF token extracted:', csrfToken.substring(0, 20) + '...');

      onProgress?.(75, 'Uploading file...');

      // Prepare form data
      const formData = new FormData();
      formData.append('authenticity_token', csrfToken);
      formData.append('tbgw_routesets_definition[file]', file);
      formData.append('tbgw_routesets_definition[tbgw_files_db_id]', '1');
      formData.append('commit', 'Import');

      console.log('DF FormData prepared, file size:', file.size);
      console.log('FormData keys:', Array.from(formData.keys()));

      // Upload the file with basic auth
      const uploadHeaders = {
        ...this.getCommonHeaders(),
        'Referer': `${this.baseURL}/file_dbs/1/routesets_definitions/new`
      };
      
      // Don't set Content-Type header - let browser set it for FormData
      delete uploadHeaders['Content-Type'];

      const uploadResponse = await fetch(`${this.baseURL}/file_dbs/1/routesets_definitions`, {
        method: 'POST',
        headers: uploadHeaders,
        body: formData
      });

      console.log('DF upload response status:', uploadResponse.status);

      onProgress?.(100, 'Upload complete!');

      if (uploadResponse.ok || uploadResponse.status === 302) {
        const responseText = await uploadResponse.text();
        console.log('DF upload response preview:', responseText.substring(0, 500));
        
        // 302 redirect usually indicates success in Rails apps
        if (uploadResponse.status === 302) {
          return { success: true, message: 'DF file uploaded successfully! (302 redirect received)' };
        }
        
        // Check if the response contains success indication
        if (responseText.includes('successfully imported') || 
            responseText.includes('success') || 
            responseText.includes('imported')) {
          return { success: true, message: 'DF file uploaded successfully!' };
        } else {
          console.warn('DF upload may have failed - no clear success indicator');
          return { success: true, message: 'File uploaded - please verify in ProSBC interface' };
        }
      } else {
        const errorText = await uploadResponse.text();
        console.error('DF upload failed:', errorText.substring(0, 1000));
        throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText.substring(0, 200)}`);
      }

    } catch (error) {
      console.error('DF Upload error:', error);
      throw error;
    }
  }

  // Upload DM (Digit Map) file
  async uploadDmFile(file, onProgress) {
    try {
      console.log('Starting DM file upload for:', file.name);
      
      onProgress?.(25, 'Getting upload form...');

      // Get the DM upload form with basic auth
      const newDmResponse = await fetch(`${this.baseURL}/file_dbs/1/routesets_digitmaps/new`, {
        method: 'GET',
        headers: this.getCommonHeaders()
      });

      console.log('DM form response status:', newDmResponse.status);

      if (!newDmResponse.ok) {
        const errorText = await newDmResponse.text();
        console.error('DM form error:', errorText.substring(0, 500));
        throw new Error(`Failed to get DM upload form: ${newDmResponse.status} - ${errorText.substring(0, 200)}`);
      }

      onProgress?.(50, 'Extracting security token...');

      const formHTML = await newDmResponse.text();
      console.log('DM form HTML length:', formHTML.length);
      
      // Debug: Look for form input fields
      const inputMatches = formHTML.match(/<input[^>]*>/g) || [];
      console.log('DM Form inputs found:', inputMatches.length);
      inputMatches.forEach((input, index) => {
        if (index < 10) { // Log first 10 inputs
          console.log(`DM Input ${index}:`, input);
        }
      });
      
      const csrfMatch = formHTML.match(/name="authenticity_token"[^>]*value="([^"]+)"/);
      
      if (!csrfMatch) {
        console.error('CSRF token not found in DM form HTML');
        console.log('HTML preview:', formHTML.substring(0, 1000));
        throw new Error('Could not find CSRF token in upload form');
      }

      const csrfToken = csrfMatch[1];
      console.log('DM CSRF token extracted:', csrfToken.substring(0, 20) + '...');

      onProgress?.(75, 'Uploading file...');

      // Prepare form data
      const formData = new FormData();
      formData.append('authenticity_token', csrfToken);
      formData.append('tbgw_routesets_digitmap[file]', file);
      formData.append('tbgw_routesets_digitmap[tbgw_files_db_id]', '1');
      formData.append('commit', 'Import');

      console.log('DM FormData prepared, file size:', file.size);

      // Upload the file with basic auth
      const uploadHeaders = {
        ...this.getCommonHeaders(),
        'Referer': `${this.baseURL}/file_dbs/1/routesets_digitmaps/new`
      };
      
      // Don't set Content-Type header - let browser set it for FormData
      delete uploadHeaders['Content-Type'];

      const uploadResponse = await fetch(`${this.baseURL}/file_dbs/1/routesets_digitmaps`, {
        method: 'POST',
        headers: uploadHeaders,
        body: formData
      });

      console.log('DM upload response status:', uploadResponse.status);

      onProgress?.(100, 'Upload complete!');

      if (uploadResponse.ok || uploadResponse.status === 302) {
        const responseText = await uploadResponse.text();
        console.log('DM upload response preview:', responseText.substring(0, 500));
        
        // 302 redirect usually indicates success in Rails apps
        if (uploadResponse.status === 302) {
          return { success: true, message: 'DM file uploaded successfully! (302 redirect received)' };
        }
        
        // Check if the response contains success indication
        if (responseText.includes('successfully imported') || 
            responseText.includes('success') || 
            responseText.includes('imported')) {
          return { success: true, message: 'DM file uploaded successfully!' };
        } else {
          console.warn('DM upload may have failed - no clear success indicator');
          return { success: true, message: 'File uploaded - please verify in ProSBC interface' };
        }
      } else {
        const errorText = await uploadResponse.text();
        console.error('DM upload failed:', errorText.substring(0, 1000));
        throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText.substring(0, 200)}`);
      }

    } catch (error) {
      console.error('DM Upload error:', error);
      throw error;
    }
  }

  // List uploaded DF files
  async listDfFiles() {
    try {
      console.log('Fetching DF files list...');
      
      const response = await fetch(`${this.baseURL}/file_dbs/1/edit`, {
        method: 'GET',
        headers: this.getCommonHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch DF files: ${response.status}`);
      }

      const html = await response.text();
      console.log('DF files list HTML length:', html.length);
      
      // Parse the HTML to extract DF file information
      const files = this.parseFileTable(html, 'Routesets Definition', 'routesets_definitions');
      
      return { success: true, files };
      
    } catch (error) {
      console.error('List DF files error:', error);
      throw error;
    }
  }

  // List uploaded DM files
  async listDmFiles() {
    try {
      console.log('Fetching DM files list...');
      
      const response = await fetch(`${this.baseURL}/file_dbs/1/edit`, {
        method: 'GET',
        headers: this.getCommonHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch DM files: ${response.status}`);
      }

      const html = await response.text();
      console.log('DM files list HTML length:', html.length);
      
      // Parse the HTML to extract DM file information
      const files = this.parseFileTable(html, 'Routesets Digitmap', 'routesets_digitmaps');
      
      return { success: true, files };
      
    } catch (error) {
      console.error('List DM files error:', error);
      throw error;
    }
  }

  // Get system status
  async getSystemStatus() {
    try {
      console.log('Checking ProSBC system status...');
      
      const response = await fetch(`${this.baseURL}/dashboard`, {
        method: 'GET',
        headers: this.getCommonHeaders()
      });

      return {
        isOnline: response.ok,
        status: response.ok ? 'Online' : 'Offline',
        statusCode: response.status
      };
      
    } catch (error) {
      console.error('System status check error:', error);
      return {
        isOnline: false,
        status: 'Error',
        statusCode: 0,
        error: error.message
      };
    }
  }

  // Parse file table from HTML
  parseFileTable(html, sectionTitle, fileType) {
    const files = [];
    
    try {
      // Find the fieldset with the specified legend
      const sectionRegex = new RegExp(`<fieldset>\\s*<legend>${sectionTitle}:</legend>([\\s\\S]*?)</fieldset>`, 'i');
      const sectionMatch = html.match(sectionRegex);
      
      if (!sectionMatch) {
        console.warn(`Section "${sectionTitle}" not found in HTML`);
        return files;
      }
      
      const sectionHtml = sectionMatch[1];
      
      // Extract table rows
      const rowRegex = /<tr>\s*<td>([^<]+)<\/td>\s*<td><a href="\/file_dbs\/1\/[^\/]+\/(\d+)\/edit"[^>]*>Update<\/a><\/td>\s*<td><a href="\/file_dbs\/1\/[^\/]+\/(\d+)\/export"[^>]*>Export<\/a><\/td>\s*<td><a href="\/file_dbs\/1\/[^\/]+\/(\d+)"[^>]*onclick="[^"]*">Delete<\/a><\/td>\s*<\/tr>/g;
      
      let match;
      while ((match = rowRegex.exec(sectionHtml)) !== null) {
        const [, fileName, updateId, exportId, deleteId] = match;
        
        files.push({
          id: updateId, // Using update ID as the primary ID
          name: fileName.trim(),
          type: fileType,
          updateUrl: `/file_dbs/1/${fileType}/${updateId}/edit`,
          exportUrl: `/file_dbs/1/${fileType}/${exportId}/export`,
          deleteUrl: `/file_dbs/1/${fileType}/${deleteId}`
        });
      }
      
      console.log(`Parsed ${files.length} files from ${sectionTitle} section`);
      
    } catch (error) {
      console.error('Error parsing file table:', error);
    }
    
    return files;
  }

  // Export file
  async exportFile(fileType, fileId, fileName) {
    try {
      console.log(`Exporting ${fileType} file ID: ${fileId}`);
      
      const response = await fetch(`${this.baseURL}/file_dbs/1/${fileType}/${fileId}/export`, {
        method: 'GET',
        headers: this.getCommonHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to export file: ${response.status}`);
      }

      // Get the file content as blob
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      return { success: true, message: `File "${fileName}" exported successfully!` };
      
    } catch (error) {
      console.error('Export file error:', error);
      throw error;
    }
  }

  // Delete file
  async deleteFile(fileType, fileId, fileName) {
    try {
      console.log(`Deleting ${fileType} file ID: ${fileId}`);
      
      // First, try to get CSRF token from upload form pages which are more reliable
      let csrfToken = null;
      let uploadFormUrl = fileType === 'routesets_definitions' 
        ? `${this.baseURL}/file_dbs/1/routesets_definitions/new`
        : `${this.baseURL}/file_dbs/1/routesets_digitmaps/new`;
      
      console.log('Attempting to get CSRF token from upload form:', uploadFormUrl);
      
      try {
        const uploadFormResponse = await fetch(uploadFormUrl, {
          method: 'GET',
          headers: this.getCommonHeaders()
        });

        if (uploadFormResponse.ok) {
          const uploadFormHtml = await uploadFormResponse.text();
          const uploadCsrfMatch = uploadFormHtml.match(/name="authenticity_token"[^>]*value="([^"]+)"/);
          if (uploadCsrfMatch) {
            csrfToken = uploadCsrfMatch[1];
            console.log('CSRF token found in upload form:', csrfToken.substring(0, 20) + '...');
          }
        }
      } catch (uploadError) {
        console.warn('Failed to get CSRF from upload form, trying main page:', uploadError.message);
      }
      
      // If upload form failed, try the main page
      if (!csrfToken) {
        console.log('Trying to get CSRF token from main edit page...');
        const mainPageResponse = await fetch(`${this.baseURL}/file_dbs/1/edit`, {
          method: 'GET',
          headers: this.getCommonHeaders()
        });

        if (!mainPageResponse.ok) {
          throw new Error(`Failed to get main page: ${mainPageResponse.status}`);
        }

        const html = await mainPageResponse.text();
        console.log('Main page HTML length:', html.length);
        
        // Try multiple patterns to find CSRF token
        const patterns = [
          // Pattern 1: In onclick handlers for delete buttons
          new RegExp(`onclick="[^"]*authenticity_token[^"]*value[^"]*'([^']+)'[^"]*"`, 'g'),
          // Pattern 2: Standard input field
          /name="authenticity_token"[^>]*value="([^"]+)"/,
          // Pattern 3: In meta tags
          /name="csrf-token"[^>]*content="([^"]+)"/,
          // Pattern 4: In JavaScript variables
          /authenticity_token['"]\s*:\s*['"]([^'"]+)['"]/
        ];
        
        for (const pattern of patterns) {
          const match = html.match(pattern);
          if (match) {
            csrfToken = match[1];
            console.log('CSRF token found using pattern:', pattern.source.substring(0, 50) + '...');
            break;
          }
        }
        
        // If still not found, try to extract from the specific delete link for this file
        if (!csrfToken && html.includes(`/file_dbs/1/${fileType}/${fileId}`)) {
          const deleteSection = html.substring(
            html.indexOf(`/file_dbs/1/${fileType}/${fileId}`) - 200,
            html.indexOf(`/file_dbs/1/${fileType}/${fileId}`) + 500
          );
          console.log('Delete section HTML:', deleteSection);
          
          const deleteTokenMatch = deleteSection.match(/authenticity_token[^']*'([^']+)'/);
          if (deleteTokenMatch) {
            csrfToken = deleteTokenMatch[1];
            console.log('CSRF token found in delete section:', csrfToken.substring(0, 20) + '...');
          }
        }
      }
      
      if (!csrfToken) {
        console.error('CSRF token not found in any source');
        throw new Error('Could not find CSRF token for delete operation. Please ensure you are logged in.');
      }

      // Prepare form data for delete request
      const formData = new FormData();
      formData.append('authenticity_token', csrfToken);
      formData.append('_method', 'delete');

      console.log('Sending delete request with CSRF token...');

      const deleteHeaders = {
        ...this.getCommonHeaders(),
        'Referer': `${this.baseURL}/file_dbs/1/edit`,
        'X-Requested-With': 'XMLHttpRequest'
      };
      
      // Remove Content-Type to let browser set it for FormData
      delete deleteHeaders['Content-Type'];

      const response = await fetch(`${this.baseURL}/file_dbs/1/${fileType}/${fileId}`, {
        method: 'POST',
        headers: deleteHeaders,
        body: formData
      });

      console.log('Delete response status:', response.status);

      if (response.ok || response.status === 302) {
        const responseText = await response.text();
        console.log('Delete response preview:', responseText.substring(0, 500));
        return { success: true, message: `File "${fileName}" deleted successfully!` };
      } else {
        const errorText = await response.text();
        console.error('Delete failed response:', errorText.substring(0, 1000));
        throw new Error(`Delete failed: ${response.status} - ${errorText.substring(0, 200)}`);
      }
      
    } catch (error) {
      console.error('Delete file error:', error);
      throw error;
    }
  }

  // Get file content for update
  async getFileContent(fileType, fileId) {
    try {
      console.log(`Getting ${fileType} file content for ID: ${fileId}`);
      
      const response = await fetch(`${this.baseURL}/file_dbs/1/${fileType}/${fileId}/edit`, {
        method: 'GET',
        headers: this.getCommonHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get file content: ${response.status}`);
      }

      const html = await response.text();
      
      // Extract file content from textarea or other form elements
      const textareaMatch = html.match(/<textarea[^>]*name="[^"]*\[uploaded_data\]"[^>]*>([\s\S]*?)<\/textarea>/);
      
      if (textareaMatch) {
        return { 
          success: true, 
          content: textareaMatch[1],
          html: html // For extracting form fields if needed
        };
      } else {
        return { 
          success: true, 
          content: '', 
          html: html,
          message: 'File content not found in textarea - file may be binary or use different format'
        };
      }
      
    } catch (error) {
      console.error('Get file content error:', error);
      throw error;
    }
  }

  // Update file content
  async updateFile(fileType, fileId, newContent, fileName) {
    try {
      console.log(`Updating ${fileType} file ID: ${fileId}`);
      
      // First get the edit form to extract CSRF token and form structure
      const editResponse = await fetch(`${this.baseURL}/file_dbs/1/${fileType}/${fileId}/edit`, {
        method: 'GET',
        headers: this.getCommonHeaders()
      });

      if (!editResponse.ok) {
        throw new Error(`Failed to get edit form: ${editResponse.status}`);
      }

      const editHtml = await editResponse.text();
      console.log('Edit form HTML length:', editHtml.length);
      
      // Extract CSRF token
      const csrfMatch = editHtml.match(/name="authenticity_token"[^>]*value="([^"]+)"/);
      
      if (!csrfMatch) {
        console.error('CSRF token not found in edit form');
        console.log('Edit form HTML preview:', editHtml.substring(0, 1000));
        throw new Error('Could not find CSRF token for update operation');
      }

      const csrfToken = csrfMatch[1];
      console.log('Update CSRF token extracted:', csrfToken.substring(0, 20) + '...');

      // Prepare form data for update
      const formData = new FormData();
      formData.append('authenticity_token', csrfToken);
      formData.append('_method', 'patch');
      
      // Determine the correct field name based on file type
      const fieldName = fileType === 'routesets_definitions' 
        ? 'tbgw_routesets_definition[uploaded_data]'
        : 'routesets_digitmap[uploaded_data]';
      
      formData.append(fieldName, newContent);
      formData.append('commit', 'Update');

      console.log('Update FormData prepared');

      const updateHeaders = {
        ...this.getCommonHeaders(),
        'Referer': `${this.baseURL}/file_dbs/1/${fileType}/${fileId}/edit`
      };
      
      // Remove Content-Type to let browser set it for FormData
      delete updateHeaders['Content-Type'];

      const response = await fetch(`${this.baseURL}/file_dbs/1/${fileType}/${fileId}`, {
        method: 'POST',
        headers: updateHeaders,
        body: formData
      });

      console.log('Update response status:', response.status);

      if (response.ok || response.status === 302) {
        const responseText = await response.text();
        console.log('Update response preview:', responseText.substring(0, 500));
        return { success: true, message: `File "${fileName}" updated successfully!` };
      } else {
        const errorText = await response.text();
        console.error('Update failed response:', errorText.substring(0, 1000));
        throw new Error(`Update failed: ${response.status} - ${errorText.substring(0, 200)}`);
      }
      
    } catch (error) {
      console.error('Update file error:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const prosbcFileAPI = new ProSBCFileAPI();
