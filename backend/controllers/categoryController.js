/**
 * controllers/categoryController.js — Category CRUD Controller
 *
 * Manages tourist attraction categories (e.g. Parks, Heritage, Wildlife).
 * Categories are used on the Explore page for filtering places and in
 * Place cards as visual labels (with icon and color).
 *
 * Exports:
 *  getCategories   GET    /api/categories          — List all active categories (public)
 *  createCategory  POST   /api/admin/categories    — Create a new category (admin only)
 *  updateCategory  PUT    /api/admin/categories/:id — Update a category (admin only)
 *  deleteCategory  DELETE /api/admin/categories/:id — Soft-delete a category (admin only)
 *
 * Soft-delete pattern:
 *  deleteCategory sets isActive = false rather than removing the document.
 *  This preserves the category reference on existing Place documents and prevents
 *  orphaned data. Inactive categories are excluded from getCategories responses.
 */

const Category = require('../models/Category');

// ── Get Categories ────────────────────────────────────────────────────────────
// Returns all active categories sorted alphabetically by name.
// Only active categories are shown to users — inactive ones are admin-hidden.
exports.getCategories = async (req, res) => {
  try {
    // Filter to isActive: true so soft-deleted categories are not exposed publicly
    const cats = await Category.find({ isActive: true }).sort('name');
    res.json({ success: true, categories: cats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Create Category ───────────────────────────────────────────────────────────
// Creates a new category from the request body.
// The Category schema requires unique `name` and `slug` fields — a 400 error
// is returned if either is already taken (Mongoose duplicate key error).
exports.createCategory = async (req, res) => {
  try {
    // Pass the entire request body to Category.create — schema validation runs automatically
    const cat = await Category.create(req.body);
    res.status(201).json({ success: true, category: cat });
  } catch (err) {
    // 400 for validation errors (duplicate name/slug, missing required fields)
    res.status(400).json({ success: false, message: err.message });
  }
};

// ── Update Category ───────────────────────────────────────────────────────────
// Updates an existing category by ID. Uses { new: true } to return the updated
// document rather than the pre-update version.
exports.updateCategory = async (req, res) => {
  try {
    const cat = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, category: cat });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ── Delete Category (Soft) ────────────────────────────────────────────────────
// Soft-deletes a category by setting isActive = false.
// The category document remains in the database so that Place references are
// not broken — it is simply hidden from the public API responses.
exports.deleteCategory = async (req, res) => {
  try {
    // Set isActive to false instead of removing the document (soft-delete)
    await Category.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Category deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
