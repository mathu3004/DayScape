/**
 * routes/categoryRoutes.js — Category Routes
 *
 * Mounted at: /api/categories (see server.js)
 *
 * Public routes (no token required):
 *  GET /api/categories      — List all active categories (for Explore page filters)
 *
 * Admin-only routes (admin Bearer token required):
 *  POST   /api/categories       — Create a new category
 *  PUT    /api/categories/:id   — Update a category's name, slug, icon, color, etc.
 *  DELETE /api/categories/:id   — Soft-delete a category (sets isActive = false)
 */

// categoryRoutes.js
const express = require('express');
const r = express.Router();

// Import all category handler functions from categoryController
const c = require('../controllers/categoryController');

// `adminProtect` guards create/update/delete operations
const { adminProtect } = require('../middleware/auth');

// ── Public Routes ─────────────────────────────────────────────────────────────
r.get('/', c.getCategories);  // Returns active categories sorted alphabetically

// ── Admin CRUD ────────────────────────────────────────────────────────────────
r.post('/',    adminProtect, c.createCategory);   // Create a new category
r.put('/:id',  adminProtect, c.updateCategory);   // Update category fields
r.delete('/:id', adminProtect, c.deleteCategory); // Soft-delete (isActive = false)

module.exports = r;
