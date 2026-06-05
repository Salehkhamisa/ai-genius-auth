const connectDB = require('./database/db');
const seedDB = require('./seed/seed');

module.exports = {
  init: async () => {
    // Connect to database and seed sample users
    await connectDB();
    await seedDB();
  }
};
