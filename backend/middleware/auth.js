/**
 * middleware/auth.js — JWT Authentication Middleware
 *
 * Provides two Express middleware functions used to protect routes:
 *
 *  protect       — validates a regular user's JWT token and attaches the
 *                  User document to req.user for downstream handlers.
 *
 *  adminProtect  — validates an admin's JWT token and attaches the
 *                  Admin document to req.admin for downstream handlers.
 *
 * Both middlewares expect the token in the Authorization header using the
 * Bearer scheme:  Authorization: Bearer <token>
 *
 * On failure (missing token, invalid token, user not found) a 401 JSON
 * response is returned and the request is terminated early.
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');

/**
 * protect
 * Middleware that authenticates regular (end-user) requests.
 *
 * Flow:
 *  1. Extract the Bearer token from the Authorization header.
 *  2. Return 401 if no token is present.
 *  3. Verify the token signature against JWT_SECRET.
 *  4. Load the user from the database (excluding the password field).
 *  5. Attach the user to req.user and call next() on success.
 */
exports.protect = async (req, res, next) => {
  let token;

  // Check if the Authorization header exists and starts with "Bearer"
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    // Extract the token part (everything after "Bearer ")
    token = req.headers.authorization.split(' ')[1];
  }

  // Reject requests that carry no token
  if (!token) return res.status(401).json({ success: false, message: 'Not authorized' });

  try {
    // Verify the token and decode the payload (contains { id })
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch the user record, omitting the hashed password from the result
    req.user = await User.findById(decoded.id).select('-password');

    // If the user was deleted or doesn't exist, reject the request
    if (!req.user) return res.status(401).json({ success: false, message: 'User not found' });

    // Proceed to the next middleware / route handler
    next();
  } catch (err) {
    // jwt.verify throws if the token is expired or tampered with
    return res.status(401).json({ success: false, message: 'Token invalid' });
  }
};

/**
 * adminProtect
 * Middleware that authenticates admin requests.
 *
 * Identical flow to `protect` but resolves against the Admin collection
 * and attaches the admin document to req.admin instead of req.user.
 */
exports.adminProtect = async (req, res, next) => {
  let token;

  // Extract Bearer token from Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Reject if no token is provided
  if (!token) return res.status(401).json({ success: false, message: 'Not authorized' });

  try {
    // Decode and verify the JWT payload
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Look up the admin, hiding the password field
    req.admin = await Admin.findById(decoded.id).select('-password');

    // Reject if the admin record no longer exists
    if (!req.admin) return res.status(401).json({ success: false, message: 'Admin not found' });

    // Pass control to the next handler
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token invalid' });
  }
};
