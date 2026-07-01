const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { approvePlan, getPlans, getPlan } = require('../controllers/nutrition.controller');

router.use(protect);
router.put('/:id/approve', authorize('doctor', 'admin'), approvePlan);
router.get('/:childId', getPlans);
router.get('/plan/:id', getPlan);

module.exports = router;
