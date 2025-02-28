// routes/authRoutes.js
const express = require("express");
const auth = require("../utils/auth");
const jwt = require("jsonwebtoken");
const User = require("../models/User");


const router = express.Router();

// Check tokens and handle each case
router.get("/auth/check-tokens", async (req, res) => {
  try {
    const token = req.cookies.jwt;
    let hasValidJWT = false;
    let hasValidAccessToken = false;
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ email: decoded.email });

        if (user) {
          hasValidJWT = true;
          if (user.expiryDate > Date.now()) {
            hasValidAccessToken = true;
          }
        }
      } catch (err) {
        console.log("IN cathc");
        console.log("Invalid JWT:", err.message);
      }
    }

    res.json({ hasValidJWT, hasValidAccessToken});
  } catch (err) {
    console.error("Error checking tokens:", err);
    res.status(500).json({ error: "Error checking tokens" });
  }
});

// Start OAuth flow
router.get("/auth", async (req, res) => {
  try {
    const authUrl = await auth.getAuthUrl();
    res.redirect(authUrl);
  } catch (err) {
    res.status(500).send("Error starting OAuth flow: " + err.message);
  }
});

// Handle OAuth callback
// routes/authRoutes.js
router.get('/auth/callback', async (req, res) => {
    try {
      const code = req.query.code;
      if (!code) {
        return res.status(400).send('Authorization code missing');
      }
  
      // Exchange the code for tokens
      const tokens = await auth.getTokens(code);
  
      // Calculate JWT expiration time based on access token's expiry_date
      const jwtExpiry = Math.floor((new Date(tokens.expiry_date).getTime() - Date.now()) / 1000); // in seconds
  
      // Generate a JWT for the user
      const token = jwt.sign({ email: 'bloody.founder@gmail.com' }, process.env.JWT_SECRET, {
        expiresIn: jwtExpiry, // Set JWT expiration to match access token's expiry_date
      });
  
      // Store the JWT in a cookie
      res.cookie('jwt', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: jwtExpiry * 1000, // in milliseconds
      });
  
      res.send('Authorization successful! JWT stored in cookies.');
    } catch (err) {
      console.error('Error handling OAuth callback:', err);
      res.status(500).send('Error handling OAuth callback: ' + err.message);
    }
  });

module.exports = router;