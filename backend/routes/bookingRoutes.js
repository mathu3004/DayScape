/**
 * routes/bookingRoutes.js — Booking Routes
 *
 * Mounted at: /api/bookings (see server.js)
 *
 * User routes (Bearer token required via `protect`):
 *  POST /api/bookings          — Create a booking (package, plan, or cart checkout)
 *  GET  /api/bookings/my       — List all bookings belonging to the current user
 *  GET  /api/bookings/:id      — Get a single booking with full nested detail
 *
 * Admin routes (admin Bearer token required via `adminProtect`):
 *  GET  /api/bookings/admin/all — List all bookings across all users
 *
 * Route ordering note:
 *  /my and /admin/all must be registered BEFORE /:id to prevent Express
 *  from matching the literal strings "my" or "admin" as an id param.
 */

const express = require('express');
const r = express.Router();

// All booking handler functions live in bookingController
const c = require('../controllers/bookingController');

// Both user and admin protect middlewares are needed in this file
const { protect, adminProtect } = require('../middleware/auth');

// ── User Routes ───────────────────────────────────────────────────────────────
r.post('/',           protect,       c.createBooking);      // Create package/plan/cart booking
r.get('/my',          protect,       c.getMyBookings);      // User's booking history list

// ── Admin Routes ──────────────────────────────────────────────────────────────
// Registered before /:id to prevent "admin" being parsed as a booking ObjectId
r.get('/admin/all',   adminProtect,  c.getAllBookingsAdmin); // All bookings for admin table

// ── Dynamic ID Route ──────────────────────────────────────────────────────────
// Must come after all literal sub-paths
r.get('/:id',         protect,       c.getOneBooking);      // Booking detail with deep population

module.exports = r;
