const AuditLog = require('../models/AuditLog');

/**
 * Middleware factory for audit logging
 * @param {string} [actionName] - Custom name for the logged action. Defaults to HTTP Method and Path.
 */
const auditLog = (actionName) => {
  return (req, res, next) => {
    // Listen to response finish event to ensure we log after processing
    res.on('finish', async () => {
      try {
        // Log only successful operations or login attempts (success/fail)
        // If login failed, the controller can log it, or we log it here
        const userId = req.user ? req.user.id : null;
        const email = req.user ? req.user.email : (req.body ? req.body.email : null);
        const resolvedAction = actionName || `${req.method} ${req.originalUrl}`;

        await AuditLog.create({
          userId,
          email,
          action: resolvedAction,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent']
        });
      } catch (error) {
        console.error('Failed to create audit log entry:', error);
      }
    });

    next();
  };
};

module.exports = auditLog;
