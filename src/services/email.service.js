// src/services/email.service.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM_ENV = process.env.FROM_EMAIL || 'noreply@auticare.ai';


const sendWelcomeEmail = async (email, name, confirmationLink) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Account</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0f172a; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #f1f5f9;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; margin: 40px auto; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);">
        <tr>
          <td style="padding: 32px 40px 20px 40px; background: linear-gradient(135deg, #0284c7, #2563eb);">
            <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">AutiCare AI</h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 40px;">
            <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #ffffff;">Confirm Your Email Address</h2>
            <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #94a3b8;">Hello ${name},</p>
            <p style="margin: 0 0 32px 0; font-size: 15px; line-height: 1.6; color: #94a3b8;">Thank you for setting up your account on the AutiCare care coordination platform. To finalize your security mesh activation and verify this dashboard profile, please click the secure authorization button below:</p>
            
            <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
              <tr>
                <td align="center" style="border-radius: 12px; background-color: #0284c7;">
                  <a href="${confirmationLink}" target="_blank" style="display: inline-block; padding: 14px 36px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 12px; letter-spacing: 0.5px;">Verify Email Address</a>
                </td>
              </tr>
            </table>
            
            <p style="margin: 32px 0 0 0; font-size: 13px; line-height: 1.5; color: #64748b;">If you did not initiate this registration request or if this message was sent to you in error, you can safely disregard this message. This activation URL will expire automatically inside 24 hours.</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 24px 40px; background-color: #111827; border-top: 1px solid #334155; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #4b5563;">© 2026 AutiCare AI · HIPAA Protected Health Architecture</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return transporter.sendMail({
    from: `"AutiCare AI" <${FROM_ENV}>`,
    to: email,
    subject: '✨ Confirm Your AutiCare AI Dashboard Connection',
    html: htmlContent,
  });
};


const sendPasswordResetEmail = async (email, name, resetUrl) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0f172a; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #f1f5f9;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; margin: 40px auto; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);">
        <tr>
          <td style="padding: 32px 40px 20px 40px; background: linear-gradient(135deg, #e11d48, #be123c);">
            <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">AutiCare Safety Hub</h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 40px;">
            <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #ffffff;">Password Reset Request</h2>
            <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #94a3b8;">Hello,</p>
            <p style="margin: 0 0 32px 0; font-size: 15px; line-height: 1.6; color: #94a3b8;">A security recovery request was generated for the AutiCare portal account associated with the address <strong>${email}</strong>. Click the secure link below to reset your password token:</p>
            
            <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
              <tr>
                <td align="center" style="border-radius: 12px; background-color: #e11d48;">
                  <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 14px 36px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 12px; letter-spacing: 0.5px;">Reset Security Credentials</a>
                </td>
              </tr>
            </table>
            
            <p style="margin: 32px 0 0 0; font-size: 13px; line-height: 1.5; color: #64748b;"><strong>Security Alert:</strong> If you did not authorize this change, please log in immediately and review your audit trails. Another entity may have mistyped your identity signature field.</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 24px 40px; background-color: #111827; border-top: 1px solid #334155; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #4b5563;">© 2026 AutiCare AI · Secure Access Management Systems</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return transporter.sendMail({
    from: `"AutiCare Security Hub" <${FROM_ENV}>`,
    to: email,
    subject: '🔒 AutiCare AI: Password Reset Request',
    html: htmlContent,
  });
};

const sendChildCredentialsEmail = async (parentEmail, parentName, childName, childUsername, childPassword) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background-color:#0f172a;font-family:'Segoe UI',sans-serif;color:#f1f5f9;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%"
        style="max-width:560px;margin:40px auto;background-color:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;">
        <tr>
          <td style="padding:32px 40px 20px 40px;background:linear-gradient(135deg,#7c3aed,#4f46e5);">
            <h1 style="margin:0;font-size:24px;font-weight:800;color:#ffffff;">AutiCare AI</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 16px 0;font-size:20px;font-weight:700;color:#ffffff;">Child Profile Created</h2>
            <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#94a3b8;">Hello ${parentName},</p>
            <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#94a3b8;">
              A child profile has been created for <strong style="color:#a78bfa;">${childName}</strong>.
              Here are their login credentials:
            </p>
            <table style="width:100%;background-color:#0f172a;border-radius:12px;border:1px solid #334155;padding:20px;border-spacing:0;">
              <tr>
                <td style="padding:8px 16px;color:#64748b;font-size:13px;">Username</td>
                <td style="padding:8px 16px;color:#f1f5f9;font-size:15px;font-weight:600;">${childUsername}</td>
              </tr>
              <tr>
                <td style="padding:8px 16px;color:#64748b;font-size:13px;">Password</td>
                <td style="padding:8px 16px;color:#f1f5f9;font-size:15px;font-weight:600;">${childPassword}</td>
              </tr>
            </table>
            <p style="margin:24px 0 0 0;font-size:13px;line-height:1.5;color:#64748b;">
              Please store these credentials securely. You can update them anytime from the parent dashboard.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px;background-color:#111827;border-top:1px solid #334155;text-align:center;">
            <p style="margin:0;font-size:12px;color:#4b5563;">© 2026 AutiCare AI · HIPAA Protected Health Architecture</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return transporter.sendMail({
    from: `"AutiCare AI" <${FROM_ENV}>`,
    to: parentEmail,
    subject: '🧒 AutiCare: Child Profile Created',
    html: htmlContent,
  });
};


module.exports = { sendWelcomeEmail, sendPasswordResetEmail, sendChildCredentialsEmail };