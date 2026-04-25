/**
 * components/common/Navbar.jsx — Top Navigation Bar
 *
 * Renders the site-wide navigation bar present on all public and user pages.
 * Adapts its content based on authentication state (guest vs logged-in user).
 *
 * State:
 *  menuOpen — Controls the mobile hamburger menu open/close state
 *  dropOpen — Controls the user dropdown menu open/close on desktop hover
 *
 * Navigation links (nl helper):
 *  Builds a <NavLink> that applies .linkActive CSS class on the active route.
 *  Clicking any link calls close() to collapse the mobile menu.
 *
 * Guest view (no user):
 *  - Links: Home, Explore, Live Map, Packages, About
 *  - Actions: "Sign In" button, "Get Started" (register) button
 *
 * Logged-in user view:
 *  - Links: Home, Explore, Live Map, Packages, Trip Planner, Saved Plans, About
 *  - Actions: Cart icon with badge (item count from CartContext), user dropdown
 *
 * User dropdown (desktop hover / mobile):
 *  Dashboard, My Profile, Trip Planner, Saved Plans, Favourites, My Bookings,
 *  Cart (with count), Sign Out
 *
 * Cart badge:
 *  Shows cartCount from CartContext as a red number badge over the cart icon.
 *  Only visible when cartCount > 0.
 *
 * Hamburger:
 *  Three-line button shown on mobile. Clicking toggles menuOpen which slides
 *  the nav links into view. Gets .hamburgerOpen class when active.
 */

import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { user, logout }  = useAuth();   // Current user session
  const { cartCount }     = useCart();   // Number of items in the cart (for badge)
  const [menuOpen, setMenuOpen] = useState(false); // Mobile hamburger state
  const [dropOpen, setDropOpen] = useState(false); // Desktop user dropdown state
  const nav = useNavigate();

  // ── Close All Menus ───────────────────────────────────────────────────────
  // Called on every link click to collapse the mobile menu and dropdown.
  const close = () => { setMenuOpen(false); setDropOpen(false); };

  // ── NavLink Builder ───────────────────────────────────────────────────────
  // Creates a NavLink with active styling. `exact` uses React Router's `end`
  // prop so only the exact path "/" matches as "home" and not every route.
  const nl = (to, label, exact = false) => (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) => isActive ? `${styles.link} ${styles.linkActive}` : styles.link}
      onClick={close}
    >
      {label}
    </NavLink>
  );

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>

        {/* ── Logo ──────────────────────────────────────────────────────── */}
        <Link to="/" className={styles.logo} onClick={close}>
          Day<em>Scape</em>
        </Link>

        {/* ── Main Navigation Links ─────────────────────────────────────── */}
        {/* On mobile, shown/hidden via the .open class toggled by hamburger */}
        {/* Nav links - guest and user see these */}
        <div className={`${styles.links} ${menuOpen ? styles.open : ''}`}>
          {nl('/', 'Home', true)}
          {nl('/explore', 'Explore')}
          {nl('/map', 'Live Map')}
          {nl('/packages', 'Packages')}
          {/* User-only links shown inline on mobile */}
          {user && (
            <>
              {nl('/planner', 'Trip Planner')}
              {nl('/plans', 'Saved Plans')}
            </>
          )}
          {nl('/about', 'About')}
        </div>

        {/* ── Right-side Actions ────────────────────────────────────────── */}
        <div className={styles.actions}>
          {user ? (
            <>
              {/* Cart icon with item count badge — only visible when count > 0 */}
              {/* Cart */}
              <Link to="/cart" className={styles.cartBtn} onClick={close}>
                🛒
                {cartCount > 0 && <span className={styles.cartBadge}>{cartCount}</span>}
              </Link>

              {/* User avatar dropdown — hover to open on desktop */}
              {/* User menu */}
              <div
                className={styles.userMenu}
                onMouseEnter={() => setDropOpen(true)}
                onMouseLeave={() => setDropOpen(false)}
              >
                {/* Avatar button shows first initial and first name */}
                <button className={styles.avatar}>
                  <span className={styles.avatarInitials}>{user.name?.charAt(0)?.toUpperCase()}</span>
                  <span className={styles.avatarName}>{user.name?.split(' ')[0]}</span>
                  <span className={styles.chevron}>▾</span>
                </button>

                {/* Dropdown menu — visible on hover (dropOpen state) */}
                {dropOpen && (
                  <div className={styles.dropdown}>
                    <Link to="/dashboard"  className={styles.dropItem} onClick={close}>📊 Dashboard</Link>
                    <Link to="/profile"    className={styles.dropItem} onClick={close}>👤 My Profile</Link>
                    <Link to="/planner"    className={styles.dropItem} onClick={close}>🗓️ Trip Planner</Link>
                    <Link to="/plans"      className={styles.dropItem} onClick={close}>📋 Saved Plans</Link>
                    <Link to="/favorites"  className={styles.dropItem} onClick={close}>❤️ Favourites</Link>
                    <Link to="/bookings"   className={styles.dropItem} onClick={close}>🎫 My Bookings</Link>
                    <Link to="/cart"       className={styles.dropItem} onClick={close}>🛒 Cart {cartCount > 0 && `(${cartCount})`}</Link>
                    <div className={styles.dropDivider} />
                    <button
                      className={`${styles.dropItem} ${styles.dropLogout}`}
                      onClick={() => { close(); logout(); }}
                    >
                      ⏻ Sign Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            // Guest view: Sign In (outline) + Get Started (gold CTA)
            <>
              <Link to="/login"    className={`btn btn-outline btn-sm ${styles.hideOnMobile}`} onClick={close}>Sign In</Link>
              <Link to="/register" className="btn btn-gold btn-sm" onClick={close}>Get Started</Link>
            </>
          )}

          {/* ── Hamburger Button (mobile only) ──────────────────────────── */}
          {/* Three <span> bars styled in CSS; .hamburgerOpen animates to an X */}
          <button
            className={`${styles.hamburger} ${menuOpen ? styles.hamburgerOpen : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <span /><span /><span />
          </button>
        </div>

      </div>
    </nav>
  );
}
