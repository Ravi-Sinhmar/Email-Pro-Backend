const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

async function sendEmail(auth, toEmail, subject, message, attachment = null) {
  const gmail = google.gmail({ version: 'v1', auth });

  // Construct the email body
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
    message,
    `--boundary--`,
  ].join('\n');

  // Add attachment if provided
  if (attachment) {
    const attachmentContent = attachment.buffer.toString('base64');
    emailBody = [
      `To: ${toEmail}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="boundary"`,
      ``,
      `--boundary`,
      `Content-Type: text/html; charset="UTF-8"`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      message,
      ``,
      `--boundary`,
      `Content-Type: ${attachment.mimetype}; name="${attachment.originalname}"`,
      `Content-Disposition: attachment; filename="${attachment.originalname}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      attachmentContent,
      `--boundary--`,
    ].join('\n');
  }

  // Encode the email body
  const encodedMessage = Buffer.from(emailBody)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Send the email
  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
    },
  });

  console.log(`Email sent to ${toEmail}:`, res.data);
  return res.data;
}



async function getUserInfo(auth) {
  const gmail = google.gmail({ version: "v1", auth });
  const res = await gmail.users.getProfile({
    userId: "me",
  });
  const emailAddress = res.data.emailAddress;
  console.log("Authenticated email:", emailAddress);
  return emailAddress;
}

function extractEmail(text) {
  try {
    const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
    const match = text.match(emailPattern);
    return match ? match[0] : null;
  } catch (error) {
    console.error("Error extracting email:", error);
    return text;
  }
}

async function countSentEmails(auth) {
  const gmail = google.gmail({ version: "v1", auth });
  const res = await gmail.users.messages.list({
    userId: "me",
    labelIds: ["SENT"],
  });
  console.log(res);
  return res.data.resultSizeEstimate;
}

async function listInboxEmails(auth, num) {
  const gmail = google.gmail({ version: "v1", auth });
  let userEmail = await getUserInfo(auth);
  userEmail = extractEmail(userEmail);

  const emailCount = await countSentEmails(auth);
  console.log(`Total SENT emails: ${emailCount}`);

  let messages = [];
  let nextPageToken = null;

  do {
    const res = await gmail.users.messages.list({
      userId: "me",
      labelIds: ["SENT"],
      maxResults: num,
      pageToken: nextPageToken,
    });

    if (res.data.messages) {
      messages = messages.concat(res.data.messages);
    }

    nextPageToken = res.data.nextPageToken;

    // Reduce num by the number of messages already fetched
    num -= res.data.messages ? res.data.messages.length : 0;
  } while (nextPageToken && num > 0);

  const detailedMessages = await Promise.all(
    messages.map(async (msg) => {
      const threadMessages = await getThreadMessages(
        auth,
        msg.threadId,
        userEmail
      );
      let toEmail = threadMessages[0].to;
      toEmail = extractEmail(toEmail);
      let fromEmail = threadMessages[0].from;
      fromEmail = extractEmail(fromEmail);
      return {
        id: msg.id,
        threadId: msg.threadId,
        subject: threadMessages[0].subject,
        status:
          threadMessages.length > 1 &&
          threadMessages.some((message) => message.from !== userEmail)
            ? "replied"
            : "sent",
        messages: threadMessages,
        to: toEmail !== userEmail ? toEmail : fromEmail,
      };
    })
  );

  return detailedMessages;
}

async function getThreadMessages(auth, threadId, userEmail) {
  const gmail = google.gmail({ version: "v1", auth });
  const res = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
  });

  const messages = res.data.messages;
  return await Promise.all(
    messages.map(async (msg) => {
      let fromEmail = msg.payload.headers.find(
        (header) => header.name === "From"
      ).value;
      let toEmail = msg.payload.headers.find(
        (header) => header.name === "To"
      ).value;
      toEmail = extractEmail(toEmail);
      fromEmail = extractEmail(fromEmail);

      const sentAt = msg.payload.headers.find(
        (header) => header.name === "Date"
      ).value;
      const subject = msg.payload.headers.find(
        (header) => header.name === "Subject"
      ).value;

      const parts = msg.payload.parts || [];
      const { body: messageBody, attachments } = parseMessageParts(parts);

      return {
        id: msg.id,
        from: fromEmail === userEmail ? "You" : fromEmail,
        to: toEmail,
        subject: subject,
        content: messageBody,
        sentAt: new Date(sentAt).toISOString(),
        attachments: await Promise.all(
          attachments.map(async (att) => {
            const attachment = await getAttachment(
              auth,
              msg.id,
              att.attachmentId
            );
            return {
              ...att,
              data: attachment.data,
              size: attachment.size,
            };
          })
        ),
      };
    })
  );
}

function parseMessageParts(parts, attachments = []) {
  let messageBody = "";
  let htmlContent = "";

  parts.forEach((part) => {
    if (part.mimeType === "text/html" && part.body.data) {
      htmlContent = Buffer.from(part.body.data, "base64").toString("utf8");
      // Remove quoted content
      htmlContent = htmlContent.replace(
        /<div class="gmail_quote">[\s\S]*<\/div>/g,
        ""
      ); // Strip out quoted content
      htmlContent = htmlContent.split(/<div class="gmail_quote">/)[0]; // Strip out content after the first quoted section
      messageBody += htmlContent;
    } else if (part.mimeType === "text/plain" && part.body.data) {
      // Ignore plain text parts
    } else if (part.filename && part.body.attachmentId) {
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType,
        attachmentId: part.body.attachmentId,
      });
    } else if (part.parts) {
      const { body, attachments: nestedAttachments } = parseMessageParts(
        part.parts,
        attachments
      );
      messageBody += body;
      attachments.push(...nestedAttachments);
    }
  });

  return { body: messageBody || htmlContent, attachments: attachments };
}

async function getAttachment(auth, messageId, attachmentId) {
  const gmail = google.gmail({ version: "v1", auth });
  const res = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId: messageId,
    id: attachmentId,
  });

  return {
    data: res.data.data,
    size: res.data.size,
  };
}

module.exports = {
  sendEmail,
  getUserInfo,
  countSentEmails,
  listInboxEmails,
};
