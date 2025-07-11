import express from 'express';
import dotenv from 'dotenv';

import database from './config/database.js';
import auditLogger from './middleware/auditLogger.js';

import napsRouter from './routes/naps.js';

import filesRouter from './routes/files.js';

import authRouter from './routes/auth.js';
import profileRouter from './routes/profile.js';
dotenv.config();

const app = express();
app.use(express.json());
// Use audit logger middleware for all routes
app.use(auditLogger);


// NAP routes
app.use('/backend/api/naps', napsRouter);

// Files routes
app.use('/backend/api/files', filesRouter);

// Auth routes
app.use('/backend/api/auth', authRouter);
app.use('/backend/api/auth', profileRouter);

app.get('/', (req, res) => {
  res.send('ProSBC Backend API is running.');
});

const PORT = process.env.PORT || 3001;

(async () => {
  try {
    await database.connect();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();
