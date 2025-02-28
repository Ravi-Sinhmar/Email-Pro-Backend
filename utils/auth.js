const { google } = require("googleapis");
const User = require("../models/User");
const jwt = require("jsonwebtoken");


// Load environment variables
require("dotenv").config();

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
];

// Create OAuth2 client using environment variables
function getOAuth2Client() {
  const client_id = process.env.GOOGLE_CLIENT_ID;
  const client_secret = process.env.GOOGLE_CLIENT_SECRET;
  const redirect_uri = process.env.GOOGLE_REDIRECT_URI;

  if (!client_id || !client_secret || !redirect_uri) {
    throw new Error("Missing Google OAuth credentials in environment variables");
  }

  return new google.auth.OAuth2(client_id, client_secret, redirect_uri);
}

// Generate Google OAuth URL
async function getAuthUrl() {
  const oAuth2Client = getOAuth2Client();
  return oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });
}

// Exchange authorization code for tokens and save to database
async function getTokens(code) {
  const oAuth2Client = getOAuth2Client();

  try {
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    // Extract email from the ID token
    const decoded = jwt.decode(tokens.id_token);
    const email = decoded?.email || "bloody.founder@gmail.com"; // Replace with dynamic email if needed

    // Save or update the user in the database
    await User.findOneAndUpdate(
      { email },
      {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date,
      },
      { upsert: true, new: true }
    );

    console.log("Tokens saved successfully in the database");
    return tokens;
  } catch (err) {
    console.error("Error retrieving access token:", err);
    throw err;
  }
}

// Refresh access token using the refresh token from the database
async function refreshAccessToken(email) {
  const user = await User.findOne({ email });
  if (!user) throw new Error("User not found");

  const oAuth2Client = getOAuth2Client();
  oAuth2Client.setCredentials({
    refresh_token: user.refreshToken,
  });

  try {
    const { tokens } = await oAuth2Client.refreshToken(user.refreshToken);
    oAuth2Client.setCredentials(tokens);

    // Update the user's access token and expiry date in the database
    await User.findOneAndUpdate(
      { email },
      {
        accessToken: tokens.access_token,
        expiryDate: tokens.expiry_date,
      }
    );

    console.log("Access token refreshed successfully");
    return tokens;
  } catch (err) {
    console.error("Error refreshing access token:", err);
    throw err;
  }
}

module.exports = {
  getAuthUrl,
  getTokens,
  refreshAccessToken,
};