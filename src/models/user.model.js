const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    paymentCustomerId: {
      type: String,
    },
    // Basic Info (required)
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    phoneNumber: {
      type: String,
      trim: true
    },
    password: {
      type: String,
      required: true,
      trim: true
    },
    profileImage: {
      type: String,
      default: 'uploads/default_profile.png'
    },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role'
    },

    // Address Info
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      zip: { type: String, trim: true },
      country: { type: String, trim: true },
      latitude: { type: String, trim: true },
      longitude: { type: String, trim: true },
      landmark: { type: String, trim: true },
      note: { type: String, trim: true }
    },

    // Status flags
    isActive: {
      type: Boolean,
      default: true
    },
    isSuperAdmin: {
      type: Boolean,
      default: false
    },
    isProfileComplete: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true // Automatically adds createdAt and updatedAt fields
  }
);

module.exports = mongoose.model('User', userSchema);
