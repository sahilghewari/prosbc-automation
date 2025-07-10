import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import DigitMap from '../models/DigitMap.js';
import DialFormat from '../models/DialFormat.js';

const router = express.Router();


// List all files from the database (DM or DF)
router.get('/list/:type', async (req, res) => {
  const { type } = req.params;
  try {
    let files;
    if (type === 'dm') {
      files = await DigitMap.findAll({ order: [['id', 'DESC']] });
    } else if (type === 'df') {
      files = await DialFormat.findAll({ order: [['id', 'DESC']] });
    } else {
      return res.status(400).json({ error: 'Invalid file type' });
    }
    res.json({ success: true, files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download file by filename (for both DM and DF)
router.get('/download/:type/:filename', async (req, res) => {
  const { type, filename } = req.params;
  if (!['dm', 'df'].includes(type)) {
    return res.status(400).json({ error: 'Invalid file type' });
  }
  const filePath = path.resolve(process.cwd(), 'uploads', filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.download(filePath, filename);
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      // Use project root for uploads directory to avoid path issues
      const uploadDir = path.resolve(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + '-' + file.originalname);
    }
  })
});

// Helper: Save file info to DB
async function saveFileToDB({ fileType, file, nap_id, tags, uploaded_by, name }) {
  let record;
  if (fileType === 'dm') {
    record = await DigitMap.create({
      filename: file.filename,
      originalname: file.originalname,
      nap_id,
      tags,
      uploaded_by,
      name
    });
  } else if (fileType === 'df') {
    record = await DialFormat.create({
      filename: file.filename,
      originalname: file.originalname,
      nap_id,
      tags,
      uploaded_by,
      name
    });
  } else {
    throw new Error('Unknown file type');
  }
  return {
    success: true,
    fileType,
    filename: file.filename,
    originalname: file.originalname,
    nap_id,
    tags,
    uploaded_by,
    name,
    id: record.id
  };
}

// POST /files/digit-maps/upload
router.post('/digit-maps/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { nap_id, tags, uploaded_by, name } = req.body;
    const result = await saveFileToDB({
      fileType: 'dm',
      file: req.file,
      nap_id,
      tags,
      uploaded_by,
      name
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /files/dial-formats/upload
router.post('/dial-formats/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { nap_id, tags, uploaded_by, name } = req.body;
    const result = await saveFileToDB({
      fileType: 'df',
      file: req.file,
      nap_id,
      tags,
      uploaded_by,
      name
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

// Add this to backend_new/routes/files.js

router.delete('/delete-all', async (req, res) => {
  try {
    await DigitMap.destroy({ where: {}, truncate: true });
    await DialFormat.destroy({ where: {}, truncate: true });
    res.json({ success: true, message: 'All DM and DF files deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete all files', error: error.message });
  }
});


// Bulk upload endpoint: Accepts an array of files and stores them in uploads/bulk, optionally saving to DB
router.post('/bulk-upload', async (req, res) => {
  try {
    const { files } = req.body;
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files provided' });
    }

    // Ensure bulk upload directory exists
    const bulkDir = path.resolve(process.cwd(), 'uploads', 'bulk');
    if (!fs.existsSync(bulkDir)) {
      fs.mkdirSync(bulkDir, { recursive: true });
    }

    let saved = 0;
    let errors = [];
    for (const file of files) {
      try {
        // Validate file content is not empty and not HTML
        const content = file.content || '';
        const isHtml = content.trim().startsWith('<!DOCTYPE html') || content.trim().startsWith('<html');
        if (!content.trim()) {
          throw new Error('File content is empty');
        }
        if (isHtml) {
          throw new Error('File content appears to be HTML, not CSV');
        }

        // Optionally: check for CSV header (basic check)
        const firstLine = content.split('\n')[0];
        if (!firstLine.includes(',') && !firstLine.toLowerCase().includes('dm') && !firstLine.toLowerCase().includes('df')) {
          throw new Error('File does not appear to be a valid CSV');
        }

        // Use fileType to optionally save to DB as well
        const fileName = file.fileName || `file_${Date.now() + Math.random()}.txt`;
        const filePath = path.join(bulkDir, fileName);
        fs.writeFileSync(filePath, content, 'utf8');

        // Optionally save to DB if fileType is present
        if (file.fileType === 'dm') {
          await DigitMap.create({
            filename: fileName,
            originalname: file.fileName,
            nap_id: file.nap_id || null,
            tags: file.tags || null,
            uploaded_by: file.uploaded_by || null,
            name: file.name || file.fileName
          });
        } else if (file.fileType === 'df') {
          await DialFormat.create({
            filename: fileName,
            originalname: file.fileName,
            nap_id: file.nap_id || null,
            tags: file.tags || null,
            uploaded_by: file.uploaded_by || null,
            name: file.name || file.fileName
          });
        }
        saved++;
      } catch (err) {
        errors.push({ file: file.fileName, error: err.message });
      }
    }

    res.json({ success: true, saved, errors });
  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});