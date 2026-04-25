/**
 * controllers/mapController.js — Live Map Nearby Services & Route Controller
 *
 * Provides two endpoints used by the LiveMapPage to enrich the map experience:
 *
 *  getNearbyServices  GET /api/map/nearby   — Filter static POI list by type and radius
 *  getRouteInfo       GET /api/map/route    — Compute travel time/cost between two coords
 *
 * Data source:
 *  NEARBY_SERVICES is a hardcoded array of real Colombo-area points of interest
 *  (restaurants, fuel stations, hotels, police stations, hospitals).
 *  In a production build this would be replaced with live Overpass API or
 *  Google Places API calls to return dynamic, always-up-to-date data.
 *
 * Haversine formula:
 *  Both endpoints use the same haversine() helper to calculate straight-line
 *  distances (km) between two WGS-84 coordinate pairs on a spherical Earth
 *  (R = 6371 km). Results are used to filter by radius and to estimate travel times.
 *
 * Route info transport modes:
 *  getRouteInfo returns estimates for 6 modes: car, tuk-tuk, bus, train, bicycle,
 *  and walking — each with a typical Colombo speed, per-km cost, and app suggestions.
 */

// Nearby essential services
// In production, replace with Overpass API or Google Places API calls
const NEARBY_SERVICES = [
  // Restaurants — popular dining venues in Colombo city centre
  { name: 'Ministry of Crab', type: 'restaurant', lat: 6.9271, lng: 79.8456, address: 'Old Dutch Hospital, Colombo 01', rating: 4.8, open: '12:00–23:00', icon: '🍽️' },
  { name: 'Nuga Gama', type: 'restaurant', lat: 6.9147, lng: 79.8522, address: 'Cinnamon Grand Hotel, Colombo 03', rating: 4.6, open: '12:00–22:30', icon: '🍽️' },
  { name: 'The Lagoon', type: 'restaurant', lat: 6.9270, lng: 79.8458, address: 'Colombo 01', rating: 4.5, open: '12:00–23:00', icon: '🍽️' },
  // Fuel stations — 24-hour petrol/diesel stations along main roads
  { name: 'Ceylon Petroleum - Galle Road', type: 'fuel', lat: 6.8887, lng: 79.8654, address: 'Galle Road, Dehiwala', rating: 4.0, open: '24hrs', icon: '⛽' },
  { name: 'Lanka IOC - Havelock Road', type: 'fuel', lat: 6.9020, lng: 79.8620, address: 'Havelock Road, Colombo 05', rating: 4.2, open: '24hrs', icon: '⛽' },
  // Hotels — prominent accommodation options near the city centre
  { name: 'Cinnamon Grand Colombo', type: 'hotel', lat: 6.9148, lng: 79.8521, address: '77 Galle Road, Colombo 03', rating: 4.7, open: '24hrs', icon: '🏨' },
  { name: 'Galle Face Hotel', type: 'hotel', lat: 6.9164, lng: 79.8436, address: '2 Kollupitiya Road, Colombo 03', rating: 4.5, open: '24hrs', icon: '🏨' },
  { name: 'OZO Colombo', type: 'hotel', lat: 6.9232, lng: 79.8479, address: 'Colombo 02', rating: 4.3, open: '24hrs', icon: '🏨' },
  // Police — nearby stations for emergency reference
  { name: 'Bambalapitiya Police', type: 'police', lat: 6.8937, lng: 79.8566, address: 'Galle Road, Bambalapitiya', rating: null, open: '24hrs', icon: '🚓' },
  { name: 'Kollupitiya Police', type: 'police', lat: 6.9037, lng: 79.8520, address: 'Kollupitiya, Colombo 03', rating: null, open: '24hrs', icon: '🚓' },
  // Hospitals — nearest medical facilities for tourist safety
  { name: 'National Hospital of Sri Lanka', type: 'hospital', lat: 6.9218, lng: 79.8607, address: 'Regent Street, Colombo 10', rating: 4.1, open: '24hrs', icon: '🏥' },
  { name: 'Nawaloka Hospital', type: 'hospital', lat: 6.9037, lng: 79.8600, address: '23 Sri Sugathadasa Mawatha, Colombo 02', rating: 4.4, open: '24hrs', icon: '🏥' },
  { name: 'Asiri Hospital', type: 'hospital', lat: 6.8954, lng: 79.8589, address: '181 Kirula Road, Colombo 05', rating: 4.5, open: '24hrs', icon: '🏥' },
];

