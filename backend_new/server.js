import 'dotenv/config';
import express from 'express';
import database from './config/database.js';
import './models/index.js';

import jwt from 'jsonwebtoken';
import Log from './models/Log.js';

import napsRouter from './routes/naps.js';
import filesRouter from './routes/files.js';
import authRouter from './routes/auth.js';
import profileRouter from './routes/profile.js';
import prosbcNapRouter from './routes/prosbc-nap.js';
import prosbcNapApiRouter from './routes/prosbc-nap-api.js';
import napEditRoutes from './routes/napEdit.js';

import prosbcUploadRouter from './routes/prosbcUpload.js';
import prosbcFileManagerRouter from './routes/prosbcFileManager.js';
import routesetMappingRouter from './routes/routesetMapping.js';



const app = express();
app.use(express.json());


// JWT authentication middleware for all requests (except login)
app.use((req, res, next) => {
  // Allow unauthenticated access to login route
  if (req.path === '/backend/api/auth/login') return next();
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Missing or invalid token' });
  jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
    if (err) return res.status(401).json({ message: 'Invalid or expired token' });
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


// NAP routes
app.use('/backend/api/naps', napsRouter);
app.use('/backend/api/prosbc-nap', prosbcNapRouter);
// ProSBC NAP API (new, Node.js backend logic)
app.use('/backend/api/prosbc-nap-api', prosbcNapApiRouter);


// Files routes
app.use('/backend/api/files', filesRouter);

// Auth routes
app.use('/backend/api/auth', authRouter);
app.use('/backend/api/auth', profileRouter);
app.use('/backend/api/nap-edit', napEditRoutes);


// ProSBC Upload routes
app.use('/backend/api/prosbc-upload', prosbcUploadRouter);

// ProSBC File Management routes
app.use('/backend/api/prosbc-files', prosbcFileManagerRouter);

// Routeset Mapping Center API
app.use('/backend/api/routeset-mapping', routesetMappingRouter);

app.get('/', (req, res) => {
  res.send('ProSBC Backend API is running.');
});

const PORT = process.env.PORT || 3001;


(async () => {
  try {
    await database.connect();
    // Sync Log table (does not drop existing data)
    await Log.sync();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();
