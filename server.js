require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const app = express();
const port = 5000;
const cookieParser = require("cookie-parser");

app.use(cookieParser());

const authorize = require("./utils/googleApiAuth");
const { sendEmail, getUserInfo } = require("./utils/gmailServices");

const corsOptions = {
  origin: "https://email-pro-mu.vercel.app",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath);
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });
let auth;

app.post('/authenticate', async (req, res) => {
  try {
    let auth_token = req.cookies.auth_token;
    console.log("cookies",auth_token);
    if (!auth_token) {
      auth_token = "noToken";
    }
    auth = await authorize(auth_token);
    const token = auth.credentials.refresh_token; // Store as plain string
   
    res.cookie('auth_token', token, { httpOnly: true, secure: true });
    res.status(200).json({ success: true, message: "Authentication successful" });
  } catch (error) {
    console.error("Authentication failed:", error);
    res.status(500).json({ success: false, message: "Authentication failed" });
  }
});

app.post("/sendEmail", upload.single("resume"), async (req, res) => {
  const { toEmail, subject, message } = req.body;
  const parsedToEmail = JSON.parse(toEmail);
  const resumePath = req.file.path;

  try {
    const emailPromises = parsedToEmail.map((email) => {
      return sendEmail(auth, email, subject, message, resumePath);
    });

    await Promise.all(emailPromises);
    console.log("All emails sent successfully!");
    res.status(200).json({ success: true, message: "All emails sent successfully!" });
  } catch (error) {
    console.error("Error sending emails:", error);
    res.status(500).json({ success: false, message: "Error sending emails" });
  } finally {
    fs.unlinkSync(resumePath);
  }
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
