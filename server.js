const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import mock database & initialize it
const db = require('./db');
db.init();

// Import middlewares
const errorHandler = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const aiRoutes = require('./routes/ai');

const app = express();

// Middlewares
app.use(cors({
  origin: true, // Allow client origin mapping
  credentials: true // Allow cookies to be sent/received
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Serve static frontend assets from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Bind API routes
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);

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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(` AI-Genius Auth Subsystem running...`);
  console.log(` Port: ${PORT}`);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(` URL: http://localhost:${PORT}`);
  console.log(`=========================================`);
});