// ── Haversine Distance Calculator ─────────────────────────────────────────────
// Computes the great-circle (straight-line) distance in km between two
// WGS-84 coordinate pairs using the Haversine formula.
// R = 6371 km is the mean radius of the Earth.
// Used by both getNearbyServices (radius filter) and getRouteInfo (travel time).
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's mean radius in kilometres
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Get Nearby Services ───────────────────────────────────────────────────────
// Filters NEARBY_SERVICES by service type and radius from the given coordinates.
// Attaches a calculated `distance` field (km) to each result and sorts
// the results nearest-first so the map sidebar is immediately useful.
//
// Query params:
//  lat    (required) — User's current latitude
//  lng    (required) — User's current longitude
//  type   (optional) — Filter by service type: 'restaurant'|'fuel'|'hotel'|'police'|'hospital'
//  radius (optional) — Search radius in km; defaults to 10 km
exports.getNearbyServices = (req, res) => {
  try {
    const { lat, lng, type, radius = 10 } = req.query;

    // Both coordinates are required to calculate distances
    if (!lat || !lng) return res.status(400).json({ success: false, message: 'lat and lng required' });

    let services = NEARBY_SERVICES;

    // Filter by service type if provided; 'all' returns every category
    if (type && type !== 'all') services = services.filter(s => s.type === type);

    // Compute distance from the user to each service, filter by radius, then sort
    services = services
      .map(s => ({ ...s, distance: parseFloat(haversine(parseFloat(lat), parseFloat(lng), s.lat, s.lng).toFixed(2)) }))
      .filter(s => s.distance <= parseFloat(radius))   // Keep only services within the radius
      .sort((a, b) => a.distance - b.distance);         // Sort nearest-first

    res.json({ success: true, services });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get Route Info ─────────────────────────────────────────────────────────────
// Calculates the straight-line distance between two coordinate pairs and returns
// estimated travel time and cost for 6 transport modes typical of Colombo.
// Speed and cost estimates are based on realistic Colombo traffic conditions.
//
// Query params:
//  fromLat, fromLng — Starting point coordinates
//  toLat, toLng     — Destination coordinates
exports.getRouteInfo = (req, res) => {
  try {
    const { fromLat, fromLng, toLat, toLng } = req.query;

    // All four coordinates are required to compute a route
    if (!fromLat || !fromLng || !toLat || !toLng)
      return res.status(400).json({ success: false, message: 'All coordinates required' });

    // Compute straight-line distance between origin and destination
    const distance = parseFloat(haversine(parseFloat(fromLat), parseFloat(fromLng), parseFloat(toLat), parseFloat(toLng)).toFixed(2));

    // Realistic time estimates based on Colombo traffic conditions
    // Each mode has: typical speed (km/h), cost per km (LKR), base fare (LKR)
    const modes = [
      { mode: 'car',   label: 'Car / Taxi', icon: '🚗', speed: 25, costPerKm: 50, baseCost: 100, description: 'Drive via Galle Road or expressway', apps: ['PickMe', 'Uber'] },
      { mode: 'taxi',  label: 'Tuk-tuk',   icon: '🛺', speed: 20, costPerKm: 40, baseCost: 60,  description: 'Tuk-tuk is ideal for short distances', apps: ['PickMe'] },
      { mode: 'bus',   label: 'City Bus',  icon: '🚌', speed: 15, costPerKm: 3,  baseCost: 15,  description: 'SLTB or private buses along main roads', apps: [] },
      { mode: 'train', label: 'Train',     icon: '🚂', speed: 30, costPerKm: 2,  baseCost: 10,  description: 'Available via Colombo Fort railway', apps: [] },
      { mode: 'bike',  label: 'Bicycle',   icon: '🚲', speed: 12, costPerKm: 0,  baseCost: 0,   description: 'Cycle paths available near coastal areas', apps: [] },
      { mode: 'walk',  label: 'Walking',   icon: '🚶', speed: 5,  costPerKm: 0,  baseCost: 0,   description: 'Suitable for distances under 2 km', apps: [] },
    ];

    // Compute per-mode duration and cost estimates
    const suggestions = modes.map(m => {
      // Duration in minutes: (distance / speed) × 60
      const minutes = Math.round((distance / m.speed) * 60);

      // Estimated cost in LKR: base fare + (distance × per-km rate)
      const cost = Math.round(m.baseCost + distance * m.costPerKm);

      return {
        mode:           m.mode,
        label:          m.label,
        icon:           m.icon,
        distance:       `${distance} km`,
        // Format duration as "X min" or "Xh Ym" for trips over 60 minutes
        duration:       minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`,
        estimatedCost:  m.costPerKm === 0 ? 'Free' : `LKR ${cost}`,
        description:    m.description,
        // Mark car as always recommended; also mark walking for very short distances
        recommended:    m.mode === 'car' || (distance < 3 && m.mode === 'walk'),
        externalApps:   m.apps, // App suggestions for ride-hailing modes
      };
    });

    res.json({ success: true, distance, suggestions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
