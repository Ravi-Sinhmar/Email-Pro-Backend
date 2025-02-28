const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();
const { sendEmail, listInboxEmails } = require('../utils/gmailServices');
const {initializeAuth} = require('../utils/auth');

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Route to read inbox emails
router.post('/readEmails', authMiddleware, async (req, res) => {
  try {
    const email = req.user.email;
    const count = req.body.count;
    const auth =await initializeAuth(email);
    const data = await listInboxEmails(auth, count);
    res.status(200).json({ success: true, message: 'Reading Emails', data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to read emails' });
  }
});

// Route to send an email
router.post('/sendEmail', authMiddleware, upload.single('resume'), async (req, res) => {
  const { toEmail, subject, message } = req.body;
  const parsedToEmail = JSON.parse(toEmail);
  const resumeBuffer = req.file ? req.file.buffer : null; // Use buffer instead of path

  try {
    const email = req.user.email;
    const auth = await initializeAuth(email);
    const emailPromises = parsedToEmail.map((email) => {
      return sendEmail(auth, email, subject, message, resumeBuffer ? { buffer: resumeBuffer, mimetype: req.file.mimetype, originalname: req.file.originalname } : null);
    });

    await Promise.all(emailPromises);
    console.log('All emails sent successfully!');
    res.status(200).json({ success: true, message: 'All emails sent successfully!' });
  } catch (error) {
    console.error('Error sending emails:', error);
    res.status(500).json({ success: false, message: 'Error sending emails' });
  }
});

// Route to check if the user is authenticated
router.get('/isAuth', authMiddleware, (req, res) => {
  try {
    res.status(200).json({ isAuth: true, email: req.user.email });
  } catch (error) {
    console.error('Error in /isAuth route:', error);
    res.status(500).json({ isAuth: false, message: 'Internal server error' });
  }
});

module.exports = router;