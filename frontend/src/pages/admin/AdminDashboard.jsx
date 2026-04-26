/**
 * pages/admin/AdminDashboard.jsx — Admin Overview Dashboard
 *
 * The main landing page of the admin panel. Displays a high-level platform
 * overview with stats, a monthly revenue bar chart, recent bookings table,
 * recent users table, and quick navigation links to all admin sections.
 *
 * Data:
 *  adminAPI.getDashboard() — returns a single aggregated response:
 *    stats          — counts for users, places, plans, bookings, packages, payments, reviews, revenue
 *    recentBookings — latest booking documents (populated with user + package)
 *    recentUsers    — most recently registered user documents
 *    monthlyRevenue — array of { _id: { year, month }, total } aggregation results
 *
 * STAT_CARDS:
 *  Array of 8 stat card definitions: { icon, label, value, color }.
 *  Rendered in a CSS grid (statsGrid). Each card uses a dynamic class
 *  `stat-${color}` for its accent color (e.g., stat-blue, stat-gold, stat-teal).
 *
 * Monthly Revenue Bar Chart:
 *  Custom CSS bar chart — no external library.
 *  maxRev: the maximum revenue value across all months (used to scale bar heights to 100%).
 *  Each bar's height is proportional: (m.total / maxRev) * 100%.
 *  months array: maps 0-indexed month number to short name (Jan–Dec).
 *  m._id.month is 1-indexed (MongoDB $month operator); subtract 1 to index into months[].
 *  Values over 999 are formatted as "X.Xk" for compact display.
 *
 * Recent Bookings Table:
 *  Shows: user name, package name (truncated to 20 chars), amount, status badge.
 *  Status badge colors: confirmed=teal, pending=gold, other=coral.
 *
 * Recent Users Table:
 *  Shows: mini avatar (first letter of name), name, email, joined date.
 *  miniAvatar is a small circle with the user's initial letter.
 *
 * Quick Actions:
 *  6 links to all admin sections, each with an emoji icon and label.
 *  Rendered as <a> tags (not Link) since admin routes are full-page navigation.
 */

import { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';
import styles from './Admin.module.css';

export default function AdminDashboard() {
  // ── State ─────────────────────────────────────────────────────────────────
  const [data, setData]       = useState(null);    // Full dashboard response from server
  const [loading, setLoading] = useState(true);    // Initial fetch loading flag

  // ── Fetch Dashboard Data on Mount ─────────────────────────────────────────
  // All stats, charts, and tables are loaded in a single API call for efficiency.
  useEffect(() => { adminAPI.getDashboard().then(({ data }) => setData(data)).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (!data) return null;

  // ── Destructure Dashboard Response ────────────────────────────────────────
  const { stats, recentBookings, recentUsers, monthlyRevenue } = data;

  // ── Stat Card Definitions ─────────────────────────────────────────────────
  // Each card shows a platform metric from stats.
  // color maps to a CSS class suffix (e.g., stat-blue, stat-gold).
  const STAT_CARDS = [
    { icon: '👥', label: 'Total Users',    value: stats.users,                       color: 'blue'   },
    { icon: '📍', label: 'Active Places',  value: stats.places,                      color: 'gold'   },
    { icon: '🗓️', label: 'Total Plans',    value: stats.plans,                       color: 'teal'   },
    { icon: '📋', label: 'Bookings',       value: stats.bookings,                    color: 'coral'  },
    { icon: '📦', label: 'Packages',       value: stats.packages,                    color: 'purple' },
    { icon: '💳', label: 'Payments',       value: stats.payments,                    color: 'green'  },
    { icon: '⭐', label: 'Reviews',        value: stats.reviews,                     color: 'gold'   },
    { icon: '💰', label: 'Revenue (LKR)',  value: stats.revenue?.toLocaleString(),   color: 'teal'   },
  ];

  // ── Bar Chart Setup ───────────────────────────────────────────────────────
  // maxRev: the tallest bar height. Math.max with fallback 1 prevents division by zero.
  const maxRev = Math.max(...(monthlyRevenue?.map(m => m.total) || [1]), 1);
  // months: human-readable month abbreviations (0-indexed; m._id.month is 1-indexed)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className={styles.page}>
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Dashboard</h1>
        <p className={styles.pageSub}>DayScape platform overview</p>
      </div>

      {/* ── Stats Grid ──────────────────────────────────────────── */}
      {/* 8-card grid showing key platform metrics */}
      <div className={styles.statsGrid}>
        {STAT_CARDS.map(s => (
          <div key={s.label} className={`${styles.statCard} ${styles[`stat-${s.color}`]}`}>
            {/* Large emoji icon for visual scanning */}
            <div className={styles.statIcon}>{s.icon}</div>
            {/* Numeric value — revenue is pre-formatted with .toLocaleString() */}
            <div className={styles.statVal}>{s.value}</div>
            {/* Metric label */}
            <div className={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Dashboard Content Grid ───────────────────────────────── */}
      <div className={styles.dashGrid}>

        {/* ── Monthly Revenue Bar Chart ────────────────────────── */}
        <div className={styles.adminCard}>
          <h3 className={styles.cardTitle}>Monthly Revenue (LKR)</h3>
          {monthlyRevenue?.length === 0 ? (
            // Empty state when no revenue data exists yet
            <div className="empty-state" style={{ padding: '1.5rem' }}><p>No revenue data yet</p></div>
          ) : (
            // Custom CSS bar chart — bar heights proportional to maxRev
            <div className={styles.barChart}>
              {monthlyRevenue?.map((m, i) => (
                <div key={i} className={styles.barCol}>
                  {/* Value label above bar: "X.Xk" for thousands, exact number otherwise */}
                  <div className={styles.barVal}>{m.total > 999 ? `${(m.total/1000).toFixed(1)}k` : m.total}</div>
                  {/* Bar height = (this month's revenue / max revenue) × 100% */}
                  <div className={styles.bar} style={{ height: `${(m.total / maxRev) * 100}%` }} />
                  {/* Month label: m._id.month is 1-indexed from MongoDB, convert to 0-indexed */}
                  <div className={styles.barLabel}>{months[(m._id.month - 1) % 12]}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Recent Bookings Table ────────────────────────────── */}
        <div className={styles.adminCard}>
          <h3 className={styles.cardTitle}>Recent Bookings</h3>
          {recentBookings?.length === 0 ? (
            <div className="empty-state" style={{ padding: '1.5rem' }}><p>No bookings yet</p></div>
          ) : (
            <table className={styles.table}>
              <thead><tr><th>User</th><th>Package</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {recentBookings?.map(b => (
                  <tr key={b._id}>
                    {/* User name from populated booking.user */}
                    <td>{b.user?.name || '-'}</td>
                    {/* Package name truncated to 20 chars to fit table column */}
                    <td>{b.package?.name?.substring(0, 20) || '-'}</td>
                    {/* Total amount in gold */}
                    <td style={{ color: 'var(--gold2)', fontWeight: 600 }}>LKR {b.totalAmount?.toLocaleString()}</td>
                    {/* Status badge: confirmed=teal, pending=gold, cancelled/other=coral */}
                    <td><span className={`badge badge-${b.status === 'confirmed' ? 'teal' : b.status === 'pending' ? 'gold' : 'coral'}`}>{b.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── New Users Table ──────────────────────────────────── */}
        <div className={styles.adminCard}>
          <h3 className={styles.cardTitle}>New Users</h3>
          <table className={styles.table}>
            <thead><tr><th>Name</th><th>Email</th><th>Joined</th></tr></thead>
            <tbody>
              {recentUsers?.map(u => (
                <tr key={u._id}>
                  {/* Avatar circle with first letter + name */}
                  <td><div className={styles.userCell}><div className={styles.miniAvatar}>{u.name?.charAt(0)}</div>{u.name}</div></td>
                  <td style={{ color: 'var(--txt3)', fontSize: '0.8rem' }}>{u.email}</td>
                  {/* Join date formatted as DD/MM/YYYY */}
                  <td style={{ color: 'var(--txt3)', fontSize: '0.78rem' }}>{new Date(u.createdAt).toLocaleDateString('en-GB')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Quick Actions Panel ──────────────────────────────── */}
        {/* 6 links to main admin sections with emoji icons */}
        <div className={styles.adminCard}>
          <h3 className={styles.cardTitle}>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[
              { href: '/admin/places',     icon: '📍', label: 'Manage Places' },
              { href: '/admin/packages',   icon: '📦', label: 'Manage Packages' },
              { href: '/admin/bookings',   icon: '📋', label: 'View Bookings' },
              { href: '/admin/reviews',    icon: '⭐', label: 'Moderate Reviews' },
              { href: '/admin/users',      icon: '👥', label: 'Manage Users' },
              { href: '/admin/categories', icon: '🏷️', label: 'Manage Categories' },
            ].map(a => (
              // Each quick action is a full-page anchor (not React Router Link)
              <a key={a.href} href={a.href} className={styles.quickAction}>
                <span>{a.icon}</span><span>{a.label}</span>
                <span style={{ marginLeft: 'auto', color: 'var(--txt4)' }}>→</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
