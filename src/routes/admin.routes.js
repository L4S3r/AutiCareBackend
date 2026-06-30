const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const {
  getAdminStats,
  getAdminUsers,
  getAuditLogs,
  changeUserPassword,
  verifyBypass,
  toggleUserStatus,
  getUnverifiedPractitioners
} = require('../controllers/admin.controller');

// Apply protection & authorization to all routes in this router
router.use(protect, authorize('admin'));

router.get('/stats', getAdminStats);
router.get('/users', getAdminUsers);
router.get('/users/unverified-practitioners', getUnverifiedPractitioners);
router.put('/users/:id/status', toggleUserStatus);
router.put('/users/:id/password', changeUserPassword);
router.put('/users/:id/verify-bypass', verifyBypass);
router.get('/logs', getAuditLogs);
router.get('/audit', getAuditLogs);

module.exports = router;
