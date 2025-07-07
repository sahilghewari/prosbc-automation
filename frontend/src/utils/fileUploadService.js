// Utility functions for ProSBC file uploads

const API_BASE = '/api';

// Upload DF file to ProSBC
export const uploadDfFile = async (file, onProgress) => {
  try {
    // Step 1: Get CSRF token from new DF page
    onProgress?.("Getting authentication token...", 25);
    
    const newDfResponse = await fetch(`${API_BASE}/file_dbs/1/routesets_definitions/new`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
      }
    });

    if (!newDfResponse.ok) {
      throw new Error(`Failed to access DF upload page: ${newDfResponse.status}`);
    }

    onProgress?.("Extracting CSRF token...", 50);
    const htmlContent = await newDfResponse.text();
    
    // Extract CSRF token
    const csrfMatch = htmlContent.match(/name="authenticity_token"[^>]*value="([^"]+)"/);
    if (!csrfMatch) {
      throw new Error('Could not find CSRF token');
    }
    const csrfToken = csrfMatch[1];

    // Step 2: Upload file
    onProgress?.("Uploading DF file...", 75);

    const formData = new FormData();
    formData.append('authenticity_token', csrfToken);
    formData.append('routesets_definition[uploaded_data]', file);
    formData.append('commit', 'Import');

    const uploadResponse = await fetch(`${API_BASE}/file_dbs/1/routesets_definitions`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        'Referer': `${API_BASE}/file_dbs/1/routesets_definitions/new`
      },
      body: formData
    });

    if (uploadResponse.ok) {
      onProgress?.("Upload completed successfully!", 100);
      return { success: true, message: 'DF file uploaded successfully!' };
    } else {
      throw new Error(`Upload failed with status: ${uploadResponse.status}`);
    }

  } catch (error) {
    console.error('DF Upload error:', error);
    throw error;
  }
};

// Upload DM file to ProSBC
export const uploadDmFile = async (file, onProgress) => {
  try {
    // Step 1: Get CSRF token from new DM page
    onProgress?.("Getting authentication token...", 25);
    
    const newDmResponse = await fetch(`${API_BASE}/file_dbs/1/routesets_digitmaps/new`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
      }
    });

    if (!newDmResponse.ok) {
      throw new Error(`Failed to access DM upload page: ${newDmResponse.status}`);
    }

    onProgress?.("Extracting CSRF token...", 50);
    const htmlContent = await newDmResponse.text();
    
    // Extract CSRF token
    const csrfMatch = htmlContent.match(/name="authenticity_token"[^>]*value="([^"]+)"/);
    if (!csrfMatch) {
      throw new Error('Could not find CSRF token');
    }
    const csrfToken = csrfMatch[1];

    // Step 2: Upload file
    onProgress?.("Uploading DM file...", 75);

    const formData = new FormData();
    formData.append('authenticity_token', csrfToken);
    formData.append('routesets_digitmap[uploaded_data]', file);
    formData.append('commit', 'Import');

    const uploadResponse = await fetch(`${API_BASE}/file_dbs/1/routesets_digitmaps`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        'Referer': `${API_BASE}/file_dbs/1/routesets_digitmaps/new`
      },
      body: formData
    });

    if (uploadResponse.ok) {
      onProgress?.("Upload completed successfully!", 100);
      return { success: true, message: 'DM file uploaded successfully!' };
    } else {
      throw new Error(`Upload failed with status: ${uploadResponse.status}`);
    }

  } catch (error) {
    console.error('DM Upload error:', error);
    throw error;
  }
};

// Get file size in readable format
export const getFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Validate file type
export const validateFileType = (file, allowedTypes = ['.xml', '.csv', '.txt']) => {
  const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
  return allowedTypes.includes(fileExtension);
};

// Check if file size is within limits
export const validateFileSize = (file, maxSizeMB = 50) => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
};
