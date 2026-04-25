/**
 * models/Category.js — Mongoose Model for Place Categories
 *
 * Categories are used to classify tourist attractions (e.g. Parks, Heritage,
 * Wildlife) so users can filter the explore page and the admin can organise
 * places by type.
 *
 * Schema fields:
 *  name        — Human-readable category name (unique, e.g. "Parks & Recreation")
 *  slug        — URL-safe identifier (unique, e.g. "park-recreational")
 *                Used in frontend route params and API queries.
 *  icon        — An emoji used as a visual icon in the UI (defaults to 📍)
 *  description — Optional longer description of the category
 *  color       — Hex colour used for badges and category highlights in the UI
 *  isActive    — Soft-delete flag; deactivated categories are hidden from users
 *  timestamps  — Mongoose adds createdAt and updatedAt
 *
 * Note: soft deletion (isActive = false) is used instead of hard deletion
 * to preserve data integrity for existing Place references.
 */

const mongoose = require('mongoose');

// ── Category Schema Definition ────────────────────────────────────────────────
const categorySchema = new mongoose.Schema({
  // Display name shown to users in filters and badges
  name: { type: String, required: true, unique: true },

  // URL slug used as a query parameter and in category filter links
  slug: { type: String, required: true, unique: true },

  // Emoji icon displayed alongside the category name in the UI
  icon: { type: String, default: '📍' },

  // Optional category description visible on admin management pages
  description: { type: String, default: '' },

  // Accent colour for category badges (stored as a hex string e.g. #c9a84c)
  color: { type: String, default: '#c9a84c' },

  // Inactive categories are excluded from public API responses
  isActive: { type: Boolean, default: true },
}, { timestamps: true }); // Adds createdAt and updatedAt automatically

module.exports = mongoose.model('Category', categorySchema);
