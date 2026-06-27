// src/services/email.service.js
const nodemailer = require('nodemailer');

// Reuse your existing transporter configuration block
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

/**
 * 1. BEAUTIFUL WELCOME & ACCOUNT CONFIRMATION EMAIL
 */
const sendWelcomeEmail = async (email, name, confirmationLink) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Confirm Your AutiCare Account</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border: 1px solid #E2E8F0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <tr>
          <td style="background: linear-gradient(135deg, #0EA5E9 0%, #2563EB 100%); padding: 32px; text-align: center;">
            <div style="display: inline-block; width: 40px; height: 40px; background-color: #ffffff; border-radius: 10px; font-weight: 900; font-size: 22px; color: #0EA5E9; line-height: 40px; text-align: center; margin-bottom: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">A</div>
            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; tracking: -0.5px;">Welcome to AutiCare AI</h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 40px 32px; color: #334155;">
            <h2 style="margin-top: 0; margin-bottom: 16px; font-size: 20px; font-weight: 700; color: #0F172A;">Hello ${name},</h2>
            <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #64748B;">Thank you for joining AutiCare. Your provider has created your specialized digital health ecosystem profile. To securely activate your dashboard and begin monitoring tailored genomic progress metrics, please verify your email address.</p>
            
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 30px 0;">
              <tr>
                <td align="center">
                  <a href="${confirmationLink}" target="_blank" style="display: inline-block; padding: 14px 32px; background-color: #0EA5E9; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 10px rgba(14, 165, 233, 0.25); transition: background-color 0.2s;">Confirm Account Link</a>
                </td>
              </tr>
            </table>

            <p style="margin: 20px 0 0 0; font-size: 13px; line-height: 1.5; color: #94A3B8;">If the button above doesn't work, copy and paste this absolute URL pathway into your browser search bar:</p>
            <p style="margin: 8px 0 0 0; font-size: 12px; font-family: monospace; word-break: break-all; color: #0EA5E9; background-color: #F1F5F9; padding: 10px; border-radius: 8px;">${confirmationLink}</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 24px 32px; background-color: #F8FAFC; border-top: 1px solid #E2E8F0; text-align: center; font-size: 12px; color: #94A3B8;">
            <p style="margin: 0 0 4px 0;">© 2026 AutiCare Systems. All rights reserved.</p>
            <p style="margin: 0;">This is a high-compliance automated transmission. Please do not reply directly to this mail pipeline.</p>
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

/**
 * 2. BEAUTIFUL PASSWORD RESET REQUEST EMAIL
 */
const sendPasswordResetEmail = async (email, name, resetUrl) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border: 1px solid #E2E8F0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <tr>
          <td style="background: linear-gradient(135deg, #0EA5E9 0%, #1E3A8A 100%); padding: 32px; text-align: center;">
            <div style="display: inline-block; width: 40px; height: 40px; background-color: #ffffff; border-radius: 10px; font-weight: 900; font-size: 22px; color: #0EA5E9; line-height: 40px; text-align: center; margin-bottom: 12px;">A</div>
            <h1 style="margin: 0; color: #ffffff; font-size: 23px; font-weight: 800; tracking: -0.5px;">Password Reset Security Request</h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 40px 32px; color: #334155;">
            <h2 style="margin-top: 0; margin-bottom: 16px; font-size: 19px; font-weight: 700; color: #0F172A;">Hello ${name},</h2>
            <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #64748B;">We received an inquiry notification requesting a pass code update execution for your dashboard account access framework. Click the link token below to configure new authorization passwords. This secure reset token expires in exactly 1 hour.</p>
            
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 30px 0;">
              <tr>
                <td align="center">
                  <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; background-color: #0EA5E9; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 10px rgba(14, 165, 233, 0.25);">Reset Secure Password</a>
                </td>
              </tr>
            </table>

            <div style="padding: 16px; background-color: #FFFBEB; border: 1px solid #FDE68A; border-radius: 12px; margin-bottom: 24px;">
              <p style="margin: 0; font-size: 13px; font-weight: 600; color: #B45309; line-height: 1.5;">🛡️ Security Warning: If you did not execute this request thread yourself, you can safely ignore this automated message. Your account remains encrypted and completely protected.</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding: 24px 32px; background-color: #F8FAFC; border-top: 1px solid #E2E8F0; text-align: center; font-size: 12px; color: #94A3B8;">
            <p style="margin: 0 0 4px 0;">© 2026 AutiCare Systems. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return transporter.sendMail({
    from: `"AutiCare Safety Hub" <${FROM_ENV}>`,
    to: email,
    subject: '🔒 AutiCare AI: Password Reset Request',
    html: htmlContent,
  });
};

module.exports = {
  sendWelcomeEmail,
  sendPasswordResetEmail
  // Include your sendMeltdownAlertEmail and sendEmail exports right here as well...
};