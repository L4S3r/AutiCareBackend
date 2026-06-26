const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const Notification = require('../models/Notification.model');
const User = require('../models/User.model');
const ChildProfile = require('../models/ChildProfile.model');
const BehaviorLog = require('../models/BehaviorLog.model');
const admin = require('firebase-admin');
const { sendEmail } = require('../services/email.service.js');

router.post('/daily-reminder', async (req, res, next) => {
  try {
    // Basic security token check to verify that external public visitors cannot ping this route manually
    const cronSecret = req.headers['authorization'];
    if (cronSecret !== `Bearer ${process.env.CRON_SECRET_KEY}`) {
      return res.status(401).json({ error: 'Unauthorized system invocation.' });
    }

    // Define the start and end of today's date window bounds
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // 1. Get all child profiles registered to track down active parents
    const children = await ChildProfile.find({ isActive: true });

    let remindersFired = 0;

    for (const child of children) {
      // Check if a behavioral entry exists for this child within today's time window bounds
      const logExists = await BehaviorLog.findOne({
        childId: child._id,
        createdAt: { $gte: startOfToday, $lte: endOfToday }
      });

      // If no log entry is found, find the parent user profile and send a reminder
      if (!logExists) {
        const parentUser = await User.findById(child.parentId);
        if (parentUser && parentUser.isActive) {

          // A. Send an informative reminder template layout via Nodemailer
          await sendEmail({
            to: parentUser.email,
            subject: '📝 AutiCare: Daily Tracking Reminder',
            text: `Hi ${parentUser.name},\n\nYou haven't submitted today's behavioral tracking log for ${child.name} yet. Logging sleep, mood, and supplements helps train your personalized AI predictive matrix.\n\nWarm regards,\nThe AutiCare Team`,
            html: `<h3>Hi ${parentUser.name},</h3><p>You haven't submitted today's behavioral tracking log for <b>${child.name}</b> yet.</p><p>Logging sleep, mood, and supplements helps train your personalized AI predictive matrix.</p><p>Warm regards,<br>The AutiCare Team</p>`
          });

          // B. If an FCM push key is registered, drop a reminder directly on their device screen
          if (parentUser.fcmToken) {
            try {
              await admin.messaging().send({
                token: parentUser.fcmToken,
                notification: {
                  title: '📝 Log Entry Reminder',
                  body: `Don't forget to submit ${child.name}'s behavioral metrics log layout for today!`
                },
                data: { type: 'log_reminder' }
              });
            } catch (fcmErr) {
              console.error(`Failed to drop push token frame for user ${parentUser.email}:`, fcmErr.message);
            }
          }
          remindersFired++;
        }
      }
    }

    res.json({ success: true, processedReminders: remindersFired });
  } catch (err) {
    next(err);
  }
});

router.use(protect);
router.get('/', async (req, res, next) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id }).sort('-createdAt').limit(20);
    const unread = await Notification.countDocuments({ userId: req.user._id, read: false });
    res.json({ success: true, data: notifications, unread });
  } catch (err) { next(err); }
});

router.put('/:id/read', async (req, res, next) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { read: true, readAt: new Date() });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.put('/read-all', async (req, res, next) => {
  try {
    await Notification.updateMany({ userId: req.user._id, read: false }, { read: true, readAt: new Date() });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
