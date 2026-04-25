/**
 * controllers/bookingController.js — Booking & Payment Controller
 *
 * Handles the full booking lifecycle: creation, payment processing, and retrieval.
 * Supports three booking types determined by `bookingType` in the request body:
 *
 *  'package' — Booking a single curated Package
 *              Total = package.price × (adults + children × 0.5)
 *
 *  'plan'    — Booking a custom VisitPlan (unlocks PDF + Google Maps after payment)
 *              Total = PLANNER_SERVICE_FEE × adults + CHILD_PLANNER_SERVICE_FEE × children
 *
 *  'cart'    — Multi-item checkout from the shopping cart
 *              Total is trusted from the client (already validated in CartPage)
 *
 * Exports:
 *  createBooking      POST /api/bookings               — Create a new booking
 *  processPayment     POST /api/bookings/pay            — Pay for a booking (marks isPaid)
 *  getMyBookings      GET  /api/bookings/my             — List the current user's bookings
 *  getOneBooking      GET  /api/bookings/:id            — Get a single booking with full details
 *  getMyPayments      GET  /api/bookings/payments/my    — List the current user's payments
 *  getAllBookingsAdmin GET  /api/admin/bookings          — Admin: list all bookings
 *  getAllPaymentsAdmin GET  /api/admin/payments          — Admin: list all payments
 *
 * Payment gate:
 *  After processPayment succeeds, booking.isPaid = true, which unlocks PDF export
 *  and Google Maps URL generation in the frontend BookingDetailPage.
 *  For plan bookings, the VisitPlan's status is also set to 'active'.
 */

const Booking   = require('../models/Booking');
const Payment   = require('../models/Payment');
const Package   = require('../models/Package');
const VisitPlan = require('../models/VisitPlan');

// ── Service Fee Constants ─────────────────────────────────────────────────────
// Fixed per-person fees charged when a user books their custom VisitPlan.
// Children pay half the adult fee. These must match the constants in the frontend.
// Planner service fee per person (matches frontend constants)
const PLANNER_SERVICE_FEE       = 2000; // per adult
const CHILD_PLANNER_SERVICE_FEE = 1000; // per child

// ── Create Booking ─────────────────────────────────────────────────────────────
// Accepts package, plan, or cart bookings in a single endpoint.
// Server-side price calculation for package and plan bookings prevents
// price tampering from the client. Cart totals are accepted from the client
// because they have already been validated during the cart flow.
// Create booking - supports package, plan, or cart
exports.createBooking = async (req, res) => {
  try {
    const { packageId, planId, bookingType, visitDate, adults = 1, children = 0, notes, totalAmount: clientTotal, cartItems: clientCartItems } = req.body;

    // A visit date is required for all booking types to schedule the trip
    if (!visitDate) return res.status(400).json({ success: false, message: 'Visit date is required' });

    let totalAmount = 0;

    // Infer bookingType from the presence of packageId/planId if not explicitly provided
    const type = bookingType || (packageId ? 'package' : 'plan');

    if (type === 'package' && packageId) {
      // Fetch the package to get the authoritative price (never trust client price)
      const pkg = await Package.findById(packageId);
      if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });

      // Children are charged at 50% of the adult rate
      totalAmount = Math.round(pkg.price * (adults + children * 0.5));

    } else if (type === 'plan' && planId) {
      const plan = await VisitPlan.findById(planId);
      if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });

      // Only the plan owner can book their own plan
      if (plan.user.toString() !== req.user._id.toString())
        return res.status(403).json({ success: false, message: 'Not authorized' });

      // Plan bookings charge a flat service fee (does not include entry ticket prices)
      totalAmount = PLANNER_SERVICE_FEE * adults + CHILD_PLANNER_SERVICE_FEE * children;

    } else if (type === 'cart') {
      // Cart total is sent from frontend (already validated there)
      totalAmount = clientTotal || 0;
    }

    // Map incoming cart item data to the shape expected by Booking.cartItems
    // Only populated for cart bookings; empty array for package/plan bookings
    const cartItemsToStore = type === 'cart' && Array.isArray(clientCartItems)
      ? clientCartItems.map(ci => ({
          itemType: ci.itemType,
          package:  ci.package  || undefined,
          plan:     ci.plan     || undefined,
          name:     ci.name     || '',
          price:    ci.price    || 0,
          adults:   ci.adults   || 1,
          children: ci.children || 0,
        }))
      : [];

    // Persist the booking document
    const booking = await Booking.create({
      user: req.user._id,
      package:     packageId  || undefined,
      plan:        planId     || undefined,
      bookingType: type,
      visitDate, adults, children, totalAmount, notes,
      isPaid: false,          // Payment has not been processed yet
      cartItems: cartItemsToStore,
    });

    // Populate related documents so the response is immediately usable by the client
    await booking.populate('package', 'name price coverImage duration');
    await booking.populate({ path: 'plan', select: 'name estimatedTotalCost estimatedDuration places status' });
    await booking.populate('cartItems.package', 'name price coverImage duration');
    await booking.populate('cartItems.plan', 'name estimatedTotalCost');

    res.status(201).json({ success: true, booking });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Process Payment ────────────────────────────────────────────────────────────
