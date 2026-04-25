/**
 * layouts/AdminLayout.jsx — Admin Panel Shell Layout
 *
 * Provides the persistent sidebar navigation and main content area for all
 * admin panel pages. Rendered as the parent route element for /admin/* routes
 * (see App.jsx). Child admin pages are injected via React Router's <Outlet />.
 *
 * Structure:
 *  <div.layout>
 *    <aside.sidebar>        — Fixed left sidebar with nav items and admin info
 *      <div.sidebarHeader>  — DayScape logo + "Admin Panel" label
 *      <nav.nav>            — List of NavLink items (active state highlighted)
 *      <div.sidebarFooter>  — Admin avatar/name + logout button
 *    <main.main>
 *      <div.mainInner>
 *        <Outlet />         — Current admin page renders here
 *
 * navItems:
 *  Each item has { to, icon (emoji), label }. The NavLink className callback
 *  applies the CSS `active` class when the current route matches `to`.
 *
 * Logout:
 *  Calls AuthContext.logout() (clears token + state) then navigates to /admin/login.
 *  The navigate() call is necessary because logout() does a hard redirect to '/'
 *  which would take the admin to the public home page — navigate ensures they
 *  land on the admin login page instead.
 *
 * Admin avatar:
 *  Displays the first character of admin.name as the avatar initials.
 *  Falls back to 'A' if the admin name is not yet loaded.
 */

import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './AdminLayout.module.css';

// ── Sidebar Navigation Items ──────────────────────────────────────────────────
// Each entry renders as an emoji-icon NavLink in the left sidebar.
// Order here determines the visual order in the sidebar navigation.
const navItems = [
  { to: '/admin/dashboard',  icon: '📊', label: 'Dashboard'  },
  { to: '/admin/places',     icon: '📍', label: 'Places'     },
  { to: '/admin/categories', icon: '🏷️', label: 'Categories' },
  { to: '/admin/packages',   icon: '📦', label: 'Packages'   },
  { to: '/admin/bookings',   icon: '📋', label: 'Bookings'   },
  { to: '/admin/reviews',    icon: '⭐', label: 'Reviews'    },
  { to: '/admin/users',      icon: '👥', label: 'Users'      },
];

// ── AdminLayout ───────────────────────────────────────────────────────────────
export default function AdminLayout() {
  const { admin, logout } = useAuth(); // Current admin session from AuthContext
  const navigate = useNavigate();

  return (
    <div className={styles.layout}>

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className={styles.sidebar}>

        {/* Logo & panel label */}
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}>Day<em>Scape</em></div>
          <div className={styles.logoSub}>Admin Panel</div>
        </div>

        {/* Navigation links — active link gets the .active CSS class */}
        <nav className={styles.nav}>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.active : ''}`
              }
            >
              <span className={styles.icon}>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Admin info and logout at the bottom of the sidebar */}
        <div className={styles.sidebarFooter}>
          <div className={styles.adminInfo}>
            {/* Avatar circle shows first letter of admin name */}
            <div className={styles.adminAvatar}>{admin?.name?.charAt(0) || 'A'}</div>
            <div>
              <div className={styles.adminName}>{admin?.name}</div>
              <div className={styles.adminRole}>Administrator</div>
            </div>
          </div>
          {/* Logout: clear auth state then redirect to admin login page */}
          <button
            className={styles.logoutBtn}
            onClick={() => { logout(); navigate('/admin/login'); }}
          >
            ⏻ Logout
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ─────────────────────────────────────────────── */}
      {/* <Outlet /> renders the active admin child route (Dashboard, Places, etc.) */}
      <main className={styles.main}>
        <div className={styles.mainInner}>
          <Outlet />
        </div>
      </main>

    </div>
  );
}
