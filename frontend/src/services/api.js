/**
 * services/api.js — Axios HTTP Client & API Method Modules
 *
 * Creates a configured Axios instance and exports named API objects, each
 * grouping the HTTP calls for one resource type. All components and pages
 * import from this file rather than calling axios directly.
 *
 * Base configuration:
 *  baseURL: '/api' — All requests are relative to /api, which Vite proxies
 *                    to http://localhost:5000 in development (see vite.config.js).
 *  timeout: 15000  — Requests failing after 15 seconds throw a timeout error.
 *
 * Request interceptor:
 *  Automatically attaches the JWT stored in localStorage as an
 *  "Authorization: Bearer <token>" header on every outgoing request.
 *  Both user tokens (from /api/auth/login) and admin tokens are stored
 *  in localStorage under the key 'token'.
 *
 * Response interceptor:
 *  If any response returns HTTP 401 (Unauthorized), the interceptor clears
 *  the stored token and role from localStorage and hard-redirects to /login.
 *  This handles expired or invalidated tokens globally without per-component logic.
 *
 * Exported API objects:
 *  authAPI      — User authentication and profile (register, login, getMe, updateProfile, changePassword)
 *  adminAuthAPI — Admin authentication (login, getMe)
 *  placeAPI     — Tourist attraction CRUD + admin endpoints
 *  categoryAPI  — Category CRUD
 *  reviewAPI    — Review creation, retrieval, deletion, and admin moderation
 *  planAPI      — VisitPlan (custom day-trip) CRUD
 *  favoriteAPI  — Toggle, list, and check saved places
 *  packageAPI   — Curated package CRUD
 *  cartAPI      — Cart get, add, update, remove, clear
 *  bookingAPI   — Create and retrieve bookings
 *  paymentAPI   — Process payments and retrieve payment history
 *  adminAPI     — Dashboard stats and user management
 *  mapAPI       — Nearby services and route info for the live map
 */

import axios from 'axios';

// ── Axios Instance ────────────────────────────────────────────────────────────
// Shared instance used by all API objects below.
// baseURL '/api' is proxied to the Express server by Vite in development.
const api = axios.create({ baseURL: '/api', timeout: 15000 });

// ── Request Interceptor: Inject Auth Token ────────────────────────────────────
// Reads the JWT from localStorage before every request and attaches it as a
// Bearer token. Both user and admin tokens are stored under the same 'token' key.
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// ── Response Interceptor: Handle 401 Globally ─────────────────────────────────
// If the server returns 401 (token expired, invalid, or missing), clear
// credentials from localStorage and redirect to the login page. This prevents
// users from staying on protected pages with a broken session.
api.interceptors.response.use(
  res => res, // Pass successful responses through unchanged
  err => {
    if (err.response?.status === 401) {
      // Expired or invalid token — clear all stored credentials
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      // Hard redirect forces a full page reload, resetting React state
      window.location.href = '/login';
    }
    return Promise.reject(err); // Re-throw so callers can still catch errors
  }
);

export default api;

// ── User Authentication API ───────────────────────────────────────────────────
// Covers user registration, login, profile retrieval, and account management.
export const authAPI = {
  register:       d => api.post('/auth/register', d),   // Create account + return JWT
  login:          d => api.post('/auth/login', d),       // Authenticate + return JWT
  getMe:          () => api.get('/auth/me'),              // Fetch full profile (DB re-query)
  updateProfile:  d => api.put('/auth/profile', d),      // Update name/phone/nationality
  changePassword: d => api.put('/auth/password', d),     // Change password (requires current)
};

// ── Admin Authentication API ──────────────────────────────────────────────────
// Separate auth flow for the admin panel (uses Admin model, not User model).
export const adminAuthAPI = {
  login: d => api.post('/admin/auth/login', d), // Admin login — returns admin JWT
  getMe: () => api.get('/admin/auth/me'),        // Fetch current admin's profile
};

// ── Place API ─────────────────────────────────────────────────────────────────
// Tourist attraction browse, search, and admin CRUD.
// getAll accepts a params object: { category, search, sort, lat, lng, entryType }
export const placeAPI = {
  getAll:      params => api.get('/places', { params }),          // Browse with filters
  getOne:      (slug, params) => api.get(`/places/${slug}`, { params }), // Place detail by slug
  getFeatured: () => api.get('/places/featured'),                 // Home page featured section
  create:      d => api.post('/places', d),                       // Admin: create place
  update:      (id, d) => api.put(`/places/${id}`, d),            // Admin: update place
  delete:      id => api.delete(`/places/${id}`),                 // Admin: soft-delete place
  getAllAdmin:  () => api.get('/places/admin/all'),                // Admin: all places incl. inactive
};

