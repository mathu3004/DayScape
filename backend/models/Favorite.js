/**
 * models/Favorite.js — Mongoose Model for User Favourite Places
 *
 * Each document represents a single user ↔ place "save" relationship.
 * The combination of user + place is indexed as unique to prevent
 * the same place being saved twice by the same user.
 *
 * Schema fields:
 *  user       — The User who saved the place
 *  place      — The Place that was saved
 *  timestamps — createdAt records when the favourite was added
 *
 * The compound unique index on { user, place } allows:
 *  - O(1) lookup when checking if a place is already favourited
 *  - Automatic prevention of duplicate saves at the database level
 *
 * The favoriteController uses this model for toggle (add/remove),
 * list, and check operations.
 */

const mongoose = require('mongoose');

// ── Favorite Schema Definition ────────────────────────────────────────────────
const favoriteSchema = new mongoose.Schema({
  // The user who added this place to their favourites
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // The tourist attraction/place that was saved
  place: { type: mongoose.Schema.Types.ObjectId, ref: 'Place', required: true },
}, { timestamps: true }); // createdAt used to sort favourites by recently added

// ── Compound Unique Index ─────────────────────────────────────────────────────
// Ensures a user cannot favourite the same place more than once.
// The index also makes "check favourite" queries very fast (index scan vs collection scan).
favoriteSchema.index({ user: 1, place: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
