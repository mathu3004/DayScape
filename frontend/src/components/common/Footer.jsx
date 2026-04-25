/**
 * components/common/Footer.jsx — Site-wide Footer
 *
 * Rendered at the bottom of every public page via the PublicLayout wrapper
 * in App.jsx. Contains four columns: branding, Explore links, Account links,
 * and Contact information.
 *
 * Columns:
 *  1. Branding   — DayScape logo + tagline describing the platform's scope
 *  2. Explore    — Links to All Places, Live Map, Packages, About
 *  3. Account    — Links to Create Account, Sign In, Trip Planner, My Favourites
 *  4. Contact    — Email, phone, physical address (opens Google Maps), office hours
 *
 * Reference address:
 *  38, Rajasinghe Road, Colombo 06 — links to Google Maps at lat/lng 6.868671, 79.860689
 *
 * Copyright line:
 *  Auto-updates the year using new Date().getFullYear() so it never goes stale.
 *  Credits the ITE2953 Programming Group Project at University of Moratuwa.
 */

import { Link } from 'react-router-dom';
import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className="container">

        {/* ── Four-column grid ─────────────────────────────────────────── */}
        <div className={styles.grid}>

          {/* Column 1: Branding */}
          <div>
            <div className={styles.logo}>Day<em>Scape</em></div>
            <p className={styles.tagline}>
              Your personalised day-trip planner for Colombo and its surroundings.
              Discover 11 verified attractions within a 25 km radius.
            </p>
          </div>

          {/* Column 2: Explore links */}
          <div>
            <h4 className={styles.colTitle}>Explore</h4>
            <ul className={styles.linkList}>
              <li><Link to="/explore">All Places</Link></li>
              <li><Link to="/map">Live Map</Link></li>
              <li><Link to="/packages">Packages</Link></li>
              <li><Link to="/about">About DayScape</Link></li>
            </ul>
          </div>

          {/* Column 3: Account links */}
          <div>
            <h4 className={styles.colTitle}>Account</h4>
            <ul className={styles.linkList}>
              <li><Link to="/register">Create Account</Link></li>
              <li><Link to="/login">Sign In</Link></li>
              <li><Link to="/planner">Trip Planner</Link></li>
              <li><Link to="/favorites">My Favourites</Link></li>
            </ul>
          </div>

          {/* Column 4: Contact details */}
          <div>
            <h4 className={styles.colTitle}>Contact</h4>
            <ul className={styles.linkList}>
              <li>
                {/* Email address — opens default mail client */}
                <a href="mailto:e2320170@bit.uom.lk">
                  📧 e2320170@bit.uom.lk
                </a>
              </li>
              <li>
                {/* Phone number — opens phone dialler on mobile */}
                <a href="tel:+94750701210">
                  📞 +94 75 070 1210
                </a>
              </li>
              <li>
                {/* Physical address — links to Google Maps at the reference coordinates */}
                <a
                  href="https://www.google.com/maps?q=6.868671,79.860689"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="reference-link"
                >
                  🏠 38, Rajasinghe Road, Colombo 06.
                </a>
              </li>
              <li><span>🕒 Mon-Sat: 9AM-6PM</span></li>
            </ul>
          </div>

        </div>

        {/* ── Copyright bar ─────────────────────────────────────────────── */}
        {/* Year auto-updates so the footer never shows a stale copyright year */}
        <div className={styles.bottom}>
          <p>© {new Date().getFullYear()} DayScape. Programming Group Project - ITE2953 · University of Moratuwa · K. Mathusha (E2320170)</p>
        </div>

      </div>
    </footer>
  );
}
