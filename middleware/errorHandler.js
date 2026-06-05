const errorHandler = (err, req, res, next) => {
  // Log error for the developer
  console.error('Centralized Error Caught:', err.stack || err);

  // If response headers have already been sent, pass to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  // Determine status code (default to 500)
  const statusCode = err.statusCode || 500;

  // Clean JSON response
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

module.exports = errorHandler;
