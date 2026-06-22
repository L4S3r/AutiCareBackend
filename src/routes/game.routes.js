const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const GameScore = require('../models/GameScore.model');

router.use(protect);

// POST /api/games/score
router.post('/score', async (req, res, next) => {
  try {
    const score = await GameScore.create({ ...req.body });
    res.status(201).json({ success: true, data: score });
  } catch (err) { next(err); }
});

// GET /api/games/:childId
router.get('/:childId', async (req, res, next) => {
  try {
    const scores = await GameScore.find({ childId: req.params.childId }).sort('-createdAt').limit(50);
    res.json({ success: true, data: scores });
  } catch (err) { next(err); }
});

// GET /api/games/:childId/progress
router.get('/:childId/progress', async (req, res, next) => {
  try {
    const games = ['memory_game', 'attention_game', 'shape_matching', 'emotion_recognition', 'cognitive_puzzle'];
    const progress = await Promise.all(games.map(async (game) => {
      const scores = await GameScore.find({ childId: req.params.childId, gameName: game }).sort('-createdAt').limit(10);
      const avg = scores.length ? scores.reduce((s, g) => s + g.score, 0) / scores.length : 0;
      return { game, avgScore: avg.toFixed(1), sessions: scores.length, latest: scores[0] || null };
    }));
    res.json({ success: true, data: progress });
  } catch (err) { next(err); }
});

module.exports = router;
