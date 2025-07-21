import express from 'express';
import {
  setupAuthentication,
  fetchLiveNaps,
  createNap,
  updateNap,
  deleteNap,
  checkNapExists,
  generateNapTemplate,
  validateNapData
} from '../utils/prosbc/napApiClientFixed.js';

const router = express.Router();

// Ensure authentication is set up before handling requests
router.use(async (req, res, next) => {
  try {
    await setupAuthentication();
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /prosbc-nap/naps - List all NAPs
router.get('/naps', async (req, res) => {
  try {
    const naps = await fetchLiveNaps();
    res.json({ success: true, naps });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /prosbc-nap/naps - Create a new NAP
router.post('/naps', async (req, res) => {
  try {
    const napData = req.body;
    const validation = validateNapData(napData);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, errors: validation.errors, warnings: validation.warnings });
    }
    const exists = await checkNapExists(napData.name);
    if (exists) {
      return res.status(409).json({ success: false, message: 'NAP with this name already exists' });
    }
    const result = await createNap(napData);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /prosbc-nap/naps/:napId - Update a NAP
router.put('/naps/:napId', async (req, res) => {
  try {
    const napId = req.params.napId;
    const napData = req.body;
    const result = await updateNap(napId, napData);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /prosbc-nap/naps/:napId - Delete a NAP
router.delete('/naps/:napId', async (req, res) => {
  try {
    const napId = req.params.napId;
    const result = await deleteNap(napId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /prosbc-nap/template - Get a NAP configuration template
router.get('/template', (req, res) => {
  const { name = 'NewNAP', ...options } = req.query;
  const template = generateNapTemplate(name, options);
  res.json({ success: true, template });
});

// GET /prosbc-nap/fields - Get supported NAP configuration fields
router.get('/fields', (req, res) => {
  const fields = validateNapData.getNapConfigurationFields ? validateNapData.getNapConfigurationFields() : {};
  res.json({ success: true, fields });
});

export default router;
