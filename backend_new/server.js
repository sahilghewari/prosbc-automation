import express from 'express';
import database from './config/database.js';

import napsRouter from './routes/naps.js';

import filesRouter from './routes/files.js';

import authRouter from './routes/auth.js';
import profileRouter from './routes/profile.js';
import prosbcNapRouter from './routes/prosbc-nap.js';
import prosbcNapApiRouter from './routes/prosbc-nap-api.js';
const app = express();
app.use(express.json());
import napEditRoutes from './routes/napEdit.js';


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
