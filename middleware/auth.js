const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to protect routes & verify stateless access token
exports.protect = async (req, res, next) => {
  let token;

  // Check for Bearer token in Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Check if token exists
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized: Access Token is missing',
      code: 'TOKEN_MISSING'
    });
  }

  // Developer Simulation Checks for Testing
  if (token === 'SIMULATED_EXPIRED_TOKEN') {
    return res.status(401).json({
      success: false,
      message: 'Access Token has expired (Simulated)',
      code: 'TOKEN_EXPIRED'
    });
  }
  if (token === 'SIMULATED_TAMPERED_TOKEN') {
    return res.status(401).json({
      success: false,
      message: 'Not authorized: Access Token is invalid or tampered (Simulated)',
      code: 'TOKEN_INVALID'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database to ensure they still exist
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized: User no longer exists',
        code: 'USER_NOT_FOUND'
      });
    }

    // Check if user is locked out
    if (user.isLocked()) {
      return res.status(401).json({
        success: false,
        message: 'Your account is locked due to multiple failed login attempts. Please try again later.',
        code: 'ACCOUNT_LOCKED'
      });
    }

    // Attach user payload (id, email, role) to request
    req.user = {
      id: user.id || user._id,
      email: user.email,
      role: user.role
    };

    next();
  } catch (err) {
    // Specific error handling for expired access token
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Access Token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    // Malformed, tampered, or invalid token
    return res.status(401).json({
      success: false,
      message: 'Not authorized: Access Token is invalid or tampered',
      code: 'TOKEN_INVALID'
    });
  }
};

// Middleware factory for Role-Based Access Control (RBAC)
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // Ensure user object is present (protect middleware must run before this)
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized: Authentication required'
      });
    }

    // Check if user's role is in the allowed roles
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Role '${req.user.role}' is not authorized to access this resource`
      });
    }

    next();
  };
};
