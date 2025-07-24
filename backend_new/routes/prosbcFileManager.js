import express from 'express';
import path from 'path';
import prosbcFileAPI from '../utils/prosbc/prosbcFileManager.js';
import multer from 'multer';
import fs from 'fs';
const router = express.Router();

// Upload DF file
router.post('/upload/df', async (req, res) => {
  try {
    const filePath = req.body.filePath;
    if (!filePath) return res.status(400).json({ error: 'Missing filePath' });
    const result = await prosbcFileAPI.uploadDfFile(filePath);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload DM file
router.post('/upload/dm', async (req, res) => {
  try {
    const filePath = req.body.filePath;
    if (!filePath) return res.status(400).json({ error: 'Missing filePath' });
    const result = await prosbcFileAPI.uploadDmFile(filePath);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List DF files
router.get('/list/df', async (req, res) => {
  try {
    const result = await prosbcFileAPI.listDfFiles();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List DM files
router.get('/list/dm', async (req, res) => {
  try {
    const result = await prosbcFileAPI.listDmFiles();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get system status
router.get('/status', async (req, res) => {
  try {
    const result = await prosbcFileAPI.getSystemStatus();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export file
router.post('/export', async (req, res) => {
  try {
    const { fileType, fileId, fileName, outputPath } = req.body;
    if (!fileType || !fileId || !fileName) return res.status(400).json({ error: 'Missing parameters' });
    const result = await prosbcFileAPI.exportFile(fileType, fileId, fileName, outputPath);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete file
router.post('/delete', async (req, res) => {
  try {
    const { fileType, fileId, fileName } = req.body;
    if (!fileType || !fileId || !fileName) return res.status(400).json({ error: 'Missing parameters' });
    const result = await prosbcFileAPI.deleteFile(fileType, fileId, fileName);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get file content
router.get('/content', async (req, res) => {
  try {
    const { fileType, fileId } = req.query;
    if (!fileType || !fileId) return res.status(400).json({ error: 'Missing parameters' });
    const result = await prosbcFileAPI.getFileContent(fileType, fileId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Multer setup for file uploads
const upload = multer({
  dest: path.join(process.cwd(), 'uploads', 'update_tmp'),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
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
    const result = await prosbcFileAPI.updateFile(fileType, fileId, targetPath);
    // Remove temp file after update
    fs.unlink(targetPath, () => {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
