/*
  Mongoose schema and model definition for forum users, including fields for name, email, password, and role.
*/
const mongoose = require('mongoose');

// User document for Archers Forum
const userSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role:     { type: String, enum: ['user', 'admin'], default: 'user' },
    avatar:   { type: String, default: '/assets/default_pfp.png' }, 
    cover:    { type: String, default: '/assets/default_banner.png' }, 
    following: [{ type: String, lowercase: true, trim: true }], // Array of email addresses
    followers: [{ type: String, lowercase: true, trim: true }], // Array of email addresses
    isDisabled: { type: Boolean, default: false }, // For account suspension
  },
  { timestamps: true }
);

// Export the Mongoose model for use in other parts of the application
module.exports = mongoose.model('User', userSchema);
