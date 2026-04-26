/**
 * pages/user/PlanDetailPage.jsx — Individual Plan Detail View
 *
 * Shows the full detail of a single saved plan identified by :id (MongoDB _id).
 * Fetches the plan and the user's bookings in parallel on mount, then determines
 * whether this plan has been paid (the "payment gate").
 *
 * Reference location (REF):
 *  38 Rajasinghe Road, Dehiwala — used as the Google Maps origin fallback
 *  when the user's GPS position is not available.
 *
 * buildMapsUrl(items, uLat, uLng):
 *  Builds a Google Maps multi-stop driving route URL.
 *  - origin: GPS position if available, otherwise REF
 *  - destination: last place's lat,lng
 *  - waypoints: all intermediate places (pipe-separated lat,lng pairs)
 *  - Returns null if no places with valid coordinates exist.
 *  Note: this version takes raw plan stop items (sorted array of {place, ...})
 *  rather than raw place objects; it maps to item.place internally.
 *
 * isPaid / paidBooking:
 *  A booking is considered "paid" when:
 *   1. The booking's .plan._id or .plan (raw ObjectId) matches the current plan's _id
 *   2. The booking's isPaid flag is true
 *   3. The booking's status is 'confirmed'
 *  paidBooking holds the matching booking document (for the link to View Booking Details).
 *
 * Payment gate layout:
 *  isPaid=true:  Full unlocked actions card
 *    - Google Maps route link (when mapsUrl is non-null)
 *    - Export PDF Itinerary button (calls exportPlanToPDF)
 *    - Open Live Map link → /map
 *    - PickMe / Uber ride-hailing links
 *    - View Booking Details link → /bookings/:id
 *    - Edit Plan link, Delete Plan button
 *  isPaid=false: Locked state card + limited actions
 *    - 🔒 "Premium Features Locked" card with CTA → /payment
 *    - Available Actions: Edit Plan, Delete Plan
 *
 * Planning fee display (Trip Summary sidebar):
 *  Shows a dashed gold info box explaining: LKR 2,000/adult, LKR 1,000/child.
 *  This is purely informational — payment happens on the /payment page.
 *
 * del():
 *  Uses native confirm() for safety. Calls planAPI.delete(id) then navigates
 *  to /plans after a success toast.
 *
 * GPS location:
 *  navigator.geolocation.getCurrentPosition() called on mount.
 *  Populates userLoc state; used as buildMapsUrl origin if available.
 *  If geolocation is denied or unavailable, buildMapsUrl falls back to REF.
 *
 * Data shape after fetch:
 *  plan.places → array of {_id, place, order, visitTime, duration, notes}
 *  sorted = plan.places sorted ascending by .order
 *  totalCost = sum of sorted[].place.tickets.localAdult (estimate only)
 */

import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { planAPI, bookingAPI } from '../../services/api';
import { exportPlanToPDF } from '../../utils/pdfExport';
import { useToast } from '../../context/ToastContext';
import styles from './User.module.css';

// ── Reference location ────────────────────────────────────────────────────────
// 38 Rajasinghe Road, Dehiwala — used as Maps origin when GPS is unavailable
const REF = { lat: 6.868671, lng: 79.860689 };

