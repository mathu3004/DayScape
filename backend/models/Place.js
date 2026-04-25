/**
 * models/Place.js — Mongoose Model for Tourist Attractions / Places
 *
 * A Place represents a single tourist destination, attraction, or point of
 * interest in Sri Lanka. It is the central entity of the DayScape platform —
 * users explore places, add them to VisitPlans, save them as favourites, and
 * write reviews about them.
 *
 * Schema sections:
 *  Identity        — name, slug (auto-generated), category ref
 *  Description     — shortDescription, fullDescription, address
 *  Coordinates     — lat, lng (used by the live map and Haversine distance calc)
 *  Distances       — distanceFromReference (38 Rajasinghe Rd), distanceFromAirport
 *  Timing          — openingTime, closingTime, closedDays, bestTimeOfDay, bestSeason, estimatedDuration
 *  Visitor info    — preparationTips[], dressCode, safetyTips[], travelNotes
 *  Tickets         — entryType (free|paid), tickets sub-object with 4 price tiers
 *  Media           — coverImage URL, gallery[] of image URLs
 *  Facilities      — parkingAvailable, nearbyFacilities[], contactInfo, website
 *  Stats           — rating, reviewCount, popularityScore
 *  Metadata        — tags[], isActive (soft-delete), isFeatured, timestamps
 *
 * Ticket price tiers (under the `tickets` sub-object):
 *  localAdult     — Local adult ticket price in LKR
 *  localChild     — Local child ticket price in LKR
 *  foreignerAdult — Foreign tourist adult price in LKR
 *  foreignerChild — Foreign tourist child price in LKR
 *  (Which tier to display is determined by user.nationality in the frontend)
 *
 * Pre-save middleware:
 *  Auto-generates a URL-safe slug from the place name on first save.
 *  Example: "Galle Fort" → "galle-fort"
 *
 * Reference location (used for distanceFromReference):
 *  38 Rajasinghe Road, Dehiwala — lat: 6.868671, lng: 79.860689
 */

const mongoose = require('mongoose');

