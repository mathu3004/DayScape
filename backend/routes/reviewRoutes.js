/**
 * routes/reviewRoutes.js — Review Routes
 *
 * Mounted at: /api/reviews (see server.js)
 *
 * Public routes (no token required):
 *  GET /api/reviews/place/:placeId  — Get all approved reviews for a place
 *
 * User routes (Bearer token required via `protect`):
 *  POST   /api/reviews         — Submit a new review for a place
 *  DELETE /api/reviews/:id     — Delete the current user's own review
 *
 * Admin routes (admin Bearer token required via `adminProtect`):
 *  GET /api/reviews/admin/all          — List all reviews for moderation
 *  PUT /api/reviews/admin/:id/toggle   — Flip a review's isApproved flag
 *
 * Route ordering note:
 *  /place/:placeId and /admin/* must be registered before /:id to prevent
 *  Express from matching "place" or "admin" as a review ObjectId param.
 */

const express = require('express');
const r = express.Router();

// Import all review handler functions from reviewController
const c = require('../controllers/reviewController');

// Both user and admin protect middlewares are needed
const { protect, adminProtect } = require('../middleware/auth');

// ── Public Routes ─────────────────────────────────────────────────────────────
r.get('/place/:placeId', c.getReviewsByPlace);     // Reviews shown on place detail page

// ── User Routes ───────────────────────────────────────────────────────────────
r.post('/',      protect, c.createReview);         // Submit a new review (one per place)

// ── Admin Routes ──────────────────────────────────────────────────────────────
// Registered before /:id to prevent "admin" being parsed as a review ObjectId
r.get('/admin/all',          adminProtect, c.getAllReviewsAdmin); // Admin moderation list
r.put('/admin/:id/toggle',   adminProtect, c.toggleApprove);     // Hide/show a review

// ── Dynamic ID Route ──────────────────────────────────────────────────────────
r.delete('/:id', protect, c.deleteReview);         // Review owner deletes their own review

module.exports = r;
