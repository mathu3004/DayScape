/**
 * models/User.js — Mongoose Model for Regular User Accounts
 *
 * Defines the schema and helpers for end-users (tourists) who register
 * on the DayScape platform to plan trips, save favourites, and book packages.
 *
 * Schema fields:
 *  name         — Full display name (trimmed)
 *  email        — Unique login email, stored lowercase
 *  password     — Bcrypt-hashed password (min 6 characters enforced)
 *  phone        — Optional contact phone number
 *  avatar       — URL to a profile picture (optional)
 *  role         — Always 'user' for regular accounts
 *  nationality  — 'local' | 'foreigner'; affects ticket pricing display
 *  isActive     — Can be toggled by admins to suspend the account
 *  savedPlans   — Array of ObjectId refs to VisitPlan documents
 *  favorites    — Array of ObjectId refs to Place documents
 *  timestamps   — Mongoose adds createdAt and updatedAt
 *
 * Middleware:
 *  pre('save') — Hashes password before first save or when changed.
 *
 * Instance methods:
 *  matchPassword(enteredPassword) — Compares plain password to stored hash.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ── User Schema Definition ────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  // Trimmed display name shown in the UI
  name: { type: String, required: true, trim: true },

  // Unique email used for login; lowercased for consistent lookup
  email: { type: String, required: true, unique: true, lowercase: true },

  // Hashed at rest; minimum length of 6 is enforced at the schema level
  password: { type: String, required: true, minlength: 6 },

  // Optional phone number for contact purposes
  phone: { type: String, default: '' },

  // URL to a profile avatar image
  avatar: { type: String, default: '' },

  // Role label used in middleware; end-users always have role 'user'
  role: { type: String, default: 'user' },

  // Visitor classification affects how ticket prices are displayed to the user
  nationality: { type: String, default: 'local' }, // local | foreigner

  // Allows admins to suspend an account without deleting user data
  isActive: { type: Boolean, default: true },

  // References to the user's saved day-trip plans
  savedPlans: [{ type: mongoose.Schema.Types.ObjectId, ref: 'VisitPlan' }],

  // References to places the user has marked as favourites
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Place' }],
}, { timestamps: true }); // Auto-adds createdAt and updatedAt

// ── Pre-save Password Hashing ─────────────────────────────────────────────────
// Only runs when the password field has been modified to avoid re-hashing
// unchanged passwords on profile updates.
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  // 10 salt rounds is a good balance between security and CPU cost
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// ── Instance Method: matchPassword ────────────────────────────────────────────
// Called in authController.login to verify that the entered password
// matches the stored bcrypt hash. bcrypt.compare is timing-safe.
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Export the compiled Mongoose model used throughout the application
module.exports = mongoose.model('User', userSchema);
