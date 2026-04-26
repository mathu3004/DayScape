/**
 * pages/user/UserDashboard.jsx — User Dashboard Overview
 *
 * The main authenticated landing page for regular users, accessed at /dashboard.
 * Displays a welcome header, 4 stat cards, and a 4-panel grid overview of:
 *  - Recent plans (last 3, links to /plans/:id)
 *  - Recent bookings (last 3 with status badge)
 *  - Favourites (last 4, links to /place/:slug)
 *  - Quick action links (Plan, Explore, Map, Packages, Profile, Favourites)
 *
 * Data fetched in parallel on mount (Promise.all):
 *  planAPI.getMyPlans()     → user's saved plans
 *  favoriteAPI.getMy()      → user's favourited places
 *  bookingAPI.getMy()       → user's booking history
 *  paymentAPI.getMy()       → user's payment history (for totalSpend calc)
 *
 * Total Spend:
 *  Summed from payments where status === 'success'. Displayed as LKR on the stat card.
 *
 * Named + default export:
 *  App.jsx imports this as default. The named export allows selective imports elsewhere.
 */

// UserDashboard.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { planAPI, favoriteAPI, bookingAPI, paymentAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import styles from './User.module.css';

// ── UserDashboard ─────────────────────────────────────────────────────────────
export function UserDashboard() {
  const { user } = useAuth();
  const { cartCount } = useCart();

  // ── Dashboard Data State ──────────────────────────────────────────────────
  const [plans, setPlans]       = useState([]);
  const [favs, setFavs]         = useState([]);
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading]   = useState(true);

  // ── Fetch All Data in Parallel ────────────────────────────────────────────
  // Uses Promise.all for efficiency — all four API calls fire simultaneously.
  useEffect(() => {
    Promise.all([planAPI.getMyPlans(), favoriteAPI.getMy(), bookingAPI.getMy(), paymentAPI.getMy()])
      .then(([p, f, b, pay]) => { setPlans(p.data.plans); setFavs(f.data.favorites); setBookings(b.data.bookings); setPayments(pay.data.payments); })
      .finally(() => setLoading(false));
  }, []);

  // ── Total Spend Calculation ───────────────────────────────────────────────
  // Only counts successful payments (not pending or failed transactions).
  const totalSpend = payments.filter(p => p.status === 'success').reduce((s, p) => s + p.amount, 0);

  return (
    <div className={styles.page}>
      <div className="container">
        {/* ── Welcome Header ─────────────────────────────────────── */}
        {/* Shows avatar initial, user name (first name only), email, and nationality type.
            Quick action buttons on the right for New Plan and Explore. */}
        <div className={styles.welcome}>
          <div className={styles.welcomeLeft}>
            {/* Circular avatar with the first letter of the user's name */}
            <div className={styles.avatar}>{user?.name?.charAt(0)}</div>
            <div>
              {/* Welcome headline — shows first name in italics */}
              <h1 className={styles.welcomeTitle}>Welcome back, <em>{user?.name?.split(' ')[0]}</em></h1>
              {/* Sub-line: email + nationality type */}
              <p className={styles.welcomeSub}>{user?.email} · {user?.nationality === 'foreigner' ? 'International Tourist' : 'Local Resident'}</p>
            </div>
          </div>
          {/* Quick CTA buttons in the header */}
          <div className={styles.welcomeActions}>
            <Link to="/planner" className="btn btn-gold">+ New Plan</Link>
            <Link to="/explore" className="btn btn-outline">Explore</Link>
          </div>
        </div>

        {/* ── Stats Grid ─────────────────────────────────────────── */}
        {/* 4 clickable stat cards linking to the relevant sections */}
        <div className={styles.statsGrid}>
          {[
            { n: plans.length,                        l: 'Saved Plans',  icon: '🗓️', to: '/plans' },
            { n: favs.length,                         l: 'Favourites',   icon: '❤️', to: '/favorites' },
            { n: bookings.length,                     l: 'Bookings',     icon: '📋', to: '/bookings' },
            { n: `LKR ${totalSpend.toLocaleString()}`,l: 'Total Spent',  icon: '💳', to: '/bookings' },
          ].map((s, i) => (
            // Each stat card is a Link to its corresponding section
            <Link key={i} to={s.to} className={styles.statCard}>
              <div className={styles.statIcon}>{s.icon}</div>
              <div className={styles.statNum}>{s.n}</div>
              <div className={styles.statLabel}>{s.l}</div>
            </Link>
          ))}
        </div>

        {/* ── Dashboard Grid: 4 cards ─────────────────────────────── */}
        <div className={styles.dashGrid}>

          {/* ── Recent Plans card ────────────────────────────────── */}
          {/* Shows last 3 plans with name, place count, date, and status badge */}
          <div className="card">
            <div className={styles.cardHd}><h3 className={styles.cardTitle}>Recent Plans</h3><Link to="/plans" className={styles.viewAll}>View all</Link></div>
            {loading ? <div className="loading-center" style={{minHeight:150}}><div className="spinner"/></div> :
              plans.length === 0 ? (
                // Empty state with CTA to create a new plan
                <div className="empty-state" style={{padding:'2rem'}}><div className="empty-state-icon">🗓️</div><h3>No plans yet</h3><Link to="/planner" className="btn btn-gold btn-sm" style={{marginTop:'0.75rem'}}>Create Plan</Link></div>
              ) :
              // List of most recent 3 plans
              plans.slice(0, 3).map(p => (
                <Link key={p._id} to={`/plans/${p._id}`} className={styles.planItem}>
                  <div className={styles.planName}>{p.name}</div>
                  {/* Subtitle: place count + formatted date */}
                  <div className={styles.planMeta}>{p.places?.length || 0} places · {p.planDate ? new Date(p.planDate).toLocaleDateString('en-GB') : 'No date'}</div>
                  {/* Status badge: active (teal) or other (gold) */}
                  <div className={styles.planStatus}><span className={`badge badge-${p.status === 'active' ? 'teal' : 'gold'}`}>{p.status}</span></div>
                </Link>
              ))
            }
          </div>

          {/* ── Recent Bookings card ──────────────────────────────── */}
          {/* Shows last 3 bookings with package name, ref, visit date, status */}
          <div className="card">
            <div className={styles.cardHd}><h3 className={styles.cardTitle}>Recent Bookings</h3><Link to="/bookings" className={styles.viewAll}>View all</Link></div>
            {bookings.length === 0 ? (
              // Empty state with CTA to browse packages
              <div className="empty-state" style={{padding:'2rem'}}><div className="empty-state-icon">📋</div><h3>No bookings</h3><Link to="/packages" className="btn btn-gold btn-sm" style={{marginTop:'0.75rem'}}>Browse Packages</Link></div>
            ) :
              // List of most recent 3 bookings
              bookings.slice(0, 3).map(b => (
                <div key={b._id} className={styles.planItem}>
                  <div className={styles.planName}>{b.package?.name || 'Package'}</div>
                  {/* Subtitle: booking ref + visit date */}
                  <div className={styles.planMeta}>{b.bookingRef} · {new Date(b.visitDate).toLocaleDateString('en-GB')}</div>
                  {/* Status badge with colour coding */}
                  <div className={styles.planStatus}><span className={`badge badge-${b.status === 'confirmed' ? 'teal' : b.status === 'pending' ? 'gold' : 'coral'}`}>{b.status}</span></div>
                </div>
              ))
            }
          </div>

          {/* ── Favourites card ───────────────────────────────────── */}
          {/* Shows last 4 saved places with name, category, and distance */}
          <div className="card">
            <div className={styles.cardHd}><h3 className={styles.cardTitle}>Favourites</h3><Link to="/favorites" className={styles.viewAll}>View all</Link></div>
            {favs.length === 0 ? (
              // Empty state with CTA to explore
              <div className="empty-state" style={{padding:'2rem'}}><div className="empty-state-icon">❤️</div><h3>No favourites</h3><Link to="/explore" className="btn btn-gold btn-sm" style={{marginTop:'0.75rem'}}>Explore</Link></div>
            ) :
              // List of most recent 4 favourited places
              favs.slice(0, 4).map(f => (
                <Link key={f._id} to={`/place/${f.place?.slug}`} className={styles.planItem}>
                  <div className={styles.planName}>{f.place?.name}</div>
                  {/* Subtitle: category name + reference distance */}
                  <div className={styles.planMeta}>{f.place?.category?.name} · {f.place?.distanceFromReference} km</div>
                </Link>
              ))
            }
          </div>

          {/* ── Quick Actions card ────────────────────────────────── */}
          {/* 6 shortcut links for common user actions */}
          <div className="card">
            <div className={styles.cardHd}><h3 className={styles.cardTitle}>Quick Actions</h3></div>
            <div className={styles.quickLinks}>
              {[
                { to:'/planner',   icon:'🗓️', label:'Plan a New Day' },
                { to:'/explore',   icon:'🔍', label:'Explore All Places' },
                { to:'/map',       icon:'🗺️', label:'Open Live Map' },
                { to:'/packages',  icon:'📦', label:'Browse Packages' },
                { to:'/profile',   icon:'👤', label:'Edit Profile' },
                { to:'/favorites', icon:'❤️', label:'My Favourites' },
              ].map(q => (
                // Each quick link has an icon, label, and right arrow indicator
                <Link key={q.to} to={q.to} className={styles.quickLink}>
                  <span className={styles.quickIcon}>{q.icon}</span>
                  <span>{q.label}</span>
                  <span className={styles.arrow}>→</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserDashboard;
