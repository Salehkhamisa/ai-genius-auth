const { body, validationResult } = require('express-validator');

// Helper middleware to execute validation schemas and return early if errors exist
const validate = (validations) => {
  return async (req, res, next) => {
    // Run all validations
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    // Format errors clean JSON response
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg, // Return the first error message as main message
      errors: errors.array().map(err => ({ field: err.path, message: err.msg }))
    });
  };
};

// Validation rules for Register
const registerRules = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('role')
    .optional()
    .isIn(['Admin', 'Premium_User', 'Free_User'])
    .withMessage('Invalid role. Choose from: Admin, Premium_User, Free_User')
];

// Validation rules for Login
const loginRules = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Validation rules for Change Password
const changePasswordRules = [
  body('oldPassword')
    .notEmpty()
    .withMessage('Old password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
];

module.exports = {
  validate,
  registerRules,
  loginRules,
  changePasswordRules
};
