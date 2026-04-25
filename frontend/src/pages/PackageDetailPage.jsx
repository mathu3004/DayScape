/**
 * pages/PackageDetailPage.jsx — Single Package Detail View
 *
 * Full-detail view for a single travel package, accessed via /packages/:id.
 * Uses the MongoDB _id (not a slug) because packages are not URL-slug-indexed.
 *
 * Data fetched on mount:
 *  packageAPI.getOne(id) — full package document with populated places array
 *
 * Layout: two-column grid
 *  Left column  — Cover image, duration badge, name, description, included places
 *                 list (clickable links to each place), What's Included / Not Included cards
 *  Right column — Sticky pricing card with Book Now + Add to Cart (or register/sign in for guests)
 *
 * Action handlers:
 *  handleBookNow    — Navigates to /payment with route state:
 *                     { mode: 'package', packageId, pkg }
 *                     Redirects to /login for guest users.
 *  handleAddToCart  — Calls cartAPI.addItem({ itemType:'package', adults:1, children:0 })
 *                     then refreshes CartContext badge count.
 *                     Redirects to /login for guest users.
 *
 * Loading / not found:
 *  Shows spinner while fetching. Shows "Package not found" heading on 404.
 *
 * Sticky sidebar:
 *  The right-side pricing card uses position:sticky at top:90 (below the navbar).
 */

