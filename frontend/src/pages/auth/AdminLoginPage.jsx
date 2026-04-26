/**
 * pages/auth/AdminLoginPage.jsx — Admin Login Page (re-export)
 *
 * This file is a thin re-export shim for React Router lazy-loading.
 * The actual AdminLoginPage component is co-located in LoginPage.jsx
 * alongside the LoginPage and RegisterPage components.
 *
 * Why co-located: All three auth forms share the same EyeIcon/EyeOffIcon
 * SVG components and similar layout patterns, so they live in one file.
 * This shim exposes AdminLoginPage as a default export for clean route config:
 * <Route path="/admin/login" element={<AdminLoginPage />} />
 *
 * AdminLoginPage uses a separate login endpoint (authAPI.adminLogin) that
 * verifies the admin role flag before issuing a token.
 * On success, calls AuthContext.adminLogin() then navigates to /admin/dashboard.
 */
export { AdminLoginPage as default } from './LoginPage';
