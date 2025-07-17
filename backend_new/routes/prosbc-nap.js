// backend_new/routes/prosbc-nap.js
import express from 'express';
import { createNapWithProSBCWorkflowEnhanced } from '../utils/prosbc/napApiProSBCWorkflow.js';
import { fetchLiveNaps } from '../utils/prosbc/napApiClientFixed.js';

const router = express.Router();

// GET /api/naps - List all NAPs from ProSBC
router.get('/naps', async (req, res) => {
  try {
    const naps = await fetchLiveNaps();
    res.json(naps);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/naps/create - Create a new NAP
router.post('/create', async (req, res) => {
  try {
    const napConfig = req.body;
    const result = await createNapWithProSBCWorkflowEnhanced(napConfig);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;