/**
 * ProSBC File Sync Routes
 * API endpoints for syncing files from ProSBC to database
 */

import express from 'express';
import { prosbcFileSyncService } from '../services/ProSBCFileSyncService.js';

const router = express.Router();

/**
 * @route   POST /api/sync/files
 * @desc    Sync files from ProSBC to database
 * @access  Public (should be protected in production)
 */
router.post('/files', async (req, res) => {
  try {
    const { type, files } = req.body;

    if (files && Array.isArray(files)) {
      // Bulk sync provided files
      const results = await prosbcFileSyncService.bulkSyncFiles(files);
      
      res.json({
        success: true,
        message: `Bulk sync completed: ${results.successful} successful, ${results.failed} failed`,
        results
      });
    } else if (type === 'fetch') {
      // Fetch files from ProSBC and sync (stub for now)
      const fetchedFiles = await fetchFilesFromProSBC();
      
      if (fetchedFiles.length === 0) {
        return res.json({
          success: true,
          message: 'No files to sync',
          results: { total: 0, successful: 0, failed: 0, created: 0, updated: 0, unchanged: 0 }
        });
      }

      const results = await prosbcFileSyncService.bulkSyncFiles(fetchedFiles);
      
      res.json({
        success: true,
        message: `Fetch and sync completed: ${results.successful} successful, ${results.failed} failed`,
        results
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid request. Provide either "files" array or type: "fetch"'
      });
    }
  } catch (error) {
    console.error('Sync files error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to sync files'
    });
  }
});

/**
 * @route   POST /api/sync/file
 * @desc    Sync a single file from ProSBC to database
 * @access  Public (should be protected in production)
 */
router.post('/file', async (req, res) => {
  try {
    const { fileData, type = 'digit_map' } = req.body;

    if (!fileData) {
      return res.status(400).json({
        success: false,
        error: 'fileData is required'
      });
    }

    let result;
    if (type === 'digit_map' || type === 'dm') {
      result = await prosbcFileSyncService.recordDigitMapFile(fileData);
    } else if (type === 'dial_format' || type === 'df') {
      result = await prosbcFileSyncService.recordDialFormatFile(fileData);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid type. Use "digit_map", "dm", "dial_format", or "df"'
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Sync single file error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to sync file'
    });
  }
});

/**
 * @route   GET /api/sync/stats
 * @desc    Get sync statistics
 * @access  Public
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await prosbcFileSyncService.getSyncStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get sync stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to get sync statistics'
    });
  }
});

/**
 * @route   GET /api/sync/status
 * @desc    Get current sync status
 * @access  Public
 */
router.get('/status', async (req, res) => {
  try {
    res.json({
      success: true,
      isProcessing: prosbcFileSyncService.isProcessing,
      lastSync: prosbcFileSyncService.syncResults.length > 0 
        ? prosbcFileSyncService.syncResults[prosbcFileSyncService.syncResults.length - 1].timestamp
        : null,
      recentResults: prosbcFileSyncService.syncResults.slice(-10) // Last 10 results
    });
  } catch (error) {
    console.error('Get sync status error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to get sync status'
    });
  }
});

/**
 * Stub function to fetch files from ProSBC
 * This should be implemented to integrate with your existing ProSBC file fetching logic
 */
async function fetchFilesFromProSBC() {
  try {
    // TODO: Integrate with your existing ProSBC file fetching logic
    // This is where you would use the prosbcFileAPI to fetch files
    
    console.log('🔄 Fetching files from ProSBC (stub implementation)');
    
    // Example of what this function should do:
    // 1. Use prosbcFileAPI.listDfFiles() and prosbcFileAPI.listDmFiles()
    // 2. For each file, use prosbcFileAPI.getFileContent() to get content
    // 3. Transform the data into the format expected by ProSBCFileSyncService
    
    // For now, return empty array - implement based on your requirements
    return [];
    
    /* Example implementation structure:
    
    const prosbcFileAPI = new ProSBCFileAPI(); // Import from frontend utils
    
    // Get file lists
    const [dfResult, dmResult] = await Promise.all([
      prosbcFileAPI.listDfFiles(),
      prosbcFileAPI.listDmFiles()
    ]);
    
    const filesToSync = [];
    
    // Process DF files
    if (dfResult.success) {
      for (const file of dfResult.files) {
        const contentResult = await prosbcFileAPI.getFileContent('routesets_definitions', file.id);
        if (contentResult.success) {
          filesToSync.push({
            type: 'dial_format',
            filename: file.name,
            content: contentResult.content,
            prosbc_id: file.id,
            routeset_id: file.id, // or extract from file structure
            source: 'prosbc_fetch'
          });
        }
      }
    }
    
    // Process DM files
    if (dmResult.success) {
      for (const file of dmResult.files) {
        const contentResult = await prosbcFileAPI.getFileContent('routesets_digitmaps', file.id);
        if (contentResult.success) {
          filesToSync.push({
            type: 'digit_map',
            filename: file.name,
            content: contentResult.content,
            prosbc_id: file.id,
            routeset_id: file.id, // or extract from file structure
            source: 'prosbc_fetch'
          });
        }
      }
    }
    
    return filesToSync;
    */
    
  } catch (error) {
    console.error('Error fetching files from ProSBC:', error);
    throw error;
  }
}

export default router;
