/**
 * pages/AboutPage.jsx — About DayScape + 404 Not Found
 *
 * This file exports TWO page components:
 *
 *  1. AboutPage (default export)
 *     Renders the About DayScape page with:
 *     - Project description paragraph
 *     - 4 feature cards (Location-Aware, Smart Planner, Live Map, Packages)
 *     - Project information table (module, student, university, tech stack)
 *     - Two CTA buttons (Explore / Live Map)
 *
 *  2. NotFoundPage (named export)
 *     Rendered by the catch-all route in App.jsx for any unmatched URL.
 *     Shows a large decorative "404" number and a link back to the homepage.
 *
 * Both components are defined here and re-exported as needed:
 *  - NotFoundPage.jsx re-exports NotFoundPage from this file
 *  - App.jsx imports { AboutPage } and { NotFoundPage } separately
 *
 * Project metadata shown on the About page:
 *  Module       : ITE2953 - Programming Group Project 25S1
 *  Student      : K. Mathusha (E2320170)
 *  University   : University of Moratuwa (CODL)
 *  Tech Stack   : React · Node.js · Express.js · MongoDB · Leaflet.js · JWT
 *  Coverage     : 11 attractions within 25 km of reference location
 */

// AboutPage.jsx
import { Link } from 'react-router-dom';

// ── AboutPage ─────────────────────────────────────────────────────────────────
// Provides an overview of the DayScape project — its purpose, features, and
// academic context. Accessible from the /about route and Navbar links.
export function AboutPage() {
  return (
    <div style={{ padding: '3rem 0 5rem' }}>
      <div className="container" style={{ maxWidth: 860 }}>
        {/* Gold badge header */}
        <div className="badge badge-gold" style={{ marginBottom: '1rem' }}>About DayScape</div>

        {/* Page headline with italic gold accent */}
        <h1 style={{ fontFamily: 'Cormorant Garamond', fontSize: 'clamp(2rem,5vw,3.5rem)', color: 'var(--txt)', marginBottom: '0.75rem' }}>Sri Lanka's Local<br /><em style={{ color: 'var(--gold)', fontStyle: 'italic' }}>Day-Visit Planner</em></h1>
        <div className="gold-divider" />

        {/* Project description paragraph */}
        <p style={{ fontSize: '1.05rem', color: 'var(--txt2)', lineHeight: '1.8', marginBottom: '2rem', maxWidth: 640 }}>
        'DayScape is a web-based tourism information and day-visit planning system focused on 11 verified attractions
        within a 25 km radius of a reference location in Colombo, Sri Lanka. Developed as a second-year university project
        for ITE2953, it demonstrates real-world requirement analysis, full-stack development, and practical tourism
        technology solutions.'</p>

        {/* ── 4 Feature Cards ─────────────────────────────────────────── */}
        {/* 2-column grid of cards describing the platform's core capabilities */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '3rem' }}>
          {[
            { icon: '📍', t: 'Location-Aware', d: 'Uses your live GPS location to display real-time distances to all 11 attractions and provide personalised navigation guidance.' },
            { icon: '🗓️', t: 'Smart Planner', d: 'Create, organise, and save multi-stop day-trip itineraries. Unlock PDF export and route access after booking.' },
            { icon: '🗺️', t: 'Live Map', d: 'Interactive Leaflet map displaying all attractions along with nearby services such as restaurants, hospitals, fuel stations, and police stations, with integrated route guidance.' },
            { icon: '📦', t: 'Packages & Booking', d: 'Curated travel packages with secure card payment, booking management, and confirmation tracking.' },
          ].map(f => (
            // Each card rendered as a standard .card with icon, title, and description
            <div key={f.t} className="card">
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{f.icon}</div>
              <h3 style={{ fontFamily: 'Cormorant Garamond', fontSize: '1.15rem', color: 'var(--txt)', marginBottom: '0.5rem' }}>{f.t}</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--txt3)', lineHeight: '1.65' }}>{f.d}</p>
            </div>
          ))}
        </div>

        {/* ── Project Information Table ────────────────────────────────── */}
        {/* Key-value rows showing academic and technical metadata about the project */}
        <div className="card" style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '1.5rem', color: 'var(--txt)', marginBottom: '1rem' }}>Project Information</h2>
          {[
            { l: 'Module', v: 'ITE2953 - Programming Group Project 25S1' },
            { l: 'Student', v: 'K. Mathusha (E2320170)' },
            { l: 'Degree', v: 'Bachelor of Information Technology (External)' },
            { l: 'University', v: 'University of Moratuwa, Faculty of Information Technology (CODL)' },
            { l: 'Reference Location', v: '38, Rajasinghe Road, Wellawatte, Colombo-06, Sri Lanka' },
            { l: 'Coverage', v: '11 curated attractions within a 25 km radius of the reference location' },
            { l: 'Tech Stack', v: 'React.js · Node.js · Express.js · MongoDB · Leaflet.js · JWT Authentication' },
          ].map(r => (
            // Each row: label (min-width 160px) + value
            <div key={r.l} style={{ display: 'flex', gap: '1rem', padding: '0.6rem 0', borderBottom: '1px solid var(--brd)', fontSize: '0.875rem', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--txt3)', minWidth: 160 }}>{r.l}</span>
              <span style={{ color: 'var(--txt)', fontWeight: 500 }}>{r.v}</span>
            </div>
          ))}
        </div>

        {/* ── CTA Buttons ──────────────────────────────────────────────── */}
        {/* Two navigation buttons to the main functional pages */}
        <div style={{ textAlign: 'center' }}>
          <Link to="/explore" className="btn btn-gold btn-lg" style={{ marginRight: '1rem' }}>Explore All Places</Link>
          <Link to="/map" className="btn btn-outline btn-lg">Open Live Map</Link>
        </div>
      </div>
    </div>
  );
}

// ── NotFoundPage ──────────────────────────────────────────────────────────────
// Catch-all 404 page rendered when no route in App.jsx matches the current URL.
// The large "404" is rendered in a Cormorant Garamond font with low opacity for
// a decorative aesthetic. A single "Go to Homepage" CTA is shown.
export function NotFoundPage() {
  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem' }}>
      <div>
        {/* Decorative oversized 404 number — gold colour, low opacity for subtlety */}
        <div style={{ fontFamily: 'Cormorant Garamond', fontSize: '8rem', color: 'var(--gold)', opacity: 0.3, lineHeight: 1 }}>404</div>
        {/* Main heading */}
        <h1 style={{ fontFamily: 'Cormorant Garamond', fontSize: '2rem', color: 'var(--txt)', marginBottom: '0.75rem' }}>Page Not Found</h1>
        {/* Explanatory sub-text */}
        <p style={{ color: 'var(--txt3)', marginBottom: '2rem' }}>The page you're looking for doesn't exist or has been moved.</p>
        {/* Navigate back to the landing page */}
        <Link to="/" className="btn btn-gold">Go to Homepage</Link>
      </div>
    </div>
  );
}

// Default export is AboutPage — NotFoundPage.jsx re-exports NotFoundPage from here
export default AboutPage;
