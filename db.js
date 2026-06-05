const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');

const dbDir = path.join(__dirname, 'data');
const dbFile = path.join(dbDir, 'users.json');

class MockDatabase {
  constructor() {
    this.users = [];
  }

  // Initialize database and pre-seed users
  async init() {
    try {
      // Create data directory if it doesn't exist
      await fs.mkdir(dbDir, { recursive: true });

      try {
        const fileContent = await fs.readFile(dbFile, 'utf8');
        this.users = JSON.parse(fileContent);
      } catch (err) {
        // File doesn't exist, create it with seeds
        this.users = [];
        await this.seed();
      }
    } catch (error) {
      console.error('Failed to initialize mock database:', error);
    }
  }

  async seed() {
    console.log('Pre-seeding mock database users...');
    
    const adminPassword = await bcrypt.hash('Admin123!', 10);
    const premiumPassword = await bcrypt.hash('Premium123!', 10);
    const freePassword = await bcrypt.hash('Free123!', 10);

    const seedUsers = [
      {
        id: 'user_admin_01',
        email: 'admin@aigenius.com',
        password: adminPassword,
        role: 'Admin',
        refreshTokens: []
      },
      {
        id: 'user_premium_01',
        email: 'premium@aigenius.com',
        password: premiumPassword,
        role: 'Premium_User',
        refreshTokens: []
      },
      {
        id: 'user_free_01',
        email: 'free@aigenius.com',
        password: freePassword,
        role: 'Free_User',
        refreshTokens: []
      }
    ];

    this.users = seedUsers;
    await this.save();
    console.log('Mock database pre-seeded successfully.');
  }

  async save() {
    try {
      await fs.writeFile(dbFile, JSON.stringify(this.users, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to write database file:', err);
    }
  }

  // Find user by email
  async findUserByEmail(email) {
    return this.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  // Find user by id
  async findUserById(id) {
    return this.users.find(u => u.id === id);
  }

  // Create new user
  async createUser(email, plainPassword, role = 'Free_User') {
    const existing = await this.findUserByEmail(email);
    if (existing) {
      throw new Error('User already exists');
    }

    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const newUser = {
      id: 'user_' + Math.random().toString(36).substr(2, 9),
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      refreshTokens: []
    };

    this.users.push(newUser);
    await this.save();
    return newUser;
  }

  // Check if password matches
  async comparePassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  // Refresh token whitelist/blacklist management
  async addRefreshToken(userId, token) {
    const user = await this.findUserById(userId);
    if (user) {
      if (!user.refreshTokens) {
        user.refreshTokens = [];
      }
      user.refreshTokens.push(token);
      await this.save();
      return true;
    }
    return false;
  }

  async removeRefreshToken(userId, token) {
    const user = await this.findUserById(userId);
    if (user && user.refreshTokens) {
      user.refreshTokens = user.refreshTokens.filter(t => t !== token);
      await this.save();
      return true;
    }
    return false;
  }

  async hasRefreshToken(userId, token) {
    const user = await this.findUserById(userId);
    return user && user.refreshTokens && user.refreshTokens.includes(token);
  }
}

const db = new MockDatabase();
module.exports = db;
