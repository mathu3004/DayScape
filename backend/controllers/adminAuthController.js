/**
 * controllers/adminAuthController.js — Admin Authentication Controller
 *
 * Handles authentication for administrator accounts. Admin users are stored
 * in a separate `admins` collection (Admin model) and use a different JWT
 * payload path than regular users, but the same JWT_SECRET and JWT_EXPIRE.
 *
 * Exports:
 *  adminLogin  POST /api/admin/auth/login  — Authenticate admin, return JWT
 *  getAdminMe  GET  /api/admin/auth/me     — Return the current admin's profile
 *
 * The `adminProtect` middleware (middleware/auth.js) validates the admin JWT
 * and attaches the admin document to req.admin before protected routes run.
 *
 * Note: There is no admin registration endpoint — admin accounts are created
 * manually via the database seed script or directly in MongoDB.
 */

const jwt   = require('jsonwebtoken');
const Admin = require('../models/Admin');

// ── Token Helper ──────────────────────────────────────────────────────────────
// Signs a JWT with the admin's ObjectId as the payload.
// Uses the same JWT_SECRET and JWT_EXPIRE as user tokens, but the middleware
// that verifies admin tokens queries the Admin collection (not User).
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });

// ── Admin Login ───────────────────────────────────────────────────────────────
// Authenticates an admin account by email and password.
// Uses Admin.matchPassword (bcrypt.compare) to verify against the stored hash.
// Returns a JWT and a safe subset of admin fields on success.
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Both email and password are required to attempt authentication
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password required' });

    // Find admin by email; matchPassword uses bcrypt.compare — timing-safe
    const admin = await Admin.findOne({ email });
    if (!admin || !(await admin.matchPassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });

    // Issue a new JWT for this admin session
    const token = generateToken(admin._id);

    // Return only safe fields — never include the hashed password in the response
    res.json({
      success: true,
      token,
      admin: { _id: admin._id, name: admin.name, email: admin.email, role: admin.role },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get Admin Me ──────────────────────────────────────────────────────────────
// Returns the profile of the currently authenticated admin.
// The `adminProtect` middleware attaches req.admin before this handler runs,
// but we re-query the DB to return the freshest data and exclude the password.
exports.getAdminMe = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id).select('-password');
    res.json({ success: true, admin });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};