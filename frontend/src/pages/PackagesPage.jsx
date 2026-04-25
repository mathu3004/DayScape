/**
 * pages/PackagesPage.jsx — Travel Packages Listing
 *
 * Displays all available travel packages in a 3-column grid with category
 * filter buttons. Each package card shows the cover image, duration badge,
 * star rating, name, truncated description, included places badges,
 * included amenities, price (with optional original price), and action buttons.
 *
 * Category Filters (FILTERS array):
 *  all | cultural | scenic | family | nature | luxury | general
 *  Filtering is done client-side by matching pkg.category === filter value.
 *
 * Action buttons per card:
 *  "Book Now"    — Navigates directly to /payment with package context in route state.
 *                  Redirects to /login if not authenticated.
 *  "Add to Cart" — Calls cartAPI.addItem({ itemType:'package', adults:1, children:0 })
 *                  then refreshes CartContext. Redirects to /login if guest.
 *
 * Named export:
 *  This component is exported as a named export { PackagesPage } AND as default.
 *  App.jsx uses the default import for the /packages route.
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { packageAPI, cartAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import styles from './Packages.module.css';

// ── PackagesPage ─────────────────────────────────────────────────────────────
// Named export so it can be imported specifically; also re-exported as default below.
export function PackagesPage() {
  // ── State ─────────────────────────────────────────────────────────────────
  const [packages, setPackages] = useState([]);   // All packages from the API
  const [loading, setLoading]   = useState(true);  // Loading spinner state
  const [filter, setFilter]     = useState('all'); // Active category filter
  const [adding, setAdding]     = useState(null);  // Package ID currently being added to cart

  // ── Context ───────────────────────────────────────────────────────────────
  const { user }      = useAuth();
  const { fetchCart } = useCart();   // Refresh cart badge count after add
  const toast         = useToast();
  const nav           = useNavigate();

  // ── Fetch All Packages on Mount ───────────────────────────────────────────
  useEffect(() => {
    packageAPI.getAll().then(({ data }) => setPackages(data.packages)).finally(() => setLoading(false));
  }, []);

  // ── Category Filters ──────────────────────────────────────────────────────
  // Displayed as pill-style toggle buttons above the grid.
  // 'all' shows every package; others filter by pkg.category value.
  const FILTERS = [
    { v:'all',      l:'All Packages' },
    { v:'cultural', l:'🏛️ Cultural' },
    { v:'scenic',   l:'🌊 Scenic' },
    { v:'family',   l:'👨‍👩‍👧 Family' },
    { v:'nature',   l:'🌿 Nature' },
    { v:'luxury',   l:'✨ Luxury' },
    { v:'general',  l:'🗺️ General' },
  ];
  // Client-side filter: compare pkg.category to the selected filter value
  const filtered = filter === 'all' ? packages : packages.filter(p => p.category === filter);

  // ── Book Now Handler ──────────────────────────────────────────────────────
  // Navigates to the shared /payment route with package context in location state.
  // PaymentPage reads state.mode === 'package' to render the correct form.
  const handleBookNow = (pkg) => {
    if (!user) { nav('/login'); return; }
    nav('/payment', {
      state: { mode: 'package', packageId: pkg._id, pkg }
    });
  };

  // ── Add to Cart Handler ───────────────────────────────────────────────────
  // Adds this package as a cart item with default 1 adult / 0 children.
  // After success, refreshes CartContext so the navbar badge count updates.
  const handleAddToCart = async (pkg) => {
    if (!user) { nav('/login'); return; }
    // Track which package is being added to show the loading "..." button state
    setAdding(pkg._id);
    try {
      await cartAPI.addItem({ itemType: 'package', packageId: pkg._id, adults: 1, children: 0, price: pkg.price });
      // Refresh CartContext so the navbar cart badge updates
      await fetchCart();
      toast.success(`${pkg.name} added to cart!`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add to cart');
    } finally { setAdding(null); }
  };

  return (
    <div style={{ padding: '2rem 0 4rem' }}>
      <div className="container">
        {/* ── Page Header ───────────────────────────────────────────── */}
        <div style={{ textAlign:'center', marginBottom:'3rem' }}>
          <div className="badge badge-gold" style={{ marginBottom:'1rem' }}>Travel Packages</div>
          {/* Responsive headline using clamp for fluid font sizing */}
          <h1 style={{ fontFamily:'Cormorant Garamond', fontSize:'clamp(2rem,4vw,3rem)', color:'var(--txt)', marginBottom:'1rem' }}>
            Curated Day-Trip Packages
          </h1>
          <div className="gold-divider" style={{ margin:'0 auto 1rem' }} />
          <p style={{ color:'var(--txt2)', maxWidth:540, margin:'0 auto' }}>
            Hand-crafted packages combining the best of Colombo's 11 verified attractions.
          </p>
        </div>

        {/* ── Category Filter Pills ─────────────────────────────────── */}
        {/* Pill-style toggle buttons rendered inline above the grid.
            Active filter gets a gold-tinted background and border. */}
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', justifyContent:'center', marginBottom:'2.5rem' }}>
          {FILTERS.map(f => (
            <button key={f.v} onClick={() => setFilter(f.v)} style={{
              padding:'0.5rem 1.1rem', borderRadius:'100px', border:'1px solid',
              // Highlight the active filter with gold accent; inactive filters are muted
              borderColor: filter === f.v ? 'rgba(201,168,76,0.4)' : 'var(--brd2)',
              background:  filter === f.v ? 'var(--gold4)' : 'var(--bg2)',
              color:       filter === f.v ? 'var(--gold2)' : 'var(--txt3)',
              fontSize:'0.82rem', fontFamily:'DM Sans', cursor:'pointer', transition:'all 0.15s',
              fontWeight: filter === f.v ? 600 : 400,
            }}>{f.l}</button>
          ))}
        </div>

        {/* ── Package Grid ──────────────────────────────────────────── */}
        {/* Show spinner while loading; otherwise render 3-column card grid */}
        {loading ? <div className="loading-center"><div className="spinner" /></div> : (
          <div className="grid-3">
            {filtered.map(pkg => (
              <div key={pkg._id} className={styles.pkgCard}>
                {/* Package cover image with discount and featured badge overlays */}
                <div className={styles.pkgImg}>
                  <img src={pkg.coverImage} alt={pkg.name} className="img-cover" />
                  {/* Discount badge — shown only when pkg.discount > 0 */}
                  {pkg.discount > 0 && <div className={styles.discBadge}>{pkg.discount}% OFF</div>}
                  {/* Featured badge — shown when pkg.isFeatured is true */}
                  {pkg.isFeatured && <div className={styles.featBadge}>⭐ Featured</div>}
                </div>
                <div className={styles.pkgBody}>
                  {/* Duration badge + star rating row */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'0.5rem' }}>
                    {/* Duration string (e.g. "Full Day", "Half Day") */}
                    <span className="badge badge-gold">{pkg.duration}</span>
                    {/* Star rating from rounded pkg.rating float */}
                    <div className="stars">{'★'.repeat(Math.round(pkg.rating || 0))}</div>
                  </div>
                  {/* Package name headline */}
                  <h3 className={styles.pkgName}>{pkg.name}</h3>
                  {/* Truncated description — 110 chars + ellipsis */}
                  <p className={styles.pkgDesc}>{pkg.description.substring(0, 110)}...</p>
                  {/* Included places — up to 3 shown, remainder as "+N more" */}
                  <div className={styles.pkgPlaces}>
                    {pkg.places?.slice(0, 3).map(p => (
                      <span key={p._id || p} className="badge badge-blue" style={{ fontSize:'0.68rem' }}>{p.name || 'Place'}</span>
                    ))}
                    {/* Show overflow count badge if more than 3 places */}
                    {pkg.places?.length > 3 && <span className="badge badge-blue" style={{ fontSize:'0.68rem' }}>+{pkg.places.length - 3} more</span>}
                  </div>
                  {/* First 3 includes shown as teal tick items */}
                  <div className={styles.includes}>
                    {pkg.includes?.slice(0, 3).map((inc, i) => (
                      <div key={i} style={{ fontSize:'0.75rem', color:'var(--teal)', padding:'2px 0' }}>✓ {inc}</div>
                    ))}
                  </div>
                  {/* ── Card Footer: Price + Action Buttons ─────────────── */}
                  <div className={styles.pkgFooter}>
                    <div>
                      {/* Strikethrough original price if a discount is active */}
                      {pkg.originalPrice > pkg.price && (
                        <div style={{ fontSize:'0.75rem', color:'var(--txt4)', textDecoration:'line-through' }}>LKR {pkg.originalPrice.toLocaleString()}</div>
                      )}
                      {/* Current (discounted) price in gold Cormorant Garamond */}
                      <div style={{ fontFamily:'Cormorant Garamond', fontSize:'1.3rem', fontWeight:700, color:'var(--gold)' }}>LKR {pkg.price.toLocaleString()}</div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:'6px', alignItems:'flex-end' }}>
                      {/* Book Now - direct payment: navigates to /payment with state */}
                      <button className="btn btn-gold btn-sm" onClick={() => handleBookNow(pkg)}>
                        Book Now
                      </button>
                      {/* Add to Cart - cartAPI.addItem then fetchCart */}
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ fontSize:'0.75rem' }}
                        onClick={() => handleAddToCart(pkg)}
                        disabled={adding === pkg._id}
                      >
                        {/* Show "..." loading indicator while this package is being added */}
                        {adding === pkg._id ? '...' : '🛒 Add to Cart'}
                      </button>
                    </div>
                  </div>
                  {/* View details link — navigates to the PackageDetailPage */}
                  <Link to={`/packages/${pkg._id}`} style={{ fontSize:'0.75rem', color:'var(--gold3)', display:'block', marginTop:'0.5rem', textAlign:'center' }}>
                    View Details →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Default export allows App.jsx to import this as a regular default import
export default PackagesPage;
