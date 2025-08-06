
import express from 'express';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import prosbcFileManager, { createProSBCFileAPI } from '../utils/prosbc/prosbcFileManager.js';
import { getProSBCCredentials } from '../utils/prosbc/multiInstanceManager.js';

const router = express.Router();

// Helper to extract configId from request (query, body, or header)
function getConfigIdFromRequest(req) {
  return req.query.configId || 
         req.body?.configId || 
         req.headers['x-config-id'] || 
         req.headers['x-prosbc-config-id'] || 
         null;
}

// Helper to get instance-specific ProSBC configuration
async function getInstanceConfig(req) {
  const instanceId = req.headers['x-prosbc-instance-id'];
  
  if (instanceId) {
    console.log(`[FileManager] Using instance ${instanceId}`);
    const instance = await getProSBCCredentials(instanceId);
    if (instance) {
      return {
        baseURL: instance.baseUrl,
        username: instance.username,
        password: instance.password,
        instanceId: instanceId
      };
    } else {
      throw new Error(`Instance ${instanceId} not found`);
    }
  } else {
    console.log('[FileManager] Using default environment settings');
    return {
      baseURL: process.env.PROSBC_BASE_URL,
      username: process.env.PROSBC_USERNAME,
      password: process.env.PROSBC_PASSWORD,
      instanceId: 'default'
    };
  }
}

