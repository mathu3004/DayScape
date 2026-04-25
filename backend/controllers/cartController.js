/**
 * controllers/cartController.js — Shopping Cart Controller
 *
 * Manages the per-user shopping cart. Each user has exactly one Cart document
 * (enforced by the unique index on Cart.user). Cart items can be either
 * curated Packages or custom VisitPlans.
 *
 * Exports:
 *  getCart    GET    /api/cart            — Get or auto-create the user's cart
 *  addItem    POST   /api/cart/add        — Add a package or plan to the cart
 *  removeItem DELETE /api/cart/:itemId    — Remove a specific item by sub-doc ID
 *  updateItem PUT    /api/cart/:itemId    — Update adults/children count for an item
 *  clearCart  DELETE /api/cart/clear      — Remove all items from the cart
 *
 * Price capture:
 *  When an item is added, the price is fetched from the Package or VisitPlan
 *  document and stored in the cart item. This snapshot prevents price changes
 *  from affecting items already in the cart (like an e-commerce price lock).
 *
 * Duplicate prevention:
 *  addItem checks for an existing item with the same packageId or planId and
 *  returns a 400 error if a duplicate would be added.
 */

const Cart      = require('../models/Cart');
const Package   = require('../models/Package');
const VisitPlan = require('../models/VisitPlan');

// ── Population Helper ─────────────────────────────────────────────────────────
// Reusable populate chain applied after every cart mutation.
// Deeply populates both package items (with their included places' lat/lng)
// and plan items (with their stop places' lat/lng) so the CartPage can render
// item cards and compute distances without additional API calls.
const populateCart = (q) =>
  q.populate({ path:'items.package', select:'name price duration coverImage places',
               populate: { path:'places', select:'name lat lng' } })
   .populate({ path:'items.plan',    select:'name estimatedTotalCost places',
               populate: { path:'places.place', select:'name lat lng' } });

// ── Get Cart ──────────────────────────────────────────────────────────────────
// Returns the current user's cart. If no cart document exists yet (first visit),
// one is automatically created with an empty items array. This means the frontend
// never needs to handle a "cart not found" state — a cart always exists.
exports.getCart = async (req, res) => {
  try {
    // Try to find an existing cart for this user
    let cart = await populateCart(Cart.findOne({ user: req.user._id }));

    // Auto-create an empty cart on first access (lazy initialisation)
    if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });

    res.json({ success: true, cart });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Add Item ──────────────────────────────────────────────────────────────────
// Adds a package or plan to the cart after fetching and snapshotting its price.
// Prevents duplicate items — the same package or plan cannot appear twice.
exports.addItem = async (req, res) => {
  try {
    const { itemType, packageId, planId, adults = 1, children = 0, visitDate } = req.body;
    let price = 0;

    if (itemType === 'package') {
      // Fetch the package to capture the authoritative price at time of adding
      const pkg = await Package.findById(packageId);
      if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });
      price = pkg.price; // Snapshot the per-adult price
    } else if (itemType === 'plan') {
      // For plan items, use the plan's estimated total cost as the price snapshot
      const plan = await VisitPlan.findById(planId);
      if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
      price = plan.estimatedTotalCost || 0;
    }

    // Find or create the user's cart
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });

    // Prevent duplicate
    // Check whether this exact package or plan already exists in the cart
    const dup = cart.items.find(i =>
      (itemType === 'package' && i.package?.toString() === packageId) ||
      (itemType === 'plan'    && i.plan?.toString()    === planId)
    );
    if (dup) return res.status(400).json({ success: false, message: 'Item already in cart' });

    // Add the new item with the snapshotted price and guest counts
    cart.items.push({ itemType, package: packageId, plan: planId, adults, children, visitDate, price });
    await cart.save();

    // Re-fetch with full population so the response contains complete item details
    cart = await populateCart(Cart.findById(cart._id));
    res.json({ success: true, cart });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Remove Item ───────────────────────────────────────────────────────────────
// Removes a single cart item by its sub-document _id.
// Uses Array.filter instead of Mongoose's pull to work with the sub-doc ID string.
exports.removeItem = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

    // Filter out the item whose sub-document _id matches the route param
    cart.items = cart.items.filter(i => i._id.toString() !== req.params.itemId);
    await cart.save();

    res.json({ success: true, cart });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Update Item ───────────────────────────────────────────────────────────────
// Updates the adults and/or children count for a specific cart item.
// Enforces a minimum of 1 adult and 0 children using Math.max guards.
exports.updateItem = async (req, res) => {
  try {
    const { adults, children } = req.body;
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

    // Use Mongoose's DocumentArray .id() to find the embedded sub-document by its _id
    const item = cart.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    // Apply the updates with floor guards to prevent invalid values
    if (adults   !== undefined) item.adults   = Math.max(1, parseInt(adults));   // Minimum 1 adult
    if (children !== undefined) item.children = Math.max(0, parseInt(children)); // Minimum 0 children

    await cart.save();

    // Return the fully populated cart so the frontend can recalculate the total
    const populated = await populateCart(Cart.findById(cart._id));
    res.json({ success: true, cart: populated });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Clear Cart ────────────────────────────────────────────────────────────────
// Empties the cart by setting items to an empty array.
// Called automatically by the frontend after a successful cart checkout (booking).
exports.clearCart = async (req, res) => {
  try {
    await Cart.findOneAndUpdate({ user: req.user._id }, { items: [] });
    res.json({ success: true, message: 'Cart cleared' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
