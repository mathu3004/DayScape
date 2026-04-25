/**
 * routes/favoriteRoutes.js — Favourites Routes
 *
 * Mounted at: /api/favorites (see server.js)
 *
 * All routes require an authenticated user (Bearer token via `protect`).
 *
 *  POST /api/favorites/toggle          — Add or remove a place from favourites
 *  GET  /api/favorites/my              — List all saved/favourite places for the current user
 *  GET  /api/favorites/check/:placeId  — Check if a specific place is saved by the current user
 *
 * The toggle endpoint replaces separate add/remove endpoints — it checks for an
 * existing Favorite document and either deletes it (un-save) or creates one (save).
 */

const express = require('express');
const r = express.Router();

// Import all favourite handler functions from favoriteController
const c = require('../controllers/favoriteController');

// All favourite operations require a valid user JWT
const { protect } = require('../middleware/auth');

// ── Favourites Routes ─────────────────────────────────────────────────────────
r.post('/toggle',           protect, c.toggleFavorite);  // Add if not saved; remove if already saved
r.get('/my',                protect, c.getMyFavorites);  // Return all saved places for the user
r.get('/check/:placeId',    protect, c.checkFavorite);   // Returns { favorited: true/false }

module.exports = r;