// ── Category API ──────────────────────────────────────────────────────────────
// Category management used by the Explore page filter bar and admin panel.
export const categoryAPI = {
  getAll:  () => api.get('/categories'),                    // All active categories
  create:  d  => api.post('/categories', d),                // Admin: create category
  update:  (id, d) => api.put(`/categories/${id}`, d),      // Admin: update category
  delete:  id => api.delete(`/categories/${id}`),           // Admin: soft-delete category
};

// ── Review API ────────────────────────────────────────────────────────────────
// User review submission and admin moderation.
export const reviewAPI = {
  create:     d  => api.post('/reviews', d),                      // Submit review (one per place)
  getByPlace: id => api.get(`/reviews/place/${id}`),              // Approved reviews for a place
  delete:     id => api.delete(`/reviews/${id}`),                 // Delete own review
  getAllAdmin: () => api.get('/reviews/admin/all'),                // Admin: all reviews
  toggle:     id => api.put(`/reviews/admin/${id}/toggle`),       // Admin: approve/hide review
};

// ── VisitPlan API ─────────────────────────────────────────────────────────────
// Custom day-trip itinerary management for the Planner and SavedPlans pages.
export const planAPI = {
  create:     d  => api.post('/plans', d),              // Create a new plan (status: 'draft')
  getMyPlans: () => api.get('/plans/my'),                // The current user's plan list
  getOne:     id => api.get(`/plans/${id}`),             // Single plan detail
  update:     (id, d) => api.put(`/plans/${id}`, d),    // Update plan name/places/status
  delete:     id => api.delete(`/plans/${id}`),          // Hard-delete plan
  getAllAdmin: () => api.get('/plans/admin/all'),         // Admin: all plans platform-wide
};

// ── Favorites API ─────────────────────────────────────────────────────────────
// Saved/favourite place management — toggle, list, and check.
export const favoriteAPI = {
  toggle:  placeId => api.post('/favorites/toggle', { placeId }), // Add or remove favourite
  getMy:   () => api.get('/favorites/my'),                         // List all saved places
  check:   placeId => api.get(`/favorites/check/${placeId}`),     // Check { favorited: bool }
};

// ── Package API ───────────────────────────────────────────────────────────────
// Curated tour package browse and admin CRUD.
export const packageAPI = {
  getAll:  () => api.get('/packages'),                      // All active packages
  getOne:  id => api.get(`/packages/${id}`),                // Package detail with places
  create:  d  => api.post('/packages', d),                  // Admin: create package
  update:  (id, d) => api.put(`/packages/${id}`, d),        // Admin: update package
  delete:  id => api.delete(`/packages/${id}`),             // Admin: soft-delete package
};

// ── Cart API ──────────────────────────────────────────────────────────────────
// Shopping cart operations. One cart per user; auto-created on first getCart call.
export const cartAPI = {
  getCart:    () => api.get('/cart'),                         // Fetch (or create) the cart
  addItem:    d  => api.post('/cart/add', d),                 // Add package or plan to cart
  updateItem: (id, d) => api.put(`/cart/item/${id}`, d),     // Update guest counts
  removeItem: id => api.delete(`/cart/item/${id}`),           // Remove one item
  clearCart:  () => api.delete('/cart/clear'),                // Empty entire cart (post-checkout)
};

// ── Booking API ───────────────────────────────────────────────────────────────
// Booking creation and retrieval (all types: package, plan, cart).
export const bookingAPI = {
  create:     d  => api.post('/bookings', d),          // Create booking → returns unpaid booking
  getMy:      () => api.get('/bookings/my'),             // Current user's booking history
  getOne:     id => api.get(`/bookings/${id}`),          // Single booking with full detail
  getAllAdmin: () => api.get('/bookings/admin/all'),      // Admin: all bookings
};

// ── Payment API ───────────────────────────────────────────────────────────────
// Payment processing and history. processPayment marks the booking as paid.
export const paymentAPI = {
  process:    d  => api.post('/payments/process', d),    // Submit card payment for a booking
  getMy:      () => api.get('/payments/my'),              // Current user's payment receipts
  getAllAdmin: () => api.get('/payments/admin/all'),       // Admin: revenue management
};

// ── Admin API ─────────────────────────────────────────────────────────────────
// Admin-specific dashboard stats and user management endpoints.
export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),           // Stats + charts + recent activity
  getUsers:     () => api.get('/admin/users'),               // All registered users
  toggleUser:   id => api.put(`/admin/users/${id}/toggle`), // Suspend / reinstate user
};

// ── Map API ───────────────────────────────────────────────────────────────────
// Live map page endpoints for nearby services and route estimation.
export const mapAPI = {
  getNearby: params => api.get('/map/nearby', { params }), // Nearby POIs by type + radius
  getRoute:  params => api.get('/map/route', { params }),  // Multi-mode travel estimates
};
