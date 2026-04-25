/**
 * controllers/adminController.js — Admin Dashboard & User Management Controller
 *
 * Provides admin-only operations for the management dashboard:
 *  - getDashboardStats  GET  /api/admin/stats        — Aggregated platform statistics
 *  - getUsers           GET  /api/admin/users         — List all registered users
 *  - toggleUserStatus   PUT  /api/admin/users/:id/toggle — Activate/suspend a user account
 *
 * All routes require the `adminProtect` middleware (attaches req.admin).
 *
 * getDashboardStats aggregates:
 *  - Count of users, active places, plans, bookings, active packages,
 *    successful payments, and total reviews
 *  - Total revenue from successful payments (via MongoDB $group aggregation)
 *  - The 5 most recent bookings (populated with user + package details)
 *  - The 5 most recently registered users
 *  - Monthly revenue breakdown for the last 6 calendar months (for the chart)
 */

const User     = require('../models/User');
const Place    = require('../models/Place');
const VisitPlan = require('../models/VisitPlan');
const Booking  = require('../models/Booking');
const Package  = require('../models/Package');
const Payment  = require('../models/Payment');
const Review   = require('../models/Review');

// ── Get Dashboard Stats ───────────────────────────────────────────────────────
// Runs 7 count queries in parallel via Promise.all for efficiency, then
// runs an aggregation for total revenue and separate queries for recent
// bookings, recent users, and monthly revenue chart data.
exports.getDashboardStats = async (req, res) => {
  try {
    // Run all count queries concurrently — none depend on each other
    const [users, places, plans, bookings, packages, payments, reviews] = await Promise.all([
      User.countDocuments(),                            // All registered users
      Place.countDocuments({ isActive: true }),         // Active tourist attractions
      VisitPlan.countDocuments(),                       // All custom day-trip plans
      Booking.countDocuments(),                         // All bookings (all statuses)
      Package.countDocuments({ isActive: true }),       // Active curated packages
      Payment.countDocuments({ status: 'success' }),   // Successful transactions
      Review.countDocuments(),                          // All reviews (approved and pending)
    ]);

    // Aggregate the total revenue from all successful payments in LKR
    const revenue = await Payment.aggregate([
      { $match: { status: 'success' } },                         // Only paid transactions
      { $group: { _id: null, total: { $sum: '$amount' } } },     // Sum the amount field
    ]);

    // Fetch the 5 most recently created bookings for the "Recent Activity" table
    const recentBookings = await Booking.find()
      .populate('user', 'name email').populate('package', 'name price')
      .sort('-createdAt').limit(5);

    // Fetch the 5 most recently registered users for the "New Users" panel
    const recentUsers = await User.find().sort('-createdAt').limit(5).select('name email createdAt');

    // Monthly revenue chart data (last 6 months)
    // Used to render the revenue bar/line chart on the admin dashboard
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5); // Go back 5 months from current month

    const monthlyRevenue = await Payment.aggregate([
      // Filter to successful payments within the last 6 calendar months
      { $match: { status: 'success', createdAt: { $gte: sixMonthsAgo } } },
      // Group by year + month and sum the revenue and transaction count
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      // Sort chronologically so the chart renders left-to-right in time order
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    res.json({
      success: true,
      stats: { users, places, plans, bookings, packages, payments, reviews, revenue: revenue[0]?.total || 0 },
      recentBookings,
      recentUsers,
      monthlyRevenue,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get All Users ─────────────────────────────────────────────────────────────
// Returns all registered user accounts sorted by most recently joined.
// Excludes the hashed password field from the response for security.
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort('-createdAt');
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Toggle User Status ─────────────────────────────────────────────────────────
// Flips the isActive flag on a user account.
//  true  → false : Suspends the user (they will be blocked at login)
//  false → true  : Reinstates a previously suspended account
// Uses a read-then-flip approach (not findByIdAndUpdate $not) so the response
// reflects the actual new state of the document.
exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Toggle: active becomes suspended; suspended becomes active
    user.isActive = !user.isActive;
    await user.save();

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};