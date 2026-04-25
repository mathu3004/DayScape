/**
 * models/Admin.js — Mongoose Model for Admin Accounts
 *
 * Defines the schema and instance methods for administrator users
 * who manage the DayScape platform through the admin panel.
 *
 * Schema fields:
 *  name       — Admin's display name (required)
 *  email      — Unique, lowercase login email (required)
 *  password   — Bcrypt-hashed password (required, never returned raw)
 *  role       — Admin role label, defaults to 'admin'
 *  isActive   — Whether the admin account is active (can be suspended)
 *  timestamps — Mongoose adds createdAt and updatedAt automatically
 *
 * Middleware:
 *  pre('save') — Hashes the password before saving if it was modified,
 *                preventing plain-text storage in MongoDB.
 *
 * Instance methods:
 *  matchPassword(entered) — Compares a plain-text candidate password
 *                           against the stored bcrypt hash. Returns a
 *                           boolean promise used during login.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ── Admin Schema Definition ───────────────────────────────────────────────────
const adminSchema = new mongoose.Schema({
  // Full name displayed in the admin panel header
  name: { type: String, required: true },

  // Email used for login; stored lowercase for case-insensitive matching
  email: { type: String, required: true, unique: true, lowercase: true },

  // Bcrypt hash of the password — never stored as plain text
  password: { type: String, required: true },

  // Role label — currently always 'admin'; reserved for future role expansion
  role: { type: String, default: 'admin' },

  // Soft-disable flag; allows account suspension without deletion
  isActive: { type: Boolean, default: true },
}, { timestamps: true }); // Adds createdAt + updatedAt fields

// ── Pre-save Password Hashing ─────────────────────────────────────────────────
// Only rehash when the password field has actually changed to avoid
// double-hashing on unrelated document updates.
adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  // Salt rounds = 10 (standard bcrypt security level)
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// ── Instance Method: matchPassword ────────────────────────────────────────────
// Used in adminAuthController.adminLogin to verify credentials at sign-in.
adminSchema.methods.matchPassword = async function (entered) {
  // bcrypt.compare handles timing-safe comparison to prevent brute-force leaks
  return await bcrypt.compare(entered, this.password);
};

// Export the compiled Mongoose model
module.exports = mongoose.model('Admin', adminSchema);
