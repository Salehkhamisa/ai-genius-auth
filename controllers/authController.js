const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const tokenService = require('../services/tokenService');
const { AppError } = require('../utils/errors');

// Helper to set cookie options
const getCookieOptions = () => {
  const cookieExpireDays = parseInt(process.env.JWT_COOKIE_EXPIRE) || 7;
  return {
    httpOnly: true,
    expires: new Date(Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000),
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  };
};

/**
 * Register User
 * POST /api/auth/register
 */
exports.register = async (req, res, next) => {
  try {
    const { email, password, role } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      throw new AppError('A user with that email already exists', 400);
    }

    // Create user (role defaults to Free_User if not provided)
    const newUser = await User.create({
      email,
      password,
      role: role || 'Free_User'
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: newUser._id,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login User
 * POST /api/auth/login
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    // Check if user is locked out
    if (user.isLocked()) {
      const lockTimeRemaining = Math.ceil((user.lockUntil - Date.now()) / 1000 / 60);
      throw new AppError(`Account is temporarily locked. Try again in ${lockTimeRemaining} minutes.`, 401);
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // Increment failed attempts and trigger lockout if limit reached
      await user.incrementLoginAttempts();
      
      if (user.isLocked()) {
        throw new AppError('Account locked due to 5 failed login attempts. Please try again in 15 minutes.', 401);
      }
      
      throw new AppError('Invalid credentials', 401);
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Generate Access and Refresh Tokens
    const accessToken = tokenService.generateAccessToken(user);
    const refreshToken = tokenService.generateRefreshToken(user);

    // Whitelist Refresh Token in DB
    await tokenService.saveRefreshToken(user._id, refreshToken);

    // Set Refresh Token as HTTP-Only Cookie
    res.cookie('refreshToken', refreshToken, getCookieOptions());

    res.status(200).json({
      success: true,
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Silent Refresh / Rotate Tokens
 * POST /api/auth/refresh
 */
exports.refresh = async (req, res, next) => {
  try {
    const oldRefreshToken = req.cookies.refreshToken;

    if (!oldRefreshToken) {
      throw new AppError('Access Denied: Refresh Token is missing', 401);
    }

    // Rotate the tokens and verify the old one
    const { accessToken, refreshToken, user } = await tokenService.rotateRefreshToken(oldRefreshToken);

    // Send the new Refresh Token in the HTTP-Only cookie
    res.cookie('refreshToken', refreshToken, getCookieOptions());

    res.status(200).json({
      success: true,
      accessToken
    });
  } catch (error) {
    // If validation/rotation fails, clear cookie and return 401
    res.clearCookie('refreshToken', {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production'
    });
    next(error);
  }
};

/**
 * Logout User
 * POST /api/auth/logout
 */
exports.logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      // Revoke the token in the whitelist database
      await RefreshToken.findOneAndDelete({ refreshToken });
    }

    // Clear HTTP-Only cookie
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
};

/**
 * Get User Profile (Bonus)
 * GET /api/user/profile
 */
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change Password (Bonus)
 * POST /api/user/change-password
 */
exports.changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Check old password
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      throw new AppError('Incorrect old password', 400);
    }

    // Save new password (pre-save middleware handles hashing)
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
};
