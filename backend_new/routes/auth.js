import express from 'express';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import ActiveUser from '../models/ActiveUser.js';

const router = express.Router();

// POST /api/login

// POST /api/login
router.post('/login', async (req, res) => {
  const { username, password, override } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }
  try {
    const user = await User.findOne({ where: { username } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }
    // For demo: assume password is stored in plaintext (not recommended!)
    // In production, use bcrypt.compare(password, user.password)
    if (user.password && password === user.password) {
      // Check for active user
      const activeUser = await ActiveUser.findOne();
      if (activeUser && !override) {
        // Someone is already logged in
        return res.status(403).json({
          message: `User ${activeUser.username} is currently logged in.`,
          activeUser: activeUser.username,
          canOverride: true
        });
      }
      // If override or no active user, set current user as active
      if (activeUser) {
        await ActiveUser.destroy({ where: {} }); // Remove previous active user
      }
      // Generate JWT
      const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
      await ActiveUser.create({ userId: user.id, username: user.username, token });
      return res.json({ token });
    } else {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/logout
router.post('/logout', async (req, res) => {
  try {
    await ActiveUser.destroy({ where: {} });
    return res.json({ message: 'Logged out and active user cleared.' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

export default router;
