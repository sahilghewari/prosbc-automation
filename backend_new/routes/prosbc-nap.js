// backend_new/routes/prosbc-nap.js
import express from 'express';
import { createNapWithProSBCWorkflowEnhanced } from '../utils/prosbc/napApiProSBCWorkflow.js';

const router = express.Router();

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