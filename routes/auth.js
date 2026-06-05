const express = require('express');
const authController = require('../controllers/authController');
const { validate, registerRules, loginRules } = require('../utils/validators');
const { loginLimiter } = require('../middleware/rateLimiter');
const auditLog = require('../middleware/auditLogger');

const router = express.Router();

// Register route
router.post(
  '/register',
  validate(registerRules),
  auditLog('USER_REGISTRATION'),
  authController.register
);

// Login route with rate limiter and audit logging
router.post(
  '/login',
  loginLimiter,
  validate(loginRules),
  auditLog('USER_LOGIN'),
  authController.login
);

// Token refresh route
router.post('/refresh', authController.refresh);

// Logout route
router.post('/logout', authController.logout);

module.exports = router;
