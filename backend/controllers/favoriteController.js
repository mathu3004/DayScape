/**
 * controllers/favoriteController.js — Favourites Controller
 *
 * Manages the user's saved/favourite places using the Favorite model.
 * Each Favorite document represents a single user ↔ place "save" relationship.
 *
 * Exports:
 *  toggleFavorite  POST /api/favorites/toggle        — Add or remove a favourite
 *  getMyFavorites  GET  /api/favorites/my            — List all the user's saved places
 *  checkFavorite   GET  /api/favorites/check/:placeId — Check if a place is saved
 *
 * Toggle pattern:
 *  toggleFavorite checks for an existing Favorite document. If found, it deletes
 *  it (un-favourite); if not found, it creates one (favourite). This avoids
 *  separate add/remove endpoints and keeps the client logic simple.
 *
 * The Favorite model has a compound unique index on { user, place } so a user
 * can never accidentally save the same place twice, even under concurrent requests.
 */

const Favorite = require('../models/Favorite');

// ── Toggle Favourite ──────────────────────────────────────────────────────────
// Adds the place to favourites if it is not already saved, or removes it if it is.
// Returns a `favorited` boolean so the frontend heart icon can update immediately.
exports.toggleFavorite = async (req, res) => {
  try {
    const { placeId } = req.body;

    // Check whether this user has already saved this place
    const exists = await Favorite.findOne({ user: req.user._id, place: placeId });

    if (exists) {
      // Already favourited — remove it (un-favourite / un-save)
      await exists.deleteOne();
      return res.json({ success: true, favorited: false, message: 'Removed from favorites' });
    }

    // Not yet saved — create the Favorite document (add to favourites)
    await Favorite.create({ user: req.user._id, place: placeId });
    res.json({ success: true, favorited: true, message: 'Added to favorites' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get My Favourites ─────────────────────────────────────────────────────────
// Returns all places the current user has saved, sorted by most recently added.
// Deep-populates place → category so the favourite card can display the
// category badge (name + icon) without an additional request.
exports.getMyFavorites = async (req, res) => {
  try {
    const favs = await Favorite.find({ user: req.user._id })
      .populate({ path: 'place', populate: { path: 'category', select: 'name icon' } })
      .sort('-createdAt'); // Most recently added first
    res.json({ success: true, favorites: favs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Check Favourite ───────────────────────────────────────────────────────────
// Returns whether the current user has saved a specific place.
// Used by PlaceDetailPage to set the initial state of the heart/save button.
// The compound index on { user, place } makes this an O(1) index lookup.
exports.checkFavorite = async (req, res) => {
  try {
    const fav = await Favorite.findOne({ user: req.user._id, place: req.params.placeId });

    // !! converts the document (truthy) or null (falsy) to a boolean
    res.json({ success: true, favorited: !!fav });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
