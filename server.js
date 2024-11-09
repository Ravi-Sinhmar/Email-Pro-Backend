require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const app = express();
const port = process.env.PORT || 5000;
const mailer = require("./Modules/mailer");

// Middleware
const corsOptions = {
  origin: "https://email-pro-mu.vercel.app",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

// Multer Setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath);
    }
    cb(null, uploadPath); // Use the dynamic path
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

app.post("/sendEmail", upload.single("resume"), async (req, res) => {
  const { toEmail, subject, message } = req.body;
  const resumeFilePath = req.file.path;

  // Log the file path to verify it exists
  console.log("Resume file path:", resumeFilePath);

  if (!fs.existsSync(resumeFilePath)) {
    return res.status(400).json({ success: false, message: "File not found" });
  }

  const parsedToEmail = JSON.parse(toEmail);

  const sendMail = async (email) => {
    const mailData = {
      from: process.env.FROM_EMAIL,
      to: email,
      subject: subject,
      html: message,
      attachments: [{ filename: req.file.originalname, path: resumeFilePath }],
    };

    return new Promise((resolve, reject) => {
      mailer.sendMail(mailData, (error, info) => {
        if (error) {
          console.error("Error sending email:", error);
          reject(error);
        } else {
          console.log("Email sent successfully:", info.messageId);
          resolve(info);
        }
      });
    });
  };

  try {
    await Promise.all(parsedToEmail.map((email) => sendMail(email)));
    res.status(200).json({ success: true, total: parsedToEmail.length });
  } catch (error) {
    res.status(500).send("Error sending email");
  }
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
