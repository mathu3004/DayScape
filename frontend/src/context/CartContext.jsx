/**
 * context/CartContext.jsx — Global Shopping Cart State
 *
 * Maintains the user's shopping cart in React state and synchronises it with
 * the backend. Consumed by any component that needs to read or mutate the cart.
 *
 * State managed:
 *  cart      — The full Cart document returned by the API (null if not loaded)
 *  cartCount — Number of items in the cart (used for the Navbar badge)
 *
 * Behaviour:
 *  - When a user logs in (user changes from null → object), fetchCart() fires
 *    automatically via useEffect. This populates the cart on page load.
 *  - When a user logs out (user → null), the cart is cleared to null and count to 0.
 *  - fetchCart is wrapped in useCallback so it is stable across renders and can
 *    safely be listed as a useEffect dependency.
 *
 * Methods exposed via context value:
 *  fetchCart()             — Re-fetch the latest cart from the API (e.g. after navigating)
 *  addToCart(payload)      — Add a package or plan item; updates state from API response
 *  removeFromCart(itemId)  — Remove a single item by its sub-document _id
 *  updateCartItem(id, data)— Update adults/children count for a cart item
 *  clearCart()             — Empty the cart (optimistic local update; also calls API)
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { cartAPI } from '../services/api';
import { useAuth } from './AuthContext';

// Create the context with null as default (throws if consumed outside provider)
const CartContext = createContext(null);

// ── CartProvider ──────────────────────────────────────────────────────────────
// Nested inside AuthProvider in App.jsx so it has access to the current user.
export const CartProvider = ({ children }) => {
  const { user } = useAuth();          // Subscribe to auth state changes
  const [cart,      setCart]      = useState(null); // Full cart document from API
  const [cartCount, setCartCount] = useState(0);    // Item count for Navbar badge

  // ── Fetch Cart ────────────────────────────────────────────────────────────
  // Retrieves the user's cart from the API. If the user is not logged in, clears
  // the local cart state. Wrapped in useCallback to keep the reference stable.
  const fetchCart = useCallback(async () => {
    if (!user) {
      // User logged out — clear cart state immediately
      setCart(null);
      setCartCount(0);
      return;
    }
    try {
      const { data } = await cartAPI.getCart();
      setCart(data.cart);
      setCartCount(data.cart?.items?.length || 0);
    } catch {
      // Network error or expired token — reset to empty state
      setCart(null);
      setCartCount(0);
    }
  }, [user]); // Re-create only when user identity changes

  // ── Auto-fetch on User Change ─────────────────────────────────────────────
  // Fetches the cart whenever the user logs in or out.
  useEffect(() => { fetchCart(); }, [fetchCart]);

  // ── Add to Cart ───────────────────────────────────────────────────────────
  // Calls the add-item API and replaces local cart state with the full updated
  // cart returned by the server. Returns the API response for caller use.
  const addToCart = async (payload) => {
    const { data } = await cartAPI.addItem(payload);
    setCart(data.cart);
    setCartCount(data.cart?.items?.length || 0);
    return data;
  };

  // ── Remove from Cart ──────────────────────────────────────────────────────
  // Removes a single item by its MongoDB sub-document _id.
  // Updates state from the server response to stay in sync.
  const removeFromCart = async (itemId) => {
    const { data } = await cartAPI.removeItem(itemId);
    setCart(data.cart);
    setCartCount(data.cart?.items?.length || 0);
  };

  // ── Update Cart Item ──────────────────────────────────────────────────────
  // Updates the guest counts (adults/children) for a specific cart item.
  // The server recalculates the line-item total and returns the updated cart.
  const updateCartItem = async (itemId, data) => {
    const { data: res } = await cartAPI.updateItem(itemId, data);
    setCart(res.cart);
    setCartCount(res.cart?.items?.length || 0);
  };

  // ── Clear Cart ────────────────────────────────────────────────────────────
  // Empties the cart both on the server and locally. Uses an optimistic local
  // update (spread to preserve other cart fields like _id and user) rather than
  // waiting for the API response before clearing the UI.
  const clearCart = async () => {
    await cartAPI.clearCart();
    // Optimistically set items to empty while retaining the cart document shape
    setCart(prev => prev ? { ...prev, items: [] } : null);
    setCartCount(0);
  };

  return (
    <CartContext.Provider value={{ cart, cartCount, fetchCart, addToCart, updateCartItem, removeFromCart, clearCart }}>
      {children}
    </CartContext.Provider>
  );
};

// ── useCart Hook ──────────────────────────────────────────────────────────────
// Convenience hook that provides type-safe access to CartContext.
// Throws if called outside CartProvider to surface missing provider wrapping early.
export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
