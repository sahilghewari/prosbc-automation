import express from 'express';
import NAP from '../models/NAP.js';

const router = express.Router();

// Create a new NAP
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const nap = await NAP.create({ name, description });
    res.status(201).json(nap);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'NAP with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to create NAP', details: error.message });
  }
});

export default router;
