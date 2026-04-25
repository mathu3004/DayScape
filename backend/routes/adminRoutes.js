/**
 * routes/adminRoutes.js — Admin Dashboard & User Management Routes
 *
 * Mounted at: /api/admin (see server.js)
 *
 * All routes are protected by `adminProtect` — a valid admin JWT is required.
 *
 *  GET /api/admin/dashboard          — Aggregated platform stats + charts data
 *  GET /api/admin/users              — List all registered users (with pagination future-ready)
 *  PUT /api/admin/users/:id/toggle   — Suspend or reinstate a user account
 */

const express = require('express');
const r = express.Router(); // Using short alias `r` for consistency with other route files

// Import all handler functions from adminController
const c = require('../controllers/adminController');

// All routes in this file require an authenticated admin session
const { adminProtect } = require('../middleware/auth');

// ── Admin Dashboard ───────────────────────────────────────────────────────────
// Returns aggregated counts, revenue totals, recent activity, and monthly chart data
r.get('/dashboard', adminProtect, c.getDashboardStats);

// ── User Management ───────────────────────────────────────────────────────────
r.get('/users',              adminProtect, c.getUsers);           // List all users (no passwords)
r.put('/users/:id/toggle',   adminProtect, c.toggleUserStatus);   // Activate / suspend account

module.exports = r;
