/**
 * routes/adminAuthRoutes.js — Admin Authentication Routes
 *
 * Mounted at: /api/admin/auth (see server.js)
 *
 * Public routes (no token required):
 *  POST /api/admin/auth/login — Authenticate admin with email + password, receive JWT
 *
 * Protected routes (admin Bearer token required via `adminProtect` middleware):
 *  GET  /api/admin/auth/me    — Get the current admin's profile
 *
 * Admin accounts are separate from regular user accounts (different collection).
 * There is no registration endpoint — admins are created via the seed script.
 */

const express = require('express');
const router  = express.Router();

// Import admin auth handler functions from adminAuthController
const { adminLogin, getAdminMe } = require('../controllers/adminAuthController');

// Import the `adminProtect` middleware that validates the admin's Bearer JWT
const { adminProtect } = require('../middleware/auth');

// ── Public Routes ─────────────────────────────────────────────────────────────
router.post('/login', adminLogin);             // Verify admin credentials + return JWT

// ── Protected Routes ──────────────────────────────────────────────────────────
router.get('/me', adminProtect, getAdminMe);   // Return the current admin's profile

module.exports = router;
