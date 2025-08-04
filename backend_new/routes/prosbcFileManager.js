
import express from 'express';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import prosbcFileManager, { createProSBCFileAPI } from '../utils/prosbc/prosbcFileManager.js';
import { getProSBCCredentials } from '../utils/prosbc/multiInstanceManager.js';

const router = express.Router();

// Helper to extract configId from request (query, body, or header)
function getConfigIdFromRequest(req) {
  return req.query.configId || req.body?.configId || req.headers['x-prosbc-config-id'] || null;
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
    const dbId = configId || '1';
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

export default router;
