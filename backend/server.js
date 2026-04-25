/**
 * server.js — DayScape v2 Express Application Entry Point
 *
 * This is the main server file that:
 *  1. Loads environment variables from .env using dotenv
 *  2. Connects to MongoDB via the connectDB helper
 *  3. Configures Express middleware (CORS, JSON body parsing)
 *  4. Mounts all API route modules under /api
 *  5. Provides a root health-check endpoint
 *  6. Registers a global error-handling middleware
 *  7. Starts the HTTP server on the configured PORT
 *
 * All API routes follow the pattern: /api/<resource>
 * Frontend (Vite dev server on port 5173) is whitelisted by CORS.
 */

const express = require('express');
const cors    = require('cors');
const dotenv  = require('dotenv');
const connectDB = require('./config/db');

// Load .env variables into process.env before anything else
dotenv.config();

// Open the MongoDB connection (exits the process if connection fails)
connectDB();

// Create the Express application instance
const app = express();

// Allow cross-origin requests from the Vite frontend dev server
// credentials:true is required so that the Authorization header is forwarded
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));

// Parse JSON request bodies (e.g. POST/PUT payloads)
app.use(express.json());

// Parse URL-encoded form data (e.g. multipart/form-data submissions)
app.use(express.urlencoded({ extended: true }));

// ── Route modules ────────────────────────────────────────────────────────────
// User authentication: register, login, profile
app.use('/api/auth',        require('./routes/authRoutes'));

// Admin authentication: login, get current admin
app.use('/api/admin/auth',  require('./routes/adminAuthRoutes'));

// Tourist place CRUD and search
app.use('/api/places',      require('./routes/placeRoutes'));

// Place category management
app.use('/api/categories',  require('./routes/categoryRoutes'));

// User-submitted reviews for places
app.use('/api/reviews',     require('./routes/reviewRoutes'));

// User day-trip plans (custom itineraries)
app.use('/api/plans',       require('./routes/planRoutes'));

// User favourite places
app.use('/api/favorites',   require('./routes/favoriteRoutes'));

// Curated travel packages
app.use('/api/packages',    require('./routes/packageRoutes'));

// Bookings for packages, plans, or cart orders
app.use('/api/bookings',    require('./routes/bookingRoutes'));

// Payment processing for confirmed bookings
app.use('/api/payments',    require('./routes/paymentRoutes'));

// Shopping cart (multi-item checkout)
app.use('/api/cart',        require('./routes/cartRoutes'));

// Authenticated user endpoint
app.use('/api/users',       require('./routes/userRoutes'));

// Admin-only management endpoints (dashboard, users, etc.)
app.use('/api/admin',       require('./routes/adminRoutes'));

// Nearby services and route information (map-related queries)
app.use('/api/map',         require('./routes/mapRoutes'));

// ── Root health-check ─────────────────────────────────────────────────────────
// A simple GET / to confirm the server is running
app.get('/', (req, res) => res.json({ message: 'DayScape v2 API running ✓' }));

// ── Global error handler ─────────────────────────────────────────────────────
// Catches any error thrown in route handlers and returns a JSON error response.
// next(err) calls are forwarded here by Express automatically.
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: err.message || 'Server Error' });
});

// ── Start listening ──────────────────────────────────────────────────────────
// Uses PORT from .env or defaults to 5000
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`DayScape v2 server on http://localhost:${PORT}`));
