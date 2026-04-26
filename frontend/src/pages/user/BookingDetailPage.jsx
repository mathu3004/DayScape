/**
 * pages/user/BookingDetailPage.jsx — Individual Booking Detail View
 *
 * Shows full details of a single booking identified by :id (MongoDB _id).
 * Provides navigation links, transport estimates, PDF export, and a "Complete
 * Payment" CTA for pending (unpaid) bookings.
 *
 * ── Reference & Geolocation ──────────────────────────────────────────────────
 * REF = { lat: 6.868671, lng: 79.860689 } — 38 Rajasinghe Road, Dehiwala
 * GPS is requested on mount. Falls back to REF on permission denial.
 * Used as Google Maps route origin and starting point for distance calculation.
 *
 * ── haversine(lat1, lon1, lat2, lon2) ─────────────────────────────────────────
 * Standard spherical-Earth distance formula (R=6371 km).
 * Returns distance in km rounded to 2 decimal places.
 * Used to compute totalDist: user→first stop + consecutive stop-to-stop segments.
 *
 * ── buildMapsUrl(places, uLat, uLng) ─────────────────────────────────────────
 * Constructs a Google Maps multi-stop driving route URL.
 * Filters places array to those with .lat coordinates.
 * Falls back to REF as origin when GPS is unavailable.
 * Returns null when no valid coordinates exist.
 *
 * ── TRANSPORT Array ───────────────────────────────────────────────────────────
 * Five transport modes. Each has: mode key, label, icon string (key into ICONS map),
 * speedKmh, base fare, and perKm rate.
 * Note: icon values here are string keys (e.g., 'Car', 'Tuk') looked up via ICONS map.
 *
 * ── ICONS Map ─────────────────────────────────────────────────────────────────
 * Maps icon key strings to emoji characters:
 *   Car → 🚗, Tuk → 🛺, Bus → 🚌, Train → 🚂, Walk → 🚶
 *
 * ── Booking Type Flags ────────────────────────────────────────────────────────
 * isPackage: bookingType === 'package'
 * isPlanBkg: bookingType === 'plan'
 * isCartBkg: bookingType === 'cart'
 * Used throughout to conditionally render type-specific UI sections.
 *
 * ── Place Extraction by Booking Type ──────────────────────────────────────────
 * Builds a flat `places` array (Place documents) used for:
 *   1. Rendering the Trip Stops list
 *   2. totalDist calculation
 *   3. Google Maps route URL
 *
 *   Package: booking.package.places (flat array of Place docs)
 *   Plan:    booking.plan.places sorted by .order, then .map(s => s.place)
 *   Cart:    forEach cartItem:
 *              if ci.package.places.length → push all package places
 *              else if ci.plan.places.length → sort by order, map to place docs
 *
 * ── handleCompletePayment ─────────────────────────────────────────────────────
 * Navigates to /payment with existingBooking to resume a pending booking at step 2.
 * Passes all relevant context so PaymentPage skips the booking creation step:
 *   mode, existingBooking (the full booking doc), pkg, packageId, plan, planId
 *
 * ── PDF Data Builders ─────────────────────────────────────────────────────────
 * Three builders create the normalized pdfItem shape expected by exportPlanToPDF():
 *
 * planForPDF: (isPlanBkg only)
 *   { name, places: sorted plan.places array, estimatedTotalCost }
 *
 * packageForPDF: (isPackage only, when places exist)
 *   { name, places: places.map(p => { place: p, visitTime, duration, notes }),
 *     estimatedTotalCost: null }
 *
 * cartForPDF: (isCartBkg only, when places exist)
 *   { name: "Cart Booking – DD/MM/YYYY", places: same shape as packageForPDF,
 *     estimatedTotalCost: booking.totalAmount }
 *
 * ── Two-column Layout ─────────────────────────────────────────────────────────
 * Left column:
 *   1. Booking header card: ref, status/type/paid badges, amount, info grid
 *      (Package/Plan name, Visit Date, Guests, Booked On)
 *   2. Trip Stops card: numbered stop list with thumbnail, meta, "View" link
 *   3. Cart Order Summary card (isCartBkg only): compact order summary above stops
 *   4. Travel Options card (isPaid + totalDist > 0): 5-mode transport estimate grid
 *   5. Navigation card OR Awaiting Payment locked card:
 *      - isPaid:  Google Maps route, PDF export, Directions to First Stop, PickMe, Uber
 *      - !isPaid: 🔒 locked screen with "Complete Payment →" button
 *
 * Right sidebar:
 *   1. Payment Details card: Amount, Payment Status, Booking Ref, Type, Date Booked
 *   2. Special Requests card (when booking.notes exists): left gold-bordered
 *   3. Travel Tips card: 4 practical tips
 *
 * ── STATUS_COLOR Map ──────────────────────────────────────────────────────────
 * Same as BookingsPage: confirmed→teal, pending→gold, cancelled→coral, completed→blue
 */

