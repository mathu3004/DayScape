/**
 * context/ToastContext.jsx — Global Toast Notification System
 *
 * Provides a lightweight in-app notification (toast) system.
 * Any component can show a toast message without prop-drilling by using
 * the useToast() hook.
 *
 * State managed:
 *  toasts — Array of active toast objects: { id: number, message: string, type: string }
 *
 * Toast types:
 *  'success' — Green toast with ✓ icon (e.g. "Added to favourites")
 *  'error'   — Red toast with ✕ icon (e.g. "Failed to load places")
 *  'info'    — Blue/neutral toast with ℹ icon (e.g. "Already in planner")
 *
 * Lifecycle:
 *  Each toast is assigned a unique ID (Date.now()), added to the array,
 *  and automatically removed after 3500 ms via setTimeout.
 *
 * The toast UI (rendered inside ToastProvider) is a fixed-position container
 * in the bottom-right corner, styled by .toast-container and .toast-{type}
 * classes defined in index.css.
 *
 * Exposed value (the `toast` object):
 *  toast.success(msg) — Show a green success toast
 *  toast.error(msg)   — Show a red error toast
 *  toast.info(msg)    — Show a neutral info toast
 */

import { createContext, useContext, useState, useCallback } from 'react';

// Create the context with null default (throws if consumed outside provider)
const ToastContext = createContext(null);

// ── ToastProvider ─────────────────────────────────────────────────────────────
// Renders the toast UI as a sibling to {children} inside the provider JSX.
// Must be inside the component tree so that the fixed-position container
// is always present in the DOM regardless of which page is active.
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]); // Array of currently visible toasts

  // ── Add Toast ─────────────────────────────────────────────────────────────
  // Creates a new toast with a unique timestamp-based ID, appends it to the
  // active list, and schedules its removal after 3500 ms.
  // Wrapped in useCallback to maintain a stable reference across renders.
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now(); // Unique ID — used to filter out the toast on removal
    setToasts(prev => [...prev, { id, message, type }]);
    // Auto-dismiss: remove this specific toast after 3.5 seconds
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  // ── Toast Shorthand Methods ───────────────────────────────────────────────
  // Convenience wrappers so callers write toast.success() instead of addToast(msg, 'success').
  const toast = {
    success: (msg) => addToast(msg, 'success'), // ✓ green — action confirmed
    error:   (msg) => addToast(msg, 'error'),   // ✕ red   — something went wrong
    info:    (msg) => addToast(msg, 'info'),     // ℹ blue  — neutral information
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* ── Toast Container ─────────────────────────────────────────────────
           Fixed-position overlay rendered alongside all page content.
           Styled by .toast-container in index.css (bottom-right, stacked). */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {/* Icon varies by type: ✓ success, ✕ error, ℹ info */}
            <span>{t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// ── useToast Hook ─────────────────────────────────────────────────────────────
// Convenience hook for consuming ToastContext.
// Throws if called outside ToastProvider to catch missing provider wrapping early.
export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
