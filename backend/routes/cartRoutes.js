/**
 * routes/cartRoutes.js — Shopping Cart Routes
 *
 * Mounted at: /api/cart (see server.js)
 *
 * All routes require an authenticated user (Bearer token via `protect`).
 * Each user has exactly one cart document; it is auto-created on first GET.
 *
 *  GET    /api/cart               — Get the current user's cart (auto-creates if missing)
 *  POST   /api/cart/add           — Add a package or plan item to the cart
 *  PUT    /api/cart/item/:itemId  — Update adults/children count for a specific item
 *  DELETE /api/cart/item/:itemId  — Remove a specific item by its sub-document _id
 *  DELETE /api/cart/clear         — Empty the entire cart (called after checkout)
 *
 * Route ordering note:
 *  /add and /clear must be registered before /item/:itemId so Express does not
 *  try to match the literal strings "add" or "clear" as an itemId param.
 */

const express = require('express');
const r = express.Router();

// Import all cart handler functions from cartController
const c = require('../controllers/cartController');

// All cart operations require a valid user JWT
const { protect } = require('../middleware/auth');

// ── Cart Routes ───────────────────────────────────────────────────────────────
r.get('/',                protect, c.getCart);     // Fetch (or auto-create) the user's cart
r.post('/add',            protect, c.addItem);     // Add package or plan item to cart
r.put('/item/:itemId',    protect, c.updateItem);  // Update guest counts for a cart item
r.delete('/item/:itemId', protect, c.removeItem);  // Remove one item by its sub-doc _id
r.delete('/clear',        protect, c.clearCart);   // Remove all items (post-checkout clear)

module.exports = r;
