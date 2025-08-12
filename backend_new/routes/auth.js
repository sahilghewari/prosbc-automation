import express from 'express';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = express.Router();

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  
  // Validation
  if (!username || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Username and password are required.' 
    });
  }

  if (username.length < 3) {
    return res.status(400).json({ 
      success: false, 
      message: 'Username must be at least 3 characters long.' 
    });
  }

  if (password.length < 6) {
    return res.status(400).json({ 
      success: false, 
      message: 'Password must be at least 6 characters long.' 
    });
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(409).json({ 
        success: false, 
        message: 'Username already exists. Please choose a different username.' 
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await User.create({
      username,
      password: hashedPassword,
      email: null // We're not collecting email for now
    });

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username }, 
      process.env.JWT_SECRET || 'secret', 
      { expiresIn: '7d' } // 7 days
    );

    res.status(201).json({ 
      success: true, 
      message: 'Account created successfully!',
      token,
      user: {
        id: user.id,
        username: user.username,
        createdAt: user.createdAt
      }
    });

  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during account creation. Please try again.',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Username and password are required.' 
    });
  }

  try {
    const user = await User.findOne({ where: { username } });
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid username or password.' 
      });
    }

    // Check password - handle both hashed and plain text for backward compatibility
    let isValidPassword = false;
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
      // Hashed password
      isValidPassword = await bcrypt.compare(password, user.password);
    } else {
      // Plain text password (legacy support)
      isValidPassword = password === user.password;
      
      // Upgrade to hashed password
      if (isValidPassword) {
        const hashedPassword = await bcrypt.hash(password, 12);
        await user.update({ password: hashedPassword });
        console.log(`Upgraded password hash for user: ${username}`);
      }
    }

    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid username or password.' 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username }, 
      process.env.JWT_SECRET || 'secret', 
      { expiresIn: '7d' }
    );

    res.json({ 
      success: true, 
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        username: user.username,
        lastLogin: new Date()
      }
    });

    // Update last login time (optional, doesn't block response)
    user.update({ lastLogin: new Date() }).catch(err => {
      console.error('Failed to update last login:', err);
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login. Please try again.',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

export default router;
