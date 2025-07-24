// Route for uploading DF and DM files to ProSBC via backend
import express from 'express';
import multer from 'multer';
import path from 'path';
import { uploadDfFileToProSBC, uploadDmFileToProSBC } from '../utils/prosbc/fileUpload.js';
import { prosbcLogin } from '../utils/prosbc/login.js';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();
const upload = multer(); // memory storage

// POST /prosbc-upload/df
router.post('/df', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, message: 'File is required.' });
  }
  try {
    // Get session cookie automatically
    const sessionCookie = await prosbcLogin(
      process.env.PROSBC_BASE_URL,
      process.env.PROSBC_USERNAME,
      process.env.PROSBC_PASSWORD
    );
    const result = await uploadDfFileToProSBC(file.buffer, file.originalname, sessionCookie);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /prosbc-upload/dm
router.post('/dm', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, message: 'File is required.' });
  }
  try {
    // Get session cookie automatically
    const sessionCookie = await prosbcLogin(
      process.env.PROSBC_BASE_URL,
      process.env.PROSBC_USERNAME,
      process.env.PROSBC_PASSWORD
    );
    const result = await uploadDmFileToProSBC(file.buffer, file.originalname, sessionCookie);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
