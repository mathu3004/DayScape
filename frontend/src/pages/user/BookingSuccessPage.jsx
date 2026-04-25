/**
 * pages/user/BookingSuccessPage.jsx — Booking Confirmation & Post-Payment Actions
 *
 * Displayed immediately after a successful payment in PaymentPage.
 * Receives booking context via React Router location.state (no API params needed
 * for the success header), but also fetches the fully-populated booking from the
 * server so that place lat/lng coordinates are always available for mapping.
 *
 * Navigation state received (from PaymentPage on success):
 *   booking     — the booking document returned by bookingAPI.create()
 *   item        — the package or plan document (for name and cover image display)
 *   totalAmount — final amount paid (may differ from booking.totalAmount if rounding)
 *   mode        — 'package' | 'plan' | 'cart'
 *   cartItems   — cart items array (only when mode === 'cart')
 *
 * ── Reference & Geolocation ──────────────────────────────────────────────────
 * REF = { lat: 6.868671, lng: 79.860689 } — 38 Rajasinghe Road, Dehiwala
 * GPS is requested on mount. Falls back to REF (not an error) when permission is denied.
 * Used as the Google Maps route origin and as the starting point for total distance.
 *
 * ── haversine(lat1, lon1, lat2, lon2) ─────────────────────────────────────────
 * Standard spherical-Earth distance formula (R = 6371 km).
 * Returns distance in kilometres rounded to 2 decimal places.
 * Used to compute totalDist: user→first stop + sum of consecutive stop-to-stop distances.
 *
 * ── buildMapsUrl(places, uLat, uLng) ─────────────────────────────────────────
 * Constructs a Google Maps driving route URL.
 * - places: flat array of place objects with .lat and .lng
 * - origin: GPS position if available, otherwise REF
 * - destination: last place's lat,lng
 * - waypoints: all intermediate places (pipe-separated lat,lng pairs)
 * Returns null when no places have valid coordinates.
 *
 * ── TRANSPORT Array ───────────────────────────────────────────────────────────
 * Five transport modes with speed and cost estimates:
 *   Car/Taxi: 25 km/h, LKR 100 base + 50/km
 *   Tuk-tuk:  20 km/h, LKR 60 base + 40/km
 *   City Bus: 15 km/h, LKR 15 base + 3/km
 *   Train:    30 km/h, LKR 10 base + 2/km
 *   Walking:   5 km/h, free
 * After totalDist is known, each mode's mins and cost are computed and added
 * as new properties to a derived transport array for rendering.
 *
 * ── fullBooking (server fetch) ────────────────────────────────────────────────
 * bookingAPI.getOne(booking._id) is called after mount to get the fully-populated
 * booking document (places with lat/lng, cartItems with populated package.places).
 * This ensures the Google Maps route and distance calculations work even if the
 * navigation state did not include coordinate data.
 *
 * ── Place Extraction by Mode ─────────────────────────────────────────────────
 * The `places` array is built differently per booking mode using `fb` (fullBooking)
 * with fallback to nav state item:
 *
 *   plan:    fb.plan.places sorted by order, then .map(s => s.place)
 *   cart:    fb.cartItems.flatMap(ci =>
 *              ci.package.places (array of Place docs)
 *              OR ci.plan.places sorted then mapped to Place docs)
 *   package: fb.package.places (flat array of Place docs)
 *
 * ── totalDist Calculation ─────────────────────────────────────────────────────
 * Start: haversine(userLoc, places[0]) — user to first stop
 * Then: haversine(places[i], places[i+1]) for each consecutive pair
 * Resulting in total trip distance in km (rounded to 1 decimal).
 *
 * ── Success Card ──────────────────────────────────────────────────────────────
 * Centered max-width:520 card with:
 *   - ✓ circle icon
 *   - "Booking Confirmed!" headline
 *   - Context-appropriate subtitle (different text for plan mode)
 *   - Booking reference box (bookingRef in gold monospace)
 *   - Key details: item name, visit date, guest count, amount paid
 *   - Primary CTAs: "View Plan (Now Unlocked)" for plan mode, "View Booking Details"
 *
 * ── Left Column (below success card) ─────────────────────────────────────────
 * Travel Options card: 5-column transport mode grid with icon, label, time, cost
 * Navigation & Ride Booking card:
 *   - Open Full Route in Google Maps (when mapsUrl available)
 *   - Directions to First Stop (direct link to first stop's coordinates)
 *   - Export PDF Itinerary button (calls exportPlanToPDF with booking context)
 *   - PickMe link → https://pickme.lk
 *   - Uber link → uber.com Colombo
 *
 * ── Right Sidebar ─────────────────────────────────────────────────────────────
 * Quick Actions card: Open Live Map + My Bookings links
 * Travel Tips card: 4 practical tips (gold-bordered)
 * Context-appropriate footer hint about unlocked features
 */

