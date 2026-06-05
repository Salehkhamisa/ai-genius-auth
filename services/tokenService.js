const jwt = require('jsonwebtoken');
const RefreshToken = require('../models/RefreshToken');
const User = require('../models/User');
const { AppError } = require('../utils/errors');

// Helper to parse JWT expiration strings to milliseconds
const parseDurationToMs = (durationStr) => {
  if (!durationStr) return 7 * 24 * 60 * 60 * 1000; // default 7 days
  const match = String(durationStr).match(/^(\d+)([smhd])$/i);
  if (!match) return 7 * 24 * 60 * 60 * 1000;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 7 * 24 * 60 * 60 * 1000;
  }
};

/**
 * Generate a short-lived Access Token
 */
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.id || user._id,
      email: user.email,
      role: user.role,
      jti: Math.random().toString(36).substring(2) + Date.now().toString(36)
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRE || '15m' }
  );
};

/**
 * Generate a long-lived Refresh Token
 */
const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user.id || user._id,
      email: user.email,
      role: user.role,
      jti: Math.random().toString(36).substring(2) + Date.now().toString(36)
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );
};

/**
 * Save Refresh Token to Whitelist Database
 */
const saveRefreshToken = async (userId, token) => {
  const durationMs = parseDurationToMs(process.env.JWT_REFRESH_EXPIRE || '7d');
  const expirationDate = new Date(Date.now() + durationMs);

  return await RefreshToken.create({
    userId,
    refreshToken: token,
    expirationDate
  });
};

/**
 * Rotate Refresh Token & Handle Token Reuse Detection (Replay attack defense)
 */
const rotateRefreshToken = async (oldToken) => {
  let decoded;
  try {
    decoded = jwt.verify(oldToken, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    throw new AppError('Refresh Token has expired or is invalid', 401);
  }

  // Find the token in our database
  const tokenDoc = await RefreshToken.findOne({ refreshToken: oldToken });

  // Scenario 1: Token does not exist in the database (could have been deleted or never existed)
  if (!tokenDoc) {
    throw new AppError('Refresh Token is not whitelisted', 401);
  }

  // Scenario 2: Token is already revoked (POTENTIAL REUSE ATTACK DETECTED!)
  if (tokenDoc.revoked) {
    // Revoke all tokens issued to this user for security
    await RefreshToken.deleteMany({ userId: tokenDoc.userId });
    throw new AppError('Potential security breach: Refresh Token reuse detected. Please login again.', 401);
  }

  // Find the user associated with this token
  const user = await User.findById(tokenDoc.userId);
  if (!user) {
    throw new AppError('User associated with token no longer exists', 401);
  }

  // Generate new Access and Refresh tokens
  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

  // Revoke the old token and document replacement link
  tokenDoc.revoked = true;
  tokenDoc.replacedByToken = newRefreshToken;
  await tokenDoc.save();

  // Save the new Refresh Token to the database
  await saveRefreshToken(user._id, newRefreshToken);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    user
  };
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  saveRefreshToken,
  rotateRefreshToken
};
