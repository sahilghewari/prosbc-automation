import express from 'express';
import database from './config/database.js';

import napsRouter from './routes/naps.js';

const app = express();
app.use(express.json());

// NAP routes
app.use('/api/naps', napsRouter);

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
