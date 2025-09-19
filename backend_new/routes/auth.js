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
  const { username, password } = req.body;
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
      // Delete any existing active session for this user
      await ActiveUser.destroy({ where: { userId: user.id } });
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
    // Update logout time and then remove the current user's active session
    await ActiveUser.update(
      { logoutTime: new Date() },
      { where: { userId: req.user.id } }
    );
    await ActiveUser.destroy({ where: { userId: req.user.id } });
    return res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

export default router;
