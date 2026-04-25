/**
 * models/Package.js — Mongoose Model for Curated Tour Packages
 *
 * A Package is a pre-built, admin-curated day-trip product that bundles
 * multiple tourist attractions (Place references) into a single purchasable
 * item. Users can browse, book, or add packages to their shopping cart.
 *
 * Schema fields:
 *  name          — Human-readable package title (e.g. "Heritage Trail")
 *  description   — Marketing description shown on the package detail page
 *  places        — Array of ObjectId refs to Place documents included in this package
 *  price         — Per-adult price in the listed currency (used at booking time)
 *  currency      — Currency code; defaults to 'LKR' (Sri Lankan Rupee)
 *  duration      — Text label for trip length (e.g. "1 Day", "2 Days 1 Night")
 *  maxPeople     — Maximum group size allowed for this package
 *  includes      — Bullet-list strings of what is covered (e.g. "Lunch", "Guide")
 *  excludes      — Bullet-list strings of what is NOT covered (e.g. "Flight")
 *  coverImage    — URL to the hero/cover image shown on listing cards
 *  rating        — Average star rating aggregated from user reviews
 *  category      — Loose classification tag (e.g. 'general', 'cultural', 'wildlife')
 *  isActive      — Soft-delete flag; inactive packages are hidden from public API
 *  isFeatured    — When true, the package appears in the "Featured" section on the home page
 *  discount      — Percentage discount to apply when computing sale price (0 = no discount)
 *  originalPrice — The undiscounted price shown as a strikethrough in the UI
 *  timestamps    — Mongoose adds createdAt and updatedAt automatically
 *
 * Relationships:
 *  - places[]  → Place model  (many-to-many via array of refs)
 *  - Booking model references Package via the `package` field
 *  - Cart cartItemSchema references Package via the `package` field
 */

const mongoose = require('mongoose');

// ── Package Schema Definition ─────────────────────────────────────────────────
const packageSchema = new mongoose.Schema({
  // Short, descriptive title displayed in listing cards and the detail page header
  name: { type: String, required: true },

  // Full marketing description rendered as the package overview paragraph
  description: { type: String, required: true },

  // Tourist attractions included in this package itinerary
  // Populated with Place documents when the API responds with full details
  places: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Place' }],

  // Per-adult base price; children are typically charged at 50% of this in bookingController
  price: { type: Number, required: true },

  // ISO 4217 currency code — all prices on the platform are in LKR by default
  currency: { type: String, default: 'LKR' },

  // Human-readable trip length shown on the package card (e.g. "1 Day", "Half Day")
  duration: { type: String, default: '1 Day' },

  // Maximum number of guests the package can accommodate; enforced at booking time
  maxPeople: { type: Number, default: 10 },

  // What is included in the package price — rendered as a bullet list in the UI
  includes: [{ type: String }],

  // What is NOT included — helps set user expectations and reduce support requests
  excludes: [{ type: String }],

  // URL of the primary image for listing cards and the detail page hero banner
  coverImage: { type: String, default: '' },

  // Aggregated average star rating (0–5); updated by the review aggregation logic
  rating: { type: Number, default: 0 },

  // Broad category label used for filtering on the packages page
  category: { type: String, default: 'general' },

  // Soft-delete: false hides the package from the public explore/package API endpoints
  isActive: { type: Boolean, default: true },

  // Featured packages appear in highlighted sections on the home page and explore page
  isFeatured: { type: Boolean, default: false },

  // Promotional discount percentage; 0 means no discount is applied
  // Sale price = price × (1 - discount / 100) computed in the frontend
  discount: { type: Number, default: 0 },

  // The original price before discount — displayed as a struck-through value in the UI
  originalPrice: { type: Number, default: 0 },
}, { timestamps: true }); // Mongoose adds createdAt and updatedAt automatically

// Export the compiled Mongoose model used by packageController and booking logic
module.exports = mongoose.model('Package', packageSchema);
