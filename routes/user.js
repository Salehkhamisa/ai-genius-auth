const express = require('express');
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { validate, changePasswordRules } = require('../utils/validators');
const auditLog = require('../middleware/auditLogger');

const router = express.Router();

// GET /api/user/profile - Get current user details
router.get('/profile', protect, authController.getProfile);

// POST /api/user/change-password - Change user password
router.post(
  '/change-password',
  protect,
  validate(changePasswordRules),
  auditLog('CHANGE_PASSWORD'),
  authController.changePassword
);

module.exports = router;
