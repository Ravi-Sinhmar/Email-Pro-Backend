const {google} = require('googleapis');
const fs = require("fs");
const path = require("path");

async function listoflables (auth){
const gmail = google.gmail({version: 'v1', auth});
const res = await gmail.users.labels.list({
userId: 'me',
});
const lables = res.data.labels;
if(!lables || lables.length == 0) {
console.log('No labels are found!');
return;
}
console.log('Lables:')
lables.forEach((label)=>{
console.log(`- ${label.name}`);
});
return lables;
}

async function sendEmail(auth, toEmail, subject, message, attachmentPath) {
    const gmail = google.gmail({ version: "v1", auth });
  
    // Construct the email message with headers
    let emailBody = [
      `To: ${toEmail}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="boundary"`,
      ``,
      `--boundary`,
      `Content-Type: text/html; charset="UTF-8"`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      message, // The main body content
    ].join("\n");
  
    // If there's an attachment, add it to the email body
    if (attachmentPath) {
      const attachmentContent = fs.readFileSync(attachmentPath).toString("base64");
      emailBody += [
        ``,
        `--boundary`,
        `Content-Type: application/pdf; name="${path.basename(attachmentPath)}"`,
        `Content-Disposition: attachment; filename="${path.basename(attachmentPath)}"`,
        `Content-Transfer-Encoding: base64`,
        ``,
        attachmentContent,
        `--boundary--`,
      ].join("\n");
    } else {
      // Close the boundary without an attachment
      emailBody += `--boundary--`;
    }
  
    // Encode the email
    const encodedMessage = Buffer.from(emailBody)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  
    // Send the email using the Gmail API
    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });
    console.log(`Email sent to ${toEmail}:`, res.data);
    return res.data;
  }

    
   // Function to get the verified email address of the authenticated user
async function getUserInfo(auth) {
    const gmail = google.gmail({ version: "v1", auth });
    const res = await gmail.users.getProfile({
      userId: "me",
    });
    const emailAddress = res.data.emailAddress;
    console.log("Authenticated email:", emailAddress);
    return emailAddress;
  }
  
  module.exports = {sendEmail, getUserInfo };