/**
 * pages/user/BookingsPage.jsx — My Bookings List
 *
 * Displays all of the authenticated user's bookings in a chronological list.
 * Each booking row shows: optional cover image thumbnail, status/type/paid badges,
 * booking name, booking reference, visit date + guest count, amount, and a
 * "View Details →" link to /bookings/:id.
 *
 * Data:
 *   bookingAPI.getMy() — returns all bookings for the current user.
 *   Each booking document has: status, bookingType, isPaid, bookingRef,
 *   visitDate, adults, children, totalAmount, and populated package/plan fields.
 *
 * STATUS_COLOR map:
 *   Maps booking status strings to badge variant class suffixes.
 *   confirmed → badge-teal (green)
 *   pending   → badge-gold (yellow)
 *   cancelled → badge-coral (red)
 *   completed → badge-blue
 *   Unlisted statuses fall back to 'gold' via the || operator.
 *
 * TYPE_LABEL map:
 *   Maps bookingType strings to human-readable labels with emoji:
 *   package → "📦 Package"
 *   plan    → "🗓️ Day Plan"
 *   cart    → "🛒 Cart Order"
 *   Unlisted types fall back to "📋 Booking".
 *
 * Cover image:
 *   Only package bookings have a coverImage (from the populated package document).
 *   Plan and cart bookings show no thumbnail (their image block is omitted entirely).
 *
 * Booking name (name variable):
 *   b.package?.name (for package bookings)
 *   || b.plan?.name (for plan bookings)
 *   || 'Booking'    (fallback label when neither field is populated)
 *
 * Empty state:
 *   Shows 🎫 icon with "No bookings yet" and CTAs to /packages and /plans.
 *
 * Note: This page shows a simple read-only list.
 *   Full booking actions (complete payment, PDF export, navigation)
 *   are available in the individual BookingDetailPage (/bookings/:id).
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { bookingAPI } from '../../services/api';
import styles from './User.module.css';

export default function BookingsPage() {
  // ── State ─────────────────────────────────────────────────────────────────
  const [bookings, setBookings] = useState([]);   // All user bookings from server
  const [loading,  setLoading]  = useState(true); // Initial fetch loading flag

  // ── Fetch All Bookings on Mount ───────────────────────────────────────────
  // bookingAPI.getMy() returns bookings sorted newest-first by the server.
  useEffect(() => {
    bookingAPI.getMy().then(({ data }) => setBookings(data.bookings)).finally(() => setLoading(false));
  }, []);

  // ── Status Badge Color Map ────────────────────────────────────────────────
  // Maps booking status → badge variant for color-coded status display.
  const STATUS_COLOR = { confirmed:'teal', pending:'gold', cancelled:'coral', completed:'blue' };

  // ── Booking Type Label Map ────────────────────────────────────────────────
  // Maps bookingType → human-readable badge label with emoji icon.
  const TYPE_LABEL   = { package:'📦 Package', plan:'🗓️ Day Plan', cart:'🛒 Cart Order' };

  return (
    <div className={styles.page}>
      <div className="container">
        {/* ── Page Header ───────────────────────────────────────── */}
        <h1 className={styles.pageTitle}>My Bookings</h1>
        <div className={styles.goldDiv} />
        {/* Dynamic booking count */}
        <p style={{ color:'var(--txt3)', fontSize:'0.875rem', marginBottom:'2rem' }}>
          {bookings.length} booking{bookings.length !== 1 ? 's' : ''}
        </p>

        {loading ? (
          // Loading spinner while fetching bookings
          <div className="loading-center"><div className="spinner" /></div>
        ) : bookings.length === 0 ? (
          // ── Empty State ─────────────────────────────────────────
          // Shown when the user has no bookings yet
          <div className="empty-state">
            <div className="empty-state-icon">🎫</div>
            <h3>No bookings yet</h3>
            <p>Browse packages or book a saved plan to get started.</p>
            {/* CTAs to help the user find something to book */}
            <div style={{ display:'flex', gap:'0.75rem', justifyContent:'center', marginTop:'1.5rem' }}>
              <Link to="/packages" className="btn btn-gold">Browse Packages</Link>
              <Link to="/plans"    className="btn btn-outline">My Plans</Link>
            </div>
          </div>
        ) : (
          // ── Bookings List ────────────────────────────────────────
          // Vertical stack of booking row cards
          <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            {bookings.map(b => {
              // Resolve display name (package > plan > fallback)
              const name = b.package?.name || b.plan?.name || 'Booking';
              // Cover image only available for package bookings
              const img  = b.package?.coverImage;
              return (
                // ── Individual Booking Row Card ────────────────────
                <div key={b._id} className="card" style={{ display:'flex', alignItems:'center', gap:'1.25rem', flexWrap:'wrap' }}>

                  {/* ── Cover Image Thumbnail ──────────────────── */}
                  {/* Only shown for package bookings (no image for plan/cart) */}
                  {img && (
                    <div style={{ width:90, height:76, borderRadius:'var(--radius)', overflow:'hidden', flexShrink:0 }}>
                      <img src={img} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    </div>
                  )}

                  {/* ── Booking Info Section ───────────────────── */}
                  <div style={{ flex:1, minWidth:200 }}>
                    {/* Badge row: status color + booking type + paid indicator */}
                    <div style={{ display:'flex', gap:'0.5rem', marginBottom:'4px', flexWrap:'wrap' }}>
                      {/* Status badge: confirmed=teal, pending=gold, cancelled=coral, completed=blue */}
                      <span className={`badge badge-${STATUS_COLOR[b.status] || 'gold'}`}>{b.status}</span>
                      {/* Booking type badge: Package / Day Plan / Cart Order */}
                      <span className="badge badge-blue" style={{ fontSize:'0.68rem' }}>{TYPE_LABEL[b.bookingType] || '📋 Booking'}</span>
                      {/* Paid badge — only shown when isPaid is true */}
                      {b.isPaid && <span className="badge badge-teal" style={{ fontSize:'0.68rem' }}>✓ Paid</span>}
                    </div>
                    {/* Booking name in Cormorant Garamond for visual hierarchy */}
                    <div style={{ fontFamily:'Cormorant Garamond', fontSize:'1.05rem', color:'var(--txt)', fontWeight:600, marginBottom:'4px' }}>{name}</div>
                    {/* Booking reference in monospace gold for easy identification */}
                    <div style={{ fontSize:'0.78rem', color:'var(--txt3)' }}>
                      Ref: <span style={{ color:'var(--gold3)', fontFamily:'monospace' }}>{b.bookingRef}</span>
                    </div>
                    {/* Visit date + guest summary on one line */}
                    <div style={{ fontSize:'0.78rem', color:'var(--txt3)', marginTop:'2px' }}>
                      Visit: {new Date(b.visitDate).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}
                      {' · '}{b.adults} adult{b.adults>1?'s':''}{b.children>0?` + ${b.children} child`:''}
                    </div>
                  </div>

                  {/* ── Amount + View Button ───────────────────── */}
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    {/* Total amount in gold Cormorant Garamond */}
                    <div style={{ fontFamily:'Cormorant Garamond', fontSize:'1.3rem', fontWeight:700, color:'var(--gold)', marginBottom:'0.5rem' }}>
                      LKR {b.totalAmount?.toLocaleString()}
                    </div>
                    {/* View Details link — navigates to BookingDetailPage */}
                    <Link to={`/bookings/${b._id}`} className="btn btn-gold btn-sm">View Details →</Link>
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
