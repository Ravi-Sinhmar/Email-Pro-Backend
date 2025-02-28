require("dotenv").config();
const { google } = require("googleapis");
const fs = require("fs");
const readline = require("readline");

const CREDENTIALS_PATH = "./credentials.json";
const TOKEN_PATH = "token.json";
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
];

// Load credentials from file
async function loadCredentials() {
  const content = await fs.promises.readFile(CREDENTIALS_PATH, "utf8");
  return JSON.parse(content);
}

// Get and store new token after prompting for user authorization
async function getNewToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });
  console.log("Authorize this app by visiting this URL:", authUrl);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    rl.question("Enter the code from that page here: ", (code) => {
      rl.close();
      oAuth2Client.getToken(code, async (err, token) => {
        if (err) {
          console.error("Error retrieving access token", err);
          reject(err);
          return;
        }
        oAuth2Client.setCredentials(token);
        await fs.promises.writeFile(TOKEN_PATH, JSON.stringify(token));
        resolve(oAuth2Client);
      });
    });
  });
}

// Refresh the access token using the refresh token
async function refreshAccessToken(oAuth2Client) {
  return new Promise((resolve, reject) => {
    oAuth2Client.refreshAccessToken(async (err, tokens) => {
      if (err) {
        console.error("Error refreshing access token", err);
        reject(err);
        return;
      }
      oAuth2Client.setCredentials(tokens);
      await fs.promises.writeFile(TOKEN_PATH, JSON.stringify(tokens));
      console.log("Access token refreshed successfully.");
      resolve(oAuth2Client);
    });
  });
}

// Authorize and handle token refresh
async function authorize() {
  const credentials = await loadCredentials();
  console.log(credentials.web);
  const { client_secret, client_id, redirect_uris } = credentials.web;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  try {
    const token = await fs.promises.readFile(TOKEN_PATH, "utf8");
    const parsedToken = JSON.parse(token);
    oAuth2Client.setCredentials(parsedToken);

    // Check if the access token is expired
    if (parsedToken.expiry_date < Date.now()) {
      console.log("Access token expired. Refreshing...");
      await refreshAccessToken(oAuth2Client);
    } else {
      console.log("Successfully authorized using stored token.");
    }

    return oAuth2Client;
  } catch (err) {
    return getNewToken(oAuth2Client);
  }
}

authorize();
