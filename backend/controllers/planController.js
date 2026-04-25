/**
 * controllers/planController.js — VisitPlan (Custom Day-Trip) CRUD Controller
 *
 * Manages user-created custom day-trip itineraries (VisitPlan documents).
 * Users build plans in the PlannerPage, then can view, edit, delete, and
 * book them. After payment, the plan's status changes to 'active', unlocking
 * PDF export and the Google Maps multi-stop navigation URL.
 *
 * Exports:
 *  createPlan       POST  /api/plans              — Create a new plan
 *  getMyPlans       GET   /api/plans/my            — List the current user's plans
 *  getPlan          GET   /api/plans/:id           — Get a single plan (owner only)
 *  updatePlan       PUT   /api/plans/:id           — Update plan fields (owner only)
 *  deletePlan       DELETE /api/plans/:id          — Hard-delete a plan (owner only)
 *  getAllPlansAdmin  GET   /api/admin/plans         — List all plans (admin only)
 *
 * Population:
 *  All plan responses populate the nested place references inside each plan item
 *  (places[].place) with the PLACE_FIELDS field projection. This gives the
 *  frontend enough data to render the itinerary cards, map markers, and ticket info.
 *
 * Ownership enforcement:
 *  getPlan, updatePlan, and deletePlan compare plan.user to req.user._id and
 *  return 403 if there is a mismatch, preventing users from accessing others' plans.
 *
 * Allowed update fields:
 *  updatePlan uses an explicit allowlist to prevent mass-assignment of protected
 *  fields (e.g. user, googleMapsUrl, status in unintended ways).
 */

const VisitPlan = require('../models/VisitPlan');

// ── Population Constants ──────────────────────────────────────────────────────
// POPULATE — Mongoose path string to populate nested place references inside plan items
const POPULATE = 'places.place';

// PLACE_FIELDS — Projection applied when populating place refs inside plan items.
// Includes coordinates (lat/lng) for map rendering, ticket prices for cost display,
// and opening times for itinerary scheduling in the planner UI.
const PLACE_FIELDS = 'name slug coverImage distanceFromReference lat lng category openingTime closingTime entryType tickets estimatedDuration shortDescription';

// ── Create Plan ───────────────────────────────────────────────────────────────
// Creates a new VisitPlan document for the authenticated user.
// Requires at least a name and one place in the places array.
exports.createPlan = async (req, res) => {
  try {
    const { name, description, planDate, places, estimatedTotalCost, estimatedDuration, totalDistance } = req.body;

    // Validate that the two most critical fields are present
    if (!name) return res.status(400).json({ success: false, message: 'Plan name is required' });
    if (!places || places.length === 0) return res.status(400).json({ success: false, message: 'Add at least one place' });

    // Create the plan document; status defaults to 'draft'
    const plan = await VisitPlan.create({
      user: req.user._id, name, description, planDate, places,
      estimatedTotalCost, estimatedDuration, totalDistance,
    });

    // Populate place refs immediately so the creation response is usable by the client
    await plan.populate(POPULATE, PLACE_FIELDS);
    res.status(201).json({ success: true, plan });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Get My Plans ──────────────────────────────────────────────────────────────
// Returns all plans belonging to the current user, sorted newest-first.
// Used by the SavedPlansPage to display the user's itinerary list.
exports.getMyPlans = async (req, res) => {
  try {
    const plans = await VisitPlan.find({ user: req.user._id })
      .populate(POPULATE, PLACE_FIELDS)
      .sort('-createdAt');
    res.json({ success: true, plans });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Get Single Plan ───────────────────────────────────────────────────────────
// Returns a single plan by ID. Enforces ownership — users can only fetch their
// own plans. The full place population allows PlanDetailPage to render the map
// and itinerary with all needed fields in one request.
exports.getPlan = async (req, res) => {
  try {
    const plan = await VisitPlan.findById(req.params.id).populate(POPULATE, PLACE_FIELDS);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });

    // Ownership check — prevent users from reading each other's plans
    if (plan.user.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Not authorized' });

    res.json({ success: true, plan });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Update Plan ───────────────────────────────────────────────────────────────
// Updates mutable plan fields. Uses an explicit allowlist to guard against
// unintended overwriting of protected fields (user, googleMapsUrl, etc.).
exports.updatePlan = async (req, res) => {
  try {
    const plan = await VisitPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });

    // Enforce ownership before allowing any modification
    if (plan.user.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Not authorized' });

    // Explicit allowlist prevents mass-assignment of fields like `user` or `googleMapsUrl`
    const allowed = ['name','description','planDate','places','estimatedTotalCost','estimatedDuration','totalDistance','status'];
    allowed.forEach(k => { if (req.body[k] !== undefined) plan[k] = req.body[k]; });

    await plan.save();
    await plan.populate(POPULATE, PLACE_FIELDS);
    res.json({ success: true, plan });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Delete Plan ───────────────────────────────────────────────────────────────
// Hard-deletes the plan document after verifying ownership.
// Unlike places/packages, plans are user-created data and can be hard-deleted
// since they are not referenced by other permanent documents after booking.
exports.deletePlan = async (req, res) => {
  try {
    const plan = await VisitPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });

    // Only the plan owner can delete their own plan
    if (plan.user.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Not authorized' });

    await plan.deleteOne();
    res.json({ success: true, message: 'Plan deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Get All Plans (Admin) ─────────────────────────────────────────────────────
// Returns all plans across all users for the admin panel.
// Populates user info (name/email) and place names for the admin table view.
exports.getAllPlansAdmin = async (req, res) => {
  try {
    const plans = await VisitPlan.find()
      .populate('user', 'name email')    // Show which user owns each plan
      .populate(POPULATE, 'name')        // Show only place names in the admin list
      .sort('-createdAt');
    res.json({ success: true, plans });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};