/**
 * context/AuthContext.jsx — Global Authentication State
 *
 * Provides session state for both regular users and admin accounts across
 * the entire application. Consumed via the useAuth() hook.
 *
 * State managed:
 *  user    — The currently logged-in regular User object (null if not logged in)
 *  admin   — The currently logged-in Admin object (null if not logged in)
 *  loading — True while the initial token validation is in progress on page load
 *
 * On mount (useEffect):
 *  Reads 'token' and 'role' from localStorage. If a token exists, calls the
 *  appropriate /me endpoint (admin or user) to restore the session silently.
 *  If the token is expired or invalid, credentials are cleared from localStorage.
 *  Sets loading = false when done so ProtectedRoute/AdminRoute know auth is resolved.
 *
 * Methods exposed via context value:
 *  login(email, password)   — Authenticates a user; stores token + role='user'
 *  adminLogin(email, pass)  — Authenticates an admin; stores token + role='admin'
 *  register(formData)       — Creates a user account; auto-logs in after registration
 *  logout()                 — Clears token + role, resets state, redirects to /
 *  updateUser(u)            — Allows UserProfile to push updated user data into context
 *
 * Token storage:
 *  JWT is stored in localStorage under the key 'token'.
 *  Role ('user' | 'admin') is stored under 'role' to determine which /me API to call on refresh.
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, adminAuthAPI } from '../services/api';

// Create the context with null as the default (will throw if used outside provider)
const AuthContext = createContext(null);

// ── AuthProvider ──────────────────────────────────────────────────────────────
// Wraps the entire app (see App.jsx). Must be the outermost provider so that
// CartProvider and ToastProvider can safely consume it.
export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);   // Regular user session
  const [admin,   setAdmin]   = useState(null);   // Admin session
  const [loading, setLoading] = useState(true);   // True until initial token check completes

  // ── Session Restore on Mount ──────────────────────────────────────────────
  // Runs once when the app loads. If a stored token exists, silently validates
  // it by calling the appropriate /me endpoint and restoring the session state.
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      const role  = localStorage.getItem('role');

      if (token) {
        try {
          if (role === 'admin') {
            // Restore admin session using the admin /me endpoint
            const { data } = await adminAuthAPI.getMe();
            setAdmin(data.admin);
          } else {
            // Restore regular user session using the user /me endpoint
            const { data } = await authAPI.getMe();
            setUser(data.user);
          }
        } catch {
          // Token is expired or invalid — clear stored credentials
          localStorage.removeItem('token');
          localStorage.removeItem('role');
        }
      }
      // Signal to ProtectedRoute/AdminRoute that auth resolution is complete
      setLoading(false);
    };
    initAuth();
  }, []);

  // ── Login ─────────────────────────────────────────────────────────────────
  // Authenticates a regular user. Stores the JWT and sets role = 'user' so
  // the session restore on next page load calls the correct /me endpoint.
  const login = async (email, password) => {
    const { data } = await authAPI.login({ email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('role', 'user');
    setUser(data.user);
    return data;
  };

  // ── Admin Login ───────────────────────────────────────────────────────────
  // Authenticates an admin. Stores role = 'admin' to distinguish from user tokens.
  const adminLogin = async (email, password) => {
    const { data } = await adminAuthAPI.login({ email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('role', 'admin');
    setAdmin(data.admin);
    return data;
  };

  // ── Register ──────────────────────────────────────────────────────────────
  // Creates a new user account and immediately logs in (the API returns a token).
  const register = async (formData) => {
    const { data } = await authAPI.register(formData);
    localStorage.setItem('token', data.token);
    localStorage.setItem('role', 'user');
    setUser(data.user);
    return data;
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  // Clears all stored credentials, resets both user and admin state, and
  // hard-redirects to the home page (full reload clears any in-memory state).
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    setUser(null);
    setAdmin(null);
    window.location.href = '/'; // Hard redirect resets all component state
  };

  // ── Update User ───────────────────────────────────────────────────────────
  // Called by UserProfile after a successful profile update so the Navbar
  // immediately reflects the new name without requiring a page reload.
  const updateUser = (u) => setUser(u);

  return (
    <AuthContext.Provider value={{ user, admin, loading, login, adminLogin, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// ── useAuth Hook ──────────────────────────────────────────────────────────────
// Convenience hook that provides type-safe access to AuthContext.
// Throws an error if called outside of AuthProvider to catch setup mistakes early.
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
