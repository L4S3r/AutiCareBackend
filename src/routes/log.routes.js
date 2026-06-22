const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const BehaviorLog = require('../models/BehaviorLog.model');

router.use(protect);

// POST /api/logs
router.post('/', async (req, res, next) => {
  try {
    const log = await BehaviorLog.create({ ...req.body, loggedBy: req.user._id });
    res.status(201).json({ success: true, data: log });
  } catch (err) { next(err); }
});

// GET /api/logs/:childId
router.get('/:childId', async (req, res, next) => {
  try {
    const { startDate, endDate, limit = 30 } = req.query;
    let query = { childId: req.params.childId };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    const logs = await BehaviorLog.find(query).sort('-date').limit(parseInt(limit)).populate('loggedBy', 'name role');
    res.json({ success: true, data: logs });
  } catch (err) { next(err); }
});

// GET /api/logs/:childId/stats
router.get('/:childId/stats', async (req, res, next) => {
  try {
    const logs = await BehaviorLog.find({ childId: req.params.childId }).sort('-date').limit(30);
    const avgSleep = logs.length ? logs.reduce((s, l) => s + (l.sleepHours || 0), 0) / logs.length : 0;
    const totalMeltdowns = logs.reduce((s, l) => s + (l.meltdowns || 0), 0);
    const moodCounts = logs.reduce((acc, l) => { acc[l.mood] = (acc[l.mood] || 0) + 1; return acc; }, {});
    res.json({ success: true, data: { avgSleep: avgSleep.toFixed(1), totalMeltdowns, moodCounts, logsCount: logs.length } });
  } catch (err) { next(err); }
});

module.exports = router;