import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import detailStyles from './BookingDetail.module.css';
import { exportPlanToPDF } from '../../utils/pdfExport';
import { bookingAPI } from '../../services/api';

// ── Reference Location ────────────────────────────────────────────────────────
// 38 Rajasinghe Road, Dehiwala — used as Maps origin when GPS is unavailable
const REF = { lat: 6.868671, lng: 79.860689 };

// ── haversine ─────────────────────────────────────────────────────────────────
// Calculates the great-circle distance between two lat/lng points in kilometres.
// Uses the Haversine formula with Earth radius R = 6371 km.
// Returns distance rounded to 2 decimal places as a float.
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return parseFloat((R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))).toFixed(2));
}

// ── buildMapsUrl ──────────────────────────────────────────────────────────────
// Constructs a Google Maps multi-stop driving URL.
// - places: flat array of place objects with .lat and .lng coordinates
// - uLat/uLng: user's GPS position (or null to fall back to REF)
// - Returns null when no valid coordinates exist
function buildMapsUrl(places, uLat, uLng) {
  const valid = (places||[]).filter(p => p?.lat);
  if (!valid.length) return null;
  const origin = uLat ? `${uLat},${uLng}` : `${REF.lat},${REF.lng}`;
  const dest   = `${valid[valid.length-1].lat},${valid[valid.length-1].lng}`;
  const wps    = valid.slice(0,-1).map(p=>`${p.lat},${p.lng}`).join('|');
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${wps?`&waypoints=${wps}`:''}&travelmode=driving`;
}

// ── TRANSPORT Mode Definitions ────────────────────────────────────────────────
// Each entry defines a transport mode with speed (for duration estimate) and
// a pricing formula (base + perKm) used to estimate trip cost.
// perKm=0 means the mode is free (Walking).
const TRANSPORT = [
  { mode:'car',   label:'Car / Taxi', icon:'🚗', speedKmh:25, base:100, perKm:50 },
  { mode:'tuk',   label:'Tuk-tuk',    icon:'🛺', speedKmh:20, base:60,  perKm:40 },
  { mode:'bus',   label:'City Bus',   icon:'🚌', speedKmh:15, base:15,  perKm:3  },
  { mode:'train', label:'Train',      icon:'🚂', speedKmh:30, base:10,  perKm:2  },
  { mode:'walk',  label:'Walking',    icon:'🚶', speedKmh:5,  base:0,   perKm:0  },
];

export default function BookingSuccessPage() {
  // ── Navigation State ──────────────────────────────────────────────────────
  // Destructure the context passed from PaymentPage after successful payment
  const { state } = useLocation();
  const { booking, item, totalAmount, mode, cartItems: navCartItems } = state || {};
  const isPlan = mode === 'plan';
  const isCart = mode === 'cart';

  // ── State ─────────────────────────────────────────────────────────────────
  const [userLoc,     setUserLoc]     = useState(null);   // GPS position {lat, lng} or null
  const [fullBooking, setFullBooking] = useState(null);   // Server-populated booking doc

  // ── GPS Request ───────────────────────────────────────────────────────────
  // Request the user's current position for use as the Maps route origin.
  // Falls back to REF (not an error state) when permission is denied.
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      p => setUserLoc({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setUserLoc(REF)  // Silently use reference location on denial
    );
  }, []);

  // ── Full Booking Fetch ────────────────────────────────────────────────────
  // Fetches the fully-populated booking document from the server.
  // The booking in navigation state may not have lat/lng for all places,
  // so this ensures map routes and distance calculations are always accurate.
  useEffect(() => {
    if (booking?._id) {
      bookingAPI.getOne(booking._id)
        .then(({ data }) => setFullBooking(data.booking))
        .catch(() => {});  // Silently fail — page still works from nav state
    }
  }, [booking?._id]);

  // ── Place Extraction by Booking Mode ─────────────────────────────────────
  // Builds a flat array of Place documents for distance calculation and mapping.
  // `fb` is the fully-populated booking (preferred over nav state item).
  const fb = fullBooking;
  const places = isPlan
    // Plan: extract place docs from sorted plan.places array
    ? [...((fb?.plan?.places || item?.places) ?? [])].sort((a, b) => a.order - b.order).map(s => s.place).filter(Boolean)
    : isCart
      // Cart: collect places from each cart item's package or plan
      ? ((fb?.cartItems || navCartItems) ?? []).flatMap(ci => {
          if (ci.package?.places?.length) return ci.package.places;
          if (ci.plan?.places?.length) return [...ci.plan.places].sort((a,b)=>a.order-b.order).map(s=>s.place).filter(Boolean);
          return [];
        })
      // Package: direct array of place docs
      : (fb?.package?.places || item?.places || []);

  // ── Distance + Route Calculation ─────────────────────────────────────────
  const loc     = userLoc || REF;                        // Use GPS or REF as starting point
  const mapsUrl = buildMapsUrl(places, loc.lat, loc.lng);  // Google Maps URL

  // totalDist: user→first stop + sum of consecutive stop distances
  let totalDist = 0;
  if (places[0]?.lat) totalDist += haversine(loc.lat, loc.lng, places[0].lat, places[0].lng);
  for (let i = 0; i < places.length - 1; i++) {
    if (places[i]?.lat && places[i+1]?.lat)
      totalDist += haversine(places[i].lat, places[i].lng, places[i+1].lat, places[i+1].lng);
  }
  totalDist = parseFloat(totalDist.toFixed(1));  // 1 decimal for display

  // ── Transport Estimates ───────────────────────────────────────────────────
  // Computes estimated travel time (mins) and cost (LKR) for each transport mode
  // based on totalDist and each mode's speedKmh/base/perKm values.
  const transport = TRANSPORT.map(m => {
    const mins = Math.round((totalDist / m.speedKmh) * 60);
    const cost = m.perKm === 0 ? 0 : Math.round(m.base + totalDist * m.perKm);
    return { ...m, mins, cost };
  });

  return (
    <div style={{ padding: '2rem 0 4rem' }}>
      <div className="container">

        {/* ══════════════════════════════════════════════════════
            SUCCESS CARD — centered, max-width 520px
            Shows confirmation icon, headline, booking reference,
            trip details, and primary CTA buttons.
        ════════════════════════════════════════════════════════ */}
        <div style={{ display:'flex', justifyContent:'center', marginBottom:'1.75rem' }}>
          <div className="card" style={{ maxWidth:520, width:'100%', textAlign:'center', padding:'2.5rem 2rem' }}>

            {/* ── Checkmark Icon ──────────────────────────────── */}
            <div style={{ display:'flex', justifyContent:'center', marginBottom:'1.25rem' }}>
              <div style={{ width:72, height:72, borderRadius:'50%', background:'var(--teal3)', border:'2px solid var(--teal2)', color:'var(--teal)', fontSize:'2rem', display:'flex', alignItems:'center', justifyContent:'center' }}>✓</div>
            </div>

            {/* ── Confirmation Headline ─────────────────────── */}
            <h1 style={{ fontFamily:'Cormorant Garamond', fontSize:'2rem', color:'var(--txt)', marginBottom:'0.4rem' }}>Booking Confirmed!</h1>
            {/* Context-sensitive subtitle: plan mode mentions unlocked features */}
            <p style={{ color:'var(--txt2)', fontSize:'0.92rem', lineHeight:'1.55', marginBottom:'1.5rem' }}>
              {isPlan
                ? 'Your plan has been booked and paid. Export PDF, Google Maps route, and navigation are now unlocked!'
                : 'Your payment was successful and booking is confirmed. Have a wonderful trip!'}
            </p>

            {/* ── Booking Reference Box ────────────────────── */}
            {/* Gold-bordered box highlighting the unique booking reference code */}
            {booking && (
              <div style={{ background:'var(--bg3)', border:'1px solid var(--gold3)', borderRadius:'var(--radius)', padding:'1rem 1.25rem', marginBottom:'1.25rem' }}>
                <div style={{ fontSize:'0.72rem', color:'var(--txt3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'0.35rem' }}>Booking Reference</div>
                <div style={{ fontFamily:'Cormorant Garamond', fontSize:'1.5rem', color:'var(--gold)', fontWeight:700, letterSpacing:'0.5px' }}>{booking.bookingRef}</div>
              </div>
            )}

            {/* ── Booking Detail Rows ──────────────────────── */}
            {/* Shows plan/package name, visit date, guest count, and total paid */}
            <div style={{ background:'var(--bg3)', borderRadius:'var(--radius)', padding:'1rem', textAlign:'left', marginBottom:'1.5rem' }}>
              {/* Item name row */}
              {item?.name && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.85rem', padding:'0.4rem 0', borderBottom:'1px solid var(--brd)', color:'var(--txt2)' }}>
                  <span>{isPlan ? 'Plan' : 'Package'}</span>
                  <span style={{ fontWeight:600, color:'var(--txt)' }}>{item.name}</span>
                </div>
              )}
              {/* Visit date row */}
              {booking?.visitDate && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.85rem', padding:'0.4rem 0', borderBottom:'1px solid var(--brd)', color:'var(--txt2)' }}>
                  <span>Visit Date</span>
                  <span style={{ fontWeight:600, color:'var(--txt)' }}>{new Date(booking.visitDate).toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</span>
                </div>
              )}
              {/* Guest count row (adults + optional children) */}
              {booking?.adults != null && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.85rem', padding:'0.4rem 0', borderBottom:'1px solid var(--brd)', color:'var(--txt2)' }}>
                  <span>Guests</span>
                  <span style={{ fontWeight:600, color:'var(--txt)' }}>
                    {booking.adults} adult{booking.adults>1?'s':''}{booking.children>0?`, ${booking.children} child${booking.children>1?'ren':''}`:'' }
                  </span>
                </div>
              )}
              {/* Total amount paid — uses totalAmount from nav state, falls back to booking doc */}
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.95rem', padding:'0.5rem 0', fontWeight:700 }}>
                <span style={{ color:'var(--txt)' }}>Amount Paid</span>
                <span style={{ color:'var(--gold)', fontFamily:'Cormorant Garamond', fontSize:'1.1rem' }}>
                  LKR {(totalAmount || booking?.totalAmount)?.toLocaleString()}
                </span>
              </div>
            </div>

            {/* ── Primary CTA Buttons ──────────────────────── */}
            <div style={{ display:'flex', flexDirection:'column', gap:'0.65rem' }}>
              {/* For plan mode: direct link to the now-unlocked plan detail page */}
              {isPlan && booking && (
                <Link to={`/plans/${booking.plan?._id || booking.plan}`} className="btn btn-gold btn-lg btn-block" style={{ justifyContent:'center' }}>
                  🗓️ View Plan (Now Unlocked)
                </Link>
              )}
              {/* View booking details (all modes) */}
              {booking && (
                <Link to={`/bookings/${booking._id}`} className="btn btn-gold btn-block" style={{ justifyContent:'center' }}>
                  📋 View Booking Details
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            TWO-COLUMN SECTION (below the success card)
            Left:  Travel Options + Navigation & Ride Booking
            Right: Quick Actions + Travel Tips
        ════════════════════════════════════════════════════════ */}
        <div className={detailStyles.layout}>

          {/* ── Left Column ─────────────────────────────────── */}
          <div className={detailStyles.left}>

            {/* ── Travel Options Card ────────────────────────── */}
            {/* Shows duration and cost estimate for 5 transport modes.
                Only rendered when totalDist > 0 (i.e., places with coordinates exist). */}
            {totalDist > 0 && (
              <div className="card" style={{ marginBottom:'1rem' }}>
                <h3 className={detailStyles.sectionTitle}>Travel Options</h3>
                <p style={{ fontSize:'0.82rem', color:'var(--txt3)', marginBottom:'1rem' }}>Estimated for {totalDist} km total trip distance.</p>
                {/* Grid of transport mode cards: icon + label + time + cost */}
                <div className={detailStyles.modeGrid}>
                  {transport.map(m => (
                    <div key={m.mode} className={detailStyles.modeCard}>
                      <div className={detailStyles.modeIcon}>{m.icon}</div>
                      <div className={detailStyles.modeLabel}>{m.label}</div>
                      {/* Duration: shows "X min" or "Xh Ym" for trips over 60 minutes */}
                      <div className={detailStyles.modeDur}>{m.mins < 60 ? `${m.mins} min` : `${Math.floor(m.mins/60)}h ${m.mins%60}m`}</div>
                      {/* Cost: "Free" for walking, otherwise LKR estimate */}
                      <div className={detailStyles.modeCost}>{m.cost === 0 ? 'Free' : `LKR ${m.cost.toLocaleString()}`}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Navigation & Ride Booking Card ─────────────── */}
            <div className="card">
              <h3 className={detailStyles.sectionTitle}>Navigation & Ride Booking</h3>
              <div className={detailStyles.actionGrid}>
                {/* Full multi-stop route in Google Maps */}
                {mapsUrl && (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-teal">
                    🗺️ Open Full Route in Google Maps
                  </a>
                )}
                {/* Direct directions to the first stop only */}
                {places[0]?.lat && (
                  <a href={`https://www.google.com/maps/dir/?api=1&origin=${loc.lat},${loc.lng}&destination=${places[0].lat},${places[0].lng}&travelmode=driving`}
                    target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                    📍 Directions to First Stop
                  </a>
                )}
                {/* Export PDF — builds pdfItem in the shape exportPlanToPDF expects */}
                {booking && (
                  <button className="btn btn-gold" onClick={() => {
                    // Build the pdfItem object in the normalized shape expected by exportPlanToPDF
                    const pdfItem = isPlan
                      ? { name: item?.name, places: item?.places || [], estimatedTotalCost: item?.estimatedTotalCost }
                      : isCart
                        ? { name: `Cart Booking – ${new Date(booking.visitDate).toLocaleDateString('en-GB')}`, places: places.map(p => ({ place: p, visitTime: p.openingTime || '', duration: p.estimatedDuration || '' })), estimatedTotalCost: totalAmount }
                        : { name: item?.name, places: (item?.places || []).map(p => ({ place: p, visitTime: p.openingTime || '', duration: p.estimatedDuration || '' })), estimatedTotalCost: totalAmount };
                    exportPlanToPDF(pdfItem, booking);
                  }}>
                    📄 Export PDF Itinerary
                  </button>
                )}
                {/* Ride-hailing quick links */}
                <a href="https://pickme.lk" target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                  🛺 Book via PickMe
                </a>
                <a href="https://www.uber.com/global/en/cities/colombo" target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                  🚗 Book via Uber
                </a>
              </div>
            </div>
          </div>

          {/* ── Right Sidebar ───────────────────────────────── */}
          <div className={detailStyles.right}>
            {/* ── Quick Actions Card ──────────────────────── */}
            <div className="card" style={{ marginBottom:'1rem' }}>
              <h3 className={detailStyles.sectionTitle}>Quick Actions</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.65rem' }}>
                {/* Open the real-time interactive map */}
                <Link to="/map" className="btn btn-outline btn-block" style={{ justifyContent:'center' }}>
                  🗺️ Open Live Map
                </Link>
                {/* Navigate to My Bookings list */}
                <Link to="/bookings" className="btn btn-ghost btn-block" style={{ justifyContent:'center' }}>
                  My Bookings
                </Link>
              </div>
            </div>

            {/* ── Travel Tips Card ────────────────────────── */}
            {/* Gold-tinted card with 4 practical trip tips */}
            <div className="card" style={{ background:'var(--gold5)', borderColor:'rgba(201,168,76,0.2)' }}>
              <div style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--gold3)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'0.75rem' }}>Travel Tips</div>
              {['Arrive at your first stop 10–15 minutes early.','Carry cash - smaller attractions may not accept cards.','Keep your booking reference handy.','Enable GPS for best navigation accuracy.'].map((tip,i) => (
                <div key={i} style={{ fontSize:'0.8rem', color:'var(--txt2)', padding:'3px 0', display:'flex', gap:'0.5rem' }}>
                  <span style={{ color:'var(--gold)', flexShrink:0 }}>→</span>{tip}
                </div>
              ))}
            </div>

            {/* Context-appropriate footer hint */}
            <p style={{ fontSize:'0.78rem', color:'var(--txt4)', lineHeight:'1.6', marginTop:'1rem', textAlign:'center' }}>
              {isPlan ? 'Visit your plan to access all unlocked features.' : 'Visit My Bookings for full details and route guidance.'}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
