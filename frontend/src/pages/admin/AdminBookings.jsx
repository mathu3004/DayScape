/**
 * pages/admin/AdminBookings.jsx — Admin: View All Bookings
 *
 * Read-only table of all bookings across all users.
 * Admins can search by user name or booking reference, and see the
 * confirmed revenue total at the top.
 *
 * Data:
 *  bookingAPI.getAllAdmin() — returns all bookings with populated user + package fields.
 *
 * Search:
 *  Client-side filter against user name and booking reference (case-insensitive).
 *  The booking reference is a short alphanumeric string (e.g., "BK-2024-XXXXX").
 *
 * totalRevenue:
 *  Computed from bookings where status === 'confirmed'.
 *  Displayed in the page subtitle as "LKR X,XXX confirmed revenue".
 *  Only confirmed bookings are included (not pending or cancelled).
 *
 * Status badge colors:
 *  confirmed → badge-teal  (green)
 *  pending   → badge-gold  (yellow)
 *  cancelled → badge-coral (red)  (all other statuses)
 *
 * Guest count column:
 *  Shows "{adults}A" and optionally "+ {children}C" for brevity.
 *  E.g., "2A + 1C" means 2 adults and 1 child.
 *
 * Package name:
 *  Truncated to 25 characters to fit table column.
 *  May be empty for plan or cart bookings (shows nothing).
 *
 * Table columns:
 *  Ref (monospace gold), User (mini avatar + name + email), Package,
 *  Visit Date, Guests, Amount (LKR, gold), Status badge
 *
 * Note: This is a read-only view — admins cannot edit or cancel bookings here.
 *   Booking management (status changes) would require a separate workflow
 *   not present in this version of the app.
 */

import { useState, useEffect } from 'react';
import { bookingAPI } from '../../services/api';
import styles from './Admin.module.css';

export default function AdminBookings() {
  // ── State ─────────────────────────────────────────────────────────────────
  const [bookings, setBookings] = useState([]);  // All bookings from server
  const [search,   setSearch]   = useState('');  // Search filter text

  // ── Fetch All Bookings on Mount ───────────────────────────────────────────
  useEffect(() => { bookingAPI.getAllAdmin().then(({ data }) => setBookings(data.bookings)); }, []);

  // ── Client-side Search Filter ─────────────────────────────────────────────
  // Matches against user name or booking reference code
  const filtered = bookings.filter(b =>
    b.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
    b.bookingRef?.toLowerCase().includes(search.toLowerCase())
  );

  // ── Confirmed Revenue Total ───────────────────────────────────────────────
  // Sum of totalAmount for all confirmed bookings (excludes pending/cancelled)
  const totalRevenue = bookings
    .filter(b => b.status === 'confirmed')
    .reduce((s, b) => s + b.totalAmount, 0);

  return (
    <div className={styles.adminPageLayout}>
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Manage Bookings</h1>
        {/* Shows total count and confirmed revenue in subtitle */}
        <p className={styles.pageSub}>{bookings.length} total · LKR {totalRevenue.toLocaleString()} confirmed revenue</p>
      </div>

      {/* ── Search Bar ──────────────────────────────────────────── */}
      {/* Searches user name and booking reference simultaneously */}
      <div className={styles.topBar}>
        <input className={styles.searchInput} placeholder="Search by name or ref..." value={search} onChange={e => setSearch(e.target.value)}/>
      </div>

      {/* ── Bookings Table ──────────────────────────────────────── */}
      <div className={styles.adminCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Ref</th>
              <th>User</th>
              <th>Package</th>
              <th>Visit Date</th>
              <th>Guests</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(b => (
              <tr key={b._id}>
                {/* Booking reference in monospace gold for quick scanning */}
                <td style={{fontFamily:'monospace',fontSize:'0.72rem',color:'var(--gold3)'}}>{b.bookingRef}</td>
                {/* User cell: mini avatar + name + email (email in smaller muted text) */}
                <td>
                  <div className={styles.userCell}>
                    <div className={styles.miniAvatar}>{b.user?.name?.charAt(0)}</div>
                    <div>
                      <div style={{color:'var(--txt)',fontWeight:500,fontSize:'0.82rem'}}>{b.user?.name}</div>
                      <div style={{fontSize:'0.72rem',color:'var(--txt4)'}}>{b.user?.email}</div>
                    </div>
                  </div>
                </td>
                {/* Package name truncated to 25 chars (empty for plan/cart bookings) */}
                <td style={{color:'var(--txt2)',fontSize:'0.82rem'}}>{b.package?.name?.substring(0,25)}</td>
                {/* Visit date formatted as DD MMM YYYY */}
                <td style={{color:'var(--txt2)',fontSize:'0.78rem'}}>{new Date(b.visitDate).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</td>
                {/* Compact guest count: "2A + 1C" or just "2A" if no children */}
                <td style={{color:'var(--txt3)',fontSize:'0.82rem'}}>{b.adults}A {b.children > 0 ? `+ ${b.children}C` : ''}</td>
                {/* Total amount in gold Cormorant Garamond */}
                <td style={{color:'var(--gold2)',fontWeight:600,fontFamily:'Cormorant Garamond',fontSize:'1rem'}}>LKR {b.totalAmount?.toLocaleString()}</td>
                {/* Status badge: confirmed=teal, pending=gold, other=coral */}
                <td>
                  <span className={`badge badge-${b.status==='confirmed'?'teal':b.status==='pending'?'gold':'coral'}`}>
                    {b.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
