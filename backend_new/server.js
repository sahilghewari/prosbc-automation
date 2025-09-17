import 'dotenv/config';
import express from 'express';
import database from './config/database.js';
import './models/index.js';

import jwt from 'jsonwebtoken';
import Log from './models/Log.js';
// ...existing code...
import proSbcInstanceService from './services/proSbcInstanceService.js';

// Removed unused: naps, files legacy routes
import authRouter from './routes/auth.js';
import profileRouter from './routes/profile.js';
// Removed unused: prosbc-nap, prosbc-nap-api, napEdit
import prosbcInstancesRouter from './routes/prosbcInstances.js';

import prosbcUploadRouter from './routes/prosbcUpload.js';

import prosbcFileManagerRouter from './routes/prosbcFileManager.js';
import routesetMappingRouter from './routes/routesetMapping.js';
import customerCountsRouter from './routes/customerCounts.js';
import dmFilesRouter from './routes/dmFiles.js';
import { fetchLiveConfigIds } from './utils/prosbc/prosbcConfigLiveFetcher.js';



const app = express();
app.use(express.json());


// JWT authentication middleware for all requests (except login and test-configs)
function extractToken(req) {
  // Try Authorization header first
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  // Optionally, try cookie (for browser clients)
  if (req.cookies && req.cookies['dashboard_token']) {
    return req.cookies['dashboard_token'];
  }
  return null;
}

import ActiveUser from './models/ActiveUser.js';

app.use(async (req, res, next) => {
  // Allow unauthenticated access only to login and test-configs endpoints
  if (
    req.path === '/backend/api/auth/login' ||
    req.path === '/backend/api/prosbc-files/test-configs'
  ) return next();
  const token = extractToken(req);
  if (!token) return res.status(401).json({ message: 'Missing or invalid token' });
  jwt.verify(token, process.env.JWT_SECRET || 'secret', async (err, user) => {
    if (err) return res.status(401).json({ message: 'Invalid or expired token' });
    // Check if token matches the active user's token
    const activeUser = await ActiveUser.findOne();
    if (!activeUser || activeUser.token !== token) {
      return res.status(401).json({ message: 'Session expired or overridden. Please login again.' });
    }
    req.user = user;
    next();
  });
});

// Log middleware for every request
app.use(async (req, res, next) => {
  // Store username instead of user id in logs
  const user = req.user && req.user.username ? req.user.username : null;
  const action = req.method + ' ' + req.originalUrl;
  const description = [
    req.method,
    req.originalUrl,
    Object.keys(req.body).length ? `Body: ${JSON.stringify(req.body)}` : '',
    Object.keys(req.query).length ? `Query: ${JSON.stringify(req.query)}` : '',
    Object.keys(req.params).length ? `Params: ${JSON.stringify(req.params)}` : '',
    `IP: ${req.ip}`
  ].filter(Boolean).join(' | ');
  await Log.create({
    user,
    action,
    description,
    level: 'info'
  }).catch((err) => { console.error('Log error:', err); }); // Log error for debugging
  next();
});


// Removed unused NAP and legacy files routes

// Auth routes
app.use('/backend/api/auth', authRouter);
app.use('/backend/api/auth', profileRouter);
// Removed unused nap-edit routes

// ProSBC Instance Management routes
app.use('/backend/api/prosbc-instances', prosbcInstancesRouter);

// ProSBC Upload routes
app.use('/backend/api/prosbc-upload', prosbcUploadRouter);

// ProSBC File Management routes
app.use('/backend/api/prosbc-files', prosbcFileManagerRouter);

// Routeset Mapping Center API
app.use('/backend/api/routeset-mapping', routesetMappingRouter);

app.use('/backend/api/customer-counts', customerCountsRouter);

app.use('/backend/api/dm-files', dmFilesRouter);


