const express = require('express');
const aiController = require('../controllers/aiController');
const { protect, restrictTo } = require('../middleware/auth');
const auditLog = require('../middleware/auditLogger');

const router = express.Router();

// GET /api/ai/free-model (Accessible to all authenticated roles)
router.get(
  '/free-model',
  protect,
  restrictTo('Free_User', 'Premium_User', 'Admin'),
  auditLog('ACCESS_FREE_MODEL'),
  aiController.getFreeModel
);

// POST /api/ai/premium-model (Accessible to Premium_User and Admin only)
router.post(
  '/premium-model',
  protect,
  restrictTo('Premium_User', 'Admin'),
  auditLog('ACCESS_PREMIUM_MODEL'),
  aiController.getPremiumModel
);

// DELETE /api/ai/purge-cache (Accessible to Admin only)
router.delete(
  '/purge-cache',
  protect,
  restrictTo('Admin'),
  auditLog('PURGE_CACHE'),
  aiController.purgeCache
);

module.exports = router;
