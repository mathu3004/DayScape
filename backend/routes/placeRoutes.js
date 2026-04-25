/**
 * routes/placeRoutes.js — Tourist Place Routes
 *
 * Mounted at: /api/places (see server.js)
 *
 * Public routes (no token required):
 *  GET /api/places             — Browse all active places (supports filter/search/sort query params)
 *  GET /api/places/featured    — Get up to 6 featured places for the home page
 *  GET /api/places/:slug       — Get a single place by its URL slug (with reviews)
 *
 * Admin-only routes (admin Bearer token required):
 *  GET    /api/places/admin/all — List ALL places including inactive (admin table)
 *  POST   /api/places           — Create a new tourist place
 *  PUT    /api/places/:id       — Update an existing place
 *  DELETE /api/places/:id       — Soft-delete a place (sets isActive = false)
 *
 * Route ordering note:
 *  /featured and /admin/all must be registered BEFORE /:slug to prevent Express
 *  from matching the literal string "featured" or "admin" as a slug param.
 */

const express = require('express');
const router  = express.Router();

// Import all place handler functions from placeController
const { getPlaces, getPlace, getFeatured, createPlace, updatePlace, deletePlace, getAllPlacesAdmin } = require('../controllers/placeController');

// `adminProtect` guards admin-only CRUD operations
const { adminProtect } = require('../middleware/auth');

// ── Public Routes ─────────────────────────────────────────────────────────────
router.get('/',             getPlaces);    // Browse with optional ?category, ?search, ?sort, ?lat, ?lng
router.get('/featured',     getFeatured);  // Home page featured section (max 6)

// ── Admin Routes ──────────────────────────────────────────────────────────────
// Registered before /:slug to avoid Express treating "admin" as a slug value
router.get('/admin/all',    adminProtect, getAllPlacesAdmin); // All places including inactive

// ── Dynamic Slug Route ────────────────────────────────────────────────────────
// Must come after /featured and /admin/all to avoid those paths being caught here
router.get('/:slug',        getPlace);    // Place detail page (includes last 10 reviews)

// ── Admin CRUD ────────────────────────────────────────────────────────────────
router.post('/',            adminProtect, createPlace);   // Create — slug auto-generated
router.put('/:id',          adminProtect, updatePlace);   // Update any field
router.delete('/:id',       adminProtect, deletePlace);   // Soft-delete (isActive = false)

module.exports = router;
