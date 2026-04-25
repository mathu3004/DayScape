/**
 * routes/paymentRoutes.js — Payment Routes
 *
 * Mounted at: /api/payments (see server.js)
 *
 * User routes (Bearer token required via `protect`):
 *  POST /api/payments/process  — Process card payment for a booking
 *                                Body: { bookingId, cardNumber, cardHolder, expiry, cvv }
 *                                On success: booking.isPaid = true, plan.status = 'active'
 *
 *  GET  /api/payments/my       — List all payments made by the current user
 *
 * Admin routes (admin Bearer token required via `adminProtect`):
 *  GET  /api/payments/admin/all — List all payments platform-wide (revenue management)
 *
 * Handler functions are imported from bookingController (not a separate paymentController)
 * because payment processing is tightly coupled with booking state updates.
 */

const express = require('express');
const r = express.Router();

// Payment handlers are defined in bookingController alongside booking logic
const c = require('../controllers/bookingController');

// Both user and admin protect middlewares are needed
const { protect, adminProtect } = require('../middleware/auth');

// ── User Routes ───────────────────────────────────────────────────────────────
r.post('/process',   protect,       c.processPayment);      // Simulate card payment + mark booking paid
r.get('/my',         protect,       c.getMyPayments);       // User's payment history

// ── Admin Routes ──────────────────────────────────────────────────────────────
r.get('/admin/all',  adminProtect,  c.getAllPaymentsAdmin);  // All transactions for revenue dashboard

module.exports = r;
