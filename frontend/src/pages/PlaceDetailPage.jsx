/**
 * pages/PlaceDetailPage.jsx — Individual Tourist Place Detail
 *
 * Full-detail view for a single tourist place, accessed via /place/:slug.
 * Presents a gallery, four tabbed content sections, a sticky sidebar, and
 * guest-aware action buttons.
 *
 * Route param: :slug — matches Place.slug (URL-safe version of the name)
 *
 * Data fetched on mount:
 *  - placeAPI.getOne(slug, { lat, lng }) — place document + reviews array
 *  - favoriteAPI.check(place._id)        — whether the logged-in user has saved this place
 *
 * Four tabs:
 *  info    — Full description, opening hours, distances, facilities, tags
 *  tips    — Preparation tips, safety tips, dress code, travel notes
 *  reviews — Review submission form (auth-gated) + list of existing reviews
 *  route   — Transport mode cards with estimated time/cost + Google Maps link
 *
 * Route Info (computed when GPS is available):
 *  5 transport modes: Car/Taxi (25 km/h), Tuk-tuk (20), Bus (15), Train (30), Walk (5).
 *  Each mode has a base fare + per-km rate used to estimate travel cost in LKR.
 *  Haversine distance is used — not road distance.
 *
 * Gallery:
 *  Uses place.gallery array if it has items; falls back to [place.coverImage].
 *  selImg state tracks the currently selected thumbnail index.
 *
 * Reference location:
 *  REF = { lat: 6.868671, lng: 79.860689 } — 38 Rajasinghe Road, Dehiwala.
 *  Used as Google Maps origin when the user hasn't granted GPS permission.
 *
 * Action buttons (guest-aware, no alert()):
 *  - addToPlan: sessionStorage['plannerPlaces'] array, redirect to /login if guest
 *  - toggleFav: favoriteAPI.toggle(), redirect to /login if guest
 *  - Get Directions: Google Maps deep-link with origin = GPS or REF
 */

