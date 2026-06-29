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

const { upload, validateFileMagicBytes } = require('../middleware/file.middleware');
const { uploadStream } = require('../services/storage.service');

router.patch('/profile/avatar', upload.single('avatar'), validateFileMagicBytes, async (req, res, next) => {
  try {
    let avatarUrl = null;

    if (req.file) {
      const uploadRes = await uploadStream(req.file.buffer, {
        folder: 'auticare/avatars',
        resource_type: 'image',
      });
      avatarUrl = uploadRes.secure_url;
    } else if (req.body.clear === 'true' || req.body.clear === true) {
      avatarUrl = null;
    } else {
      return res.status(400).json({ error: 'No file uploaded or clear parameter specified.' });
    }

    let updatedProfile;
    if (req.user.role === 'Child') {
      updatedProfile = await ChildProfile.findByIdAndUpdate(
        req.user._id,
        { avatar: avatarUrl },
        { new: true }
      );
    } else {
      updatedProfile = await User.findByIdAndUpdate(
        req.user._id,
        { avatar: avatarUrl },
        { new: true }
      );
    }

    res.json({
      success: true,
      data: updatedProfile,
      message: avatarUrl ? 'Profile avatar updated successfully.' : 'Profile avatar cleared successfully.'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
