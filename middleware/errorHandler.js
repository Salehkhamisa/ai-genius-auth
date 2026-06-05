const errorHandler = (err, req, res, next) => {
  // Log error stack for developer visibility
  console.error('Centralized Error Caught:', err.stack || err);

  if (res.headersSent) {
    return next(err);
  }

  // Copy error object so we don't mutate the original
  let error = { ...err };
  error.message = err.message;

  // 1. Mongoose Bad ObjectId (Cast Error)
  if (err.name === 'CastError') {
    const message = `Resource not found with id of ${err.value}`;
    error = { message, statusCode: 404 };
  }

  // 2. Mongoose Duplicate Key Error (MongoDB Code 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate field value entered: '${err.keyValue[field]}'. Please use another ${field}.`;
    error = { message, statusCode: 400 };
  }

  // 3. Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
  }

  // 4. JWT Expiration Error
  if (err.name === 'TokenExpiredError') {
    error = { message: 'Token expired', statusCode: 401 };
  }

  // 5. JWT Invalid Token Error
  if (err.name === 'JsonWebTokenError') {
    error = { message: 'Invalid token', statusCode: 401 };
  }

  // Determine final status code (default to 500)
  const statusCode = error.statusCode || err.statusCode || 500;

  // Clean JSON response
  res.status(statusCode).json({
    success: false,
    message: error.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

module.exports = errorHandler;
