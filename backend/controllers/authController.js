/**
 * controllers/authController.js — User Authentication & Profile Controller
 *
 * Handles all authentication and profile operations for regular user accounts:
 *  - register    POST /api/auth/register  — Create a new user account
 *  - login       POST /api/auth/login     — Authenticate and return a JWT
 *  - getMe       GET  /api/auth/me        — Return the logged-in user's profile
 *  - updateProfile PUT /api/auth/profile  — Update name, phone, nationality
 *  - changePassword PUT /api/auth/password — Verify old password and set new one
 *
 * All protected routes require a valid Bearer token (set by the `protect`
 * middleware in middleware/auth.js) which attaches req.user to the request.
 *
 * Token generation:
 *  Tokens are signed with JWT_SECRET and expire after JWT_EXPIRE (from .env).
 *  The token payload contains only { id } — the user's MongoDB ObjectId.
 *  The token is returned in the response body (not a cookie) and stored in
 *  localStorage by the frontend AuthContext.
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ── Token Helper ──────────────────────────────────────────────────────────────
// Signs a JWT containing only the user's MongoDB ObjectId.
// Called after successful register and login to issue a new session token.
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });

// ── Register ──────────────────────────────────────────────────────────────────
// Creates a new user account. Validates required fields, checks for duplicate
// email, creates the user document (password hashed by User pre-save hook),
// and immediately returns a JWT so the user is logged in after registration.
exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, nationality } = req.body;

    // Ensure the three mandatory fields are present before touching the database
    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'Please fill all required fields' });

    // Prevent duplicate accounts — email is the unique login identifier
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ success: false, message: 'Email already registered' });

    // Create the user — the User model's pre-save hook will bcrypt-hash the password
    const user = await User.create({ name, email, password, phone, nationality });

    // Issue a JWT immediately so the client is authenticated without a second login step
    const token = generateToken(user._id);

    // Return only the safe subset of user fields (never return the hashed password)
    res.status(201).json({
      success: true,
      token,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role, nationality: user.nationality },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Login ─────────────────────────────────────────────────────────────────────
// Authenticates a returning user. Looks up by email, verifies password using
// bcrypt.compare (via User.matchPassword), checks the account is active,
// and returns a new JWT on success.
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Both fields are required — return early rather than hitting the database
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password required' });

    // Look up the user by email; matchPassword uses bcrypt.compare (timing-safe)
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    // Suspended accounts are blocked from logging in
    if (!user.isActive)
      return res.status(403).json({ success: false, message: 'Account deactivated' });

    const token = generateToken(user._id);

    // Return a slightly richer payload than register (includes phone for profile display)
    res.json({
      success: true,
      token,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role, nationality: user.nationality, phone: user.phone },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get Me ────────────────────────────────────────────────────────────────────
// Returns the full profile of the currently authenticated user.
// The `protect` middleware has already loaded the user onto req.user,
// but this re-queries the DB to ensure the latest data is returned.
// The password field is excluded with .select('-password').
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Update Profile ────────────────────────────────────────────────────────────
// Allows the user to update their display name, phone number, and nationality.
// Email and password changes are handled separately for security reasons.
// Uses { new: true } to return the updated document in the response.
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, nationality } = req.body;

    // findByIdAndUpdate with { new: true } returns the document after the update
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, phone, nationality },
      { new: true }
    ).select('-password'); // Never expose the hashed password

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Change Password ───────────────────────────────────────────────────────────
// Verifies the user's current password before allowing a password change.
// Assigning user.password and calling user.save() triggers the pre-save hook
// in the User model, which bcrypt-hashes the new password automatically.
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Fetch the full user document so we have access to matchPassword
    const user = await User.findById(req.user._id);

    // Reject the change if the current password does not match the stored hash
    if (!(await user.matchPassword(currentPassword)))
      return res.status(400).json({ success: false, message: 'Current password incorrect' });

    // Assigning triggers isModified('password') = true, so the pre-save hook re-hashes
    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
