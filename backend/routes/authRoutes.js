/**
 * routes/authRoutes.js — User Authentication Routes
 *
 * Mounted at: /api/auth (see server.js)
 *
 * Public routes (no token required):
 *  POST /api/auth/register — Create a new user account and receive a JWT
 *  POST /api/auth/login    — Authenticate with email + password, receive a JWT
 *
 * Protected routes (Bearer token required via `protect` middleware):
 *  GET  /api/auth/me       — Get the current user's profile
 *  PUT  /api/auth/profile  — Update name, phone, nationality
 *  PUT  /api/auth/password — Change password (requires currentPassword + newPassword)
 */

// routes/authRoutes.js
const express = require('express');
const router  = express.Router();

// Import the five auth handler functions from authController
const { register, login, getMe, updateProfile, changePassword } = require('../controllers/authController');

// Import the `protect` middleware that validates the Bearer JWT for user routes
const { protect } = require('../middleware/auth');

// ── Public Routes ─────────────────────────────────────────────────────────────
router.post('/register', register);       // Create account + return JWT
router.post('/login',    login);          // Verify credentials + return JWT

// ── Protected Routes ──────────────────────────────────────────────────────────
router.get('/me',       protect, getMe);           // Return current user's profile
router.put('/profile',  protect, updateProfile);   // Update display name / phone / nationality
router.put('/password', protect, changePassword);  // Change password (verifies old password first)

module.exports = router;