// Test endpoint: fetch live ProSBC configs
app.get('/backend/api/prosbc-files/test-configs', async (req, res) => {
  try {
    // Extract instance ID from headers for instance-specific config fetching
    const instanceId = req.headers['x-prosbc-instance-id'];
    console.log(`[test-configs] Request received with instance ID: ${instanceId}`);
    console.log(`[test-configs] Headers with x-prefix:`, Object.keys(req.headers).filter(h => h.startsWith('x-')));
    
    let baseURL, username, password;

    if (instanceId) {
      // Use instance-specific settings
      console.log(`[test-configs] Attempting to get credentials for instance ${instanceId}`);
      const { getProSBCCredentials } = await import('./utils/prosbc/multiInstanceManager.js');
      try {
        const instance = await getProSBCCredentials(instanceId);
        if (instance) {
          baseURL = instance.baseUrl;
          username = instance.username;
          password = instance.password;
          console.log(`[test-configs] Using instance ${instanceId}: ${baseURL}`);
        } else {
          console.log(`[test-configs] Instance ${instanceId} returned null, falling back to default`);
          baseURL = process.env.PROSBC_BASE_URL;
          username = process.env.PROSBC_USERNAME;
          password = process.env.PROSBC_PASSWORD;
        }
      } catch (instanceError) {
        console.log(`[test-configs] Error getting instance ${instanceId}:`, instanceError.message);
        console.log(`[test-configs] Falling back to default environment settings`);
        baseURL = process.env.PROSBC_BASE_URL;
        username = process.env.PROSBC_USERNAME;
        password = process.env.PROSBC_PASSWORD;
      }
    } else {
      // Use default environment settings
      baseURL = process.env.PROSBC_BASE_URL;
      username = process.env.PROSBC_USERNAME;
      password = process.env.PROSBC_PASSWORD;
      console.log('[test-configs] No instance ID provided, using default environment settings');
    }

    console.log(`[test-configs] Final baseURL: ${baseURL}`);
    const { prosbcLogin } = await import('./utils/prosbc/login.js');
    
    // Add retry logic for ProSBC login and config fetching
    let sessionCookie;
    let configs;
    
    try {
      console.log('[test-configs] Step 1: Attempting ProSBC login...');
      sessionCookie = await prosbcLogin(baseURL, username, password);
      console.log('[test-configs] Step 1: ✓ ProSBC login successful');
      
      console.log('[test-configs] Step 2: Fetching configurations...');
      configs = await fetchLiveConfigIds(baseURL, sessionCookie);
      console.log(`[test-configs] Step 2: ✓ Retrieved ${configs.length} configs`);
      
      if (!configs || configs.length === 0) {
        throw new Error('No configurations found');
      }
      
    } catch (firstAttemptError) {
      console.warn('[test-configs] First attempt failed:', firstAttemptError.message);
      console.log('[test-configs] Retrying with fresh session...');
      
      try {
        // Wait a bit for ProSBC to stabilize
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('[test-configs] Retry: Attempting ProSBC login...');
        sessionCookie = await prosbcLogin(baseURL, username, password);
        console.log('[test-configs] Retry: ✓ ProSBC login successful');
        
        console.log('[test-configs] Retry: Fetching configurations...');
        configs = await fetchLiveConfigIds(baseURL, sessionCookie);
        console.log(`[test-configs] Retry: ✓ Retrieved ${configs.length} configs`);
        
        if (!configs || configs.length === 0) {
          throw new Error('No configurations found on retry');
        }
        
      } catch (retryError) {
        console.error('[test-configs] Retry also failed:', retryError.message);
        throw new Error(`Failed to fetch configs after retry: ${retryError.message}`);
      }
    }
    
    res.json({ success: true, configs, instanceId: instanceId || 'default', baseURL: baseURL });
  } catch (err) {
    console.error('[test-configs] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Clear credentials cache endpoint
app.post('/backend/api/prosbc-instances/clear-cache', async (req, res) => {
  try {
    const { instanceId } = req.body;
    const { clearCredentialsCache } = await import('./utils/prosbc/multiInstanceManager.js');
    
    clearCredentialsCache(instanceId);
    
    res.json({ 
      success: true, 
      message: instanceId ? `Cache cleared for instance ${instanceId}` : 'All cache cleared'
    });
  } catch (err) {
    console.error('[clear-cache] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


app.get('/', (req, res) => {
  res.send('ProSBC Backend API is running.');
});

// Global error handler (always returns JSON, logs stack)
app.use((err, req, res, next) => {
  console.error('GLOBAL ERROR:', err.stack || err);
  res.status(500).json({ success: false, error: err.message || 'Internal server error', stack: err.stack });
});

const PORT = process.env.PORT || 3001;


(async () => {
  try {
    await database.connect();
  // Sync Log table (does not drop existing data)
  await Log.sync();
  // Sync ActiveUser table
  await ActiveUser.sync();
  // Sync CustomerCount table
  try {
    await database.sequelize.models.CustomerCount.sync();
    console.log('✅ CustomerCount table synced');
  } catch (syncError) {
    console.warn('⚠️ Failed to sync CustomerCount table:', syncError.message);
  }
    
    // Initialize default ProSBC instances
    await proSbcInstanceService.initializeDefaultInstances();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();
