/**
 * models/VisitPlan.js — Mongoose Model for Custom Day-Trip Plans
 *
 * A VisitPlan is a user-created itinerary composed of an ordered list of
 * tourist attractions (Place references). Users build plans in the Planner
 * page, can book them, and after payment receive a PDF export and a Google
 * Maps multi-stop navigation URL.
 *
 * Two schemas are defined in this file:
 *
 * 1. planItemSchema (sub-document)
 *    Each item in the plan's `places` array is a planItemSchema document.
 *    Fields:
 *      place     — ObjectId ref to the Place being visited
 *      order     — Integer position in the itinerary (1 = first stop, 2 = second, …)
 *      visitTime — Planned arrival time string (e.g. "09:00 AM")
 *      notes     — Free-text notes for this stop (e.g. "Buy tickets in advance")
 *      duration  — Intended time to spend here (e.g. "2 hours")
 *
 * 2. visitPlanSchema (main document)
 *    Fields:
 *      user                — The User who owns this plan
 *      name                — Plan title set by the user (e.g. "Colombo Day Trip")
 *      description         — Optional longer description of the plan
 *      planDate            — The date the user intends to execute the plan
 *      places              — Array of planItemSchema sub-documents (ordered stops)
 *      estimatedTotalCost  — Summed entry costs across all stops (LKR)
 *      estimatedDuration   — Human-readable total time (e.g. "6 hours")
 *      totalDistance       — Approximate total travel distance in km
 *      status              — 'draft' | 'active' | 'completed'
 *      isPublic            — When true the plan is visible to other users (future feature)
 *      googleMapsUrl       — Cached multi-stop Google Maps URL (populated after booking)
 *      timestamps          — Mongoose adds createdAt and updatedAt
 *
 * Instance method: generateGoogleMapsUrl(userLat, userLng)
 *    Builds a Google Maps Directions URL from the user's current location (or
 *    the first stop as fallback) through all intermediate waypoints to the
 *    final destination. The method expects `this.places` to be populated with
 *    Place documents (lat/lng/name/address fields available).
 *    Returns: a fully-formed https://www.google.com/maps/dir/... URL string,
 *    or '' if the plan has no stops.
 *
 * Gate:
 *    The googleMapsUrl and PDF export are locked behind payment in planController.
 *    The URL is generated and stored only after the linked Booking is marked isPaid.
 */

const mongoose = require('mongoose');

// ── Plan Item Sub-schema ──────────────────────────────────────────────────────
// Represents a single stop within a day-trip itinerary.
// Embedded as an array inside visitPlanSchema.places.
const planItemSchema = new mongoose.Schema({
  // Reference to the tourist attraction for this stop
  place:     { type: mongoose.Schema.Types.ObjectId, ref: 'Place', required: true },

  // Numeric position in the day's itinerary (1-based); used to sort stops on render
  order:     { type: Number, required: true },

  // Planned arrival time displayed in the itinerary card (e.g. "09:30 AM")
  visitTime: { type: String, default: '' },

  // User-written notes specific to this stop (reminders, tips, entry requirements)
  notes:     { type: String, default: '' },

  // Intended time to spend at this stop — contributes to estimatedDuration display
  duration:  { type: String, default: '' },
});

// ── Visit Plan Schema ─────────────────────────────────────────────────────────
const visitPlanSchema = new mongoose.Schema({
  // The user who created and owns this plan
  user:                { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // User-defined plan title displayed on the saved plans list and plan detail page
  name:                { type: String, required: true, trim: true },

  // Optional overview paragraph explaining the theme or purpose of the trip
  description:         { type: String, default: '' },

  // The date the user plans to execute this itinerary
  planDate:            { type: Date },

  // Ordered array of plan item sub-documents representing each stop of the day trip
  places:              [planItemSchema],

  // Sum of entry ticket costs across all stops (calculated in planController)
  estimatedTotalCost:  { type: Number, default: 0 },

  // Human-readable total trip time, e.g. "5 hours 30 minutes"
  estimatedDuration:   { type: String, default: '' },

  // Approximate total road/travel distance across all stops in km
  totalDistance:       { type: Number, default: 0 },

  // Lifecycle state of the plan:
  //  'draft'     — Being edited; not yet confirmed or booked
  //  'active'    — Confirmed and/or booked; ready to execute
  //  'completed' — The trip has taken place
  status:              { type: String, enum: ['draft','active','completed'], default: 'draft' },

  // Whether this plan can be viewed by other users (reserved for a future social feature)
  isPublic:            { type: Boolean, default: false },

  // Cached multi-stop Google Maps URL generated after booking payment is confirmed
  // Empty string until payment is processed — acts as a paywall gate
  googleMapsUrl:       { type: String, default: '' },
}, { timestamps: true }); // Mongoose adds createdAt and updatedAt automatically

// ── Instance Method: generateGoogleMapsUrl ────────────────────────────────────
// Constructs a Google Maps Directions URL covering all stops in the plan.
// Called by planController after a booking is paid to build and persist the URL.
//
// Parameters:
//  userLat (Number|null) — User's current GPS latitude (used as the origin)
//  userLng (Number|null) — User's current GPS longitude
//
// If the user's location is unavailable, the first stop's coordinates are used
// as the origin. The last stop is always used as the final destination. All
// intermediate stops are passed as pipe-separated waypoints.
//
// Requires: this.places to be populated (Place lat/lng/name/address must be loaded)
visitPlanSchema.methods.generateGoogleMapsUrl = function (userLat, userLng) {
  // Nothing to navigate to if the plan has no stops
  if (!this.places || this.places.length === 0) return '';

  // Sort stops by their `order` field to ensure correct navigation sequence
  const sorted = [...this.places].sort((a, b) => a.order - b.order);

  // Extract the populated Place documents from each plan item
  // We store coordinates from populated place objects
  const waypoints = sorted.map(p => p.place);
  if (waypoints.length === 0) return '';

  // Use the user's live GPS location as origin, or fall back to the first stop's coords
  const origin = userLat && userLng
    ? `${userLat},${userLng}`
    : (waypoints[0]?.lat ? `${waypoints[0].lat},${waypoints[0].lng}` : 'Colombo,Sri+Lanka');

  // The last stop in the sorted list is always the final destination
  const dest = waypoints[waypoints.length - 1];
  const destStr = dest?.lat ? `${dest.lat},${dest.lng}` : encodeURIComponent(dest?.address || 'Colombo');

  // All stops except the last are intermediate waypoints — joined with '|' for the API
  const wps = waypoints.slice(0, -1).map(p =>
    p?.lat ? `${p.lat},${p.lng}` : encodeURIComponent(p?.name || '')
  ).join('|');

  // Assemble the base Google Maps Directions URL with origin and destination
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destStr}`;

  // Append waypoints only if there are intermediate stops
  if (wps) url += `&waypoints=${wps}`;

  // Always use driving mode for day-trip navigation
  url += '&travelmode=driving';
  return url;
};

// Export the compiled Mongoose model used by planController and bookingController
module.exports = mongoose.model('VisitPlan', visitPlanSchema);
