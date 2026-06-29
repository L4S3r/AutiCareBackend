const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const User = require('../models/User.model');
const ChildProfile = require('../models/ChildProfile.model');

router.use(protect);

router.get('/:id', async (req, res, next) => {
  try {
    let user = await User.findById(req.params.id);
    if (!user) {
      user = await ChildProfile.findById(req.params.id);
    }
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

router.put('/profile', async (req, res, next) => {
  try {
    const { name, phone, clinic, specialization, language } = req.body;
    const user = await User.findByIdAndUpdate(req.user._id, { name, phone, clinic, specialization, language }, { new: true, runValidators: true });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

router.put('/fcm-token', async (req, res, next) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) {
      return res.status(400).json({ error: 'fcmToken parameter is required' });
    }

    if (req.user.role === 'Child') {
      await ChildProfile.findByIdAndUpdate(req.user._id, { fcmToken });
    } else {
      await User.findByIdAndUpdate(req.user._id, { fcmToken });
    }

    res.json({ success: true, message: 'FCM device token registered to profile successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