// Simulates a card payment gateway. Extracts the last 4 digits and brand
// from the card number, creates a Payment record, marks the booking as paid,
// and for plan bookings sets the plan's status to 'active' (unlocking features).
// Process payment - marks booking confirmed + isPaid; activates plan if plan booking
exports.processPayment = async (req, res) => {
  try {
    const { bookingId, cardNumber, cardHolder, expiry, cvv } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    // Only the booking owner can pay for it
    if (booking.user.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Not authorized' });

    // Extract the last 4 digits by removing spaces and slicing the end
    const last4 = cardNumber.replace(/\s/g, '').slice(-4);

    // Determine card brand: Visa cards start with '4', everything else is Mastercard
    const brand = cardNumber.trim().startsWith('4') ? 'Visa' : 'Mastercard';

    // Create the payment record with status 'success' (simulated approval)
    const payment = await Payment.create({
      user:      req.user._id,
      booking:   bookingId,
      amount:    booking.totalAmount,
      method:    'card',
      status:    'success',
      cardLast4: last4,
      cardBrand: brand,
      paidAt:    new Date(),
    });

    // Update the booking to reflect successful payment and confirm the reservation
    booking.status = 'confirmed';
    booking.isPaid = true;
    await booking.save();

    // If plan booking - set plan status to 'active' (paid/unlocked)
    // 'active' status is the gate that enables PDF export and Google Maps URL in the frontend
    if (booking.plan) {
      await VisitPlan.findByIdAndUpdate(booking.plan, { status: 'active' });
    }

    res.json({ success: true, payment, booking, message: 'Payment successful' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Get My Bookings ────────────────────────────────────────────────────────────
// Returns all bookings belonging to the current user, sorted by most recent.
// Populates package, plan, and cart item references for the bookings list page.
exports.getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate('package', 'name price coverImage duration')
      .populate({ path: 'plan', select: 'name estimatedTotalCost estimatedDuration places status' })
      .populate('cartItems.package', 'name price coverImage duration')
      .populate('cartItems.plan', 'name estimatedTotalCost')
      .sort('-createdAt');
    res.json({ success: true, bookings });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Get One Booking ────────────────────────────────────────────────────────────
// Returns a single booking with deeply nested place data for the detail page.
// Deep-populates places inside packages and plans so the map and itinerary
// can render lat/lng coordinates, ticket prices, and opening hours.
exports.getOneBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      // Deep-populate package → its places (for package bookings)
      .populate({ path: 'package', populate: { path: 'places', select: 'name lat lng coverImage distanceFromReference openingTime closingTime estimatedDuration entryType tickets slug' } })
      // Deep-populate plan → its place items (for plan bookings)
      .populate({ path: 'plan', populate: { path: 'places.place', select: 'name lat lng coverImage distanceFromReference openingTime closingTime estimatedDuration entryType tickets slug' } })
      // Deep-populate cart package items → their places (for cart bookings)
      .populate({
        path: 'cartItems.package',
        populate: { path: 'places', select: 'name lat lng coverImage distanceFromReference openingTime closingTime estimatedDuration entryType tickets slug' },
      })
      // Deep-populate cart plan items → their place items (for cart bookings)
      .populate({
        path: 'cartItems.plan',
        populate: { path: 'places.place', select: 'name lat lng coverImage distanceFromReference openingTime closingTime estimatedDuration entryType tickets slug' },
      });

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    // Users can only view their own bookings
    if (booking.user.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Not authorized' });

    res.json({ success: true, booking });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Get My Payments ────────────────────────────────────────────────────────────
// Returns the payment history for the current user.
// Each payment is populated with its linked booking (and the booking's package name).
exports.getMyPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.user._id })
      .populate({ path: 'booking', populate: { path: 'package', select: 'name' } })
      .sort('-createdAt');
    res.json({ success: true, payments });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Get All Bookings (Admin) ───────────────────────────────────────────────────
// Returns all bookings across all users for the admin bookings management page.
// Populates user, package, and plan summary fields needed for the admin table.
exports.getAllBookingsAdmin = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('user', 'name email')
      .populate('package', 'name price')
      .populate('plan', 'name estimatedTotalCost')
      .sort('-createdAt');
    res.json({ success: true, bookings });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Get All Payments (Admin) ───────────────────────────────────────────────────
// Returns all payment records for the admin payments/revenue management page.
// Populates user info and the linked booking's package name.
exports.getAllPaymentsAdmin = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('user', 'name email')
      .populate({ path: 'booking', populate: { path: 'package', select: 'name' } })
      .sort('-createdAt');
    res.json({ success: true, payments });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
