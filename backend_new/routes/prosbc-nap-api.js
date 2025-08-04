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


// RESTful NAP endpoints under /configurations/:configId/naps
// List all NAPs for a configuration
router.get('/configurations/:configId/naps', async (req, res) => {
  try {
    const { configId } = req.params;
    const naps = await fetchLiveNaps(configId);
    res.json({ success: true, naps });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get a specific NAP by name
router.get('/configurations/:configId/naps/:napName', async (req, res) => {
  try {
    const { configId, napName } = req.params;
    // Use getNap if available, else filter from fetchLiveNaps
    if (typeof getNap === 'function') {
      const nap = await getNap(napName, configId);
      if (!nap) return res.status(404).json({ success: false, message: 'NAP not found' });
      res.json({ success: true, nap });
    } else {
      const naps = await fetchLiveNaps(configId);
      const nap = Array.isArray(naps) ? naps.find(n => n.name === napName) : naps[napName];
      if (!nap) return res.status(404).json({ success: false, message: 'NAP not found' });
      res.json({ success: true, nap });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create a new NAP for a configuration
router.post('/configurations/:configId/naps', async (req, res) => {
  try {
    const { configId } = req.params;
    const napData = req.body;
    const validation = validateNapData(napData);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, errors: validation.errors, warnings: validation.warnings });
    }
    const exists = await checkNapExists(napData.name, configId);
    if (exists) {
      return res.status(409).json({ success: false, message: 'NAP with this name already exists' });
    }
    const result = await createNap(napData, configId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update a NAP for a configuration
router.put('/configurations/:configId/naps/:napName', async (req, res) => {
  try {
    const { configId, napName } = req.params;
    const napData = req.body;
    const result = await updateNap(napName, napData, configId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete a NAP for a configuration
router.delete('/configurations/:configId/naps/:napName', async (req, res) => {
  try {
    const { configId, napName } = req.params;
    const result = await deleteNap(napName, configId);
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
