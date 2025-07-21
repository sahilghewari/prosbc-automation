
import express from 'express';
import NapEditService from '../utils/prosbc/napEditService.js';
import { getProSbcNapIdByNameOrId } from '../utils/prosbc/proSbcNapUtil.js';

const router = express.Router();

// GET /api/naps/:id/edit - Fetch NAP edit form data
router.get('/naps/:id/edit', async (req, res) => {
  try {
    const napIdentifier = req.params.id;
    const napId = await getProSbcNapIdByNameOrId(napIdentifier);
    const napService = new NapEditService();
    const napData = await napService.getNapForEdit(napId);
    res.json({ success: true, data: napData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/naps/:id - Update NAP configuration
router.post('/naps/:id', async (req, res) => {
  try {
    const napIdentifier = req.params.id;
    const napId = await getProSbcNapIdByNameOrId(napIdentifier);
    const formData = req.body;
    const napService = new NapEditService();
    const result = await napService.updateNap(napId, formData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/prosbc/health - Test connection to ProSBC
router.get('/prosbc/health', async (req, res) => {
  try {
    const napService = new NapEditService();
    const ok = await napService.testConnection();
    res.json({ success: ok });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
