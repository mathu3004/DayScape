/**
 * pages/admin/AdminReviews.jsx — Admin: Moderate Reviews
 *
 * Displays all user-submitted reviews across all places in a searchable table.
 * Admins can approve hidden reviews or hide approved ones with a single toggle.
 *
 * Data:
 *  reviewAPI.getAllAdmin() — returns all reviews (including hidden/unapproved ones).
 *  Each review has: user (populated), place (populated), rating, comment,
 *  createdAt, and isApproved flag.
 *
 * Search:
 *  Client-side filter against both place name and reviewer name (case-insensitive).
 *  Allows admins to quickly find reviews for a specific place or by a specific user.
 *
 * toggle(id):
 *  Calls reviewAPI.toggle(id) which flips the review's isApproved flag on the server.
 *  On success: replaces the review in local state with the updated document.
 *  Button label and style switch dynamically:
 *    isApproved=true  → "Hide" button (btn-danger, red)
 *    isApproved=false → "Approve" button (btn-ghost)
 *
 * Status badge:
 *  isApproved=true  → badge-teal  "Approved" (review is visible on the place page)
 *  isApproved=false → badge-coral "Hidden"   (review is hidden from public view)
 *
 * Comment display:
 *  Truncated to 80 characters with "..." suffix for compact table display.
 *  Full text is visible on the place's detail page.
 *
 * Table columns:
 *  User (reviewer name), Place (place name), Rating (with ★ suffix),
 *  Comment (truncated), Date, Status badge, Action toggle button
 *
 * Note: There is no create/edit for reviews in the admin panel.
 *   Reviews are always submitted by users via the place detail page.
 *   Admin can only approve or hide them.
 */

import { useState, useEffect } from 'react';
import { reviewAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import styles from './Admin.module.css';

export default function AdminReviews() {
  // ── State ─────────────────────────────────────────────────────────────────
  const [reviews, setReviews] = useState([]);   // All reviews from server (including hidden)
  const [search,  setSearch]  = useState('');   // Search filter text
  const toast = useToast();

  // ── Fetch All Reviews on Mount ────────────────────────────────────────────
  // getAllAdmin returns unapproved/hidden reviews too (public API only shows approved).
  useEffect(() => { reviewAPI.getAllAdmin().then(({ data }) => setReviews(data.reviews)); }, []);

  // ── Toggle Approve / Hide ─────────────────────────────────────────────────
  // Flips isApproved server-side, then updates the review in local state.
  const toggle = async (id) => {
    const { data } = await reviewAPI.toggle(id);
    setReviews(prev => prev.map(r => r._id === id ? data.review : r));
    toast.success('Review status updated');
  };

  // ── Client-side Search Filter ─────────────────────────────────────────────
  // Matches against place name OR reviewer's user name (both case-insensitive)
  const filtered = reviews.filter(r =>
    r.place?.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.user?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.adminPageLayout}>
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Manage Reviews</h1>
        <p className={styles.pageSub}>{reviews.length} total reviews</p>
      </div>

      {/* ── Search Bar ──────────────────────────────────────────── */}
      {/* Searches place name and reviewer name simultaneously */}
      <div className={styles.topBar}>
        <input className={styles.searchInput} placeholder="Search reviews..." value={search} onChange={e => setSearch(e.target.value)}/>
      </div>

      {/* ── Reviews Table ───────────────────────────────────────── */}
      <div className={styles.adminCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>User</th>
              <th>Place</th>
              <th>Rating</th>
              <th>Comment</th>
              <th>Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r._id}>
                {/* Reviewer's display name */}
                <td style={{color:'var(--txt)',fontWeight:500}}>{r.user?.name}</td>
                {/* Place name the review was submitted for */}
                <td style={{color:'var(--txt2)',fontSize:'0.82rem'}}>{r.place?.name}</td>
                {/* Star rating: numeric value + ★ symbol in gold */}
                <td style={{color:'var(--gold)'}}>{r.rating}★</td>
                {/* Comment: truncated to 80 characters to fit table column */}
                <td style={{color:'var(--txt3)',fontSize:'0.78rem',maxWidth:200}}>{r.comment?.substring(0,80)}...</td>
                {/* Submission date formatted as DD/MM/YYYY */}
                <td style={{color:'var(--txt3)',fontSize:'0.75rem'}}>{new Date(r.createdAt).toLocaleDateString('en-GB')}</td>
                {/* Approval status: Approved=teal, Hidden=coral */}
                <td>
                  {r.isApproved
                    ? <span className="badge badge-teal">Approved</span>
                    : <span className="badge badge-coral">Hidden</span>
                  }
                </td>
                {/* Toggle button: "Hide" (danger/red) for approved, "Approve" (ghost) for hidden */}
                <td>
                  <button
                    className={`btn btn-sm ${r.isApproved?'btn-danger':'btn-ghost'}`}
                    onClick={() => toggle(r._id)}
                  >
                    {r.isApproved?'Hide':'Approve'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
