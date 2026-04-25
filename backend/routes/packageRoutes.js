/**
 * routes/packageRoutes.js — Curated Tour Package Routes
 *
 * Mounted at: /api/packages (see server.js)
 *
 * Public routes (no token required):
 *  GET /api/packages      — List all active packages (with places populated)
 *  GET /api/packages/:id  — Get a single package with full place details
 *
 * Admin-only routes (admin Bearer token required):
 *  POST   /api/packages       — Create a new package
 *  PUT    /api/packages/:id   — Update an existing package
 *  DELETE /api/packages/:id   — Soft-delete a package (sets isActive = false)
 */

const express = require('express');
const r = express.Router();

// Import all package handler functions from packageController
const c = require('../controllers/packageController');

// `adminProtect` guards create/update/delete operations
const { adminProtect } = require('../middleware/auth');

// ── Public Routes ─────────────────────────────────────────────────────────────
r.get('/',     c.getPackages);  // Packages listing page — returns all active packages
r.get('/:id',  c.getPackage);   // Package detail page — includes nested place data

// ── Admin CRUD ────────────────────────────────────────────────────────────────
r.post('/',    adminProtect, c.createPackage);   // Create a new curated package
r.put('/:id',  adminProtect, c.updatePackage);   // Update package fields, places, pricing
r.delete('/:id', adminProtect, c.deletePackage); // Soft-delete (isActive = false)

module.exports = r;
