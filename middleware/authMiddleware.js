// middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../utils/auth");

const authMiddleware = async (req, res, next) => {
  console.log("Auth Middleware");
  try {
    // Get the JWT token from cookies
    const token = req.cookies.jwt;
    if (!token) throw new Error("Authorization token missing");

    // Verify the JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded", decoded);
    const user = await User.findOne({ email: decoded.email });
    if (!user) throw new Error("User not found");

    // Check if the access token is expired
    if (user.expiryDate < Date.now()) {
      const newAccessToken = await auth.refreshAccessToken(user.email);
      req.accessToken = newAccessToken;
    } else {
      req.accessToken = user.accessToken;
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).send({ error: "Unauthorized: " + err.message });
  }
};

module.exports = authMiddleware;