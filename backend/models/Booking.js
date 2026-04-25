/**
 * models/Booking.js — Mongoose Model for Bookings
 *
 * Represents a booking record created when a user reserves a package,
 * a custom day-trip plan, or checks out a shopping cart.
 *
 * Booking types:
 *  'package' — A single curated package booking
 *  'plan'    — A user's custom VisitPlan booking (unlocks PDF/maps on payment)
 *  'cart'    — A multi-item checkout from the shopping cart
 *
 * Schema fields:
 *  user         — Reference to the User who made the booking
 *  package      — Reference to the Package (for package/cart bookings)
 *  plan         — Reference to the VisitPlan (for plan bookings)
 *  bookingType  — Discriminator: 'package' | 'plan' | 'cart'
 *  bookingDate  — Timestamp when the booking was created
 *  visitDate    — The actual day the user plans to visit (required)
 *  adults       — Number of adult guests (minimum 1)
 *  children     — Number of child guests
 *  totalAmount  — Total payment amount in LKR
 *  status       — 'pending' → 'confirmed' / 'cancelled' / 'completed'
 *  isPaid       — Set to true after successful payment
 *  bookingRef   — Auto-generated unique reference number (DS-...)
 *  notes        — Optional special requests from the user
 *  cartItems    — Embedded sub-documents for cart booking line items
 *  timestamps   — createdAt and updatedAt added by Mongoose
 *
 * Pre-save middleware:
 *  Generates a unique bookingRef (DS-<timestamp>-<random>) if not already set.
 */

const mongoose = require('mongoose');

// ── Booking Schema Definition ─────────────────────────────────────────────────
const bookingSchema = new mongoose.Schema({
  // The user who created this booking
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // For package or cart bookings — references the Package document
  package:     { type: mongoose.Schema.Types.ObjectId, ref: 'Package' },

  // For plan bookings — references the user's VisitPlan document
  plan:        { type: mongoose.Schema.Types.ObjectId, ref: 'VisitPlan' },

  // Determines which type of booking this is (drives business logic)
  bookingType: { type: String, enum: ['package','plan','cart'], default: 'package' },

  // Timestamp of when the booking was placed (defaults to now)
  bookingDate: { type: Date, default: Date.now },

  // The planned visit date chosen by the user during checkout
  visitDate:   { type: Date, required: true },

  // Guest counts — children pay half price for packages
  adults:      { type: Number, default: 1 },
  children:    { type: Number, default: 0 },

  // Total price in LKR calculated server-side (not trusted from client)
  totalAmount: { type: Number, required: true },

  // Lifecycle status of the booking
  status:      { type: String, enum: ['pending','confirmed','cancelled','completed'], default: 'pending' },

  // True once payment is successfully processed
  isPaid:      { type: Boolean, default: false },

  // Human-readable reference shown to the user (e.g. DS-1716000000000-123)
  bookingRef:  { type: String, unique: true },

  // Optional notes the user submitted at checkout (dietary, accessibility, etc.)
  notes:       { type: String, default: '' },

  // Line items stored only for cart bookings (one entry per cart item)
  cartItems: [{
    // Discriminates between a package item and a plan item in the cart
    itemType: { type: String, enum: ['package', 'plan'] },
    package:  { type: mongoose.Schema.Types.ObjectId, ref: 'Package' },
    plan:     { type: mongoose.Schema.Types.ObjectId, ref: 'VisitPlan' },
    name:     String,   // Snapshot of the item name at the time of booking
    price:    Number,   // Per-adult price at the time of booking
    adults:   Number,
    children: Number,
  }],
}, { timestamps: true }); // Mongoose adds createdAt + updatedAt

// ── Pre-save: Auto-generate Booking Reference ─────────────────────────────────
// Creates a unique reference string only on the first save (when bookingRef
// is still unset). The format is DS-<milliseconds>-<3-digit random> to ensure
// uniqueness without requiring an additional DB lookup.
bookingSchema.pre('save', function (next) {
  if (!this.bookingRef) {
    this.bookingRef = 'DS-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  }
  next();
});

module.exports = mongoose.model('Booking', bookingSchema);
