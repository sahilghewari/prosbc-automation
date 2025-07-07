/**
 * Routes Index
 * Central routing configuration
 */

import express from 'express';
import napRoutes from './naps.js';
import fileRoutes from './files.js';
import mappingRoutes from './mappings.js';
import configActionRoutes from './configActions.js';
import auditLogRoutes from './auditLogs.js';
import dashboardRoutes from './dashboard.js';
import syncRoutes from './sync.js';

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'ProSBC Automation API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Mount route modules
router.use('/naps', napRoutes);
router.use('/files', fileRoutes);
router.use('/mappings', mappingRoutes);
router.use('/config-actions', configActionRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/sync', syncRoutes);

// 404 handler for API routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

export default router;
