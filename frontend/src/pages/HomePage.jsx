/**
 * pages/HomePage.jsx — Public Landing Page
 *
 * The main entry point of the DayScape application. Displays the hero section,
 * location status bar, category quick-links, featured attractions, how-it-works
 * steps, the reference location card, curated packages, and a context-aware CTA.
 *
 * Data fetched on mount (Promise.all for parallel efficiency):
 *  - placeAPI.getFeatured()  → isFeatured places (displayed in the 3-column grid)
 *  - packageAPI.getAll()     → all packages, filtered to isFeatured, capped at 3
 *
 * Live GPS integration:
 *  - useLocation() provides location state, locationStatus, and getLocation trigger
 *  - getLiveDist() computes real-time Haversine distance from user GPS to each place
 *  - Falls back to place.distanceFromReference when GPS is unavailable
 *
 * Guest vs authenticated CTA:
 *  - Guest: "Browse All Places", "Create Free Account", "Sign In"
 *  - Logged-in: "Open Trip Planner", "Live Map", "Explore Places"
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { placeAPI, packageAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PlaceCard from '../components/place/PlaceCard';
import useLocation from '../hooks/useLocation';
import { haversine } from '../hooks/useLocation';
import styles from './HomePage.module.css';

// ── Category Quick-Links ──────────────────────────────────────────────────────
// Each entry maps to a category slug in the database and pre-fills the
// /explore?cat= query parameter when clicked. The 8 slugs correspond to
// the Category documents seeded in the database.
const CATEGORIES = [
  { slug:'park-recreational',     icon:'🌳', label:'Parks',      link:'/explore?cat=park-recreational' },
  { slug:'religious-site',         icon:'🛕', label:'Religious',  link:'/explore?cat=religious-site' },
  { slug:'heritage-cultural',      icon:'🏛️', label:'Heritage',   link:'/explore?cat=heritage-cultural' },
  { slug:'wildlife-recreational',  icon:'🦁', label:'Wildlife',   link:'/explore?cat=wildlife-recreational' },
  { slug:'modern-landmark',        icon:'🗼', label:'Landmarks',  link:'/explore?cat=modern-landmark' },
  { slug:'urban-coastal',          icon:'🌊', label:'Coastal',    link:'/explore?cat=urban-coastal' },
  { slug:'nature-eco',             icon:'🦜', label:'Nature',     link:'/explore?cat=nature-eco' },
  { slug:'educational-scientific', icon:'🔭', label:'Science',    link:'/explore?cat=educational-scientific' },
];

// ── How DayScape Works — 4-step process ──────────────────────────────────────
// Displayed as a grid of step cards in the "How It Works" section.
// n is the step number displayed as a decorative label (01, 02, 03, 04).
const STEPS = [
  { n:'01', icon:'🔍', title:'Explore', desc:'Browse 11 verified attractions across Colombo. Filter by category, review key details, and access essential information including timings, pricing, and visitor insights.' },
  { n:'02', icon:'📍', title:'Locate',  desc:'Enable location services to view real-time distances from your current position and discover nearby attractions within the defined radius.' },
  { n:'03', icon:'🗓️', title:'Plan',   desc:'Create your personalised day itinerary. Select destinations, organise your route, and save your plan for easy access and future use.' },
  { n:'04', icon:'🗺️', title:'Go',     desc:'Navigate your journey using the live map or Google Maps integration. Access route guidance and travel seamlessly across your selected destinations.' },
];

export default function HomePage() {
  // ── Auth & Location ───────────────────────────────────────────────────────
  const { user } = useAuth();
  // location: { lat, lng } when GPS is found, null otherwise
  // locationStatus: 'idle' | 'locating' | 'found' | 'error'
  // getLocation: trigger function to prompt GPS access
  const [featured, setFeatured] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const { location, locationStatus, getLocation } = useLocation();

  // ── Data Fetch on Mount ───────────────────────────────────────────────────
  // Fetch featured places and all packages in parallel with Promise.all.
  // Packages are filtered to only featured ones and capped at 3 for the preview grid.
  useEffect(() => {
    Promise.all([placeAPI.getFeatured(), packageAPI.getAll()])
      .then(([p, pkg]) => {
        setFeatured(p.data.places);
        setPackages(pkg.data.packages.filter(p => p.isFeatured).slice(0, 3));
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Live Distance Helper ──────────────────────────────────────────────────
  // Returns a Haversine distance (km) from the user's GPS to a place,
  // or null when GPS is unavailable (PlaceCard then falls back to server-stored distance).
  const getLiveDist = (place) =>
    location ? haversine(location.lat, location.lng, place.lat, place.lng) : null;

  return (
    <div className={styles.page}>

      {/* ── HERO - discovery-first ─────────────────────── */}
      {/* Full-viewport hero with background image overlay. Contains the tagline,
          two CTAs (Explore/Plan), and a row of 4 key stat numbers. */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          {/* Gold badge showing coverage area */}
          <div className="badge badge-gold" style={{ marginBottom: '1.25rem' }}>
            📍 25 km radius · Colombo, Sri Lanka
          </div>
          {/* Main headline — italic wraps the brand keyword */}
          <h1 className={styles.heroTitle}>
            Discover <em>Colombo's</em><br />Hidden Gems
          </h1>
          {/* Sub-headline — key value propositions for new visitors */}
          <p className={styles.heroSub}>
            Experience 11 of the finest attractions in and around Colombo, Sri Lanka. Effortlessly explore destinations, craft your own itinerary, and navigate with real-time maps - start exploring instantly, no sign-up required.
          </p>
          {/* Primary and secondary CTA buttons */}
          <div className={styles.heroBtns}>
            <Link to="/explore" className="btn btn-gold btn-lg">Explore Places</Link>
            <Link to="/planner" className="btn btn-outline btn-lg">Plan My Day</Link>
          </div>
          {/* Stat strip: 11 Attractions · 25km · 6+ Packages · Premium */}
          <div className={styles.heroStats}>
            <div className={styles.stat}><span className={styles.statNum}>11</span><span className={styles.statLabel}>Attractions</span></div>
            <div className={styles.statDiv}/>
            <div className={styles.stat}><span className={styles.statNum}>25km</span><span className={styles.statLabel}>Radius</span></div>
            <div className={styles.statDiv}/>
            <div className={styles.stat}><span className={styles.statNum}>6+</span><span className={styles.statLabel}>Packages</span></div>
            <div className={styles.statDiv}/>
            <div className={styles.stat}><span className={styles.statNum}>Premium</span><span className={styles.statLabel}>Planning</span></div>
          </div>
        </div>
        {/* Background: full-bleed image with dark overlay for text legibility */}
        <div className={styles.heroBg}>
          <div className={styles.heroBgOverlay}/>
          <img src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200" alt="Colombo" className={styles.heroBgImg}/>
        </div>
      </section>

      {/* ── LOCATION BAR ─────────────────────────────────── */}
      {/* Sticky-style bar below the hero that shows real-time GPS status.
          The dot colour changes: teal (found) → gold (locating) → red (error/none).
          The button text toggles between "↺ Refresh" and "📍 Enable Location". */}
      <div className={styles.locBar}>
        <div className="container">
          <div className={styles.locInner}>
            {/* Status indicator dot — CSS class determines the colour */}
            <div className={`${styles.locDot}
              ${locationStatus === 'found' ? styles.locFound :
                locationStatus === 'locating' ? styles.locating : styles.locError}`}
            />
            {/* Human-readable status message */}
            <span className={styles.locTxt}>
              {locationStatus === 'found'
                ? '📍 Live location active - distances updated to your current position'
                : locationStatus === 'locating'
                ? 'Detecting your location...'
                : 'Location unavailable - showing distances from 38 Rajasinghe Road, Colombo'}
            </span>
            {/* Trigger GPS request or refresh if already found */}
            <button className="btn btn-ghost btn-sm" onClick={getLocation}>
              {locationStatus === 'found' ? '↺ Refresh' : '📍 Enable Location'}
            </button>
          </div>
        </div>
      </div>

      {/* ── CATEGORIES ────────────────────────────────────── */}
      {/* 8-icon grid of category quick-links. Each card navigates to /explore
          pre-filtered by the corresponding category slug via query params. */}
      <section className={`section ${styles.catSection}`}>
        <div className="container">
          {/* Section header with View All link */}
          <div className={styles.sectionHd}>
            <div>
              <h2 className="section-title">Browse by Category</h2>
              <div className="gold-divider" />
            </div>
            <Link to="/explore" className="btn btn-ghost btn-sm">View All →</Link>
          </div>
          {/* Grid of category cards — one per CATEGORIES entry */}
          <div className={styles.catGrid}>
            {CATEGORIES.map(c => (
              <Link key={c.slug} to={c.link} className={styles.catCard}>
                <span className={styles.catIcon}>{c.icon}</span>
                <span className={styles.catLabel}>{c.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED PLACES ──────────────────────────────── */}
      {/* 3-column PlaceCard grid showing isFeatured places. While loading,
          a centred spinner is shown. Each card receives a liveDistance prop
          computed from the user's current GPS position (or null). */}
      <section className="section">
        <div className="container">
          <div className={styles.sectionHd}>
            <div>
              <h2 className="section-title">Featured Attractions</h2>
              <div className="gold-divider" />
                <p className="section-sub">
                  Explore highlights from our curated selection of 11 destinations within a 25 km radius of the reference location.
                </p>
              </div>
            <Link to="/explore" className="btn btn-ghost btn-sm">View All →</Link>
          </div>
          {/* Show spinner while fetching, then render the PlaceCard grid */}
          {loading ? (
            <div className="loading-center"><div className="spinner" /></div>
          ) : (
            <div className="grid-3">
              {featured.map(p => (
                // Pass live GPS distance to each PlaceCard so it can display real-time km
                <PlaceCard key={p._id} place={p} liveDistance={getLiveDist(p)} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────── */}
      {/* 4-step process cards (Explore → Locate → Plan → Go).
          Dark-background section to provide visual contrast. */}
      <section className={`section ${styles.howSection}`}>
        <div className="container">
          {/* Centred section header */}
          <div style={{ textAlign:'center', marginBottom:'3rem' }}>
            <h2 className="section-title">How DayScape Works</h2>
            <div className="gold-divider" style={{ margin:'0.5rem auto 1rem' }} />
            <p className="section-sub">
              Explore seamlessly as a guest, and unlock planning and saving features when you're ready.
            </p></div>
          {/* 4-column step grid — each card has a step number, icon, title, description */}
          <div className={styles.stepsGrid}>
            {STEPS.map(s => (
              <div key={s.n} className={styles.stepCard}>
                {/* Large decorative step number (01–04) */}
                <div className={styles.stepN}>{s.n}</div>
                <div className={styles.stepIcon}>{s.icon}</div>
                <h3 className={styles.stepTitle}>{s.title}</h3>
                <p className={styles.stepDesc}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── REFERENCE LOCATION CARD ─────────────────────── */}
      {/* Informs users that distances are calculated from 38 Rajasinghe Road
          when GPS is unavailable. Coordinates shown for transparency. */}
      <section className="section" style={{ paddingTop:0 }}>
        <div className="container">
          <div className={styles.refCard}>
            <div className={styles.refLeft}>
              {/* House icon */}
              <div className={styles.refIcon}>🏠</div>
              <div>
                <h3 className={styles.refTitle}>Official Reference Location</h3>
                <p className={styles.refAddr}>38, Rajasinghe Road, Wellawatte, Colombo 06, Sri Lanka</p>
                {/* Exact lat/lng used in haversine calculations */}
                <p className={styles.refCoords}>Lat: 6.868671 · Lng: 79.860689</p>
                <p className={styles.refNote}> All distances are calculated from this reference point when live GPS data is unavailable.</p>
              </div>
            </div>
            {/* CTA to open the live map centred on the reference location */}
            <Link to="/map" className="btn btn-gold">View on Map →</Link>
          </div>
        </div>
      </section>

      {/* ── PACKAGES ─────────────────────────────────────── */}
      {/* Only renders when at least one featured package exists.
          Shows up to 3 featured packages as clickable preview cards.
          Discount badge shown when pkg.discount > 0. */}
      {packages.length > 0 && (
        <section className="section" style={{ paddingTop:0 }}>
          <div className="container">
            <div className={styles.sectionHd}>
              <div>
                <h2 className="section-title">Travel Packages</h2>
                <div className="gold-divider" />
                <p className="section-sub">Discover curated day-trip packages across Colombo. Browse freely and book when you're ready.</p>
              </div>
              <Link to="/packages" className="btn btn-ghost btn-sm">All Packages →</Link>
            </div>
            {/* 3-column package preview grid */}
            <div className="grid-3">
              {packages.map(pkg => (
                // Full package card is a Link to /packages/:id
                <Link key={pkg._id} to={`/packages/${pkg._id}`} className={styles.pkgCard}>
                  {/* Cover image with optional discount badge overlay */}
                  <div className={styles.pkgImg}>
                    <img src={pkg.coverImage} alt={pkg.name} className="img-cover" />
                    {/* Show discount ribbon only when discount > 0 */}
                    {pkg.discount > 0 && (
                      <div className={styles.pkgDiscount}>{pkg.discount}% OFF</div>
                    )}
                  </div>
                  <div className={styles.pkgBody}>
                    {/* Duration badge (e.g. "Full Day") */}
                    <div className="badge badge-gold" style={{ marginBottom:'0.5rem' }}>{pkg.duration}</div>
                    <h3 className={styles.pkgName}>{pkg.name}</h3>
                    {/* Truncated description — 95 chars + ellipsis */}
                    <p className={styles.pkgDesc}>{pkg.description.substring(0, 95)}...</p>
                    <div className={styles.pkgFooter}>
                      <div>
                        {/* Show strikethrough original price when a discount is active */}
                        {pkg.originalPrice > pkg.price && (
                          <div className={styles.pkgOldPrice}>LKR {pkg.originalPrice.toLocaleString()}</div>
                        )}
                        {/* Current (possibly discounted) price */}
                        <div className={styles.pkgPrice}>LKR {pkg.price.toLocaleString()}</div>
                      </div>
                      {/* Non-interactive "View" button — the entire card is a Link */}
                      <span className="btn btn-gold btn-sm">View</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA - gentle, not a wall ─────────────────────── */}
      {/* Context-aware call-to-action section at the bottom of the page.
          Shows different buttons depending on whether the user is logged in.
          Logged-in users see planning options; guests see registration/explore prompts. */}
      <section className={styles.ctaSection}>
        <div className="container">
          <div className={styles.ctaCard}>
            {/* Decorative gold accent bar at the top of the card */}
            <div className={styles.ctaAccent} />
            {user ? (
              // ── Authenticated CTA — focused on planning and exploring
              <>
                <h2 className={styles.ctaTitle}>Ready for your next adventure?</h2>
                <p className={styles.ctaSub}>Open the live map, build a day plan, or browse all 11 verified attractions.</p>
                <div className={styles.ctaBtns}>
                  <Link to="/planner"  className="btn btn-gold btn-lg">Open Trip Planner</Link>
                  <Link to="/map"      className="btn btn-outline btn-lg">Live Map</Link>
                  <Link to="/explore"  className="btn btn-ghost btn-lg">Explore Places</Link>
                </div>
              </>
            ) : (
              // ── Guest CTA — encourage exploration and registration
              <>
                <h2 className={styles.ctaTitle}>Explore Colombo at Your Own Pace</h2>
                <p className={styles.ctaSub}>
                  Discover 11 verified attractions across Colombo. Browse freely, plan your perfect day,
                  save your favourites, and book curated experiences when you're ready.
                </p>
                <div className={styles.ctaBtns}>
                  <Link to="/explore"  className="btn btn-gold btn-lg">Browse All Places</Link>
                  <Link to="/register" className="btn btn-outline btn-lg">Create Free Account</Link>
                  <Link to="/login"    className="btn btn-ghost btn-lg">Sign In</Link>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
