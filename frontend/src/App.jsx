/**
 * App.jsx — Root Application Component & Router Configuration
 *
 * Sets up the full client-side routing tree using React Router v6.
 * Wraps the app in three global context providers (in order, outermost first):
 *
 *  AuthProvider  — Manages user and admin session state; exposes useAuth()
 *  CartProvider  — Manages shopping cart state; exposes useCart()
 *  ToastProvider — Manages toast notification queue; exposes useToast()
 *
 * Helper components defined in this file:
 *
 *  ScrollToTop    — Listens to route changes and scrolls window to (0,0)
 *                   so every page transition starts at the top of the viewport.
 *
 *  ProtectedRoute — Guards user-only pages. Redirects to /login if no
 *                   authenticated user is found in AuthContext.
 *
 *  AdminRoute     — Guards admin-only pages. Redirects to /admin/login if no
 *                   authenticated admin is found in AuthContext.
 *
 *  PublicLayout   — Wraps public pages with <Navbar>, a .page-wrapper div,
 *                   and <Footer>. Admin pages use <AdminLayout> instead.
 *
 * Route groups:
 *  Public         — /, /about, /explore, /place/:slug, /map, /packages, /packages/:id
 *  Auth           — /login, /register, /admin/login
 *  User (protected) — /dashboard, /profile, /favorites, /planner, /plans, /cart, /payment, /bookings
 *  Admin (protected) — /admin/* (nested under AdminLayout)
 *  Catch-all      — * → NotFoundPage
 *
 * Payment note:
 *  The /payment route is a single universal page that receives booking context
 *  via React Router's location.state (passed from PackageDetailPage, PlanDetailPage,
 *  and CartPage). No separate payment routes per booking type are needed.
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { CartProvider } from './context/CartContext';

// Shared layout components present on all public pages
import Navbar from './components/common/Navbar';
import Footer from './components/common/Footer';

// ── Public Pages ──────────────────────────────────────────────────────────────
import HomePage          from './pages/HomePage';
import AboutPage         from './pages/AboutPage';
import ExplorePage       from './pages/ExplorePage';
import PlaceDetailPage   from './pages/PlaceDetailPage';
import LiveMapPage       from './pages/LiveMapPage';
import PackagesPage      from './pages/PackagesPage';
import PackageDetailPage from './pages/PackageDetailPage';
import NotFoundPage      from './pages/NotFoundPage';

// ── Auth Pages ────────────────────────────────────────────────────────────────
import LoginPage      from './pages/auth/LoginPage';
import RegisterPage   from './pages/auth/RegisterPage';
import AdminLoginPage from './pages/auth/AdminLoginPage';

// ── User Pages (require login) ────────────────────────────────────────────────
import UserDashboard      from './pages/user/UserDashboard';
import UserProfile        from './pages/user/UserProfile';
import FavoritesPage      from './pages/user/FavoritesPage';
import PlannerPage        from './pages/user/PlannerPage';
import SavedPlansPage     from './pages/user/SavedPlansPage';
import EditPlanPage       from './pages/user/EditPlanPage';
import PlanDetailPage     from './pages/user/PlanDetailPage';
import CartPage           from './pages/user/CartPage';
import PaymentPage        from './pages/user/PaymentPage';
import BookingSuccessPage from './pages/user/BookingSuccessPage';
import BookingsPage       from './pages/user/BookingsPage';
import BookingDetailPage  from './pages/user/BookingDetailPage';

// ── Admin Pages (require admin login) ────────────────────────────────────────
import AdminLayout     from './layouts/AdminLayout';
import AdminDashboard  from './pages/admin/AdminDashboard';
import AdminPlaces     from './pages/admin/AdminPlaces';
import AdminUsers      from './pages/admin/AdminUsers';
import AdminPackages   from './pages/admin/AdminPackages';
import AdminReviews    from './pages/admin/AdminReviews';
import AdminBookings   from './pages/admin/AdminBookings';
import AdminCategories from './pages/admin/AdminCategories';

// ── ScrollToTop ───────────────────────────────────────────────────────────────
// Renders nothing but resets window scroll position on every pathname change.
// Without this, navigating between pages would preserve the previous scroll offset.
// Scrolls to top of page on every route change
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// ── ProtectedRoute ────────────────────────────────────────────────────────────
// Wraps pages that require a logged-in regular user.
// Shows a spinner while AuthContext is resolving the token on first load.
// Redirects to /login if the user is not authenticated.
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-center"><div className="spinner"/></div>;
  return user ? children : <Navigate to="/login" replace />;
};

// ── AdminRoute ────────────────────────────────────────────────────────────────
// Wraps pages that require a logged-in admin user.
// Redirects to /admin/login if no admin session is found in AuthContext.
const AdminRoute = ({ children }) => {
  const { admin, loading } = useAuth();
  if (loading) return <div className="loading-center"><div className="spinner"/></div>;
  return admin ? children : <Navigate to="/admin/login" replace />;
};

// ── PublicLayout ──────────────────────────────────────────────────────────────
// Adds the global Navbar and Footer around any public-facing page content.
// The .page-wrapper div provides consistent vertical padding above the footer.
const PublicLayout = ({ children }) => (
  <><Navbar /><div className="page-wrapper">{children}</div><Footer /></>
);

// ── AppRoutes ─────────────────────────────────────────────────────────────────
// Declares the full client-side route tree. All routes are rendered inside
// BrowserRouter (defined in the App component below).
function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        {/* ── Public Routes ──────────────────────────────────────────── */}
        <Route path="/"             element={<PublicLayout><HomePage /></PublicLayout>} />
        <Route path="/about"        element={<PublicLayout><AboutPage /></PublicLayout>} />
        <Route path="/explore"      element={<PublicLayout><ExplorePage /></PublicLayout>} />
        <Route path="/place/:slug"  element={<PublicLayout><PlaceDetailPage /></PublicLayout>} />
        <Route path="/map"          element={<PublicLayout><LiveMapPage /></PublicLayout>} />
        <Route path="/packages"     element={<PublicLayout><PackagesPage /></PublicLayout>} />
        <Route path="/packages/:id" element={<PublicLayout><PackageDetailPage /></PublicLayout>} />

        {/* ── Auth Routes ────────────────────────────────────────────── */}
        <Route path="/login"        element={<LoginPage />} />
        <Route path="/register"     element={<RegisterPage />} />
        <Route path="/admin/login"  element={<AdminLoginPage />} />

        {/* ── User Protected Routes ───────────────────────────────────── */}
        <Route path="/dashboard"       element={<ProtectedRoute><PublicLayout><UserDashboard /></PublicLayout></ProtectedRoute>} />
        <Route path="/profile"         element={<ProtectedRoute><PublicLayout><UserProfile /></PublicLayout></ProtectedRoute>} />
        <Route path="/favorites"       element={<ProtectedRoute><PublicLayout><FavoritesPage /></PublicLayout></ProtectedRoute>} />
        <Route path="/planner"         element={<ProtectedRoute><PublicLayout><PlannerPage /></PublicLayout></ProtectedRoute>} />
        <Route path="/plans"           element={<ProtectedRoute><PublicLayout><SavedPlansPage /></PublicLayout></ProtectedRoute>} />
        <Route path="/plans/:id"       element={<ProtectedRoute><PublicLayout><PlanDetailPage /></PublicLayout></ProtectedRoute>} />
        <Route path="/plans/:id/edit"  element={<ProtectedRoute><PublicLayout><EditPlanPage /></PublicLayout></ProtectedRoute>} />
        <Route path="/cart"            element={<ProtectedRoute><PublicLayout><CartPage /></PublicLayout></ProtectedRoute>} />
        {/* Single payment route - receives all context via location.state */}
        <Route path="/payment"         element={<ProtectedRoute><PublicLayout><PaymentPage /></PublicLayout></ProtectedRoute>} />
        <Route path="/booking-success" element={<ProtectedRoute><PublicLayout><BookingSuccessPage /></PublicLayout></ProtectedRoute>} />
        <Route path="/bookings"        element={<ProtectedRoute><PublicLayout><BookingsPage /></PublicLayout></ProtectedRoute>} />
        <Route path="/bookings/:id"    element={<ProtectedRoute><PublicLayout><BookingDetailPage /></PublicLayout></ProtectedRoute>} />

        {/* ── Admin Protected Routes (nested under AdminLayout) ──────── */}
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index           element={<Navigate to="/admin/dashboard" />} />
          <Route path="dashboard"  element={<AdminDashboard />} />
          <Route path="places"     element={<AdminPlaces />} />
          <Route path="users"      element={<AdminUsers />} />
          <Route path="packages"   element={<AdminPackages />} />
          <Route path="reviews"    element={<AdminReviews />} />
          <Route path="bookings"   element={<AdminBookings />} />
          <Route path="categories" element={<AdminCategories />} />
        </Route>

        {/* ── 404 Catch-all ──────────────────────────────────────────── */}
        <Route path="*" element={<PublicLayout><NotFoundPage /></PublicLayout>} />
      </Routes>
    </>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
// Root component. Wraps the entire application in BrowserRouter and the three
// global context providers. Provider order matters: AuthProvider must be
// outermost because CartProvider may need the auth state in the future.
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
