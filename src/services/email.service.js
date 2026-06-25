const nodemailer = require('nodemailer');

const sendEmail = async ({ to, subject, html, text }) => {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT || 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const fromEmail = process.env.FROM_EMAIL || 'noreply@auticare.org';

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.log('✉️ [MOCK EMAIL]:');
    console.log(`   To:      ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Body:    ${text || html}`);
    return { success: true, mock: true };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: Number(smtpPort) === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const info = await transporter.sendMail({
      from: `"AutiCare Admin" <${fromEmail}>`,
      to,
      subject,
      text,
      html,
    });

    console.log('✉️ Real email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('⚠️ Failed to send real email via SMTP:', err.message);
    return { success: false, error: err.message };
  }
};

const sendWelcomeEmail = async (userEmail, userName) => {
  return sendEmail({
    to: userEmail,
    subject: 'Welcome to AutiCare!',
    text: `Hi ${userName},\n\nThank you for signing up for AutiCare! Your email address has been successfully verified, and your account is active.\n\nWarm regards,\nThe AutiCare Team`,
    html: `<h3>Welcome to AutiCare!</h3><p>Hi ${userName},</p><p>Thank you for signing up for AutiCare! Your email address has been verified, and your account is active.</p><p>Warm regards,<br/>The AutiCare Team</p>`
  });
};

const sendChildCredentialsEmail = async (parentEmail, parentName, childName, childUsername, childPassword) => {
  return sendEmail({
    to: parentEmail,
    subject: `AutiCare child account for ${childName}`,
    text: `Hi ${parentName},\n\nYour child profile for ${childName} has been created.\n\nChild username: ${childUsername}\nChild password: ${childPassword}\n\nPlease keep these credentials private.\n\nWarm regards,\nThe AutiCare Team`,
    html: `<h3>AutiCare child account created</h3><p>Hi ${parentName},</p><p>Your child profile for <strong>${childName}</strong> has been created.</p><p><strong>Child username:</strong> ${childUsername}<br/><strong>Child password:</strong> ${childPassword}</p><p>Please keep these credentials private.</p><p>Warm regards,<br/>The AutiCare Team</p>`
  });
};

const sendMeltdownAlertEmail = async (parentEmail, childName, riskScore, suggestions) => {
  const suggestionsHtml = suggestions && suggestions.length 
    ? `<ul>${suggestions.map(s => `<li>${s}</li>`).join('')}</ul>` 
    : '';
  return sendEmail({
    to: parentEmail,
    subject: `🚨 [CRITICAL ALERT] High Meltdown Risk Detected for ${childName}`,
    text: `Dear Parent,\n\nOur AutiCare AI engine has detected a HIGH meltdown crisis index (${riskScore}%) for ${childName} based on recent behavioral logs.\n\nSuggested immediate actions:\n${suggestions ? suggestions.map(s => `- ${s}`).join('\n') : 'None'}\n\nPlease check your Parent Portal immediately for more details.\n\nBest,\nAutiCare Clinical Support`,
    html: `<h3>🚨 High Meltdown Risk Detected for ${childName}</h3><p>Dear Parent,</p><p>Our AutiCare AI engine has detected a <strong>HIGH meltdown crisis index (${riskScore}%)</strong> for ${childName} based on recent behavioral logs.</p><p><strong>Suggested immediate actions:</strong></p>${suggestionsHtml}<p>Please check your <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}">Parent Portal</a> immediately for more details.</p><p>Best,<br/>AutiCare Clinical Support</p>`
  });
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendChildCredentialsEmail,
  sendMeltdownAlertEmail
};
