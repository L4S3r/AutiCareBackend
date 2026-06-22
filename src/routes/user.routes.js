const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const User = require('../models/User.model');

router.use(protect);

router.get('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
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

module.exports = router;
