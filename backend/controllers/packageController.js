/**
 * controllers/packageController.js — Package CRUD Controller
 *
 * Manages curated tour packages — pre-built itineraries bundling multiple
 * tourist attractions that users can browse, book, or add to their cart.
 *
 * Exports:
 *  getPackages    GET    /api/packages          — List all active packages (public)
 *  getPackage     GET    /api/packages/:id      — Get a single package with place details
 *  createPackage  POST   /api/admin/packages    — Create a package (admin only)
 *  updatePackage  PUT    /api/admin/packages/:id — Update a package (admin only)
 *  deletePackage  DELETE /api/admin/packages/:id — Soft-delete a package (admin only)
 *
 * Soft-delete pattern:
 *  deletePackage sets isActive = false instead of removing the document.
 *  This preserves data integrity for existing Booking and Cart references.
 *
 * Population:
 *  getPackages populates places with a lightweight field set for listing cards.
 *  getPackage populates with additional fields needed for the detail page
 *  (shortDescription, lat, lng for the map preview).
 */

const Package = require('../models/Package');

// ── Get All Packages ──────────────────────────────────────────────────────────
// Returns all active (non-soft-deleted) packages with their included places.
// Places are populated with a minimal field set for rendering listing cards.
exports.getPackages = async (req, res) => {
  try {
    const packages = await Package.find({ isActive: true })
      .populate('places', 'name slug coverImage distanceFromReference');
    res.json({ success: true, packages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get Single Package ────────────────────────────────────────────────────────
// Returns a single package by ID with an expanded place field set.
// Includes lat/lng for the embedded map preview and shortDescription
// for the places list on the package detail page.
exports.getPackage = async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id)
      .populate('places', 'name slug coverImage shortDescription distanceFromReference lat lng');
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });
    res.json({ success: true, package: pkg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Create Package ────────────────────────────────────────────────────────────
// Creates a new package from the request body. All required field validation
// is handled by the Package schema. Returns 400 for validation errors.
exports.createPackage = async (req, res) => {
  try {
    const pkg = await Package.create(req.body);
    res.status(201).json({ success: true, package: pkg });
  } catch (err) {
    // 400 for validation failures (missing required fields, invalid enum values)
    res.status(400).json({ success: false, message: err.message });
  }
};

// ── Update Package ────────────────────────────────────────────────────────────
// Updates a package by ID. Uses { new: true } to return the updated document.
// Admins can update any field including places[], price, and discount.
exports.updatePackage = async (req, res) => {
  try {
    const pkg = await Package.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!pkg) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, package: pkg });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ── Delete Package (Soft) ─────────────────────────────────────────────────────
// Soft-deletes a package by setting isActive = false.
// The document is retained in the database so existing Booking and Cart
// references continue to resolve without orphaned ObjectId errors.
exports.deletePackage = async (req, res) => {
  try {
    // Set isActive = false instead of hard-deleting the document
    await Package.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Package deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
