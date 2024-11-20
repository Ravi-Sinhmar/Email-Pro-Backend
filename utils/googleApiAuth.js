const fs = require("fs").promises;
const path = require("path");
const { authenticate } = require("@google-cloud/local-auth");
const { google } = require("googleapis");
const { getUserInfo } = require("./gmailServices");

const SCOPE = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];

const TEMP_CREDENTIALS_PATH = path.join(process.cwd(), "temp_credentials.json");
async function createTempCredentialsFile() {
  const credentials = {
    web: {
      client_id: process.env.client_id,
      project_id: process.env.project_id,
      auth_uri: process.env.auth_uri,
      token_uri: process.env.token_uri,
      auth_provider_x509_cert_url: process.env.auth_provider_x509_cert_url,
      client_secret: process.env.client_secret,
      redirect_uris: [process.env.redirect_uris],
    },
  };
  await fs.writeFile(TEMP_CREDENTIALS_PATH, JSON.stringify(credentials));
}
async function deleteTempCredentialsFile() {
  try {
    await fs.unlink(TEMP_CREDENTIALS_PATH);
  } catch (err) {
    console.error("Error deleting temporary credentials file:", err);
  }
}

async function loadSavedCredentialsIfExists(refresh_token) {
  try {
    const credentials = {
      type: "authorized_user",
      client_id: process.env.client_id,
      client_secret: process.env.client_secret,
      refresh_token: refresh_token,
    };
    return google.auth.fromJSON(credentials);
  } catch (err) {
    console.error("Error reading token file:", err);
    return null;
  }
}

async function authorize(refresh_token) {
  let isValid = true;
  let client = null;
  if (refresh_token != "noToken") {
    console.log("Ye token");
    client = await loadSavedCredentialsIfExists(refresh_token);
  }

  if (client) {
    try {
      await getUserInfo(client);
    } catch (error) {
      isValid = false;
    }
    console.log("isValid", isValid);
    if (isValid) {
      return client;
    }
  }

  await createTempCredentialsFile();
  try {
    client = await authenticate({
      scopes: SCOPE,
      keyfilePath: TEMP_CREDENTIALS_PATH,
    });
    if (client) {
      console.log("cred");
    }
  } finally {
    await deleteTempCredentialsFile();
  }
  return client;
}

module.exports = authorize;
