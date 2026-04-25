/**
 * routes/mapRoutes.js — Live Map Routes
 *
 * Mounted at: /api/map (see server.js)
 *
 * Public routes (no token required):
 *  GET /api/map/nearby  — Find nearby services (restaurants, hotels, fuel, police, hospitals)
 *                         Query params: lat (required), lng (required), type, radius (default 10km)
 *
 *  GET /api/map/route   — Get travel time + cost estimates between two coordinate pairs
 *                         Query params: fromLat, fromLng, toLat, toLng (all required)
 *                         Returns estimates for 6 transport modes (car, tuk-tuk, bus, train, bike, walk)
 *
 * Both endpoints use the Haversine formula to compute straight-line distances.
 * No authentication is required — map data is available to all visitors.
 */

const express = require('express');
const r = express.Router();

// Import the two map handler functions from mapController
const c = require('../controllers/mapController');

// ── Map Routes ────────────────────────────────────────────────────────────────
r.get('/nearby', c.getNearbyServices); // Nearby POI filter: type + radius from user position
r.get('/route',  c.getRouteInfo);      // Multi-mode travel estimate between two points

module.exports = r;
