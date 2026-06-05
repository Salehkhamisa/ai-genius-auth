const app = require('./app');
const connectDB = require('./database/db');
const User = require('./models/User');
const seedDB = require('./seed/seed');

// Initialize Server & Database
const startServer = async () => {
  try {
    // 1. Connect to MongoDB via Mongoose
    await connectDB();

    // 2. Proactive automatic database seeding (if User collection is empty)
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('No users found in database. Seeding default accounts...');
      await seedDB();
    } else {
      console.log('Database already has users. Skipping automatic seeding.');
    }

    // 3. Listen on port
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`=========================================`);
      console.log(` AI-Genius Auth System running...`);
      console.log(` Port: ${PORT}`);
      console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(` URL: http://localhost:${PORT}`);
      console.log(`=========================================`);
    });
  } catch (error) {
    console.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();