// ── Place Schema Definition ───────────────────────────────────────────────────
const placeSchema = new mongoose.Schema({
  // Official name of the tourist attraction displayed throughout the app
  name: { type: String, required: true },

  // URL-safe identifier auto-generated from name on first save (e.g. "galle-fort")
  // Used in frontend route params: /places/:slug
  slug: { type: String, unique: true },

  // Reference to the Category document this place belongs to
  // Used for filtering on the Explore page (e.g. Parks, Heritage, Wildlife)
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },

  // One-sentence teaser shown on listing cards and search results
  shortDescription: { type: String, required: true },

  // Full multi-paragraph description rendered on the place detail page
  fullDescription: { type: String, required: true },

  // Human-readable address shown below the map on the detail page
  address: { type: String, required: true },

  // WGS-84 decimal latitude — used by Leaflet map and Haversine distance calculation
  lat: { type: Number, required: true },

  // WGS-84 decimal longitude — used by Leaflet map and Haversine distance calculation
  lng: { type: Number, required: true },

  // ── Distances ──────────────────────────────────────────────────────────────
  // Straight-line distance in km from 38 Rajasinghe Road, Dehiwala
  // (lat: 6.868671, lng: 79.860689) — calculated via Haversine formula and stored
  distanceFromReference: { type: Number }, // km from 38 Rajasinghe Road

  // Straight-line distance in km from Bandaranaike International Airport (BIA)
  distanceFromAirport: { type: Number },   // km from BIA

  // ── Timing ─────────────────────────────────────────────────────────────────
  // Opening and closing times in HH:MM 24-hour format
  openingTime: { type: String, default: '08:00' },
  closingTime:  { type: String, default: '17:00' },

  // Days of the week the attraction is closed (e.g. ['Monday', 'Tuesday'])
  closedDays: [{ type: String }],

  // Best part of the day to visit — guides itinerary planning (e.g. 'Morning', 'Sunset')
  bestTimeOfDay: { type: String, default: 'Morning' },

  // Best season / months for visiting (e.g. 'November to April')
  bestSeason: { type: String, default: 'November to April' },

  // Typical visit length used in VisitPlan duration estimates (e.g. '1-2 hours')
  estimatedDuration: { type: String, default: '1-2 hours' },

  // ── Visitor Information ─────────────────────────────────────────────────────
  // Practical tips shown before visiting (e.g. "Bring sunscreen", "Book in advance")
  preparationTips: [{ type: String }],

  // Dress code requirement shown as a notice on the detail page (e.g. "Modest dress required")
  dressCode: { type: String, default: '' },

  // Safety advice shown in a callout on the detail page (e.g. "Watch for monkeys")
  safetyTips: [{ type: String }],

  // General travel advice (directions, parking tips, nearby landmarks)
  travelNotes: { type: String, default: '' },

  // ── Ticket Pricing ──────────────────────────────────────────────────────────
  // Whether this attraction charges an entry fee
  entryType: { type: String, enum: ['free', 'paid'], default: 'free' },

  // Nested sub-object with 4 ticket price tiers in LKR.
  // The frontend uses user.nationality ('local' | 'foreigner') to select the
  // correct adult/child price tier to display.
  tickets: {
    localAdult:     { type: Number, default: 0 }, // LKR price for local adult visitors
    localChild:     { type: Number, default: 0 }, // LKR price for local child visitors
    foreignerAdult: { type: Number, default: 0 }, // LKR price for foreign adult visitors
    foreignerChild: { type: Number, default: 0 }, // LKR price for foreign child visitors
  },

  // ── Media ───────────────────────────────────────────────────────────────────
  // URL of the primary hero/cover image shown on listing cards and the detail page
  coverImage: { type: String, default: '' },

  // Array of additional image URLs rendered in the photo gallery on the detail page
  gallery: [{ type: String }],

  // ── Facilities & Contact ────────────────────────────────────────────────────
  // Whether the attraction has on-site car parking (shown as a facility badge)
  parkingAvailable: { type: Boolean, default: false },

  // Nearby amenities or services (e.g. ['Restrooms', 'Food Stalls', 'Gift Shop'])
  nearbyFacilities: [{ type: String }],

  // Phone number or email address for the attraction's ticket office / management
  contactInfo: { type: String, default: '' },

  // Official website URL for the attraction (opens in a new tab)
  website: { type: String, default: '' },

  // ── Stats & Metadata ────────────────────────────────────────────────────────
  // Aggregated average star rating (0–5); updated when a new review is approved
  rating: { type: Number, default: 0 },

  // Total number of approved reviews; displayed as "(N reviews)" on listing cards
  reviewCount: { type: Number, default: 0 },

  // Internal score used to surface popular attractions in default sort order
  popularityScore: { type: Number, default: 0 },

  // Freeform tag keywords used for search (e.g. ['beach', 'swimming', 'family'])
  tags: [{ type: String }],

  // Soft-delete: false hides the place from all public-facing API responses
  isActive: { type: Boolean, default: true },

  // Featured places are highlighted on the home page and at the top of Explore
  isFeatured: { type: Boolean, default: false },
}, { timestamps: true }); // Mongoose adds createdAt and updatedAt automatically

// ── Pre-save: Auto-generate Slug ──────────────────────────────────────────────
// Generates a URL-safe slug from the place name only on the first save (when
// slug is still unset). Converts to lowercase and replaces non-alphanumeric
// characters with hyphens.
// Example: "Gangarama Temple" → "gangarama-temple"
placeSchema.pre('save', function (next) {
  if (!this.slug) {
    // Lowercase the name, then replace any sequence of non-alphanumeric chars with '-'
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }
  next();
});

// Export the compiled Mongoose model used throughout controllers and the planner
module.exports = mongoose.model('Place', placeSchema);
