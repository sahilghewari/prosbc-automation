import express from 'express';
import proSbcInstanceService from '../services/proSbcInstanceService.js';

const router = express.Router();

// GET /backend/api/prosbc-instances - Get all ProSBC instances
router.get('/', async (req, res) => {
  try {
    console.log('[ProSBC Instances] Fetching all instances...');
    const instances = await proSbcInstanceService.getAllInstances();
    console.log(`[ProSBC Instances] Found ${instances.length} instances`);
    
    // Don't send passwords to frontend
    const safeInstances = instances.map(instance => {
      // Get the raw instance data to access exact database fields
      const rawInstance = instance.get({ plain: true });
      
      return {
        id: instance.id,
        name: instance.id, // Use ID as name for now
        baseUrl: rawInstance.baseUrl, // Use the lowercase baseUrl field
        username: instance.username,
        location: '',
        description: '',
        isActive: true,
        createdAt: instance.createdAt,
        updatedAt: instance.updatedAt
      };
    });
    res.json({ success: true, instances: safeInstances });
  } catch (error) {
    console.error('[ProSBC Instances] Error fetching instances:', error);
    console.error('[ProSBC Instances] Error stack:', error.stack);
    res.status(500).json({ success: false, error: error.message, details: error.stack });
  }
});

// GET /backend/api/prosbc-instances/:id - Get specific ProSBC instance
router.get('/:id', async (req, res) => {
  try {
    const instance = await proSbcInstanceService.getInstanceById(req.params.id);
    // Get the raw instance data to access exact database fields
    const rawInstance = instance.get({ plain: true });
    
    const safeInstance = {
      id: instance.id,
      name: instance.id, // Use ID as name for now
      baseUrl: rawInstance.baseURL, // Get from raw database record
      username: instance.username,
      location: '',
      description: '',
      isActive: true,
      createdAt: instance.createdAt,
      updatedAt: instance.updatedAt
    };
    res.json({ success: true, instance: safeInstance });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

// POST /backend/api/prosbc-instances - Create new ProSBC instance
router.post('/', async (req, res) => {
  try {
    const { name, baseUrl, username, password, location, description } = req.body;
    
    if (!name || !baseUrl || !username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name, baseUrl, username, and password are required' 
      });
    }

    const instanceData = {
      name,
      baseUrl,
      username,
      password,
      location: location || '',
      description: description || '',
      isActive: true
    };

    const instance = await proSbcInstanceService.createInstance(instanceData);
    
    const safeInstance = {
      id: instance.id,
      name: instance.name,
      baseUrl: instance.baseUrl,
      username: instance.username,
      location: instance.location,
      description: instance.description,
      isActive: instance.isActive
    };

    res.status(201).json({ success: true, instance: safeInstance });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// PUT /backend/api/prosbc-instances/:id - Update ProSBC instance
router.put('/:id', async (req, res) => {
  try {
    const { name, baseUrl, username, password, location, description, isActive } = req.body;
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (baseUrl !== undefined) updateData.baseUrl = baseUrl;
    if (username !== undefined) updateData.username = username;
    if (password !== undefined) updateData.password = password;
    if (location !== undefined) updateData.location = location;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;

    const instance = await proSbcInstanceService.updateInstance(req.params.id, updateData);
    
    const safeInstance = {
      id: instance.id,
      name: instance.name,
      baseUrl: instance.baseUrl,
      username: instance.username,
      location: instance.location,
      description: instance.description,
      isActive: instance.isActive
    };

    res.json({ success: true, instance: safeInstance });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE /backend/api/prosbc-instances/:id - Delete ProSBC instance
router.delete('/:id', async (req, res) => {
  try {
    const result = await proSbcInstanceService.deleteInstance(req.params.id);
    res.json({ success: true, message: result.message });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /backend/api/prosbc-instances/:id/toggle - Toggle active status
router.post('/:id/toggle', async (req, res) => {
  try {
    const instance = await proSbcInstanceService.toggleActiveStatus(req.params.id);
    res.json({ 
      success: true, 
      message: `Instance ${instance.isActive ? 'activated' : 'deactivated'}`,
      isActive: instance.isActive 
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /backend/api/prosbc-instances/:id/test - Test connection
router.post('/:id/test', async (req, res) => {
  try {
    const result = await proSbcInstanceService.testConnection(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /backend/api/prosbc-instances/initialize - Initialize default instances
router.post('/initialize', async (req, res) => {
  try {
    await proSbcInstanceService.initializeDefaultInstances();
    res.json({ success: true, message: 'Default instances initialized' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
