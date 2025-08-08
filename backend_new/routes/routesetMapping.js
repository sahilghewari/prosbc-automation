



import express from 'express';
import routesetService from '../utils/prosbc/routesetMappingService.js';
const router = express.Router();

// GET /api/routeset-mappings
router.get('/mappings', async (req, res) => {
  try {
    const instanceId = req.headers['x-prosbc-instance-id'] || req.query.instanceId;
    const configId = req.query.configId;
    const mappings = await routesetService.getRoutesetMappings(configId, instanceId);
    res.json({ success: true, mappings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/routeset-mapping/nap-edit-data/:napName
router.get('/nap-edit-data/:napName', async (req, res) => {
  try {
    const instanceId = req.headers['x-prosbc-instance-id'] || req.query.instanceId;
    const configId = req.query.configId;
    const data = await routesetService.getNapEditData(req.params.napName, configId, instanceId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
router.post('/activate-configuration/:id', async (req, res) => {
  try {
    const instanceId = req.headers['x-prosbc-instance-id'];
    const result = await routesetService.activateConfiguration(req.params.id, '1', instanceId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/routeset-mapping/validate-configuration/:id
router.post('/validate-configuration/:id', async (req, res) => {
  try {
    const instanceId = req.headers['x-prosbc-instance-id'];
    const result = await routesetService.validateConfiguration(req.params.id, '1', instanceId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
// GET /api/routeset-mappings/:napName
router.get('/mappings/:napName', async (req, res) => {
  try {
    const data = await routesetService.getNapEditData(req.params.napName);
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/routeset-mappings/:napName
router.put('/mappings/:napName', async (req, res) => {
  try {
    const result = await routesetService.updateNapMapping(req.params.napName, req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/routeset-files
router.get('/files', async (req, res) => {
  try {
    const instanceId = req.headers['x-prosbc-instance-id'] || req.query.instanceId;
    const configId = req.query.configId;
    const files = await routesetService.getAvailableFiles(configId, instanceId);
    res.json({ success: true, ...files });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/routeset-mapping/update-nap-mapping/:napName
router.post('/update-nap-mapping/:napName', async (req, res) => {
  try {
    const { configId, instanceId } = req.query;
    console.log(`[RoutesetMapping API] Update NAP mapping request:`, {
      napName: req.params.napName,
      configId,
      instanceId,
      body: req.body,
      query: req.query,
      headers: {
        'x-prosbc-instance-id': req.headers['x-prosbc-instance-id']
      }
    });
    
    // Try to get instanceId from multiple sources
    const finalInstanceId = instanceId || req.headers['x-prosbc-instance-id'] || req.body.instanceId;
    console.log(`[RoutesetMapping API] Using instanceId: ${finalInstanceId}`);
    
    const result = await routesetService.updateNapMapping(req.params.napName, req.body, configId, finalInstanceId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/routeset-mapping/generate-database
router.post('/generate-database', async (req, res) => {
  try {
    const systemId = req.query.systemId || '1';
    const instanceId = req.headers['x-prosbc-instance-id'] || req.query.instanceId;
    const result = await routesetService.generateRoutingDatabase(systemId, instanceId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
// GET /api/routeset-configurations
router.get('/configurations', async (req, res) => {
  try {
    const systemId = req.query.systemId || '1';
    const instanceId = req.headers['x-prosbc-instance-id'] || req.query.instanceId;
    const configs = await routesetService.getAvailableConfigurations(systemId, instanceId);
    res.json({ success: true, configurations: configs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/routeset-configurations/:id/activate
router.post('/configurations/:id/activate', async (req, res) => {
  try {
    const systemId = req.query.systemId || '1';
    const instanceId = req.headers['x-prosbc-instance-id'] || req.query.instanceId;
    const result = await routesetService.activateConfiguration(req.params.id, systemId, instanceId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/routeset-configurations/:id/validate
router.post('/configurations/:id/validate', async (req, res) => {
  try {
    const { systemId = '1', instanceId } = req.query;
    const result = await routesetService.validateConfiguration(req.params.id, systemId, instanceId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/routeset-mapping/available-files
router.get('/available-files', async (req, res) => {
  try {
    const instanceId = req.headers['x-prosbc-instance-id'] || req.query.instanceId;
    const configId = req.query.configId;
    const files = await routesetService.getAvailableFiles(configId, instanceId);
    res.json(files);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