// ── buildMapsUrl ──────────────────────────────────────────────────────────────
// Constructs a Google Maps multi-stop driving route URL from plan stop items.
// - items: sorted array of plan stop objects (each has a .place sub-object with lat/lng)
// - uLat/uLng: user's GPS coordinates (used as origin); falls back to REF if falsy
// - Returns null when no places have valid lat/lng coordinates
function buildMapsUrl(items, uLat, uLng) {
  // Extract place objects from stop items, keeping only those with a lat value
  const valid = (items || []).map(i => i.place).filter(p => p?.lat);
  if (!valid.length) return null;
  // Use GPS position as origin; fall back to reference location
  const origin = uLat ? `${uLat},${uLng}` : `${REF.lat},${REF.lng}`;
  // Last place is always the destination
  const dest   = `${valid[valid.length-1].lat},${valid[valid.length-1].lng}`;
  // All places except the last become waypoints (pipe-separated)
  const wps    = valid.slice(0,-1).map(p => `${p.lat},${p.lng}`).join('|');
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${wps ? `&waypoints=${wps}` : ''}&travelmode=driving`;
}

export default function PlanDetailPage() {
  // ── Route Params + Context ────────────────────────────────────────────────
  // id = MongoDB _id of the plan (from URL param :id)
  const { id }  = useParams();
  const nav     = useNavigate();
  const toast   = useToast();

  // ── State ─────────────────────────────────────────────────────────────────
  const [plan,     setPlan]     = useState(null);    // Full plan document with populated places
  const [bookings, setBookings] = useState([]);       // User's bookings (for paid-status check)
  const [loading,  setLoading]  = useState(true);    // Initial data fetch loading flag
  const [userLoc,  setUserLoc]  = useState(null);    // GPS position (lat/lng or null)

  // ── Parallel Data Fetch + GPS ─────────────────────────────────────────────
  // Fetches the plan and all bookings simultaneously to avoid sequential round-trips.
  // GPS is requested separately (non-blocking) as it may take time or be denied.
  useEffect(() => {
    Promise.all([planAPI.getOne(id), bookingAPI.getMy()])
      .then(([p, b]) => { setPlan(p.data.plan); setBookings(b.data.bookings); })
      .finally(() => setLoading(false));
    // Request GPS position to use as Google Maps origin (if user grants permission)
    navigator.geolocation?.getCurrentPosition(p => setUserLoc({ lat: p.coords.latitude, lng: p.coords.longitude }));
  }, [id]);

  // ── Delete Plan ───────────────────────────────────────────────────────────
  // Confirms with native dialog. Calls planAPI.delete(), shows success toast,
  // then navigates back to /plans (the saved plans list).
  const del = async () => {
    if (!confirm(`Delete "${plan.name}"?`)) return;
    await planAPI.delete(id);
    toast.success('Plan deleted');
    nav('/plans');
  };

  // ── Loading + Not Found States ────────────────────────────────────────────
  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (!plan) return (
    <div className="container" style={{ padding:'4rem 0', textAlign:'center' }}>
      <h2>Plan not found</h2>
      <Link to="/plans" className="btn btn-gold" style={{ marginTop:'1rem' }}>Back</Link>
    </div>
  );

  // ── Derived Data ──────────────────────────────────────────────────────────
  // Sort plan stops ascending by order number (1, 2, 3, ...)
  const sorted   = [...(plan.places || [])].sort((a, b) => a.order - b.order);
  // Estimated entry cost: sum of localAdult ticket prices for each stop
  const totalCost= sorted.reduce((s, p) => s + (p.place?.tickets?.localAdult || 0), 0);
  // Build Google Maps URL using GPS position (or REF fallback)
  const mapsUrl  = buildMapsUrl(sorted, userLoc?.lat, userLoc?.lng);

  // ── Payment Gate Check ────────────────────────────────────────────────────
  // A plan is "paid" when a confirmed + isPaid booking exists for this plan's _id.
  // Checks both b.plan._id (populated) and b.plan (raw ObjectId string) to handle
  // variation in Mongoose population depth.
  const paidBooking = bookings.find(b =>
    (b.plan?._id === id || b.plan === id) && b.isPaid && b.status === 'confirmed'
  );
  // Boolean shorthand used for conditional rendering throughout
  const isPaid = !!paidBooking;

  return (
    <div className={styles.page}>
      <div className="container">
        {/* ── Breadcrumb navigation ─────────────────────────── */}
        <div style={{ marginBottom:'1rem', fontSize:'0.85rem', color:'var(--txt3)' }}>
          <Link to="/plans" style={{ color:'var(--gold3)' }}>← My Plans</Link>
        </div>

        {/* ── Page Header ───────────────────────────────────────── */}
        {/* Shows plan name, date badge, status badge, stop count, paid/unpaid badge,
            and action buttons (PDF export only for paid plans, plus edit + delete) */}
        <div className={styles.planHeader}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem' }}>
            <div>
              {/* Plan title */}
              <h1 className={styles.pageTitle}>{plan.name}</h1>
              <div className={styles.goldDiv} />
              {/* Optional description */}
              {plan.description && <p style={{ color:'var(--txt2)', marginBottom:'0.75rem', fontSize:'0.9rem' }}>{plan.description}</p>}
              {/* Badge row: date | status | stop count | paid/unpaid */}
              <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
                {/* Plan date badge — shown only when planDate is set */}
                {plan.planDate && <span className="badge badge-gold">📅 {new Date(plan.planDate).toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</span>}
                {/* Status: active=teal, other=gold */}
                <span className={`badge badge-${plan.status === 'active' ? 'teal' : 'gold'}`}>{plan.status}</span>
                {/* Stop count */}
                <span className="badge badge-blue">{sorted.length} stops</span>
                {/* Paid / Unpaid access badge */}
                {isPaid
                  ? <span className="badge badge-teal">✓ Paid & Unlocked</span>
                  : <span className="badge badge-coral">🔒 Unpaid - limited access</span>
                }
              </div>
            </div>
            {/* ── Header Action Buttons ─────────────────────────── */}
            <div style={{ display:'flex', gap:'0.6rem', flexWrap:'wrap' }}>
              {/* PDF export — only shown when isPaid; passes sorted places to PDF utility */}
              {isPaid && (
                <button className="btn btn-outline btn-sm" onClick={() => exportPlanToPDF({ ...plan, places: sorted }, paidBooking || null)}>
                  📄 Export PDF
                </button>
              )}
              {/* Edit link — always available */}
              <Link to={`/plans/${id}/edit`} className="btn btn-gold btn-sm">✏️ Edit</Link>
              {/* Delete button — triggers confirm() via del() handler */}
              <button className="btn btn-danger btn-sm" onClick={del}>🗑️</button>
            </div>
          </div>
        </div>

        {/* ── Two-column layout: itinerary + actions sidebar ───── */}
        <div className={styles.planDetailLayout}>

          {/* ── Left Column: Itinerary ──────────────────────────── */}
          <div className={styles.planDetailLeft}>
            <div className="card">
              <h3 style={{ fontFamily:'Cormorant Garamond', fontSize:'1.2rem', color:'var(--txt)', marginBottom:'1.25rem' }}>Itinerary</h3>

              {sorted.length === 0 ? (
                // Empty state — plan has no stops yet
                <div className="empty-state" style={{ padding:'2rem' }}>
                  <div className="empty-state-icon">🗓️</div>
                  <h3>No stops added</h3>
                  <Link to={`/plans/${id}/edit`} className="btn btn-gold btn-sm" style={{ marginTop:'0.75rem' }}>Add Places</Link>
                </div>
              ) : (
                // List of itinerary stops in sorted order
                <div className={styles.planStopList}>
                  {sorted.map((item, i) => (
                    <div key={item._id || i}>
                      {/* ── Individual Stop Row ──────────────────── */}
                      <div className={styles.planStop}>
                        {/* Sequential step number indicator */}
                        <div className={styles.stopNum}>{i + 1}</div>
                        {/* Place thumbnail */}
                        <div className={styles.stopImg}>
                          {item.place?.coverImage && <img src={item.place.coverImage} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'var(--radius)' }} />}
                        </div>
                        {/* Stop details: name, time, duration, distance */}
                        <div className={styles.stopInfo}>
                          <div className={styles.stopName}>{item.place?.name || 'Place'}</div>
                          <div className={styles.stopMeta}>
                            {/* Visit time assigned from ARRIVAL_TIMES when plan was saved */}
                            {item.visitTime && <span>🕐 {item.visitTime}</span>}
                            {/* Estimated duration for this specific place */}
                            {item.duration   && <span style={{ marginLeft:'0.75rem' }}>⏱ {item.duration}</span>}
                            {/* Distance from reference location */}
                            {item.place?.distanceFromReference && <span style={{ marginLeft:'0.75rem' }}>📍 {item.place.distanceFromReference} km</span>}
                          </div>
                          {/* User note — shown in gold italic when present */}
                          {item.notes && <div style={{ fontSize:'0.78rem', color:'var(--gold3)', marginTop:'4px', fontStyle:'italic' }}>Note: {item.notes}</div>}
                        </div>
                        {/* View place detail link (only if slug exists for deep-linking) */}
                        {item.place?.slug && <Link to={`/place/${item.place.slug}`} className="btn btn-ghost btn-sm" style={{ flexShrink:0 }}>View</Link>}
                      </div>
                      {/* Travel time connector between consecutive stops (~30 min estimate) */}
                      {i < sorted.length - 1 && <div className={styles.stopArrow}>↓ ~30 min travel</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right Column: Actions + Summary ─────────────────── */}
          <div className={styles.planDetailRight}>

            {/* ── Trip Summary Card ─────────────────────────────── */}
            {/* Key stats and metadata about the plan */}
            <div className="card">
              <h3 style={{ fontFamily:'Cormorant Garamond', fontSize:'1.1rem', color:'var(--txt)', marginBottom:'1rem' }}>Trip Summary</h3>
              {/* Key-value summary rows: stops, duration, cost, status, dates */}
              {[
                { l:'Stops',             v: sorted.length },
                { l:'Est. Duration',     v: plan.estimatedDuration || `~${(sorted.length * 1.5).toFixed(1)} hrs` },
                { l:'Est. Entry Fee',    v: `LKR ${totalCost.toLocaleString()}` },
                { l:'Status',            v: plan.status },
                { l:'Created',           v: new Date(plan.createdAt).toLocaleDateString('en-GB') },
                { l:'Updated',           v: new Date(plan.updatedAt || plan.createdAt).toLocaleDateString('en-GB') },
              ].map(r => (
                <div key={r.l} style={{ display:'flex', justifyContent:'space-between', padding:'0.5rem 0', borderBottom:'1px solid var(--brd)', fontSize:'0.82rem' }}>
                  <span style={{ color:'var(--txt3)' }}>{r.l}</span>
                  <span style={{ color:'var(--txt)', fontWeight:600 }}>{r.v}</span>
                </div>
              ))}

              {/* ── Planning Service Fee Info Box ─────────────────── */}
              {/* Informs the user about the per-person service fee charged at booking.
                  LKR 2,000 per adult, LKR 1,000 per child (separate from entry tickets). */}
              <div style={{ marginTop:'0.75rem', padding:'0.65rem 0.75rem', background:'rgba(201,168,76,0.07)', borderRadius:'var(--radius)', border:'1px dashed rgba(201,168,76,0.3)' }}>
                <div style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--gold3)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'0.4rem' }}>Planning Fee (charged at booking)</div>
                {/* Adult service fee row */}
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.8rem', color:'var(--txt2)', padding:'2px 0' }}>
                  <span>Per adult</span>
                  <span style={{ color:'var(--gold)', fontWeight:600 }}>LKR 2,000</span>
                </div>
                {/* Child service fee row */}
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.8rem', color:'var(--txt2)', padding:'2px 0' }}>
                  <span>Per child</span>
                  <span style={{ color:'var(--gold)', fontWeight:600 }}>LKR 1,000</span>
                </div>
              </div>
            </div>

            {/* ── PAID: Full Feature Actions Card ──────────────── */}
            {/* Shown when isPaid=true — all premium features are unlocked */}
            {isPaid ? (
              <div className="card">
                <h3 style={{ fontFamily:'Cormorant Garamond', fontSize:'1.1rem', color:'var(--txt)', marginBottom:'1rem' }}>
                  ✓ Paid Plan - All Features Unlocked
                </h3>
                <div style={{ display:'flex', flexDirection:'column', gap:'0.65rem' }}>
                  {/* Google Maps full multi-stop route (only when coordinates exist) */}
                  {mapsUrl && (
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-teal btn-block" style={{ justifyContent:'center' }}>
                      🗺️ Open Full Route in Google Maps
                    </a>
                  )}
                  {/* PDF export — passes sorted plan with booking doc to jsPDF utility */}
                  <button className="btn btn-gold btn-block" onClick={() => exportPlanToPDF({ ...plan, places: sorted }, paidBooking || null)} style={{ justifyContent:'center' }}>
                    📄 Export PDF Itinerary
                  </button>
                  {/* Live map link for real-time place browsing */}
                  <Link to="/map" className="btn btn-outline btn-block" style={{ justifyContent:'center' }}>
                    🗺️ Open Live Map
                  </Link>
                  {/* Ride-hailing quick links */}
                  <div style={{ display:'flex', gap:'0.5rem', paddingTop:'0.5rem', borderTop:'1px solid var(--brd)' }}>
                    <a href="https://pickme.lk" target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ flex:1, justifyContent:'center' }}>🛺 PickMe</a>
                    <a href="https://www.uber.com/global/en/cities/colombo" target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ flex:1, justifyContent:'center' }}>🚗 Uber</a>
                  </div>
                  {/* Link to the specific paid booking's detail page */}
                  {paidBooking && (
                    <Link to={`/bookings/${paidBooking._id}`} className="btn btn-ghost btn-block" style={{ justifyContent:'center' }}>
                      View Booking Details
                    </Link>
                  )}
                  {/* Edit plan link */}
                  <Link to={`/plans/${id}/edit`} className="btn btn-ghost btn-block" style={{ justifyContent:'center' }}>✏️ Edit Plan</Link>
                  {/* Delete plan — triggers confirm() modal */}
                  <button className="btn btn-danger btn-block" onClick={del} style={{ justifyContent:'center', marginTop:'0.25rem' }}>🗑️ Delete Plan</button>
                </div>
              </div>
            ) : (
              /* ── UNPAID: Locked State ────────────────────────── */
              /* Two cards for unpaid plans:
                 1. Gold-bordered "Premium Features Locked" card with Book CTA
                 2. "Available Actions" card with edit/delete only */
              <>
                {/* ── Premium Features Locked Card ──────────────── */}
                {/* Explains what features will be unlocked after payment.
                    CTA navigates to /payment with mode='plan' context. */}
                <div className="card" style={{ background:'rgba(201,168,76,0.05)', border:'1px solid rgba(201,168,76,0.25)' }}>
                  <div style={{ textAlign:'center', padding:'0.5rem 0 0.25rem' }}>
                    {/* Lock icon */}
                    <div style={{ fontSize:'2rem', marginBottom:'0.5rem' }}>🔒</div>
                    <h3 style={{ fontFamily:'Cormorant Garamond', fontSize:'1.1rem', color:'var(--gold2)', marginBottom:'0.5rem' }}>
                      Premium Features Locked
                    </h3>
                    {/* Explanation of what booking unlocks */}
                    <p style={{ fontSize:'0.82rem', color:'var(--txt3)', lineHeight:'1.6', marginBottom:'1rem' }}>
                      Book and pay for this plan to unlock Export PDF, Google Maps Route, Live Navigation, and Transport Suggestions.
                    </p>
                    {/* Book This Plan CTA → navigates to /payment with plan context */}
                    <button
                      className="btn btn-gold btn-block"
                      style={{ justifyContent:'center' }}
                      onClick={() => nav('/payment', { state: { mode:'plan', planId: plan._id, plan } })}
                    >
                      Book This Plan to Unlock
                    </button>
                  </div>
                </div>

                {/* ── Available Actions Card (unpaid) ───────────── */}
                {/* Only edit and delete are available without payment */}
                <div className="card">
                  <h3 style={{ fontFamily:'Cormorant Garamond', fontSize:'1.1rem', color:'var(--txt)', marginBottom:'1rem' }}>Available Actions</h3>
                  <div style={{ display:'flex', flexDirection:'column', gap:'0.65rem' }}>
                    <Link to={`/plans/${id}/edit`} className="btn btn-outline btn-block" style={{ justifyContent:'center' }}>✏️ Edit Plan</Link>
                    <button className="btn btn-danger btn-block" onClick={del} style={{ justifyContent:'center' }}>🗑️ Delete Plan</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