import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { placeAPI, reviewAPI, favoriteAPI, cartAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import useLocation from '../hooks/useLocation';
import { haversine } from '../hooks/useLocation';
import styles from './PlaceDetailPage.module.css';

// ── Reference: 38 Rajasinghe Road, Dehiwala ─────────────────
// Used as Google Maps origin fallback when GPS is unavailable.
const REF = { lat: 6.868671, lng: 79.860689 };

export default function PlaceDetailPage() {
  // ── Router & Context ──────────────────────────────────────────────────────
  const { slug } = useParams();  // URL slug, e.g. "viharamahadevi-park"
  const { user } = useAuth();    // Determines which action buttons are shown
  const { addToCart } = useCart();
  const toast = useToast();
  const nav = useNavigate();
  const { location } = useLocation();  // Live GPS coordinates or null

  // ── Page State ────────────────────────────────────────────────────────────
  const [place, setPlace] = useState(null);       // Fetched place document
  const [reviews, setReviews] = useState([]);     // Reviews for this place
  const [loading, setLoading] = useState(true);   // Initial load spinner
  const [favorited, setFavorited] = useState(false); // Whether user has saved this place
  const [selImg, setSelImg] = useState(0);        // Selected gallery image index
  const [revForm, setRevForm] = useState({ rating: 5, comment: '', title: '' }); // Review form
  const [submitting, setSubmitting] = useState(false); // Review submit loading state
  const [routeInfo, setRouteInfo] = useState(null); // Transport mode data (computed from GPS)
  const [tab, setTab] = useState('info');          // Active tab: info | tips | reviews | route

  // ── Fetch Place Data ──────────────────────────────────────────────────────
  // Passes live GPS coordinates when available so the server can compute live distance.
  // Checks favourite status for logged-in users (ignores errors silently).
  useEffect(() => {
    const params = location ? { lat: location.lat, lng: location.lng } : {};
    placeAPI.getOne(slug, params)
      .then(({ data }) => {
        setPlace(data.place);
        setReviews(data.reviews || []);
        // Only check favourite status if the user is logged in
        if (user) {
          favoriteAPI.check(data.place._id).then(r => setFavorited(r.data.favorited)).catch(() => {});
        }
      })
      .finally(() => setLoading(false));
  }, [slug, user]);

  // ── Compute Route Info from GPS ───────────────────────────────────────────
  // When both GPS and place data are available, calculate travel time and cost
  // for 5 transport modes using Haversine distance.
  useEffect(() => {
    if (location && place) {
      const dist = haversine(location.lat, location.lng, place.lat, place.lng);
      // Transport modes: speed (km/h), base fare (LKR), per-km rate (LKR), apps
      const MODES = [
        { mode:'car',   label:'Car / Taxi', icon:'🚗', speed:25, base:100, perKm:50, apps:['PickMe','Uber'] },
        { mode:'tuk',   label:'Tuk-tuk',   icon:'🛺', speed:20, base:60,  perKm:40, apps:['PickMe'] },
        { mode:'bus',   label:'City Bus',  icon:'🚌', speed:15, base:15,  perKm:3,  apps:[] },
        { mode:'train', label:'Train',     icon:'🚂', speed:30, base:10,  perKm:2,  apps:[] },
        { mode:'walk',  label:'Walk',      icon:'🚶', speed:5,  base:0,   perKm:0,  apps:[] },
      ];
      setRouteInfo({
        distance: dist.toFixed(2),
        // For each mode: compute travel time in minutes and estimated cost in LKR
        modes: MODES.map(m => ({
          ...m,
          mins: Math.round((dist / m.speed) * 60),
          // perKm === 0 means free (walking); otherwise base + distance × rate
          cost: m.perKm === 0 ? 0 : Math.round(m.base + dist * m.perKm),
        })),
      });
    }
  }, [location, place]);

  // ── Guest-safe favourite toggle ─────────────────────────────
  // Redirects guests to /login. For logged-in users, toggles the favourite
  // and updates local state to reflect the new status immediately.
  const toggleFav = async () => {
    if (!user) { nav('/login'); return; }
    const { data } = await favoriteAPI.toggle(place._id);
    setFavorited(data.favorited);
    toast.success(data.message);
  };

  // ── Guest-safe add to planner ───────────────────────────────
  // Redirects guests to /login. For logged-in users, adds the place to
  // the sessionStorage 'plannerPlaces' array for pickup by PlannerPage.
  const addToPlan = () => {
    if (!user) { nav('/login'); return; }
    const existing = JSON.parse(sessionStorage.getItem('plannerPlaces') || '[]');
    // Prevent duplicates — if already in planner, navigate there instead
    if (existing.find(p => p._id === place._id)) {
      toast.info('Already in planner'); nav('/planner'); return;
    }
    // Append to planner list in sessionStorage
    sessionStorage.setItem('plannerPlaces', JSON.stringify([...existing, place]));
    toast.success(`${place.name} added to planner!`);
  };

  // ── Review Submit ─────────────────────────────────────────────────────────
  // Prepends the new review to the local reviews array on success so it
  // appears immediately without a full page reload.
  const submitReview = async (e) => {
    e.preventDefault();
    if (!user) { nav('/login'); return; }
    setSubmitting(true);
    try {
      const { data } = await reviewAPI.create({ placeId: place._id, ...revForm });
      // Prepend to the reviews list so the newest review appears at the top
      setReviews(prev => [data.review, ...prev]);
      toast.success('Review posted!');
      // Reset the form back to defaults
      setRevForm({ rating: 5, comment: '', title: '' });
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to post review'); }
    finally { setSubmitting(false); }
  };

  // ── Loading / Not Found States ────────────────────────────────────────────
  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (!place) return (
    <div className="container" style={{ padding:'4rem 0', textAlign:'center' }}>
      <h2>Place not found</h2>
      <Link to="/explore" className="btn btn-gold" style={{ marginTop:'1rem' }}>Back to Explore</Link>
    </div>
  );

  // ── Derived Display Values ────────────────────────────────────────────────
  // Live distance takes priority over server-calculated reference distance
  const liveD = location ? haversine(location.lat, location.lng, place.lat, place.lng) : null;
  const displayDist = liveD ?? place.distanceFromReference;
  const distFromRef = place.distanceFromReference;
  // Gallery: use place.gallery if populated; otherwise fall back to coverImage array
  const imgList = place.gallery?.length ? place.gallery : [place.coverImage].filter(Boolean);
  // Helper: build a star string like "★★★☆☆" from a numeric rating
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

  // Google Maps route — origin is live GPS if available, otherwise reference location
  const origin = location ? `${location.lat},${location.lng}` : `${REF.lat},${REF.lng}`;
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${place.lat},${place.lng}&travelmode=driving`;

  // ── Tab Definitions ───────────────────────────────────────────────────────
  // Four tabs shown under the gallery. Review count is live from state.
  const TABS = [
    { id:'info',    label:'📋 Information' },
    { id:'tips',    label:'💡 Visit Tips' },
    { id:'reviews', label:`⭐ Reviews (${reviews.length})` },
    { id:'route',   label:'🗺️ Route & Transport' },
  ];

  return (
    <div className={styles.page}>
      <div className="container">
        {/* ── Breadcrumb navigation ───────────────────────────────── */}
        <div className={styles.breadcrumb}>
          <Link to="/">Home</Link> / <Link to="/explore">Explore</Link> / <span>{place.name}</span>
        </div>

        {/* ── Two-column layout: main content + sticky sidebar ─────── */}
        <div className={styles.layout}>
          {/* ── LEFT ────────────────────────────────── */}
          <div className={styles.main}>
            {/* ── Gallery ────────────────────────────────── */}
            {/* Main image with optional thumbnail strip below */}
            <div className={styles.gallery}>
              <div className={styles.mainImg}>
                {/* Display the currently selected gallery image */}
                {imgList.length > 0 && (
                  <img src={imgList[selImg]} alt={place.name} className="img-cover" />
                )}
                {/* Featured badge overlay */}
                {place.isFeatured && <div className={styles.featBadge}>⭐ Featured</div>}
              </div>
              {/* Thumbnail strip — only rendered when there are multiple images */}
              {imgList.length > 1 && (
                <div className={styles.thumbs}>
                  {imgList.map((img, i) => (
                    <button
                      key={i}
                      // Active thumbnail gets the .thumbOn CSS class for a highlighted border
                      className={`${styles.thumb} ${i === selImg ? styles.thumbOn : ''}`}
                      onClick={() => setSelImg(i)}
                    >
                      <img src={img} alt="" className="img-cover" style={{ width:'100%', height:'100%' }} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Tab Navigation ─────────────────────────────────── */}
            <div className={styles.tabs}>
              {TABS.map(t => (
                <button
                  key={t.id}
                  // Active tab gets the .tabOn class for highlighting
                  className={`${styles.tab} ${tab === t.id ? styles.tabOn : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── INFO TAB ─────────────────── */}
            {/* Full description, opening hours, distances, nearby facilities, and tags */}
            {tab === 'info' && (
              <div className={styles.tabContent}>
                <h2 className={styles.secH}>About This Place</h2>
                {/* Full description text from the Place document */}
                <p className={styles.fullDesc}>{place.fullDescription}</p>
                {/* Key info grid — opening hours, best times, distances, parking */}
                <div className={styles.infoGrid}>
                  {[
                    { l:'Opening Hours', v:`${place.openingTime} – ${place.closingTime}` },
                    { l:'Best Time of Day', v:place.bestTimeOfDay },
                    { l:'Best Season', v:place.bestSeason },
                    { l:'Estimated Duration', v:place.estimatedDuration },
                    { l:'From Reference (38 Rajasinghe Rd)', v:`${distFromRef} km` },
                    { l:'From Airport (BIA)', v:place.distanceFromAirport ? `${place.distanceFromAirport} km` : '-' },
                    { l:'From Your Location', v:liveD ? `${liveD.toFixed(1)} km (live)` : 'Enable GPS for live distance' },
                    { l:'Parking', v:place.parkingAvailable ? '✓ Available' : '✗ Not Available' },
                    // Contact info row — only shown if place.contactInfo is set
                    place.contactInfo && {
                        l: 'Contact',
                        v: (
                          <a href={`tel:${place.contactInfo}`} className={styles.phoneLink}>
                            📞 {place.contactInfo}
                          </a>
                        )
                      },
                    // Closed days row — only shown if closedDays array has items
                    place.closedDays?.length > 0 && { l:'Closed On', v:place.closedDays.join(', ') },
                  ].filter(Boolean).map(r => (
                    <div key={r.l} className={styles.infoBox}>
                      <div className={styles.infoL}>{r.l}</div>
                      <div className={styles.infoV}>{r.v}</div>
                    </div>
                  ))}
                </div>
                {/* Nearby facilities — badges (e.g. "Parking", "Restaurant") */}
                {place.nearbyFacilities?.length > 0 && (
                  <div style={{ marginTop:'1rem' }}>
                    <div className={styles.secH} style={{ fontSize:'1rem', marginBottom:'0.65rem' }}>Nearby Facilities</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'0.5rem' }}>
                      {place.nearbyFacilities.map((f, i) => <span key={i} className="badge badge-blue">{f}</span>)}
                    </div>
                  </div>
                )}
                {/* Tags — small descriptive chips (e.g. "family-friendly", "historic") */}
                {place.tags?.length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'0.4rem', marginTop:'1rem' }}>
                    {place.tags.map((t, i) => <span key={i} className={styles.tag}>{t}</span>)}
                  </div>
                )}
              </div>
            )}

            {/* ── TIPS TAB ─────────────────── */}
            {/* Preparation tips, safety advice, dress code, and travel notes */}
            {tab === 'tips' && (
              <div className={styles.tabContent}>
                {/* Preparation tips — what to bring, book in advance, etc. */}
                {place.preparationTips?.length > 0 && (
                  <>
                    <h3 className={styles.secH}>Before You Visit</h3>
                    <ul className={styles.tipList}>
                      {place.preparationTips.map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                  </>
                )}
                {/* Safety tips — specific to this place's environment */}
                {place.safetyTips?.length > 0 && (
                  <>
                    <h3 className={styles.secH} style={{ marginTop:'1.5rem' }}>Safety Tips</h3>
                    <ul className={styles.tipList}>
                      {place.safetyTips.map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                  </>
                )}
                {/* Dress code — only shown if the field is set (e.g. temple attire) */}
                {place.dressCode && (
                  <div className={styles.infoBox} style={{ marginTop:'1.25rem' }}>
                    <div className={styles.infoL}>Dress Code</div>
                    <div className={styles.infoV}>{place.dressCode}</div>
                  </div>
                )}
                {/* Travel notes — free-text advice about getting there */}
                {place.travelNotes && (
                  <div className={styles.travelNote}><strong>Travel Notes:</strong> {place.travelNotes}</div>
                )}
              </div>
            )}

            {/* ── REVIEWS TAB ──────────────── */}
            {/* Review submission form (for logged-in users) + list of past reviews */}
            {tab === 'reviews' && (
              <div className={styles.tabContent}>
                {user ? (
                  // Review form — only shown to authenticated users
                  <form onSubmit={submitReview} className={styles.revForm}>
                    <h3 className={styles.secH}>Write a Review</h3>
                    {/* Star picker — 5 buttons, clicking a star sets the rating */}
                    <div className={styles.starPicker}>
                      {[1,2,3,4,5].map(n => (
                        <button type="button" key={n}
                          className={`${styles.starBtn} ${revForm.rating >= n ? styles.starOn : ''}`}
                          onClick={() => setRevForm(f => ({ ...f, rating: n }))}>★</button>
                      ))}
                      <span className={styles.starLabel}>{revForm.rating}/5</span>
                    </div>
                    {/* Optional review title */}
                    <div className="form-group">
                      <input className="form-input" placeholder="Review title (optional)" value={revForm.title} onChange={e => setRevForm(f => ({ ...f, title: e.target.value }))} />
                    </div>
                    {/* Required review body text */}
                    <div className="form-group">
                      <textarea className="form-input form-textarea" placeholder="Share your experience..." required value={revForm.comment} onChange={e => setRevForm(f => ({ ...f, comment: e.target.value }))} />
                    </div>
                    <button className="btn btn-gold" type="submit" disabled={submitting}>
                      {submitting ? 'Posting...' : 'Post Review'}
                    </button>
                  </form>
                ) : (
                  // Prompt to sign in — shown to guest users
                  <div className={styles.signInCard}>
                    <p>Sign in to leave a review for this place.</p>
                    <Link to="/login" className="btn btn-gold btn-sm">Sign In to Review</Link>
                  </div>
                )}
                {/* Reviews list — sorted newest-first (prepend on new review) */}
                <div className={styles.revList}>
                  {reviews.length === 0
                    // Empty state when no reviews have been submitted
                    ? <div className="empty-state" style={{ padding:'2rem' }}><div className="empty-state-icon">💬</div><h3>No reviews yet</h3><p>Be the first!</p></div>
                    : reviews.map(r => (
                      <div key={r._id} className={styles.revItem}>
                        {/* Review header: user avatar initial + name + star rating + date */}
                        <div className={styles.revHd}>
                          <div className={styles.revAv}>{r.user?.name?.charAt(0)}</div>
                          <div><div className={styles.revName}>{r.user?.name}</div><div className="stars">{stars(r.rating)}</div></div>
                          {/* Date formatted as "12 Jan 2025" */}
                          <div className={styles.revDate}>{new Date(r.createdAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</div>
                        </div>
                        {/* Optional review title */}
                        {r.title && <div className={styles.revTitle}>{r.title}</div>}
                        {/* Review body text */}
                        <p className={styles.revText}>{r.comment}</p>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}

            {/* ── ROUTE TAB ────────────────── */}
            {/* Shows transport mode cards with time and cost estimates.
                Requires GPS to be active — prompts user to enable if not. */}
            {tab === 'route' && (
              <div className={styles.tabContent}>
                <h3 className={styles.secH}>Getting There</h3>
                {!location ? (
                  // GPS not available — prompt the user to enable it
                  <div className={styles.signInCard}>
                    <p>Enable location access for live distance and transport estimates.</p>
                    <button className="btn btn-gold btn-sm" onClick={() => window.location.reload()}>Enable Location</button>
                  </div>
                ) : (
                  <>
                    {/* Distance from current GPS position */}
                    <div className={styles.routeDist}>
                      <span className={styles.routeDistNum}>{routeInfo?.distance} km</span>
                      <span className={styles.routeDistLabel}>from your current location</span>
                    </div>
                    {/* 5-mode transport grid: Car, Tuk-tuk, Bus, Train, Walk */}
                    <div className={styles.modeGrid}>
                      {routeInfo?.modes.map(m => (
                        <div key={m.mode} className={styles.modeCard}>
                          <div className={styles.modeIcon}>{m.icon}</div>
                          <div className={styles.modeLabel}>{m.label}</div>
                          {/* Travel time — formatted as minutes or hours+minutes */}
                          <div className={styles.modeDur}>{m.mins < 60 ? `${m.mins} min` : `${Math.floor(m.mins/60)}h ${m.mins%60}m`}</div>
                          {/* Cost — "Free" for walking; LKR estimate for other modes */}
                          <div className={styles.modeCost}>{m.cost === 0 ? 'Free' : `LKR ${m.cost.toLocaleString()}`}</div>
                        </div>
                      ))}
                    </div>
                    {/* External app buttons: Google Maps, PickMe, Uber */}
                    <div className={styles.appBtns}>
                      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-teal">
                        🗺️ Open Route in Google Maps
                      </a>
                      <a href="https://pickme.lk" target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                        🛺 Book via PickMe
                      </a>
                      <a href="https://www.uber.com/global/en/cities/colombo" target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                        🚗 Book via Uber
                      </a>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT SIDEBAR ────────────────────────── */}
          {/* Sticky sidebar showing place name, rating, distance, ticket prices,
              and all action buttons (plan / favourite / directions / map). */}
          <aside className={styles.sidebar}>
            <div className={styles.sideCard}>
              {/* Category + icon row */}
              <div className={styles.sideCat}>{place.category?.icon} {place.category?.name}</div>
              {/* Place name headline */}
              <h1 className={styles.sideName}>{place.name}</h1>
              {/* Star rating display with numeric score and review count */}
              <div className={styles.sideRating}>
                <span className="stars-lg">{stars(Math.round(place.rating || 0))}</span>
                <span className={styles.ratingNum}>{(place.rating || 0).toFixed(1)}</span>
                <span className={styles.ratingCount}>({reviews.length} reviews)</span>
              </div>
              {/* Distance row — shows "Live" badge if GPS is active */}
              <div className={styles.distRow}>
                <span>📍 {typeof displayDist === 'number' ? `${displayDist.toFixed(1)} km` : displayDist}</span>
                {liveD && <span className="badge badge-teal" style={{ fontSize:'0.68rem' }}>Live</span>}
              </div>
              <div className={styles.divider} />

              {/* ── Ticket Prices ──────────────────────────────────── */}
              <div className={styles.ticketTitle}>Entry Fees</div>
              {place.entryType === 'free' ? (
                // Free entry — show a teal badge
                <div className="badge badge-teal" style={{ fontSize:'0.9rem', padding:'0.5rem 1rem', marginBottom:'1rem', display:'inline-flex' }}>🆓 Free Entry</div>
              ) : (
                // Paid entry — 4-tier pricing table (local/foreigner × adult/child)
                <table className={styles.ticketTable}>
                  <tbody>
                    <tr><td>Local Adult</td><td>LKR {place.tickets?.localAdult?.toLocaleString()}</td></tr>
                    <tr><td>Local Child</td><td>LKR {place.tickets?.localChild?.toLocaleString()}</td></tr>
                    <tr><td>Foreigner Adult</td><td>LKR {place.tickets?.foreignerAdult?.toLocaleString()}</td></tr>
                    <tr><td>Foreigner Child</td><td>LKR {place.tickets?.foreignerChild?.toLocaleString()}</td></tr>
                  </tbody>
                </table>
              )}
              <div className={styles.divider} />

              {/* Action buttons - guest-aware, no alert() */}
              {/* Logged-in users see functional buttons; guests see sign-in prompts */}
              {user ? (
                <>
                  {/* Add to planner — uses sessionStorage key 'plannerPlaces' */}
                  <button className="btn btn-gold btn-block" onClick={addToPlan} style={{ marginBottom:'0.65rem' }}>
                    + Add to Day Plan
                  </button>
                  {/* Favourite toggle — shows current saved state */}
                  <button
                    className={`btn btn-block ${favorited ? 'btn-danger' : 'btn-outline'}`}
                    onClick={toggleFav}
                    style={{ marginBottom:'0.65rem' }}
                  >
                    {favorited ? '❤️ Saved to Favourites' : '♡ Save to Favourites'}
                  </button>
                </>
              ) : (
                // Guest view — both buttons redirect to /login
                <>
                  <Link to="/login" className="btn btn-gold btn-block" style={{ marginBottom:'0.65rem', justifyContent:'center' }}>
                    🔑 Sign In to Plan
                  </Link>
                  <Link to="/login" className="btn btn-outline btn-block" style={{ marginBottom:'0.65rem', justifyContent:'center' }}>
                    🔑 Sign In to Save
                  </Link>
                </>
              )}

              {/* Google Maps directions — uses GPS origin or REF fallback */}
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-teal btn-block" style={{ marginBottom:'0.65rem', justifyContent:'center' }}>
                🗺️ Get Directions
              </a>
              {/* Link to the live map page (not place-specific, general map view) */}
              <Link to={`/map`} className="btn btn-ghost btn-block" style={{ justifyContent:'center' }}>
                Open on Live Map
              </Link>

              {/* Official website link — only shown if place.website is set */}
              {place.website && (
                <a href={place.website} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-block" style={{ marginTop:'0.65rem', justifyContent:'center' }}>
                  🌐 Official Website
                </a>
              )}
            </div>

            {/* ── Quick Info Card ───────────────────────────────── */}
            {/* Secondary sidebar card with at-a-glance visiting details */}
            <div className={styles.sideCard} style={{ marginTop:'1rem' }}>
              <div className={styles.ticketTitle}>Quick Info</div>
              <div className={styles.quickList}>
                {/* Opening and closing times */}
                <div className={styles.quickItem}><span>🕐</span><span>{place.openingTime} – {place.closingTime}</span></div>
                {/* Estimated visit duration */}
                <div className={styles.quickItem}><span>⏱️</span><span>{place.estimatedDuration}</span></div>
                {/* Best season to visit */}
                <div className={styles.quickItem}><span>🌤️</span><span>{place.bestSeason}</span></div>
                {/* Parking availability */}
                <div className={styles.quickItem}><span>🚗</span><span>{place.parkingAvailable ? 'Parking available' : 'No parking'}</span></div>
                {/* Airport distance — only shown if field is set */}
                {place.distanceFromAirport && <div className={styles.quickItem}><span>✈️</span><span>{place.distanceFromAirport} km from BIA</span></div>}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
