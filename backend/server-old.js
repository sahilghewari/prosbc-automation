/**
 * ProSBC Automation Backend Server
 * Enhanced server with MongoDB integration and comprehensive API
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import database from './config/database.js';
import apiRoutes from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Base storage directory
const STORAGE_BASE = process.env.STORAGE_PATH || '/root/prosbc-dashboard/files';

// Directory structure
const DIRS = {
  df: path.join(STORAGE_BASE, 'df'),
  dm: path.join(STORAGE_BASE, 'dm'),
  routesets: path.join(STORAGE_BASE, 'routesets'),
  backups: path.join(STORAGE_BASE, 'backups'),
  naps: path.join(STORAGE_BASE, 'naps'),
  logs: path.join(STORAGE_BASE, 'logs'),
  metadata: path.join(STORAGE_BASE, 'metadata')
};

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Mount API routes
app.use('/api', apiRoutes);

// Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.body.type || 'misc';
    const dir = DIRS[type] || DIRS.backups;
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const originalName = file.originalname;
    cb(null, `${timestamp}_${originalName}`);
  }
});

const upload = multer({ storage });

// Utility functions
const ensureDirectories = async () => {
  for (const dir of Object.values(DIRS)) {
    await fs.ensureDir(dir);
  }
};

const generateId = (prefix = 'id') => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const saveMetadata = async (type, id, data) => {
  const metadataFile = path.join(DIRS.metadata, `${type}_${id}.json`);
  await fs.writeJson(metadataFile, data, { spaces: 2 });
};

const loadMetadata = async (type, id) => {
  const metadataFile = path.join(DIRS.metadata, `${type}_${id}.json`);
  if (await fs.pathExists(metadataFile)) {
    return await fs.readJson(metadataFile);
  }
  return null;
};

const loadAllMetadata = async (type) => {
  const files = await fs.readdir(DIRS.metadata);
  const metadataFiles = files.filter(f => f.startsWith(`${type}_`) && f.endsWith('.json'));
  
  const results = [];
  for (const file of metadataFiles) {
    try {
      const data = await fs.readJson(path.join(DIRS.metadata, file));
      results.push(data);
    } catch (error) {
      console.error(`Error loading metadata file ${file}:`, error);
    }
  }
  
  return results;
};

// Routes

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const stats = {};
    for (const [name, dir] of Object.entries(DIRS)) {
      const exists = await fs.pathExists(dir);
      if (exists) {
        const files = await fs.readdir(dir);
        stats[name] = { exists, fileCount: files.length };
      } else {
        stats[name] = { exists, fileCount: 0 };
      }
    }

    res.json({
      status: 'healthy',
      message: 'Ubuntu storage backend is running',
      timestamp: new Date().toISOString(),
      storage: {
        basePath: STORAGE_BASE,
        directories: stats
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// File operations
app.post('/api/files', upload.single('file'), async (req, res) => {
  try {
    const fileData = req.body;
    const uploadedFile = req.file;

    const metadata = {
      id: generateId('file'),
      name: fileData.name || uploadedFile.originalname,
      type: fileData.type,
      size: fileData.size || uploadedFile.size,
      original_filename: uploadedFile ? uploadedFile.originalname : fileData.original_filename,
      file_path: uploadedFile ? uploadedFile.path : null,
      uploaded_by: fileData.uploaded_by || 'user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: fileData.tags ? JSON.parse(fileData.tags) : [],
      validation: fileData.validation ? JSON.parse(fileData.validation) : { isValid: true },
      prosbc_result: fileData.prosbc_result ? JSON.parse(fileData.prosbc_result) : null
    };

    await saveMetadata('file', metadata.id, metadata);

    res.json({
      success: true,
      file: metadata,
      message: 'File saved successfully to Ubuntu storage'
    });
  } catch (error) {
    console.error('Error saving file:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/files/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const metadata = await loadMetadata('file', id);
    
    if (!metadata) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    res.json({
      success: true,
      file: metadata
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/files', async (req, res) => {
  try {
    const { type } = req.query;
    let files = await loadAllMetadata('file');
    
    if (type) {
      files = files.filter(f => f.type === type);
    }

    res.json({
      success: true,
      files: files.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// NAP operations
app.post('/api/naps', async (req, res) => {
  try {
    const napData = req.body;
    
    const metadata = {
      ...napData,
      id: napData.nap_id || generateId('nap'),
      created_at: napData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Save NAP config to file
    const napFile = path.join(DIRS.naps, `${metadata.id}.json`);
    await fs.writeJson(napFile, metadata, { spaces: 2 });

    // Save metadata
    await saveMetadata('nap', metadata.id, metadata);

    res.json({
      success: true,
      nap: metadata,
      message: 'NAP saved successfully to Ubuntu storage'
    });
  } catch (error) {
    console.error('Error saving NAP:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/naps/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const metadata = await loadMetadata('nap', id);
    
    if (!metadata) {
      return res.status(404).json({
        success: false,
        error: 'NAP not found'
      });
    }

    res.json({
      success: true,
      nap: metadata
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/naps', async (req, res) => {
  try {
    const naps = await loadAllMetadata('nap');

    res.json({
      success: true,
      naps: naps.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Log operations
app.post('/api/logs', async (req, res) => {
  try {
    const logData = req.body;
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(DIRS.logs, `${today}.json`);
    
    let logs = [];
    if (await fs.pathExists(logFile)) {
      logs = await fs.readJson(logFile);
    }

    const newLog = {
      ...logData,
      id: logData.id || generateId('log'),
      created_at: logData.created_at || new Date().toISOString()
    };

    logs.push(newLog);
    await fs.writeJson(logFile, logs, { spaces: 2 });

    res.json({
      success: true,
      log: newLog,
      message: 'Log saved successfully'
    });
  } catch (error) {
    console.error('Error saving log:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/logs', async (req, res) => {
  try {
    const { date } = req.query;
    let logs = [];

    if (date) {
      const logFile = path.join(DIRS.logs, `${date}.json`);
      if (await fs.pathExists(logFile)) {
        logs = await fs.readJson(logFile);
      }
    } else {
      // Get logs from last 7 days
      const files = await fs.readdir(DIRS.logs);
      const jsonFiles = files.filter(f => f.endsWith('.json')).sort().reverse().slice(0, 7);
      
      for (const file of jsonFiles) {
        try {
          const dayLogs = await fs.readJson(path.join(DIRS.logs, file));
          logs.push(...dayLogs);
        } catch (error) {
          console.error(`Error loading log file ${file}:`, error);
        }
      }
    }

    res.json({
      success: true,
      logs: logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Storage statistics
app.get('/api/storage/stats', async (req, res) => {
  try {
    const stats = {};
    let totalSize = 0;
    let totalFiles = 0;

    for (const [name, dir] of Object.entries(DIRS)) {
      if (await fs.pathExists(dir)) {
        const files = await fs.readdir(dir);
        let dirSize = 0;
        
        for (const file of files) {
          try {
            const filePath = path.join(dir, file);
            const stat = await fs.stat(filePath);
            dirSize += stat.size;
          } catch (error) {
            // Skip if file doesn't exist or can't read
          }
        }

        stats[name] = {
          fileCount: files.length,
          size: dirSize,
          sizeFormatted: formatBytes(dirSize)
        };

        totalFiles += files.length;
        totalSize += dirSize;
      } else {
        stats[name] = { fileCount: 0, size: 0, sizeFormatted: '0 B' };
      }
    }

    res.json({
      success: true,
      stats: {
        directories: stats,
        total: {
          files: totalFiles,
          size: totalSize,
          sizeFormatted: formatBytes(totalSize)
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Utility function to format bytes
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});

// Start server
const startServer = async () => {
  try {
    await ensureDirectories();
    console.log('📁 Storage directories ensured');
    
    app.listen(PORT, () => {
      console.log(`🚀 Ubuntu Backend Server running on port ${PORT}`);
      console.log(`📂 Storage base path: ${STORAGE_BASE}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