import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { packageAPI, cartAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';

export default function PackageDetailPage() {
  // ── Router & Context ──────────────────────────────────────────────────────
  const { id } = useParams();     // MongoDB _id of the package from the URL
  const { user } = useAuth();     // Determines which action buttons are shown
  const { fetchCart } = useCart(); // Refresh cart badge after adding to cart
  const toast = useToast();
  const nav = useNavigate();

  // ── State ─────────────────────────────────────────────────────────────────
  const [pkg, setPkg] = useState(null);        // Package document
  const [loading, setLoading] = useState(true); // Initial fetch loading spinner
  const [adding, setAdding] = useState(false);  // "Add to Cart" loading state

  // ── Fetch Package on Mount ────────────────────────────────────────────────
  // Populates pkg with the full package document including places array.
  useEffect(() => {
    packageAPI.getOne(id).then(({ data }) => setPkg(data.package)).finally(() => setLoading(false));
  }, [id]);

  // ── Book Now Handler ──────────────────────────────────────────────────────
  // Navigates directly to the payment page with package context in route state.
  // PaymentPage reads state.mode === 'package' to know it's a package booking.
  const handleBookNow = () => {
    if (!user) { nav('/login'); return; }
    nav('/payment', { state: { mode: 'package', packageId: pkg._id, pkg } });
  };

  // ── Add to Cart Handler ───────────────────────────────────────────────────
  // Adds the package as a cart item with 1 adult / 0 children default quantities.
  // After success, refreshes CartContext so the navbar badge count updates.
  const handleAddToCart = async () => {
    if (!user) { nav('/login'); return; }
    setAdding(true);
    try {
      await cartAPI.addItem({ itemType: 'package', packageId: pkg._id, adults: 1, children: 0, price: pkg.price });
      // Re-fetch cart so CartContext and navbar badge reflect the new item
      await fetchCart();
      toast.success(`${pkg.name} added to cart!`);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to add to cart'); }
    finally { setAdding(false); }
  };

  // ── Loading / Not Found States ────────────────────────────────────────────
  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (!pkg) return <div className="container" style={{ padding:'4rem 0', textAlign:'center' }}><h2>Package not found</h2></div>;

  return (
    <div style={{ padding: '2rem 0 4rem' }}>
      <div className="container">
        {/* Back link to the packages listing page */}
        <div style={{ marginBottom:'1rem' }}>
          <Link to="/packages" style={{ fontSize:'0.85rem', color:'var(--gold3)' }}>← Back to Packages</Link>
        </div>

        {/* ── Two-column layout: main content + sticky sidebar ─────── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 360px', gap:'2.5rem', alignItems:'start' }}>

          {/* ── Left Column ───────────────────────────────────────── */}
          <div>
            {/* Cover image — tall box with object-fit cover */}
            <div style={{ height:360, borderRadius:'var(--radius-lg)', overflow:'hidden', marginBottom:'2rem' }}>
              <img src={pkg.coverImage} alt={pkg.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            </div>

            {/* Duration badge (e.g. "Full Day") */}
            <div className="badge badge-gold" style={{ marginBottom:'0.75rem' }}>{pkg.duration}</div>

            {/* Package name headline */}
            <h1 style={{ fontFamily:'Cormorant Garamond', fontSize:'2.2rem', color:'var(--txt)', marginBottom:'1rem' }}>{pkg.name}</h1>
            <div className="gold-divider" />

            {/* Full package description */}
            <p style={{ color:'var(--txt2)', lineHeight:'1.75', marginBottom:'2rem' }}>{pkg.description}</p>

            {/* ── Included Attractions ────────────────────────────── */}
            {/* Each place shown as a clickable card linking to its detail page */}
            <h2 style={{ fontFamily:'Cormorant Garamond', fontSize:'1.4rem', color:'var(--txt)', marginBottom:'1rem' }}>Included Attractions</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem', marginBottom:'2rem' }}>
              {pkg.places?.map((p, i) => (
                // Clickable place row — links to /place/:slug
                <Link key={p._id} to={`/place/${p.slug}`} style={{ display:'flex', alignItems:'center', gap:'1rem', background:'var(--bg2)', border:'1px solid var(--brd)', borderRadius:'var(--radius-lg)', padding:'0.85rem', transition:'all 0.15s' }}>
                  {/* Small cover image thumbnail */}
                  {p.coverImage && <div style={{ width:60, height:52, borderRadius:'var(--radius)', overflow:'hidden', flexShrink:0 }}><img src={p.coverImage} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /></div>}
                  <div style={{ flex:1 }}>
                    {/* Place name */}
                    <div style={{ fontSize:'0.9rem', fontWeight:600, color:'var(--txt)', marginBottom:'2px' }}>{p.name}</div>
                    {/* Short one-sentence description */}
                    <div style={{ fontSize:'0.75rem', color:'var(--txt3)' }}>{p.shortDescription}</div>
                  </div>
                  {/* Right arrow indicating clickability */}
                  <span style={{ color:'var(--gold3)', fontSize:'0.85rem' }}>→</span>
                </Link>
              ))}
            </div>

            {/* ── What's Included / Not Included ─────────────────── */}
            {/* Two-column card grid shown when the arrays have items */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem' }}>
              {/* Included amenities/services — shown with green tick marks */}
              {pkg.includes?.length > 0 && (
                <div className="card">
                  <h3 style={{ fontFamily:'Cormorant Garamond', fontSize:'1.1rem', color:'var(--teal)', marginBottom:'0.75rem' }}>What's Included</h3>
                  {pkg.includes.map((inc, i) => <div key={i} style={{ fontSize:'0.82rem', color:'var(--txt2)', padding:'4px 0' }}>✓ {inc}</div>)}
                </div>
              )}
              {/* Excluded items — shown with red cross marks */}
              {pkg.excludes?.length > 0 && (
                <div className="card">
                  <h3 style={{ fontFamily:'Cormorant Garamond', fontSize:'1.1rem', color:'var(--coral)', marginBottom:'0.75rem' }}>Not Included</h3>
                  {pkg.excludes.map((ex, i) => <div key={i} style={{ fontSize:'0.82rem', color:'var(--txt2)', padding:'4px 0' }}>✗ {ex}</div>)}
                </div>
              )}
            </div>
          </div>

          {/* ── Right Column: Sticky Pricing Card ─────────────────── */}
          {/* Stays visible as the user scrolls the left column content */}
          <div style={{ position:'sticky', top:90 }}>
            <div className="card">
              {/* Pricing section: optional original price + current price */}
              <div style={{ textAlign:'center', marginBottom:'1.5rem' }}>
                {/* Show strikethrough original price if a discount is active */}
                {pkg.originalPrice > pkg.price && <div style={{ fontSize:'0.85rem', color:'var(--txt4)', textDecoration:'line-through' }}>LKR {pkg.originalPrice.toLocaleString()}</div>}
                {/* Current price in large gold Cormorant Garamond */}
                <div style={{ fontFamily:'Cormorant Garamond', fontSize:'2rem', fontWeight:700, color:'var(--gold)' }}>LKR {pkg.price.toLocaleString()}</div>
                {/* Per-person label with duration */}
                <div style={{ fontSize:'0.78rem', color:'var(--txt3)' }}>per person · {pkg.duration}</div>
                {/* Discount badge — only shown when discount > 0 */}
                {pkg.discount > 0 && <div className="badge badge-coral" style={{ marginTop:'0.5rem' }}>{pkg.discount}% Discount</div>}
              </div>

              {/* Package metadata rows: Max Group, Duration, Category */}
              {[{l:'Max Group', v:`${pkg.maxPeople} people`}, {l:'Duration', v:pkg.duration}, {l:'Category', v:pkg.category}].map(r => (
                <div key={r.l} style={{ display:'flex', justifyContent:'space-between', fontSize:'0.82rem', padding:'0.4rem 0', borderBottom:'1px solid var(--brd)' }}>
                  <span style={{ color:'var(--txt3)' }}>{r.l}</span>
                  <span style={{ color:'var(--txt)', fontWeight:600 }}>{r.v}</span>
                </div>
              ))}

              {/* ── Action Buttons ───────────────────────────────── */}
              <div style={{ display:'flex', flexDirection:'column', gap:'0.65rem', marginTop:'1.25rem' }}>
                {user ? (
                  // Logged-in user: functional Book Now + Add to Cart buttons
                  <>
                    {/* Book Now — navigates to /payment with package context */}
                    <button className="btn btn-gold btn-lg btn-block" onClick={handleBookNow} style={{ justifyContent:'center' }}>
                      Book This Package
                    </button>
                    {/* Add to Cart — disabled during API call, shows "..." indicator */}
                    <button
                      className="btn btn-outline btn-block"
                      onClick={handleAddToCart}
                      disabled={adding}
                      style={{ justifyContent:'center' }}
                    >
                      {adding ? '...' : '🛒 Add to Cart'}
                    </button>
                  </>
                ) : (
                  // Guest view: register and sign-in prompts instead of functional buttons
                  <>
                    <Link to="/register" className="btn btn-gold btn-lg btn-block" style={{ justifyContent:'center' }}>Create Account to Book</Link>
                    <Link to="/login" className="btn btn-outline btn-block" style={{ justifyContent:'center' }}>Sign In</Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
