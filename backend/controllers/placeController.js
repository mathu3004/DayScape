/**
 * controllers/placeController.js — Tourist Attraction CRUD & Search Controller
 *
 * Manages Place documents — the core tourist attraction entities of the platform.
 * Public endpoints support filtering, full-text search, distance sorting, and
 * featured place retrieval. Admin endpoints handle CRUD operations.
 *
 * Exports:
 *  getPlaces         GET  /api/places              — Filtered, searchable place list (public)
 *  getPlace          GET  /api/places/:slug         — Single place detail with reviews (public)
 *  getFeatured       GET  /api/places/featured      — Up to 6 featured places (public)
 *  createPlace       POST /api/admin/places         — Create a place (admin only)
 *  updatePlace       PUT  /api/admin/places/:id     — Update a place (admin only)
 *  deletePlace       DELETE /api/admin/places/:id   — Soft-delete a place (admin only)
 *  getAllPlacesAdmin  GET  /api/admin/places         — All places including inactive (admin only)
 *
 * Query parameters supported by getPlaces:
 *  category  — Filter by Category ObjectId
 *  search    — Full-text search on name, shortDescription, and tags (case-insensitive regex)
 *  sort      — 'nearest' | 'rating' | 'popularity' | 'name'
 *  lat, lng  — User coordinates for computing live distances (adds liveDistance field)
 *  entryType — 'free' | 'paid' filter
 *
 * Haversine:
 *  The local haversine() function computes straight-line distance in km between
 *  two WGS-84 coordinate pairs. When lat/lng are provided, a `liveDistance` field
 *  is added to each place object and used for the 'nearest' sort.
 */

const Place  = require('../models/Place');
const Review = require('../models/Review');

// ── Haversine Distance Calculator ─────────────────────────────────────────────
// Returns the great-circle distance in km between two coordinate pairs.
// R = 6371 km is the mean radius of the Earth.
// Used to compute liveDistance from the user's current position to each place.
// Haversine distance calculator
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Get Places ────────────────────────────────────────────────────────────────
// Returns all active places, optionally filtered and sorted based on query params.
// When user coordinates are provided, a `liveDistance` field is injected into
// each place object so the 'nearest' sort can use real-time positioning.
exports.getPlaces = async (req, res) => {
  try {
    const { category, search, sort, lat, lng, entryType } = req.query;

    // Base query: only return places that have not been soft-deleted
    let query = { isActive: true };

    // Optional category filter — expects a Category ObjectId string
    if (category) query.category = category;

    // Optional entry-type filter — 'free' or 'paid'
    if (entryType) query.entryType = entryType;

    // Full-text search across name, shortDescription, and tags (case-insensitive)
    if (search) query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { shortDescription: { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } },
    ];

    // Fetch places and populate the category reference for badge rendering
    let places = await Place.find(query).populate('category', 'name slug icon color');

    // Compute live distance if coords provided
    // Convert Mongoose docs to plain objects so we can add a computed field
    if (lat && lng) {
      places = places.map(p => {
        const obj = p.toObject();
        // Compute distance from the user's location to this place and round to 2dp
        obj.liveDistance = parseFloat(haversine(parseFloat(lat), parseFloat(lng), p.lat, p.lng).toFixed(2));
        return obj;
      });
    }

    // Apply the requested sort order in memory (after distance computation)
    if (sort === 'nearest')    places.sort((a, b) => (a.liveDistance || a.distanceFromReference) - (b.liveDistance || b.distanceFromReference));
    else if (sort === 'rating')     places.sort((a, b) => b.rating - a.rating);
    else if (sort === 'popularity') places.sort((a, b) => b.popularityScore - a.popularityScore);
    else if (sort === 'name')       places.sort((a, b) => a.name.localeCompare(b.name));

    res.json({ success: true, count: places.length, places });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get Single Place ──────────────────────────────────────────────────────────
// Returns a single active place by its URL slug, along with the 10 most recent
// approved reviews. If the user's coordinates are provided as query params,
// a liveDistance field is also returned for the distance badge on the detail page.
exports.getPlace = async (req, res) => {
  try {
    // Look up by slug (URL-friendly identifier) rather than _id for SEO-friendly URLs
    const place = await Place.findOne({ slug: req.params.slug, isActive: true })
      .populate('category', 'name slug icon color');
    if (!place) return res.status(404).json({ success: false, message: 'Place not found' });

    // Optionally compute distance from the user's current position
    const { lat, lng } = req.query;
    const obj = place.toObject();
    if (lat && lng) {
      obj.liveDistance = parseFloat(haversine(parseFloat(lat), parseFloat(lng), place.lat, place.lng).toFixed(2));
    }

    // Fetch the 10 most recent approved reviews for the review section
    const reviews = await Review.find({ place: place._id, isApproved: true })
      .populate('user', 'name').sort('-createdAt').limit(10);

    res.json({ success: true, place: obj, reviews });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get Featured Places ───────────────────────────────────────────────────────
// Returns up to 6 places that are marked as featured and active.
// Used by the home page "Featured Attractions" section for curated highlights.
exports.getFeatured = async (req, res) => {
  try {
    const places = await Place.find({ isFeatured: true, isActive: true })
      .populate('category', 'name slug icon color').limit(6);
    res.json({ success: true, places });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin CRUD ────────────────────────────────────────────────────────────────

// Create Place — slug is auto-generated by the Place model's pre-save hook
// Admin CRUD
exports.createPlace = async (req, res) => {
  try {
    const place = await Place.create(req.body);
    res.status(201).json({ success: true, place });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Update Place — runValidators: true ensures schema constraints are re-checked
exports.updatePlace = async (req, res) => {
  try {
    const place = await Place.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!place) return res.status(404).json({ success: false, message: 'Place not found' });
    res.json({ success: true, place });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Soft-delete Place — sets isActive = false to hide from public API without losing data
exports.deletePlace = async (req, res) => {
  try {
    await Place.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Place deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get All Places (Admin) — returns ALL places (including inactive) for the admin table
exports.getAllPlacesAdmin = async (req, res) => {
  try {
    const places = await Place.find().populate('category', 'name').sort('-createdAt');
    res.json({ success: true, places });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
