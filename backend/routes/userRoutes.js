/**
 * routes/userRoutes.js — User Profile Routes (Lightweight)
 *
 * Mounted at: /api/users (see server.js)
 *
 * This router contains a single convenience endpoint that returns the
 * currently authenticated user's profile directly from the JWT-populated
 * req.user object (without a database re-query).
 *
 * For full profile management (update, change password), use authRoutes:
 *  PUT /api/auth/profile  — Update name, phone, nationality
 *  PUT /api/auth/password — Change password
 *  GET /api/auth/me       — Full profile with DB re-query
 *
 * Protected routes (Bearer token required via `protect`):
 *  GET /api/users/me — Return the req.user object set by the protect middleware
 */

// userRoutes.js
const express = require('express');
const r = express.Router();

// `protect` validates the Bearer JWT and attaches the user document to req.user
const { protect } = require('../middleware/auth');

// ── User Routes ───────────────────────────────────────────────────────────────
// Returns the user document already loaded by the `protect` middleware.
// This is a lightweight alternative to GET /api/auth/me — no extra DB query.
r.get('/me', protect, (req, res) => res.json({ success: true, user: req.user }));

module.exports = r;
