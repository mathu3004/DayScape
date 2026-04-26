/**
 * pages/user/SavedPlansPage.jsx — My Saved Plans
 *
 * Lists all of the user's saved trip plans in a 2-column grid. For each plan,
 * shows: name, date badge, status badge, stop count, paid/unpaid badge,
 * description, stop previews, estimated duration/cost, a payment gate block
 * (if unpaid), and action buttons.
 *
 * Data fetched in parallel on mount:
 *  planAPI.getMyPlans()  — all plans (populated with places + place data)
 *  bookingAPI.getMy()    — all bookings (to check paid status for each plan)
 *
 * isPlanPaid(planId):
 *  Returns the booking document if the plan has a confirmed + isPaid booking.
 *  Used to determine whether premium features (PDF, Maps route) are unlocked.
 *
 * Payment gate:
 *  Unpaid plans display a gold-bordered card with a "Book This Plan to Unlock"
 *  button. Paid plans show the Google Maps route link instead.
 *
 * buildMapsUrl(plan):
 *  Constructs a Google Maps multi-stop route URL from the plan's places sorted
 *  by order. The first place is the origin and the last is the destination.
 *  Intermediate places are passed as waypoints (pipe-separated lat,lng pairs).
 *  Returns null if no places with valid coordinates exist.
 *
 * bookPlan(plan):
 *  Navigates to /payment with state: { mode: 'plan', planId, plan }
 *  PaymentPage reads this state to set up a plan booking.
 *
 * deletePlan(id, name):
 *  Uses native confirm() dialog for safety. Removes from local state on success.
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { planAPI, bookingAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import styles from './User.module.css';

export default function SavedPlansPage() {
  // ── State ─────────────────────────────────────────────────────────────────
  const [plans, setPlans]       = useState([]);  // User's saved plans
  const [bookings, setBookings] = useState([]);  // Bookings (for paid-status check)
  const [loading, setLoading]   = useState(true);
  const toast   = useToast();
  const nav     = useNavigate();

  // ── Fetch Plans + Bookings in Parallel ───────────────────────────────────
  useEffect(() => {
    Promise.all([planAPI.getMyPlans(), bookingAPI.getMy()])
      .then(([p, b]) => { setPlans(p.data.plans); setBookings(b.data.bookings); })
      .finally(() => setLoading(false));
  }, []);

  // ── Check if a Plan Has Been Paid ─────────────────────────────────────────
  // Returns the booking if there exists a confirmed + isPaid booking for this planId.
  // Both plan._id and plan (raw ObjectId string) are checked to handle population variance.
  const isPlanPaid = (planId) =>
    bookings.some(b => b.plan?._id === planId || b.plan === planId) &&
    bookings.find(b => (b.plan?._id === planId || b.plan === planId) && b.isPaid && b.status === 'confirmed');

  // ── Delete Plan ───────────────────────────────────────────────────────────
  // Shows confirm dialog with plan name. On confirm: calls planAPI.delete(id)
  // and filters the plan out of local state for immediate UI update.
  const deletePlan = async (id, name) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await planAPI.delete(id);
    setPlans(prev => prev.filter(p => p._id !== id));
    toast.success('Plan deleted');
  };

  // ── Book Plan ─────────────────────────────────────────────────────────────
  // Navigates to the shared /payment route with plan booking context.
  // PaymentPage reads state.mode === 'plan' to display the planner service fee breakdown.
  const bookPlan = (plan) => {
    nav('/payment', { state: { mode: 'plan', planId: plan._id, plan } });
  };

  // ── Build Google Maps Multi-Stop Route URL ────────────────────────────────
  // Only available for paid plans. Builds a URL with:
  //  origin      = first place's lat,lng
  //  destination = last place's lat,lng
  //  waypoints   = intermediate places joined with '|'
  // Returns null when no places with valid coordinates exist.
  const buildMapsUrl = (plan) => {
    const sorted = [...(plan.places || [])].sort((a,b) => a.order - b.order);
    const places  = sorted.map(s => s.place).filter(p => p?.lat);
    if (!places.length) return null;
    const origin = `${places[0].lat},${places[0].lng}`;
    const dest   = `${places[places.length-1].lat},${places[places.length-1].lng}`;
    // Waypoints are all places except the last (already the destination)
    const wps    = places.slice(0,-1).map(p => `${p.lat},${p.lng}`).join('|');
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${wps ? `&waypoints=${wps}` : ''}&travelmode=driving`;
  };

  return (
    <div className={styles.page}>
      <div className="container">
        {/* ── Page Header ───────────────────────────────────────── */}
        <div className={styles.welcome}>
          <div>
            <h1 className={styles.pageTitle}>My Saved Plans</h1>
            <div className={styles.goldDiv} />
            {/* Dynamic plan count */}
            <p style={{ color:'var(--txt3)', fontSize:'0.875rem' }}>{plans.length} saved plan{plans.length !== 1 ? 's' : ''}</p>
          </div>
          <Link to="/planner" className="btn btn-gold">+ Create New Plan</Link>
        </div>

        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : plans.length === 0 ? (
          // Empty state — prompt to use the Trip Planner
          <div className="empty-state" style={{ paddingTop:'3rem' }}>
            <div className="empty-state-icon">🗓️</div>
            <h3>No saved plans yet</h3>
            <p>Use the Trip Planner to build your first Colombo day itinerary</p>
            <Link to="/planner" className="btn btn-gold" style={{ marginTop:'1.25rem' }}>Open Trip Planner</Link>
          </div>
        ) : (
          // 2-column grid of plan cards
          <div className="grid-2">
            {plans.map(plan => {
              // Check paid status and build maps URL (null for unpaid plans)
              const paid = isPlanPaid(plan._id);
              const mapsUrl = paid ? buildMapsUrl(plan) : null;
              // Estimated entry cost: sum of localAdult prices for each stop
              const totalCost = plan.places?.reduce((s,p) => s + (p.place?.tickets?.localAdult || 0), 0) || 0;

              return (
                <div key={plan._id} className="card" style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
                  {/* ── Plan Card Header ───────────────────────── */}
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'0.75rem' }}>
                    <div style={{ flex:1 }}>
                      {/* Plan name headline */}
                      <h3 style={{ fontFamily:'Cormorant Garamond', fontSize:'1.2rem', color:'var(--txt)', marginBottom:'3px' }}>{plan.name}</h3>
                      {/* Status badges row */}
                      <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', marginTop:'4px' }}>
                        {/* Date badge — only shown when planDate is set */}
                        {plan.planDate && <span className="badge badge-gold">📅 {new Date(plan.planDate).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</span>}
                        {/* Active vs. other status */}
                        <span className={`badge badge-${plan.status === 'active' ? 'teal' : 'gold'}`}>{plan.status}</span>
                        {/* Stop count */}
                        <span className="badge badge-blue">{plan.places?.length || 0} stops</span>
                        {/* Paid/unlocked or locked badge */}
                        {paid
                          ? <span className="badge badge-teal">✓ Paid & Unlocked</span>
                          : <span className="badge badge-coral">🔒 Unpaid</span>
                        }
                      </div>
                    </div>
                  </div>

                  {/* Optional plan description */}
                  {plan.description && <p style={{ fontSize:'0.82rem', color:'var(--txt3)', lineHeight:'1.55' }}>{plan.description}</p>}

                  {/* ── Stop Previews ─────────────────────────── */}
                  {/* Shows up to 5 place name badges; "+N more" for the rest */}
                  {plan.places?.length > 0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
                      {[...plan.places].sort((a,b)=>a.order-b.order).slice(0,5).map(item => (
                        <span key={item._id} className="badge badge-blue" style={{ fontSize:'0.68rem' }}>{item.place?.name || 'Place'}</span>
                      ))}
                      {/* Overflow count badge */}
                      {plan.places.length > 5 && <span className="badge badge-blue" style={{ fontSize:'0.68rem' }}>+{plan.places.length - 5} more</span>}
                    </div>
                  )}

                  {/* ── Trip Summary Row ──────────────────────── */}
                  <div style={{ display:'flex', gap:'1rem', fontSize:'0.8rem', color:'var(--txt3)', flexWrap:'wrap' }}>
                    {plan.estimatedDuration && <span>⏱ {plan.estimatedDuration}</span>}
                    {totalCost > 0 && <span>💰 LKR {totalCost.toLocaleString()} est.</span>}
                  </div>

                  {/* ── PAYMENT GATE (unpaid plans) ────────────── */}
                  {/* Shown for plans that haven't been booked + paid yet.
                      Explains what premium features will be unlocked after payment. */}
                  {!paid && (
                    <div style={{ background:'rgba(201,168,76,0.06)', border:'1px solid rgba(201,168,76,0.2)', borderRadius:'var(--radius)', padding:'0.85rem 1rem' }}>
                      <div style={{ fontSize:'0.82rem', color:'var(--gold2)', fontWeight:600, marginBottom:'0.35rem' }}>🔒 Premium Features Locked</div>
                      <div style={{ fontSize:'0.78rem', color:'var(--txt3)', marginBottom:'0.75rem' }}>
                        Book and pay for this plan to unlock: Export PDF, Route Access, Google Maps navigation, and Live Transport Suggestions.
                      </div>
                      <button className="btn btn-gold btn-sm" onClick={() => bookPlan(plan)}>
                        Book This Plan to Unlock
                      </button>
                    </div>
                  )}

                  {/* ── Action Buttons ────────────────────────── */}
                  <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', borderTop:'1px solid var(--brd)', paddingTop:'0.75rem' }}>
                    {/* View detail page */}
                    <Link to={`/plans/${plan._id}`} className="btn btn-gold btn-sm">View</Link>
                    {/* Edit plan */}
                    <Link to={`/plans/${plan._id}/edit`} className="btn btn-outline btn-sm">✏️ Edit</Link>
                    {/* Google Maps route — only for paid plans with valid coordinates */}
                    {paid && mapsUrl && (
                      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-teal btn-sm">
                        🗺️ Google Maps
                      </a>
                    )}
                    {/* Book CTA — only for unpaid plans */}
                    {!paid && (
                      <button className="btn btn-gold btn-sm" onClick={() => bookPlan(plan)}>Book Plan</button>
                    )}
                    {/* Delete — triggers confirm() before API call */}
                    <button className="btn btn-danger btn-sm" onClick={() => deletePlan(plan._id, plan.name)}>🗑️ Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