// Simple export: stream file directly to client as download
router.get('/export', async (req, res) => {
  try {
    const fileType = req.query.fileType;
    const fileId = req.query.fileId;
    const fileName = req.query.fileName || 'export.csv';
    const configId = req.query.configId;
    if (!fileType || !fileId) {
      return res.status(400).json({ success: false, error: 'Missing fileType or fileId' });
    }
    const dbId = configId ;
    const fetch = (await import('node-fetch')).default;
    const exportUrl = `${prosbcFileManager.baseURL}/file_dbs/${dbId}/${fileType}/${fileId}/export`;
    console.log(`[EXPORT] Fetching: ${exportUrl}`);
    const response = await fetch(exportUrl, {
      method: 'GET',
      headers: await prosbcFileManager.getCommonHeaders()
    });
    console.log(`[EXPORT] Response status: ${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
      const text = await response.text();
      console.error(`[EXPORT] Error response:`, text.substring(0, 300));
      return res.status(500).json({ success: false, error: `Failed to export file: ${response.status}`, details: text.substring(0, 300) });
    }
    // If not CSV, likely a login page or error
    if (!contentType.includes('csv')) {
      const text = await response.text();
      console.error(`[EXPORT] Unexpected content-type: ${contentType}`);
      if (text.includes('login') || text.includes('Login')) {
        return res.status(401).json({ success: false, error: 'Not authenticated to ProSBC. Please check credentials or session.' });
      }
      return res.status(500).json({ success: false, error: 'Unexpected response from ProSBC', details: text.substring(0, 300) });
    }
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'text/csv');
    response.body.pipe(res);
  } catch (err) {
    console.error('[EXPORT] Exception:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Download exported file
router.get('/download', async (req, res) => {
  try {
    const filePath = req.query.filePath;
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    res.download(filePath, path.basename(filePath), (err) => {
      // Optionally delete file after download
      try { fs.unlinkSync(filePath); } catch (e) {}
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
// List DF files
router.get('/df/list', async (req, res) => {
  try {
    const configId = getConfigIdFromRequest(req);
    const instanceId = req.headers['x-prosbc-instance-id'];
    
    // Create instance-specific file manager
    const instanceFileManager = createProSBCFileAPI(instanceId);
    
    const result = await instanceFileManager.listDfFiles(configId);
    console.log(`[DF List] Instance ${instanceId || 'default'} returned ${result.dfFiles?.length || 0} files`);
    res.json(result);
  } catch (err) {
    console.error('[DF List] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// List DM files
router.get('/dm/list', async (req, res) => {
  try {
    const configId = getConfigIdFromRequest(req);
    const instanceId = req.headers['x-prosbc-instance-id'];
    
    // Create instance-specific file manager
    const instanceFileManager = createProSBCFileAPI(instanceId);
    
    const result = await instanceFileManager.listDmFiles(configId);
    console.log(`[DM List] Instance ${instanceId || 'default'} returned ${result.dmFiles?.length || 0} files`);
    res.json(result);
  } catch (err) {
    console.error('[DM List] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Upload DF file
router.post('/df/upload', async (req, res) => {
  try {
    const filePath = req.body.filePath;
    if (!filePath) return res.status(400).json({ error: 'Missing filePath' });
    const configId = getConfigIdFromRequest(req);
    const result = await prosbcFileManager.uploadDfFile(filePath, undefined, configId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Upload DM file
router.post('/dm/upload', async (req, res) => {
  try {
    const filePath = req.body.filePath;
    if (!filePath) return res.status(400).json({ error: 'Missing filePath' });
    const configId = getConfigIdFromRequest(req);
    const result = await prosbcFileManager.uploadDmFile(filePath, undefined, configId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const upload = multer({
  dest: path.join(process.cwd(), 'uploads', 'update_tmp'),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Memory storage for REST API (small files, read content directly)
const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Upload DF file via FormData (new route for FileUploader component)
router.post('/df/upload-form', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    const instanceId = req.headers['x-prosbc-instance-id'];
    const configId = getConfigIdFromRequest(req);
    
    console.log(`[Upload DF] Instance: ${instanceId}, Config: ${configId}, File: ${req.file.originalname}`);
    
    // Create instance-specific ProSBC file manager
    const fileManager = await createProSBCFileAPI(instanceId);
    
    // Create a simple progress callback for logging
    const onProgress = (percent, message) => {
      console.log(`[Upload DF Progress] ${percent}% - ${message}`);
    };
    
    const result = await fileManager.uploadDfFile(req.file.path, onProgress, configId, req.file.originalname);
    
    // Clean up uploaded file
    try {
      await fs.promises.unlink(req.file.path);
    } catch (cleanupError) {
      console.warn('Failed to cleanup uploaded file:', cleanupError);
    }
    
    res.json(result);
  } catch (err) {
    console.error('[Upload DF] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Upload DM file via FormData (new route for FileUploader component)
router.post('/dm/upload-form', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    const instanceId = req.headers['x-prosbc-instance-id'];
    const configId = getConfigIdFromRequest(req);
    
    console.log(`[Upload DM] Instance: ${instanceId}, Config: ${configId}, File: ${req.file.originalname}`);
    
    // Create instance-specific ProSBC file manager
    const fileManager = await createProSBCFileAPI(instanceId);
    
    // Create a simple progress callback for logging
    const onProgress = (percent, message) => {
      console.log(`[Upload DM Progress] ${percent}% - ${message}`);
    };
    
    const result = await fileManager.uploadDmFile(req.file.path, onProgress, configId, req.file.originalname);
    
    // Clean up uploaded file
    try {
      await fs.promises.unlink(req.file.path);
    } catch (cleanupError) {
      console.warn('Failed to cleanup uploaded file:', cleanupError);
    }
    
    res.json(result);
  } catch (err) {
    console.error('[Upload DM] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// Get file content (for CSV editor etc)
router.get('/content', async (req, res) => {
  try {
    const fileType = req.query.fileType;
    const fileId = req.query.fileId;
    const configId = getConfigIdFromRequest(req);
    if (!fileType || !fileId) {
      return res.status(400).json({ success: false, error: 'Missing fileType or fileId' });
    }
    const result = await prosbcFileManager.getFileContent(fileType, fileId, configId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update file (accepts multipart/form-data)
router.post('/update', upload.single('file'), async (req, res) => {
  try {
    const { fileType, fileId } = req.body;
    if (!fileType || !fileId || !req.file) {
      return res.status(400).json({ error: 'Missing parameters (fileType, fileId, file)' });
    }
    // Rename temp file to original filename for ProSBC
    const tempPath = req.file.path;
    const originalName = req.file.originalname;
    const targetPath = path.join(path.dirname(tempPath), originalName);
    await fs.promises.rename(tempPath, targetPath);
    // Call the updateFile API with the renamed file path
    const configId = getConfigIdFromRequest(req);
    const result = await prosbcFileManager.updateFile(fileType, fileId, targetPath, undefined, configId);
    // Remove temp file after update
    fs.unlink(targetPath, () => {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete file using ProSBC REST API (clean and reliable)
router.post('/delete-direct', async (req, res) => {
  try {
    const { fileName, fileType, fileId, configId } = req.body;
    const instanceId = req.headers['x-prosbc-instance-id'];
    
    if (!fileName || !fileType) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters: fileName and fileType' 
      });
    }

    console.log(`[Delete REST API] Instance: ${instanceId}, File: ${fileName}, ID: ${fileId}, Type: ${fileType}, Config: ${configId}`);

    // Create instance-specific file manager
    const instanceFileManager = createProSBCFileAPI(instanceId);
    
    // Use REST API to delete the file with proper file ID
    const result = await instanceFileManager.deleteFileRestAPI(fileType, fileName, configId, fileId);
    
    res.json(result);

  } catch (err) {
    console.error('[Delete REST API] Error:', err);
    
    // Provide specific error messages based on error type
    if (err.message.includes('not found')) {
      res.status(404).json({ 
        success: false, 
        error: `File '${req.body.fileName}' not found in ProSBC` 
      });
    } else if (err.message.includes('Authentication failed')) {
      res.status(401).json({ 
        success: false, 
        error: 'Authentication failed. Please check ProSBC credentials.' 
      });
    } else if (err.message.includes('configuration name')) {
      res.status(400).json({ 
        success: false, 
        error: 'Could not determine ProSBC configuration for this instance' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: err.message 
      });
    }
  }
});

// Export file using direct ProSBC URL with authentication
router.post('/export-direct', async (req, res) => {
  try {
    const { exportUrl, fileName, fileType, fileId, configId } = req.body;
    const instanceId = req.headers['x-prosbc-instance-id'];
    
    if (!exportUrl) {
      return res.status(400).json({ success: false, error: 'Missing exportUrl' });
    }

    console.log(`[Export Direct] Instance: ${instanceId}, URL: ${exportUrl}, File: ${fileName}`);

    // Get instance configuration
    const instanceConfig = await getInstanceConfig(req);
    
    // Create instance-specific file manager to ensure proper authentication
    const instanceFileManager = createProSBCFileAPI(instanceId);
    const fullExportUrl = `${instanceConfig.baseURL}${exportUrl}`;

    const fetch = (await import('node-fetch')).default;
    console.log(`[Export Direct] Fetching: ${fullExportUrl}`);
    
    const response = await fetch(fullExportUrl, {
      method: 'GET',
      headers: await instanceFileManager.getCommonHeaders()
    });

    console.log(`[Export Direct] Response status: ${response.status}`);
    
    if (!response.ok) {
      const text = await response.text();
      console.error(`[Export Direct] Error response:`, text.substring(0, 300));
      
      // Check if it's a login page (authentication issue)
      if (text.includes('login') || text.includes('Login')) {
        return res.status(401).json({ 
          success: false, 
          error: 'Not authenticated to ProSBC. Session may have expired.' 
        });
      }
      
      return res.status(500).json({ 
        success: false, 
        error: `Failed to export file: ${response.status}`, 
        details: text.substring(0, 300) 
      });
    }

    // Check content type
    const contentType = response.headers.get('content-type') || '';
    console.log(`[Export Direct] Content-Type: ${contentType}`);
    
    // If not CSV or expected file type, likely an error page
    if (!contentType.includes('csv') && !contentType.includes('text/plain') && !contentType.includes('application/octet-stream')) {
      const text = await response.text();
      console.error(`[Export Direct] Unexpected content-type: ${contentType}`);
      
      if (text.includes('login') || text.includes('Login')) {
        return res.status(401).json({ 
          success: false, 
          error: 'Not authenticated to ProSBC. Please check credentials or session.' 
        });
      }
      
      return res.status(500).json({ 
        success: false, 
        error: 'Unexpected response from ProSBC', 
        details: text.substring(0, 300) 
      });
    }

    // Stream the file to the client
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', contentType);
    response.body.pipe(res);

  } catch (err) {
    console.error('[Export Direct] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update file using ProSBC REST API (clean and reliable)
router.post('/update-rest-api', uploadMemory.single('file'), async (req, res) => {
  try {
    const { fileName, fileType, configId } = req.body;
    const instanceId = req.headers['x-prosbc-instance-id'];
    
    if (!fileName || !fileType) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters: fileName and fileType' 
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No file uploaded' 
      });
    }

    console.log(`[Update REST API] Instance: ${instanceId}, File: ${fileName}, Type: ${fileType}, Config: ${configId}`);

    // Read file content from memory buffer
    const fileContent = req.file.buffer.toString('utf8');
    
    // Create instance-specific file manager
    const instanceFileManager = createProSBCFileAPI(instanceId);
    
    // Use REST API to update the file with file content
    const result = await instanceFileManager.updateFileRestAPI(fileType, fileName, fileContent, configId);
    
    res.json(result);

  } catch (err) {
    console.error('[Update REST API] Error:', err);
    
    // Provide specific error messages based on error type
    if (err.message.includes('not found')) {
      res.status(404).json({ 
        success: false, 
        error: `File '${req.body.fileName}' not found in ProSBC` 
      });
    } else if (err.message.includes('Authentication failed')) {
      res.status(401).json({ 
        success: false, 
        error: 'Authentication failed. Please check ProSBC credentials.' 
      });
    } else if (err.message.includes('configuration')) {
      res.status(400).json({ 
        success: false, 
        error: 'Could not determine ProSBC configuration for this instance.' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: err.message 
      });
    }
  }
});

// Update file using direct ProSBC URL
router.post('/update-direct', upload.single('file'), async (req, res) => {
  try {
    const { updateUrl, fileName, fileType, fileId, configId, uploadFileName } = req.body;
    const instanceId = req.headers['x-prosbc-instance-id'];
    
    if (!updateUrl) {
      return res.status(400).json({ success: false, error: 'Missing updateUrl' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    console.log(`[Update Direct] Instance: ${instanceId}, URL: ${updateUrl}, File: ${fileName}`);

    // Get instance configuration
    const instanceConfig = await getInstanceConfig(req);
    const fullUpdateUrl = `${instanceConfig.baseURL}${updateUrl}`;

    // First, get the update form to retrieve CSRF token
    const fetch = (await import('node-fetch')).default;
    console.log(`[Update Direct] Getting update form from: ${fullUpdateUrl}`);
    
    const formResponse = await fetch(fullUpdateUrl, {
      method: 'GET',
      headers: await prosbcFileManager.getCommonHeaders()
    });

    if (!formResponse.ok) {
      throw new Error(`Failed to get update form: ${formResponse.status}`);
    }

    const formHtml = await formResponse.text();
    const csrfMatch = formHtml.match(/name="authenticity_token"\s+type="hidden"\s+value="([^"]+)"/);
    
    if (!csrfMatch) {
      throw new Error('Could not find CSRF token in update form');
    }

    const csrfToken = csrfMatch[1];
    console.log(`[Update Direct] Found CSRF token: ${csrfToken.substring(0, 10)}...`);

    // Prepare the form data for file upload
    const FormData = require('form-data');
    const formData = new FormData();
    
    // Add the file
    const fileStream = fs.createReadStream(req.file.path);
    formData.append(`tbgw_${fileType}[file]`, fileStream, uploadFileName || req.file.originalname);
    
    // Add other required fields
    formData.append('_method', 'put');
    formData.append('authenticity_token', csrfToken);
    formData.append(`tbgw_${fileType}[id]`, fileId);

    // Construct the POST URL (remove /edit from the end)
    const postUrl = fullUpdateUrl.replace('/edit', '');
    console.log(`[Update Direct] Posting to: ${postUrl}`);

    // Perform the update
    const updateResponse = await fetch(postUrl, {
      method: 'POST',
      headers: {
        ...(await prosbcFileManager.getCommonHeaders()),
        ...formData.getHeaders()
      },
      body: formData,
      redirect: 'manual' // Don't follow redirects automatically
    });

    console.log(`[Update Direct] Update response status: ${updateResponse.status}`);

    // Clean up uploaded file
    try {
      await fs.promises.unlink(req.file.path);
    } catch (cleanupError) {
      console.warn('Failed to cleanup uploaded file:', cleanupError);
    }

    // ProSBC typically returns a 302 redirect on successful update
    if (updateResponse.status === 302 || updateResponse.status === 200) {
      res.json({ 
        success: true, 
        message: `${fileName} updated successfully`,
        status: updateResponse.status
      });
    } else {
      const responseText = await updateResponse.text();
      res.json({ 
        success: false, 
        error: `Update failed with status ${updateResponse.status}`,
        details: responseText.substring(0, 300)
      });
    }

  } catch (err) {
    console.error('[Update Direct] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
