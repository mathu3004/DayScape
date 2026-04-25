/**
 * models/Cart.js — Mongoose Model for Shopping Carts
 *
 * Each logged-in user has exactly one cart document (user field is unique).
 * The cart holds multiple items, each of which can be either a curated
 * Package or a custom VisitPlan.
 *
 * Sub-schema: cartItemSchema
 *  itemType  — 'package' or 'plan'; determines which ref field is used
 *  package   — ObjectId ref to a Package document
 *  plan      — ObjectId ref to a VisitPlan document
 *  quantity  — Number of units (always 1 per item in this version)
 *  adults    — Adult guest count for this item
 *  children  — Child guest count for this item
 *  visitDate — Optional intended visit date set by the user
 *  price     — Per-adult base price captured at the time the item was added
 *
 * Main schema: cartSchema
 *  user      — One-to-one link to the User; unique prevents duplicate carts
 *  items     — Array of embedded cartItemSchema sub-documents
 *  timestamps— Mongoose adds createdAt and updatedAt
 *
 * Virtual: total
 *  A computed grand total that sums price × (adults + children × 0.5)
 *  across all cart items. Not persisted to the database.
 */

const mongoose = require('mongoose');

// ── Cart Item Sub-schema ──────────────────────────────────────────────────────
const cartItemSchema = new mongoose.Schema({
  // Discriminates between a package and a plan item
  itemType:  { type: String, enum: ['package','plan'], required: true },

  // Populated when itemType === 'package'
  package:   { type: mongoose.Schema.Types.ObjectId, ref: 'Package' },

  // Populated when itemType === 'plan'
  plan:      { type: mongoose.Schema.Types.ObjectId, ref: 'VisitPlan' },

  // Number of this item in the cart (currently always 1)
  quantity:  { type: Number, default: 1, min: 1 },

  // Guest counts used to compute the line-item total
  adults:    { type: Number, default: 1 },
  children:  { type: Number, default: 0 },

  // Date the user wants to visit (optional; can be set later at checkout)
  visitDate: { type: Date },

  // Per-adult price snapshot — captured when the item is added to the cart
  price:     { type: Number, required: true },
});

// ── Cart Schema ───────────────────────────────────────────────────────────────
const cartSchema = new mongoose.Schema({
  // One cart per user — unique constraint enforced at the DB level
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

  // The array of items currently in the cart
  items: [cartItemSchema],
}, { timestamps: true }); // Adds createdAt and updatedAt fields

// ── Virtual: total ────────────────────────────────────────────────────────────
// Computes the cart grand total on the fly.
// Children are priced at 50% of the adult rate (× 0.5).
// This virtual is not stored in MongoDB — it is recalculated each time it
// is accessed on the Mongoose document.
cartSchema.virtual('total').get(function () {
  return this.items.reduce((s, i) => s + i.price * (i.adults + i.children * 0.5), 0);
});

module.exports = mongoose.model('Cart', cartSchema);
