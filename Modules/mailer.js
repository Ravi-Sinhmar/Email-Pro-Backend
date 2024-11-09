
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',  // Replace with your email provider's SMTP host
  port: 587,                 // Replace with your email provider's SMTP port
  secure: false,             // Adjust based on your SMTP server configuration
  auth: {
    user: process.env.EMAIL_USER,  // Replace with your email address
    pass: process.env.EMAIL_PASSWORD           // Replace with your email password
  }
});

module.exports = transporter;
