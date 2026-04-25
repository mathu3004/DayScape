/**
 * controllers/reviewController.js — Review Management Controller
 *
 * Handles the creation, retrieval, moderation, and deletion of place reviews.
 * Reviews are user-submitted star ratings and written opinions about specific
 * tourist attractions. After each write operation that changes review counts,
 * the parent Place document's `rating` and `reviewCount` fields are updated.
 *
 * Exports:
 *  createReview      POST   /api/reviews              — Submit a review (authenticated users)
 *  getReviewsByPlace GET    /api/reviews/:placeId      — Get approved reviews for a place
 *  deleteReview      DELETE /api/reviews/:id           — Delete a review (owner only)
 *  getAllReviewsAdmin GET    /api/admin/reviews         — All reviews for admin moderation
 *  toggleApprove     PUT    /api/admin/reviews/:id/approve — Flip isApproved (admin only)
 *
 * One-review-per-user rule:
 *  createReview checks for an existing Review with the same user + place combination.
 *  A user can only submit one review per place — submitting again returns a 400 error.
 *
 * Rating aggregation:
 *  After a new review is created, all approved reviews for the place are fetched
 *  and their average is computed. The Place document's `rating` (rounded to 1dp)
 *  and `reviewCount` are then updated atomically. The `popularityScore` is also
 *  incremented by 1 to reflect increased engagement with the attraction.
 */

const Review = require('../models/Review');
const Place  = require('../models/Place');

// ── Create Review ─────────────────────────────────────────────────────────────
// Validates that the user hasn't already reviewed this place, creates the review,
// then re-aggregates the place's rating and increments its popularity score.
exports.createReview = async (req, res) => {
  try {
    const { placeId, rating, comment, title, visitDate } = req.body;

    // One review per user per place — check for a duplicate before creating
    const existing = await Review.findOne({ user: req.user._id, place: placeId });
    if (existing) return res.status(400).json({ success: false, message: 'You already reviewed this place' });

    // Create the review document (isApproved defaults to true — auto-approve)
    const review = await Review.create({
      user: req.user._id, place: placeId, rating, comment, title, visitDate,
    });

    // Update place rating
    // Fetch all currently approved reviews to recalculate the average
    const reviews = await Review.find({ place: placeId, isApproved: true });
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;

    // Update the place's aggregated rating (1dp), review count, and popularity score
    await Place.findByIdAndUpdate(placeId, {
      rating:     Math.round(avg * 10) / 10, // Round to 1 decimal place (e.g. 4.3)
      reviewCount: reviews.length,
      $inc: { popularityScore: 1 },           // Each new review boosts popularity by 1
    });

    // Populate the user's name so the response matches the review card format
    await review.populate('user', 'name');
    res.status(201).json({ success: true, review });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get Reviews by Place ──────────────────────────────────────────────────────
// Returns all approved reviews for a specific place, sorted newest-first.
// Used by PlaceDetailPage to render the reviews section below the description.
exports.getReviewsByPlace = async (req, res) => {
  try {
    const reviews = await Review.find({ place: req.params.placeId, isApproved: true })
      .populate('user', 'name').sort('-createdAt');
    res.json({ success: true, reviews });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Delete Review ─────────────────────────────────────────────────────────────
// Allows the review author to hard-delete their own review.
// Enforces ownership — users cannot delete reviews written by others.
exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    // Ownership check — only the review author can delete it
    if (review.user.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Not authorized' });

    await review.deleteOne();
    res.json({ success: true, message: 'Review deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get All Reviews (Admin) ───────────────────────────────────────────────────
// Returns every review in the database for the admin moderation panel.
// Populates user info (name/email) and place name for the admin table.
exports.getAllReviewsAdmin = async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate('user', 'name email')
      .populate('place', 'name')
      .sort('-createdAt');
    res.json({ success: true, reviews });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Toggle Approve (Admin) ────────────────────────────────────────────────────
// Flips the isApproved flag on a review.
//  true  → false : Hides the review from public place pages
//  false → true  : Re-approves a previously hidden review
// Admins use this to moderate inappropriate or spam content.
exports.toggleApprove = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Not found' });

    // Toggle: approved becomes hidden; hidden becomes approved
    review.isApproved = !review.isApproved;
    await review.save();

    res.json({ success: true, review });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
