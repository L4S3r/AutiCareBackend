const express = require('express');
const router = express.Router();
const { validate, schemas } = require('../middleware/validate.middleware');
const ContactSubmission = require('../models/ContactSubmission.model');
const { sendContactSubmissionEmail } = require('../services/email.service');

// POST /api/contact - Submit contact form securely
router.post('/', validate(schemas.contactSchema), async (req, res, next) => {
  try {
    const { name, email, phone, message } = req.body;

    // 1. Securely save to database
    const submission = await ContactSubmission.create({
      name,
      email,
      phone,
      message,
    });

    // 2. Dispatch secure email transmission asynchronously to not block the response
    try {
      await sendContactSubmissionEmail(submission);
    } catch (emailErr) {
      console.error('❌ Failed to send contact email notification:', emailErr.message);
      // We don't fail the request if email fails, since the submission is securely saved in DB
    }

    res.status(201).json({
      success: true,
      message: 'Message securely transmitted and registered successfully.',
      data: {
        id: submission._id,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
