const mongoose = require('mongoose');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');

const seedUsers = [
  {
    email: 'admin@aigenius.com',
    password: 'Admin123!',
    role: 'Admin'
  },
  {
    email: 'premium@aigenius.com',
    password: 'Premium123!',
    role: 'Premium_User'
  },
  {
    email: 'free@aigenius.com',
    password: 'Free123!',
    role: 'Free_User'
  }
];

const seedDB = async () => {
  try {
    // Clear existing users from seeds to avoid duplicates
    const emails = seedUsers.map(u => u.email);
    await User.deleteMany({ email: { $in: emails } });
    
    // Clear refresh tokens to reset state
    await RefreshToken.deleteMany({});
    
    // Create new seeded users (User schema pre-save hook will hash passwords)
    await User.create(seedUsers);
    
    console.log('-----------------------------------------');
    console.log(' Database seeded with default users:');
    console.log('   - Admin: admin@aigenius.com (Admin123!)');
    console.log('   - Premium: premium@aigenius.com (Premium123!)');
    console.log('   - Free: free@aigenius.com (Free123!)');
    console.log('-----------------------------------------');
  } catch (error) {
    console.error('Failed to seed database:', error);
  }
};

// Check if run directly from command line (e.g., node seed/seed.js)
if (require.main === module) {
  require('dotenv').config();
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ai_genius_auth';
  
  mongoose.connect(MONGO_URI)
    .then(async () => {
      console.log('Connected to MongoDB for seeding...');
      await seedDB();
      await mongoose.connection.close();
      console.log('Database connection closed.');
      process.exit(0);
    })
    .catch(err => {
      console.error('MongoDB connection error in seeder:', err);
      process.exit(1);
    });
}

module.exports = seedDB;
