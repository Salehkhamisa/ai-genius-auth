const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import middlewares
const errorHandler = require('./middleware/errorHandler');
const { globalLimiter } = require('./middleware/rateLimiter');

// Import routes
const authRoutes = require('./routes/auth');
const aiRoutes = require('./routes/ai');
const userRoutes = require('./routes/user');

const app = express();

// Security Headers Middleware (Disable CSP in development to allow inline onclick handlers in HTML)
app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"]
      }
    } : false
  })
);

// Prevent NoSQL Injection attacks (MongoDB sanitization)
app.use(mongoSanitize());

// CORS Configuration
app.use(
  cors({
    origin: true, // Allow client origin mapping dynamically
    credentials: true // Allow cookies to be sent and received
  })
);

// Global request rate limiting (100 requests per 15 minutes)
app.use('/api', globalLimiter);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Cookie parser
app.use(cookieParser());

// Serve static frontend assets from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Bind API routes
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/user', userRoutes);

// Fallback to serving the HTML index for single-page routing
app.get('*', (req, res, next) => {
  // If it's an API route that didn't match, let it fall through to 404
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      message: `API endpoint '${req.originalUrl}' not found`
    });
  }
  // Otherwise serve the UI
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Centralized error handler (must be loaded last)
app.use(errorHandler);

module.exports = app;