import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { bookingAPI } from '../../services/api';
import { exportPlanToPDF } from '../../utils/pdfExport';
import styles from './BookingDetail.module.css';

// ── Reference Location ────────────────────────────────────────────────────────
// 38 Rajasinghe Road, Dehiwala — used as Maps origin when GPS is unavailable
const REF = { lat: 6.868671, lng: 79.860689 };

// ── haversine ─────────────────────────────────────────────────────────────────
// Great-circle distance between two lat/lng points in kilometres (R = 6371 km).
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return parseFloat((R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))).toFixed(2));
}

// ── buildMapsUrl ──────────────────────────────────────────────────────────────
// Constructs a Google Maps multi-stop driving route URL from a flat places array.
// Uses GPS position as origin; falls back to REF when unavailable.
function buildMapsUrl(places, uLat, uLng) {
  const valid = (places||[]).filter(p => p?.lat);
  if (!valid.length) return null;
  const origin = uLat ? `${uLat},${uLng}` : `${REF.lat},${REF.lng}`;
  const dest   = `${valid[valid.length-1].lat},${valid[valid.length-1].lng}`;
  const wps    = valid.slice(0,-1).map(p=>`${p.lat},${p.lng}`).join('|');
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${wps?`&waypoints=${wps}`:''}&travelmode=driving`;
}

// ── TRANSPORT Mode Definitions ────────────────────────────────────────────────
// Note: icon field is a string key (looked up in ICONS map below), not an emoji.
const TRANSPORT = [
  { mode:'car',   label:'Car / Taxi', icon:'Car',   speedKmh:25, base:100, perKm:50,  apps:['PickMe','Uber'] },
  { mode:'tuk',   label:'Tuk-tuk',    icon:'Tuk',   speedKmh:20, base:60,  perKm:40,  apps:['PickMe'] },
  { mode:'bus',   label:'City Bus',   icon:'Bus',   speedKmh:15, base:15,  perKm:3,   apps:[] },
  { mode:'train', label:'Train',      icon:'Train', speedKmh:30, base:10,  perKm:2,   apps:[] },
  { mode:'walk',  label:'Walking',    icon:'Walk',  speedKmh:5,  base:0,   perKm:0,   apps:[] },
];

// ── ICONS Map ─────────────────────────────────────────────────────────────────
// Maps TRANSPORT icon string keys to emoji characters for rendering.
const ICONS = { Car:'🚗', Tuk:'🛺', Bus:'🚌', Train:'🚂', Walk:'🚶' };

export default function BookingDetailPage() {
  // ── Route Params + Context ────────────────────────────────────────────────
  const { id } = useParams();  // MongoDB _id of the booking from URL
  const nav = useNavigate();

  // ── State ─────────────────────────────────────────────────────────────────
  const [booking, setBooking] = useState(null);    // Full booking document from server
  const [loading, setLoading] = useState(true);    // Initial fetch loading flag
  const [userLoc, setUserLoc] = useState(null);    // GPS position {lat, lng} or null

  // ── Fetch Booking + GPS on Mount ─────────────────────────────────────────
  // Fetches the fully-populated booking. GPS is requested separately (non-blocking).
  useEffect(() => {
    bookingAPI.getOne(id).then(({ data }) => setBooking(data.booking)).finally(() => setLoading(false));
    // Request GPS; falls back to REF on denial (not an error state)
    navigator.geolocation?.getCurrentPosition(
      p => setUserLoc({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setUserLoc(REF)
    );
  }, [id]);

  // ── Loading + Not Found States ────────────────────────────────────────────
  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (!booking) return (
    <div className="container" style={{ padding:'4rem 0', textAlign:'center' }}>
      <h2>Booking not found</h2>
      <Link to="/bookings" className="btn btn-gold" style={{ marginTop:'1rem' }}>My Bookings</Link>
    </div>
  );

  // ── Booking Type Flags ────────────────────────────────────────────────────
  const isPackage = booking.bookingType === 'package';
  const isPlanBkg = booking.bookingType === 'plan';
  const isCartBkg = booking.bookingType === 'cart';

  // ── Place Extraction ──────────────────────────────────────────────────────
  // Builds a flat array of Place documents for the stops list and map routing.
  let places = [];
  if (isPackage) {
    // Package: places are a flat array directly on the package document
    places = booking.package?.places || [];
  } else if (isPlanBkg) {
    // Plan: stop items sorted by order, then extract the nested .place document
    places = (booking.plan?.places || []).sort((a,b) => a.order - b.order).map(s => s.place).filter(Boolean);
  } else if (isCartBkg) {
    // Cart: collect all places from every cart item's package or plan
    (booking.cartItems || []).forEach(ci => {
      if (ci.package?.places?.length) {
        places.push(...ci.package.places);
      } else if (ci.plan?.places?.length) {
        places.push(...(ci.plan.places).sort((a,b)=>a.order-b.order).map(s=>s.place).filter(Boolean));
      }
    });
  }

  // ── Distance + Route Calculation ─────────────────────────────────────────
  const mapsUrl = buildMapsUrl(places, userLoc?.lat, userLoc?.lng);

  // totalDist: user→first stop + sum of consecutive stop-to-stop distances
  let totalDist = 0;
  if (userLoc && places[0]?.lat) totalDist += haversine(userLoc.lat, userLoc.lng, places[0].lat, places[0].lng);
  for (let i = 0; i < places.length - 1; i++) {
    if (places[i]?.lat && places[i+1]?.lat) totalDist += haversine(places[i].lat, places[i].lng, places[i+1].lat, places[i+1].lng);
  }
  totalDist = parseFloat(totalDist.toFixed(1));

  // ── Transport Estimates ───────────────────────────────────────────────────
  // Derive mins and cost for each mode based on totalDist
  const transport = TRANSPORT.map(m => {
    const mins = Math.round((totalDist / m.speedKmh) * 60);
    const cost = m.perKm === 0 ? 0 : Math.round(m.base + totalDist * m.perKm);
    return { ...m, mins, cost };
  });

  // ── Status Badge Color Map ────────────────────────────────────────────────
  const STATUS_COLOR = { confirmed:'teal', pending:'gold', cancelled:'coral', completed:'blue' };

  // ── handleCompletePayment ─────────────────────────────────────────────────
  // Resumes a pending booking by navigating to /payment at step 2.
  // Passes existingBooking so PaymentPage skips booking creation (step 1).
  const handleCompletePayment = () => {
    nav('/payment', {
      state: {
        mode: booking.bookingType || 'package',
        existingBooking: booking,           // Triggers step=2 on mount in PaymentPage
        pkg:       booking.package  || undefined,
        packageId: booking.package?._id,
        plan:      booking.plan     || undefined,
        planId:    booking.plan?._id,
      }
    });
  };

  // ── PDF Data Builders ─────────────────────────────────────────────────────
  // Normalise booking data into the shape exportPlanToPDF() expects for each booking type.

  // Plan booking: pass sorted places array directly (already in {place, visitTime, ...} shape)
  const planForPDF = isPlanBkg && booking.plan ? {
    name: booking.plan.name,
    places: (booking.plan.places || []).sort((a,b) => a.order - b.order),
    estimatedTotalCost: booking.plan.estimatedTotalCost,
  } : null;

  // Package booking: wrap flat place docs into the {place, visitTime, duration, notes} shape
  const packageForPDF = isPackage && booking.package && places.length > 0 ? {
    name: booking.package.name,
    places: places.map(p => ({ place: p, visitTime: p.openingTime || '', duration: p.estimatedDuration || '', notes: '' })),
    estimatedTotalCost: null,  // Packages don't have a per-place cost breakdown
  } : null;

  // Cart booking: collect all places already in the `places` flat array
  const cartForPDF = isCartBkg && places.length > 0 ? {
    name: `Cart Booking – ${new Date(booking.visitDate).toLocaleDateString('en-GB')}`,
    places: places.map(p => ({ place: p, visitTime: p.openingTime || '', duration: p.estimatedDuration || '', notes: '' })),
    estimatedTotalCost: booking.totalAmount,
  } : null;

  return (
    <div className={styles.page}>
      <div className="container">
        {/* ── Breadcrumb ────────────────────────────────────────── */}
        <div style={{ marginBottom:'1rem' }}>
          <Link to="/bookings" style={{ fontSize:'0.85rem', color:'var(--gold3)' }}>← My Bookings</Link>
        </div>

        {/* ── Two-Column Layout ─────────────────────────────────── */}
        <div className={styles.layout}>

          {/* ══════════════════════════════════════════════════════
              LEFT COLUMN
          ════════════════════════════════════════════════════════ */}
          <div className={styles.left}>

            {/* ── Booking Header Card ──────────────────────────── */}
            {/* Reference number, badges, amount, and key details grid */}
            <div className="card" style={{ marginBottom:'1rem' }}>
              <div className={styles.bookingHd}>
                <div>
                  {/* Booking reference label + value */}
                  <div style={{ fontSize:'0.72rem', color:'var(--txt3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'4px' }}>Booking Reference</div>
                  <div className={styles.bookingRef}>{booking.bookingRef}</div>
                  {/* Badge row: status + booking type + paid indicator */}
                  <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', marginTop:'0.65rem' }}>
                    <span className={`badge badge-${STATUS_COLOR[booking.status] || 'gold'}`}>{booking.status}</span>
                    {isPackage && <span className="badge badge-gold">📦 Package</span>}
                    {isPlanBkg && <span className="badge badge-blue">🗓️ Day Plan</span>}
                    {isCartBkg && <span className="badge badge-gold">🛒 Cart</span>}
                    {booking.isPaid && <span className="badge badge-teal">✓ Paid</span>}
                  </div>
                </div>
                {/* Total amount — right-aligned in large Cormorant Garamond */}
                <div className={styles.bookingAmount}>
                  <div style={{ fontSize:'0.72rem', color:'var(--txt3)', marginBottom:'4px' }}>Amount</div>
                  <div style={{ fontFamily:'Cormorant Garamond', fontSize:'1.6rem', fontWeight:700, color:'var(--gold)' }}>LKR {booking.totalAmount?.toLocaleString()}</div>
                </div>
              </div>

              {/* ── Booking Info Grid ────────────────────────── */}
              {/* 4 labelled info boxes: name, visit date, guests, booked on date */}
              <div className={styles.infoGrid}>
                <div className={styles.infoBox}>
                  <div className={styles.infoL}>Package / Plan</div>
                  <div className={styles.infoV}>
                    {/* Cart: show item count; Package/Plan: show name */}
                    {isCartBkg
                      ? `${booking.cartItems?.length || 0} item${booking.cartItems?.length !== 1 ? 's' : ''} (cart)`
                      : booking.package?.name || booking.plan?.name || '-'}
                  </div>
                </div>
                <div className={styles.infoBox}><div className={styles.infoL}>Visit Date</div><div className={styles.infoV}>{new Date(booking.visitDate).toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div></div>
                <div className={styles.infoBox}><div className={styles.infoL}>Guests</div><div className={styles.infoV}>{booking.adults} adult{booking.adults>1?'s':''}{booking.children>0?`, ${booking.children} child${booking.children>1?'ren':''}`:''}</div></div>
                <div className={styles.infoBox}><div className={styles.infoL}>Booked On</div><div className={styles.infoV}>{new Date(booking.createdAt || booking.bookingDate).toLocaleDateString('en-GB')}</div></div>
              </div>
            </div>

            {/* ── Trip Stops Card ──────────────────────────────── */}
            {/* Numbered list of all places in the booking with thumbnails */}
            {places.length > 0 && (
              <div className="card" style={{ marginBottom:'1rem' }}>
                <h3 className={styles.sectionTitle}>Trip Stops</h3>
                <div className={styles.stopList}>
                  {places.map((place, i) => (
                    <div key={place?._id || i}>
                      {/* ── Individual Stop Row ──────────────── */}
                      <div className={styles.stop}>
                        {/* Sequential number indicator */}
                        <div className={styles.stopNum}>{i + 1}</div>
                        {/* Place thumbnail */}
                        {place?.coverImage && <div className={styles.stopImg}><img src={place.coverImage} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'var(--radius)' }} /></div>}
                        {/* Place name + meta (opening time, distance, duration) */}
                        <div className={styles.stopInfo}>
                          <div className={styles.stopName}>{place?.name || 'Place'}</div>
                          <div className={styles.stopMeta}>
                            {place?.openingTime && <span>🕐 {place.openingTime}–{place.closingTime}</span>}
                            {place?.distanceFromReference && <span>📍 {place.distanceFromReference} km from ref.</span>}
                            {place?.estimatedDuration && <span>⏱ {place.estimatedDuration}</span>}
                          </div>
                        </div>
                        {/* View place detail link (only when slug exists) */}
                        {place?.slug && <Link to={`/place/${place.slug}`} className="btn btn-ghost btn-sm" style={{ flexShrink:0 }}>View</Link>}
                      </div>
                      {/* Travel connector between consecutive stops */}
                      {i < places.length - 1 && <div style={{ textAlign:'center', color:'var(--txt4)', fontSize:'0.8rem', padding:'0.2rem 0 0.2rem 40px' }}>↓ travel to next stop</div>}
                    </div>
                  ))}
                </div>
                {/* Trip summary row: stop count, distance, estimated time */}
                <div className={styles.tripSummary}>
                  <div className={styles.summaryItem}><span className={styles.sLabel}>Stops</span><span className={styles.sVal}>{places.length}</span></div>
                  <div className={styles.summaryItem}><span className={styles.sLabel}>Est. Distance</span><span className={styles.sVal}>{totalDist} km</span></div>
                  <div className={styles.summaryItem}><span className={styles.sLabel}>Est. Time</span><span className={styles.sVal}>~{(places.length * 1.5).toFixed(1)} hrs</span></div>
                </div>
              </div>
            )}

            {/* ── Cart Order Summary Card ──────────────────────── */}
            {/* Compact per-item order summary shown only for cart bookings */}
            {isCartBkg && booking.cartItems?.length > 0 && (
              <div className="card" style={{ marginBottom:'1rem', padding:'0.85rem 1.1rem' }}>
                <div style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--txt4)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'0.6rem' }}>Order Summary</div>
                {booking.cartItems.map((ci, i) => (
                  <div key={ci._id || i} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.45rem 0', borderBottom: i < booking.cartItems.length - 1 ? '1px solid var(--brd)' : 'none' }}>
                    {/* Cart item thumbnail (package cover only) */}
                    {ci.package?.coverImage && (
                      <div style={{ width:44, height:38, borderRadius:'var(--radius)', overflow:'hidden', flexShrink:0 }}>
                        <img src={ci.package.coverImage} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      </div>
                    )}
                    <div style={{ flex:1 }}>
                      {/* Cart item name */}
                      <div style={{ fontSize:'0.85rem', fontWeight:600, color:'var(--txt)' }}>{ci.name || ci.package?.name || ci.plan?.name || 'Item'}</div>
                      {/* Guest counts + per-adult rate */}
                      <div style={{ fontSize:'0.74rem', color:'var(--txt3)' }}>
                        👥 {ci.adults} adult{ci.adults > 1 ? 's' : ''}{ci.children > 0 ? ` · ${ci.children} child${ci.children > 1 ? 'ren' : ''}` : ''}
                        {ci.price > 0 && <span style={{ marginLeft:'0.5rem' }}>· LKR {ci.price.toLocaleString()} / adult</span>}
                      </div>
                    </div>
                    {/* Per-item total (price × adults + price × 0.5 × children) */}
                    <div style={{ fontFamily:'Cormorant Garamond', fontSize:'1rem', color:'var(--gold)', fontWeight:700, flexShrink:0 }}>
                      LKR {Math.round(ci.price * (ci.adults + ci.children * 0.5)).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Travel Options Card (paid only) ──────────────── */}
            {/* Only shown for paid bookings with calculable distance */}
            {booking.isPaid && totalDist > 0 && (
              <div className="card" style={{ marginBottom:'1rem' }}>
                <h3 className={styles.sectionTitle}>Travel Options</h3>
                <p style={{ fontSize:'0.82rem', color:'var(--txt3)', marginBottom:'1rem' }}>Estimated for {totalDist} km total trip distance.</p>
                {/* Grid of 5 transport mode cards with icon, label, time, cost */}
                <div className={styles.modeGrid}>
                  {transport.map(m => (
                    <div key={m.mode} className={styles.modeCard}>
                      {/* Emoji icon via ICONS map (icon field is a string key) */}
                      <div className={styles.modeIcon}>{ICONS[m.icon]}</div>
                      <div className={styles.modeLabel}>{m.label}</div>
                      {/* Duration: "X min" or "Xh Ym" for trips over 60 minutes */}
                      <div className={styles.modeDur}>{m.mins < 60 ? `${m.mins} min` : `${Math.floor(m.mins/60)}h ${m.mins%60}m`}</div>
                      {/* Cost: "Free" for walking, otherwise LKR estimate */}
                      <div className={styles.modeCost}>{m.cost === 0 ? 'Free' : `LKR ${m.cost.toLocaleString()}`}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Navigation Card OR Awaiting Payment ──────────── */}
            {/* Paid: full navigation actions | Unpaid: locked with Complete Payment CTA */}
            {booking.isPaid ? (
              // ── Navigation & Ride Booking Card (paid) ───────────
              <div className="card">
                <h3 className={styles.sectionTitle}>Navigation & Ride Booking</h3>
                <div className={styles.actionGrid}>
                  {/* Full multi-stop route in Google Maps */}
                  {mapsUrl && <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-teal">🗺️ Open Full Route in Google Maps</a>}
                  {/* PDF export — uses the appropriate builder for this booking type */}
                  {isPlanBkg    && planForPDF    && <button className="btn btn-gold" onClick={() => exportPlanToPDF(planForPDF, booking)}>📄 Export PDF Itinerary</button>}
                  {isPackage    && packageForPDF && <button className="btn btn-gold" onClick={() => exportPlanToPDF(packageForPDF, booking)}>📄 Export PDF Itinerary</button>}
                  {isCartBkg    && cartForPDF    && <button className="btn btn-gold" onClick={() => exportPlanToPDF(cartForPDF, booking)}>📄 Export PDF Itinerary</button>}
                  {/* Directions to just the first stop */}
                  {places[0]?.lat && userLoc && (
                    <a href={`https://www.google.com/maps/dir/?api=1&origin=${userLoc.lat},${userLoc.lng}&destination=${places[0].lat},${places[0].lng}&travelmode=driving`}
                      target="_blank" rel="noopener noreferrer" className="btn btn-outline">📍 Directions to First Stop</a>
                  )}
                  {/* Ride-hailing quick links */}
                  <a href="https://pickme.lk" target="_blank" rel="noopener noreferrer" className="btn btn-ghost">🛺 Book via PickMe</a>
                  <a href="https://www.uber.com/global/en/cities/colombo" target="_blank" rel="noopener noreferrer" className="btn btn-ghost">🚗 Book via Uber</a>
                </div>
              </div>
            ) : (
              // ── Awaiting Payment Card (unpaid) ───────────────────
              // Locked state shown for pending bookings.
              // "Complete Payment →" resumes the booking at PaymentPage step 2.
              <div className="card" style={{ textAlign:'center', padding:'1.5rem', background:'rgba(201,168,76,0.05)', border:'1px solid rgba(201,168,76,0.2)' }}>
                <div style={{ fontSize:'1.75rem', marginBottom:'0.5rem' }}>🔒</div>
                <div style={{ fontFamily:'Cormorant Garamond', fontSize:'1.1rem', color:'var(--gold2)', marginBottom:'0.5rem' }}>Awaiting Payment</div>
                <p style={{ fontSize:'0.82rem', color:'var(--txt3)', marginBottom:'1rem' }}>Complete payment to unlock routes, maps, and navigation.</p>
                <button className="btn btn-gold btn-lg" style={{ width:'100%' }} onClick={handleCompletePayment}>
                  Complete Payment →
                </button>
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════════════════════
              RIGHT SIDEBAR
          ════════════════════════════════════════════════════════ */}
          <div className={styles.right}>
            {/* ── Payment Details Card ─────────────────────────── */}
            {/* Key payment fields: amount, status, reference, type, date */}
            <div className="card" style={{ marginBottom:'1rem' }}>
              <h3 className={styles.sectionTitle}>Payment Details</h3>
              {[
                { l:'Amount',         v: `LKR ${booking.totalAmount?.toLocaleString()}` },
                { l:'Payment Status', v: booking.isPaid ? '✓ Paid' : 'Pending' },
                { l:'Booking Ref',    v: booking.bookingRef },
                { l:'Booking Type',   v: booking.bookingType || 'package' },
                { l:'Date Booked',    v: new Date(booking.createdAt || booking.bookingDate).toLocaleDateString('en-GB') },
              ].map(r => (
                <div key={r.l} style={{ display:'flex', justifyContent:'space-between', padding:'0.55rem 0', borderBottom:'1px solid var(--brd)', fontSize:'0.82rem' }}>
                  <span style={{ color:'var(--txt3)' }}>{r.l}</span>
                  <span style={{ color:'var(--txt)', fontWeight:600 }}>{r.v}</span>
                </div>
              ))}
            </div>

            {/* ── Special Requests Card ────────────────────────── */}
            {/* Left gold border visually distinguishes this from regular cards */}
            {booking.notes && (
              <div className="card" style={{ marginBottom:'1rem', borderLeft:'2px solid var(--gold)', borderRadius:'0 var(--radius-lg) var(--radius-lg) 0' }}>
                <div style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--gold3)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'0.5rem' }}>Special Requests</div>
                <p style={{ fontSize:'0.85rem', color:'var(--txt2)', lineHeight:'1.6' }}>{booking.notes}</p>
              </div>
            )}

            {/* ── Travel Tips Card ────────────────────────────── */}
            {/* Gold-tinted card with 4 practical pre-trip tips */}
            <div className="card" style={{ background:'var(--gold5)', borderColor:'rgba(201,168,76,0.2)' }}>
              <div style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--gold3)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'0.75rem' }}>Travel Tips</div>
              {['Arrive at your first stop 10–15 minutes early.','Carry cash - smaller attractions may not accept cards.','Keep your booking reference handy.','Enable GPS for best navigation accuracy.'].map((tip,i) => (
                <div key={i} style={{ fontSize:'0.8rem', color:'var(--txt2)', padding:'3px 0', display:'flex', gap:'0.5rem' }}>
                  <span style={{ color:'var(--gold)', flexShrink:0 }}>→</span>{tip}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
