/**
 * models/Review.js — Mongoose Model for Place Reviews
 *
 * A Review is a user-submitted rating and written opinion about a specific
 * tourist attraction (Place). Reviews are displayed on the Place detail page
 * and their ratings are aggregated into the Place's overall star rating.
 *
 * Schema fields:
 *  user        — The User who submitted the review
 *  place       — The Place being reviewed
 *  rating      — Integer star rating from 1 (worst) to 5 (best); required
 *  title       — Optional short headline for the review
 *  comment     — The main written review body; required
 *  visitDate   — Optional date the user actually visited the attraction
 *  helpful     — Count of "helpful" votes from other users (community upvote)
 *  isApproved  — Moderation flag; only approved reviews are shown publicly
 *  timestamps  — Mongoose adds createdAt and updatedAt
 *
 * Moderation:
 *  isApproved defaults to true (auto-approve). Admins can set it to false
 *  via the admin reviews management panel to hide inappropriate content.
 *
 * Rating aggregation:
 *  When a review is created or deleted, the placeController (or reviewController)
 *  recalculates the Place's `rating` and `reviewCount` fields by averaging
 *  all approved reviews for that place.
 */

const mongoose = require('mongoose');

// ── Review Schema Definition ──────────────────────────────────────────────────
const reviewSchema = new mongoose.Schema({
  // The authenticated user who wrote this review
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // The tourist attraction this review is about
  place: { type: mongoose.Schema.Types.ObjectId, ref: 'Place', required: true },

  // Star rating: 1 = terrible, 5 = excellent. Mongoose enforces the min/max.
  rating: { type: Number, required: true, min: 1, max: 5 },

  // Optional one-line summary headline (e.g. "Breathtaking views at sunset!")
  title: { type: String, default: '' },

  // The detailed written review — required to ensure every review has content
  comment: { type: String, required: true },

  // The date the reviewer actually visited — helps other users gauge recency
  visitDate: { type: Date },

  // Number of times other users have marked this review as "helpful"
  // Incremented by a dedicated API endpoint; not decrementable in this version
  helpful: { type: Number, default: 0 },

  // Moderation state: true = visible to all users, false = hidden from public API
  // Defaults to true (auto-approve); admins can flip to false in the admin panel
  isApproved: { type: Boolean, default: true },
}, { timestamps: true }); // Mongoose adds createdAt and updatedAt automatically

// Export the compiled Mongoose model used by reviewController and admin panel
module.exports = mongoose.model('Review', reviewSchema);
