/**
 * pages/user/CartPage.jsx — Shopping Cart
 *
 * Displays all items in the user's cart with quantity controls, per-item
 * totals, and a sticky order summary sidebar. Navigates to /payment when
 * the user proceeds to checkout.
 *
 * Cart data comes from CartContext (useCart hook), which fetches from the
 * server on mount and keeps the local state in sync after mutations.
 *
 * Per-item price formula:
 *  getItemTotal(item) = item.price × (adults + children × 0.5)
 *  Children are priced at 50% of the adult rate throughout the app.
 *
 * Grand total:
 *  Sum of getItemTotal() across all items. Passed to /payment as state.
 *
 * Quantity controls:
 *  Adults: min 1 (enforced by Math.max in CartContext.updateCartItem)
 *  Children: min 0
 *  Each ± button calls handleUpdate(itemId, newAdults, newChildren).
 *  updating state tracks which item is being updated to disable its buttons.
 *
 * Checkout:
 *  handleCheckout() navigates to /payment with:
 *  state: { mode: 'cart', cartItems: items, grandTotal }
 *  PaymentPage reads this to set up a cart-type booking.
 *
 * Cover image fallback:
 *  Shows package or plan cover image. Falls back to a 📦 or 🗓️ emoji placeholder
 *  when no cover image is available.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import styles from './Cart.module.css';

export default function CartPage() {
  // ── Context ───────────────────────────────────────────────────────────────
  const { cart, cartCount, removeFromCart, updateCartItem, clearCart } = useCart();
  const toast = useToast();
  const nav = useNavigate();

  // ── Loading State Trackers ────────────────────────────────────────────────
  const [removing, setRemoving] = useState(null); // Item _id being removed (shows "..." button)
  const [updating, setUpdating] = useState(null); // Item _id being updated (disables buttons)

  // Safely extract items array from cart (null-safe)
  const items = cart?.items || [];

  // ── Per-item Total Calculation ────────────────────────────────────────────
  // Children are charged at 50% of the adult rate.
  const getItemTotal = (item) => {
    const base = item.price || 0;
    return base * (item.adults + item.children * 0.5);
  };

  // ── Grand Total ───────────────────────────────────────────────────────────
  const grandTotal = items.reduce((s, i) => s + getItemTotal(i), 0);

  // ── Update Quantity Handler ───────────────────────────────────────────────
  // Calls CartContext.updateCartItem() and shows error toast on failure.
  const handleUpdate = async (itemId, adults, children) => {
    setUpdating(itemId);
    try {
      await updateCartItem(itemId, { adults, children });
    } catch { toast.error('Failed to update item'); }
    finally { setUpdating(null); }
  };

  // ── Remove Item Handler ───────────────────────────────────────────────────
  // Calls CartContext.removeFromCart() — shows "..." on the button while loading.
  const handleRemove = async (itemId) => {
    setRemoving(itemId);
    try {
      await removeFromCart(itemId);
      toast.success('Item removed from cart');
    } catch { toast.error('Failed to remove item'); }
    finally { setRemoving(null); }
  };

  // ── Clear All Handler ─────────────────────────────────────────────────────
  // Requires native confirm() before calling CartContext.clearCart().
  const handleClear = async () => {
    if (!confirm('Clear all items from cart?')) return;
    await clearCart();
    toast.info('Cart cleared');
  };

  // ── Checkout Handler ──────────────────────────────────────────────────────
  // Guards against empty cart. Navigates to /payment with cart mode context.
  const handleCheckout = () => {
    if (items.length === 0) { toast.error('Your cart is empty'); return; }
    nav('/payment', { state: { mode: 'cart', cartItems: items, grandTotal } });
  };

  return (
    <div className={styles.page}>
      <div className="container">
        {/* ── Page Header ───────────────────────────────────────── */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>My Cart</h1>
            <div className="gold-divider" />
            {/* Dynamic item count */}
            <p style={{ color: 'var(--txt3)', fontSize: '0.875rem' }}>
              {items.length} item{items.length !== 1 ? 's' : ''}
            </p>
          </div>
          {/* Clear All button — only shown when cart has items */}
          {items.length > 0 && (
            <button className="btn btn-danger btn-sm" onClick={handleClear}>
              🗑️ Clear All
            </button>
          )}
        </div>

        {items.length === 0 ? (
          // Empty cart state
          <div className="empty-state" style={{ paddingTop: '4rem' }}>
            <div className="empty-state-icon">🛒</div>
            <h3>Your cart is empty</h3>
            <p>Browse packages or save a plan, then add it here to book.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.5rem' }}>
              <Link to="/packages" className="btn btn-gold">Browse Packages</Link>
              <Link to="/planner" className="btn btn-outline">Trip Planner</Link>
            </div>
          </div>
        ) : (
          // Two-column layout: cart items + order summary sidebar
          <div className={styles.layout}>
            {/* ── Cart Items Column ──────────────────────────── */}
            <div className={styles.itemsCol}>
              {items.map(item => (
                <div key={item._id} className={styles.cartItem}>
                  {/* ── Cover Image ────────────────────────── */}
                  <div className={styles.itemImg}>
                    {/* Show package or plan cover image */}
                    {(item.package?.coverImage || item.plan?.coverImage) && (
                      <img
                        src={item.package?.coverImage || item.plan?.coverImage}
                        alt=""
                        className="img-cover"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius)' }}
                      />
                    )}
                    {/* Emoji placeholder when no cover image exists */}
                    {!item.package?.coverImage && !item.plan?.coverImage && (
                      <div style={{ width: '100%', height: '100%', background: 'var(--bg4)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
                        {item.itemType === 'package' ? '📦' : '🗓️'}
                      </div>
                    )}
                  </div>

                  {/* ── Item Info ──────────────────────────── */}
                  <div className={styles.itemInfo}>
                    {/* Type badge: gold for package, blue for custom plan */}
                    <div className={styles.itemType}>
                      <span className={`badge ${item.itemType === 'package' ? 'badge-gold' : 'badge-blue'}`}>
                        {item.itemType === 'package' ? '📦 Package' : '🗓️ Custom Plan'}
                      </span>
                    </div>
                    {/* Item name: package or plan name */}
                    <h3 className={styles.itemName}>
                      {item.package?.name || item.plan?.name || 'Item'}
                    </h3>
                    {/* Meta: visit date + duration */}
                    <div className={styles.itemMeta}>
                      {item.visitDate && (
                        <span>📅 {new Date(item.visitDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      )}
                      {item.package?.duration && <span>⏱ {item.package.duration}</span>}
                    </div>

                    {/* ── Guest Count Controls ─────────────────────── */}
                    {/* Separate +/- controls for adults and children */}
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                      {/* Adults control: minimum 1 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--txt3)' }}>Adults</span>
                        {/* Decrement — disabled at minimum 1 */}
                        <button className="btn btn-ghost btn-sm" style={{ padding: '0 0.45rem', minWidth: 'unset' }}
                          onClick={() => handleUpdate(item._id, Math.max(1, item.adults - 1), item.children)}
                          disabled={updating === item._id || item.adults <= 1}>−</button>
                        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--txt)', minWidth: '1.4rem', textAlign: 'center' }}>{item.adults}</span>
                        {/* Increment */}
                        <button className="btn btn-ghost btn-sm" style={{ padding: '0 0.45rem', minWidth: 'unset' }}
                          onClick={() => handleUpdate(item._id, item.adults + 1, item.children)}
                          disabled={updating === item._id}>+</button>
                      </div>
                      {/* Children control: minimum 0 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--txt3)' }}>Children</span>
                        {/* Decrement — disabled at 0 */}
                        <button className="btn btn-ghost btn-sm" style={{ padding: '0 0.45rem', minWidth: 'unset' }}
                          onClick={() => handleUpdate(item._id, item.adults, Math.max(0, item.children - 1))}
                          disabled={updating === item._id || item.children <= 0}>−</button>
                        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--txt)', minWidth: '1.4rem', textAlign: 'center' }}>{item.children}</span>
                        {/* Increment */}
                        <button className="btn btn-ghost btn-sm" style={{ padding: '0 0.45rem', minWidth: 'unset' }}
                          onClick={() => handleUpdate(item._id, item.adults, item.children + 1)}
                          disabled={updating === item._id}>+</button>
                      </div>
                    </div>

                    {/* ── Price Row ──────────────────────────────── */}
                    <div className={styles.itemPriceRow}>
                      <div>
                        {/* Per-person rate reminder: children at 50% */}
                        <div style={{ fontSize: '0.75rem', color: 'var(--txt3)', marginBottom: '2px' }}>
                          LKR {item.price?.toLocaleString()} / adult · LKR {Math.round(item.price * 0.5).toLocaleString()} / child
                        </div>
                        {/* Calculated total for this item */}
                        <div className={styles.itemTotal}>
                          LKR {getItemTotal(item).toLocaleString()}
                        </div>
                      </div>
                      {/* Remove button — shows "..." while the API call is in progress */}
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleRemove(item._id)}
                        disabled={removing === item._id}
                      >
                        {removing === item._id ? '...' : '✕ Remove'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Order Summary Sidebar ─────────────────────── */}
            <div className={styles.summary}>
              <div className={styles.summaryCard}>
                <h3 className={styles.summaryTitle}>Order Summary</h3>

                {/* Per-item subtotals */}
                {items.map(item => (
                  <div key={item._id} className={styles.summaryRow}>
                    <span className={styles.summaryLabel} style={{ maxWidth: '60%' }}>
                      {item.package?.name || item.plan?.name || 'Item'}
                    </span>
                    <span className={styles.summaryVal}>LKR {getItemTotal(item).toLocaleString()}</span>
                  </div>
                ))}

                <div className={styles.summaryDivider} />

                {/* Grand total row */}
                <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                  <span>Total</span>
                  <span>LKR {grandTotal.toLocaleString()}</span>
                </div>

                {/* Checkout button — navigates to /payment with cart context */}
                <button className="btn btn-gold btn-block btn-lg" style={{ marginTop: '1.25rem' }} onClick={handleCheckout}>
                  Proceed to Payment →
                </button>

                {/* Quick links to add more items */}
                <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <Link to="/packages" className="btn btn-ghost btn-block btn-sm">+ Add Package</Link>
                  <Link to="/planner" className="btn btn-ghost btn-block btn-sm">+ Add Custom Plan</Link>
                </div>

                {/* Reassurance note — clarifies this is a demo with no real charges */}
                <div className={styles.secureNote}>
                  🔒 Secure payment · No real charges
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
