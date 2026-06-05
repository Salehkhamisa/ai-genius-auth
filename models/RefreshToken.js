const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    refreshToken: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    expirationDate: {
      type: Date,
      required: true,
      index: { expires: 0 } // TTL index: MongoDB will automatically delete document when current time > expirationDate
    },
    revoked: {
      type: Boolean,
      required: true,
      default: false
    },
    replacedByToken: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
