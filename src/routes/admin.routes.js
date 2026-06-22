const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const User = require('../models/User.model');
const ChildProfile = require('../models/ChildProfile.model');
const BehaviorLog = require('../models/BehaviorLog.model');
const GeneticReport = require('../models/GeneticReport.model');
const NutritionPlan = require('../models/NutritionPlan.model');
const AuditLog = require('../models/AuditLog.model');

router.use(protect, authorize('admin'));

// GET /api/admin/stats
router.get('/stats', async (req, res, next) => {
  try {
    const [users, patients, reports, plans, logs] = await Promise.all([
      User.countDocuments({ isActive: true }),
      ChildProfile.countDocuments({ isActive: true }),
      GeneticReport.countDocuments(),
      NutritionPlan.countDocuments({ approved: true }),
      BehaviorLog.countDocuments(),
    ]);
    const roleBreakdown = await User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]);
    res.json({ success: true, data: { users, patients, reports, approvedPlans: plans, behaviorLogs: logs, roleBreakdown } });
  } catch (err) { next(err); }
});

// GET /api/admin/users
router.get('/users', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const filter = req.query.role ? { role: req.query.role } : {};
    const [users, total] = await Promise.all([
      User.find(filter).skip(skip).limit(limit).sort('-createdAt'),
      User.countDocuments(filter),
    ]);
    res.json({ success: true, data: users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

// PUT /api/admin/users/:id/status
router.put('/users/:id/status', async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: req.body.isActive }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

// GET /api/admin/audit
router.get('/audit', async (req, res, next) => {
  try {
    const logs = await AuditLog.find().populate('userId', 'name role').sort('-createdAt').limit(100);
    res.json({ success: true, data: logs });
  } catch (err) { next(err); }
});

module.exports = router;
