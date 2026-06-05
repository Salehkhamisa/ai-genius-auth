const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
const router = express.Router();

// Utility function to generate Access Token (Stateless payload)
const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRE || '15m' }
  );
};

// Utility function to generate Refresh Token
const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, role } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an email and password'
      });
    }

    // Validate role if provided
    const validRoles = ['Admin', 'Premium_User', 'Free_User'];
    const selectedRole = role || 'Free_User';
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Choose from: Admin, Premium_User, Free_User'
      });
    }

    const userExists = await db.findUserByEmail(email);
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'A user with that email already exists'
      });
    }

    const newUser = await db.createUser(email, password, selectedRole);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/auth/login
// @desc    Login user, generate Access Token and Refresh Token (HTTP-Only Cookie)
// @access  Public
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Check if user exists
    const user = await db.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password match
    const isMatch = await db.comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Save refresh token to whitelist database
    await db.addRefreshToken(user.id, refreshToken);

    // Set Refresh Token in secure, httpOnly cookie
    const cookieExpireDays = parseInt(process.env.JWT_COOKIE_EXPIRE) || 7;
    const cookieOptions = {
      httpOnly: true,
      expires: new Date(Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000),
      sameSite: 'strict',
      // In production, require HTTPS transmission
      secure: process.env.NODE_ENV === 'production'
    };

    res.cookie('refreshToken', refreshToken, cookieOptions);

    // Return Access Token & User details in JSON payload
    res.status(200).json({
      success: true,
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/auth/refresh
// @desc    Get new Access Token using Refresh Token from cookie
// @access  Public (Relies on secure cookie)
router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Access Denied: Refresh Token is missing',
        code: 'REFRESH_TOKEN_MISSING'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Access Denied: Refresh Token is invalid or expired',
        code: 'REFRESH_TOKEN_INVALID'
      });
    }

    // Verify token against database whitelist
    const isWhitelisted = await db.hasRefreshToken(decoded.id, refreshToken);
    if (!isWhitelisted) {
      return res.status(401).json({
        success: false,
        message: 'Access Denied: Refresh Token is revoked or not whitelisted',
        code: 'REFRESH_TOKEN_REVOKED'
      });
    }

    // Find the user
    const user = await db.findUserById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Access Denied: User associated with token does not exist',
        code: 'USER_NOT_FOUND'
      });
    }

    // Generate new Access Token
    const accessToken = generateAccessToken(user);

    res.status(200).json({
      success: true,
      accessToken
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/auth/logout
// @desc    Clear refresh token from database and clear cookie
// @access  Public
router.post('/logout', async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      try {
        // Attempt to decode to find user and remove from whitelist
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        await db.removeRefreshToken(decoded.id, refreshToken);
      } catch (err) {
        // Token might be malformed or already expired, ignore and clear cookie
      }
    }

    // Clear cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production'
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
