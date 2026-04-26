/**
 * pages/auth/RegisterPage.jsx — Register Page (re-export)
 *
 * This file is a thin re-export shim for React Router lazy-loading.
 * The actual RegisterPage component is co-located in LoginPage.jsx
 * alongside the LoginPage and AdminLoginPage components.
 *
 * Why co-located: All three auth forms (Login, Register, AdminLogin)
 * share the same EyeIcon/EyeOffIcon SVG components and similar patterns,
 * so they are defined in a single file. This shim exposes RegisterPage
 * as a default export for clean route config:
 * <Route path="/register" element={<RegisterPage />} />
 *
 * RegisterPage collects: Full Name, Email, Password (min 6 chars),
 * and Visitor Type (local/foreigner). Calls AuthContext.register()
 * then navigates to /dashboard on success.
 */
export { RegisterPage as default } from './LoginPage';
