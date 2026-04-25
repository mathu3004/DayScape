/**
 * routes/planRoutes.js — VisitPlan (Custom Day-Trip) Routes
 *
 * Mounted at: /api/plans (see server.js)
 *
 * User routes (Bearer token required via `protect`):
 *  POST   /api/plans       — Create a new day-trip plan
 *  GET    /api/plans/my    — List all plans belonging to the current user
 *  GET    /api/plans/:id   — Get a single plan (owner only)
 *  PUT    /api/plans/:id   — Update a plan's name, places, or other fields (owner only)
 *  DELETE /api/plans/:id   — Hard-delete a plan (owner only)
 *
 * Admin routes (admin Bearer token required via `adminProtect`):
 *  GET /api/plans/admin/all — List all plans across all users
 *
 * Route ordering note:
 *  /my and /admin/all must be registered BEFORE /:id to prevent Express
 *  from matching the literal strings "my" or "admin" as a MongoDB ObjectId param.
 */

const express = require('express');
const r = express.Router();

// Import all plan handler functions from planController
const c = require('../controllers/planController');

// Both user and admin protect middlewares are used in this file
const { protect, adminProtect } = require('../middleware/auth');

// ── User Routes ───────────────────────────────────────────────────────────────
r.post('/',        protect,       c.createPlan);    // Create a new itinerary (status: 'draft')
r.get('/my',       protect,       c.getMyPlans);    // List the user's own plans

// ── Admin Routes ──────────────────────────────────────────────────────────────
// Registered before /:id to avoid "admin" being parsed as a plan ObjectId
r.get('/admin/all', adminProtect, c.getAllPlansAdmin); // All plans platform-wide

// ── Dynamic ID Routes ─────────────────────────────────────────────────────────
r.get('/:id',      protect,       c.getPlan);       // Plan detail (owner-only)
r.put('/:id',      protect,       c.updatePlan);    // Edit plan fields (owner-only)
r.delete('/:id',   protect,       c.deletePlan);    // Hard-delete plan (owner-only)

module.exports = r;
