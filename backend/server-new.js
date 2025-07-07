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

// Base storage directory (keeping existing file storage for compatibility)
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

// Utility functions (keeping existing for compatibility)
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

// Mount API routes (new database-driven routes)
app.use('/api', apiRoutes);

// Legacy file storage routes (keeping for compatibility)
const multerStorage = multer.diskStorage({
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

const upload = multer({ storage: multerStorage });

// Legacy file upload endpoint
app.post('/api/legacy/files/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const { type = 'misc', metadata: metadataStr } = req.body;
    let metadata = {};
    
    try {
      if (metadataStr) {
        metadata = JSON.parse(metadataStr);
      }
    } catch (parseError) {
      console.error('Error parsing metadata:', parseError);
    }

    const fileId = generateId('file');
    const filePath = req.file.path;
    
    // Enhanced metadata
    const fileMetadata = {
      id: fileId,
      type,
      original_name: req.file.originalname,
      filename: req.file.filename,
      filepath: filePath,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploaded_at: new Date().toISOString(),
      ...metadata
    };

    // Save metadata
    await saveMetadata('file', fileId, fileMetadata);

    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: fileMetadata
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({
      success: false,
      error: 'File upload failed',
      message: error.message
    });
  }
});

// Legacy storage stats endpoint
app.get('/api/legacy/storage/stats', async (req, res) => {
  try {
    const stats = {};
    let totalFiles = 0;
    let totalSize = 0;

    for (const [name, dir] of Object.entries(DIRS)) {
      try {
        const exists = await fs.pathExists(dir);
        if (exists) {
          const files = await fs.readdir(dir);
          let dirSize = 0;
          
          for (const file of files) {
            try {
              const filePath = path.join(dir, file);
              const stat = await fs.stat(filePath);
              if (stat.isFile()) {
                dirSize += stat.size;
              }
            } catch (err) {
              console.warn(`Error stating file ${file}:`, err.message);
            }
          }
          
          stats[name] = {
            fileCount: files.length,
            size: dirSize,
            sizeFormatted: formatBytes(dirSize),
            path: dir
          };
          
          totalFiles += files.length;
          totalSize += dirSize;
        } else {
          stats[name] = { 
            fileCount: 0, 
            size: 0, 
            sizeFormatted: '0 B',
            path: dir,
            exists: false
          };
        }
      } catch (error) {
        stats[name] = { 
          fileCount: 0, 
          size: 0, 
          sizeFormatted: '0 B',
          path: dir,
          error: error.message
        };
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
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  
  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      error: 'File upload error',
      message: error.message
    });
  }
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await database.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await database.disconnect();
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    // Connect to database
    console.log('🔌 Connecting to database...');
    await database.connect();
    await database.initializeIndexes();
    
    // Ensure directories exist (for legacy file storage)
    await ensureDirectories();
    console.log('📁 Storage directories ensured');
    
    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`✅ ProSBC Automation Backend Server running on port ${PORT}`);
      console.log(`🔗 API URL: http://localhost:${PORT}/api`);
      console.log(`📊 Health Check: http://localhost:${PORT}/api/health`);
      console.log(`🗄️  Database: ${database.getConnectionStatus().isConnected ? 'Connected' : 'Disconnected'}`);
      console.log(`📂 Storage base path: ${STORAGE_BASE}`);
      console.log(`⏰ Started at: ${new Date().toISOString()}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
