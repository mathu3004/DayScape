/**
 * pages/user/PaymentPage.jsx — Unified Payment Page (2-Step Flow)
 *
 * Handles all three booking modes through a shared 2-step flow:
 *   Step 1 — Booking Details: visit date, guest counts, special requests, price breakdown
 *   Step 2 — Card Payment:    card number, expiry, CVV, billing name, Luhn validation
 *
 * Booking modes (read from location.state.mode):
 *   'package' — single tour package booked by package._id
 *   'plan'    — day plan booking (planning service fee, not attraction entry fees)
 *   'cart'    — multiple items from CartContext
 *
 * Reached from:
 *   PackagesPage / PackageDetailPage → state: { mode:'package', packageId, pkg }
 *   SavedPlansPage / PlanDetailPage  → state: { mode:'plan', planId, plan }
 *   CartPage                         → state: { mode:'cart', cartItems, grandTotal }
 *   BookingDetailPage (resume)       → state: { existingBooking, mode, pkg/plan }
 *
 * existingBooking support:
 *   When state.existingBooking is provided, the booking was already created (pending).
 *   The page skips directly to step 2 (card entry) using existingBooking as the
 *   booking document. The "Back" button to step 1 is hidden to prevent re-creating.
 *
 * ── Utility Functions ──────────────────────────────────────────────────────────
 *
 * luhn(num):
 *   Implements the Luhn / mod-10 algorithm to validate card numbers.
 *   Iterates right-to-left: every second digit is doubled; if > 9, subtract 9.
 *   Returns true when the total digit sum is divisible by 10.
 *
 * detectBrand(num):
 *   Detects card brand from the card number prefix:
 *   - Visa:       starts with '4'
 *   - Mastercard: starts with '5' followed by 1-5
 *   - Amex:       starts with '3' followed by 4 or 7
 *   - Returns '' for unknown brands (no brand label shown)
 *
 * validateCard(form):
 *   Validates all 6 card fields; returns an errors object keyed by field name.
 *   Fields: cardHolder, cardNumber (Luhn + length 13-19), expiryMonth (1-12),
 *   expiryYear (not expired), cvv (3-4 digits), billingName.
 *   Returns an empty object {} when all fields are valid.
 *
 * ── Pricing Constants ──────────────────────────────────────────────────────────
 *
 * PLANNER_ADULT_FEE = 2000 LKR — planning service fee per adult
 * PLANNER_CHILD_FEE = 1000 LKR — planning service fee per child
 * calcPlanTotal(adults, children): computes total plan booking fee
 *
 * ── Total Calculation Logic (total variable) ──────────────────────────────────
 * Computed dynamically whenever det (guest counts) or item changes:
 *   Cart mode:    cartItems.length > 0
 *     → sum of price × (adults + children × 0.5) for each cart item
 *     else fall back to grandTotal from navigation state
 *   Plan mode:    calcPlanTotal(det.adults, det.children)
 *     → PLANNER_ADULT_FEE × adults + PLANNER_CHILD_FEE × children
 *   Package mode: item.price × (adults + children × 0.5)
 *     → children are always priced at 50% of adult rate
 *
 * ── Field-level Error Display Pattern ─────────────────────────────────────────
 * touch(f):  marks a field as "touched" (user has interacted with it)
 * getErr(f): returns the error for field f only if it has been touched
 * <Err f="fieldName" /> — inline component that renders the error text or nothing
 * This pattern shows errors only after the user has attempted to fill a field.
 *
 * fmtCard(v):
 *   Formats a raw card number string with spaces every 4 digits (e.g., "1234 5678 9012 3456").
 *   Used in the onChange handler for the card number input.
 *
 * ── Inner Components ───────────────────────────────────────────────────────────
 *
 * PlanBreakdown:
 *   Renders line-item rows for the plan service fee breakdown:
 *   "Planning fee: LKR 2,000 × N adults → LKR X,XXX"
 *   "Planning fee (child): LKR 1,000 × N children → LKR X,XXX"
 *   Only renders when mode === 'plan'; returns null otherwise.
 *
 * Err:
 *   Renders the touched error message for a given field name, or nothing.
 *   Used throughout both Step 1 and Step 2 forms.
 *
 * ── Step 1: goToPayment ────────────────────────────────────────────────────────
 * Validates visitDate (required, today or future).
 * Builds payload with all booking fields for the selected mode:
 *   - package: bookingType, packageId, totalAmount calculated from price + guests
 *   - plan:    bookingType, planId, totalAmount from calcPlanTotal
 *   - cart:    bookingType, totalAmount, cartItems array (mapped from navigation state)
 * Calls bookingAPI.create(payload) → sets booking state → advances to step 2.
 * On error: shows toast with server message or generic fallback.
 *
 * ── Step 2: processPayment ─────────────────────────────────────────────────────
 * Validates all 6 card fields via validateCard(). Shows error toast if invalid.
 * Calls paymentAPI.process({ bookingId, cardNumber, cardHolder, expiry, cvv }).
 * On success:
 *   - If cart mode: calls clearCart() to empty CartContext
 *   - Navigates to /booking-success with { booking, item, totalAmount, mode, cartItems }
 * On error: shows toast with server message or generic fallback.
 *
 * ── Progress Indicator ─────────────────────────────────────────────────────────
 * Three steps shown at top: 1=Details, 2=Payment, 3=Confirm
 * Steps ≤ current step are highlighted with styles.stepOn.
 * Completed steps show ✓ instead of the step number.
 *
 * ── Sidebar ────────────────────────────────────────────────────────────────────
 * Always visible next to the active step form.
 * Shows: mode badge, cover image (when available), item name/duration,
 * package includes list, plan service fee rows + stop list, cart item summary.
 * An "Unlocks features" card is shown below when mode === 'plan'.
 */

import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { bookingAPI, paymentAPI, packageAPI, planAPI } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import styles from './Payment.module.css';

// ── Card Validation Utilities ────────────────────────────────────────────────

// luhn: Implements the Luhn / mod-10 checksum algorithm.
// Traverses the digit string from right to left.
// Every second digit (counting from right) is doubled; if > 9, subtract 9.
// Valid card numbers sum to a multiple of 10.
function luhn(num) {
  let sum = 0, alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = parseInt(num[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
}

// detectBrand: Returns the card brand name based on leading digit pattern.
// Visa starts with 4, Mastercard with 51-55, Amex with 34 or 37.
// Returns '' for unrecognised card types (no brand label is rendered).
function detectBrand(num) {
  const n = num.replace(/\s/g, '');
  if (/^4/.test(n))       return 'Visa';
  if (/^5[1-5]/.test(n))  return 'Mastercard';
  if (/^3[47]/.test(n))   return 'Amex';
  return '';
}

// validateCard: Validates all 6 card form fields.
// Returns an errors object keyed by field name; empty object means no errors.
// Validation rules:
//   cardHolder  — required, letters/spaces/punctuation only
//   cardNumber  — required, digits only, 13-19 chars, must pass Luhn check
//   expiryMonth — required, numeric 1-12
//   expiryYear  — required, not in the past (checks against current month)
//   cvv         — required, 3 or 4 digits
//   billingName — required
function validateCard(form) {
  const errs = {};
  // Card holder name: required + letters-only regex
  if (!form.cardHolder.trim())
    errs.cardHolder = 'Card holder name is required';
  else if (!/^[a-zA-Z\s.'",-]+$/.test(form.cardHolder))
    errs.cardHolder = 'Name must contain letters only';

  // Card number: strip spaces, validate length, validate Luhn checksum
  const raw = form.cardNumber.replace(/\s/g, '');
  if (!raw) errs.cardNumber = 'Card number is required';
  else if (!/^\d+$/.test(raw)) errs.cardNumber = 'Digits only';
  else if (raw.length < 13 || raw.length > 19) errs.cardNumber = '13-19 digits required';
  else if (!luhn(raw)) errs.cardNumber = 'Card number is invalid';

  // Expiry month: required, must be 01-12
  const mo = parseInt(form.expiryMonth);
  if (!form.expiryMonth) errs.expiryMonth = 'Month required';
  else if (mo < 1 || mo > 12) errs.expiryMonth = 'Enter 01-12';

  // Expiry year: required, must not be in the past (year or year+month)
  if (!form.expiryYear) errs.expiryYear = 'Year required';
  else {
    const now = new Date(), yr = parseInt(form.expiryYear);
    if (yr < now.getFullYear() || (yr === now.getFullYear() && mo < now.getMonth() + 1))
      errs.expiryYear = 'Card has expired';
  }

  // CVV: required, 3-4 digits (4 for Amex)
  if (!form.cvv) errs.cvv = 'CVV required';
  else if (!/^\d{3,4}$/.test(form.cvv)) errs.cvv = '3 or 4 digits required';

  // Billing name: required (may differ from card holder name)
  if (!form.billingName.trim()) errs.billingName = 'Billing name required';

  return errs;
}

// ── Planner Service Fee Constants ────────────────────────────────────────────
// These are the planning service fees charged per person at booking time.
// They are separate from the attraction entry fees paid at each venue.
const PLANNER_ADULT_FEE = 2000;  // LKR per adult
const PLANNER_CHILD_FEE = 1000;  // LKR per child

// calcPlanTotal: Computes total plan service fee from guest counts.
function calcPlanTotal(adults, children) {
  return PLANNER_ADULT_FEE * adults + PLANNER_CHILD_FEE * children;
}

export default function PaymentPage() {
  // ── Context + Router ──────────────────────────────────────────────────────
  const location = useLocation();
  const nav      = useNavigate();
  const toast    = useToast();
  const { clearCart } = useCart();  // Used to empty cart after successful cart payment

  // ── Navigation State ──────────────────────────────────────────────────────
  // state.mode determines which pricing and booking type logic to use
  const state = location.state || {};
  const mode  = state.mode || 'package';  // 'package' | 'plan' | 'cart'

  // existingBooking: provided when the user is resuming a pending booking
  // (navigated from BookingDetailPage "Complete Payment" button)
  const existingBooking = state.existingBooking || null;

  // ── State ─────────────────────────────────────────────────────────────────
  // item: the package or plan document (pre-loaded from nav state or fetched)
  const [item,       setItem]       = useState(
    state.pkg || state.plan || existingBooking?.package || existingBooking?.plan || null
  );
  // step: 1 = booking details form, 2 = card payment form
  // When resuming an existing booking, start directly at step 2
  const [step,       setStep]       = useState(existingBooking ? 2 : 1);
  const [processing, setProcessing] = useState(false);    // Prevents double-submit
  const [booking,    setBooking]    = useState(existingBooking || null);  // Created booking doc
  const [touched,    setTouched]    = useState({});        // Fields the user has interacted with
  const [errs,       setErrs]       = useState({});        // Validation error messages per field
  const [showCvv,    setShowCvv]    = useState(false);     // Toggles CVV text/password visibility

  // ── Booking Details Form State ────────────────────────────────────────────
  // Pre-populated from existingBooking when resuming a pending booking
  const [det, setDet] = useState({
    visitDate: existingBooking?.visitDate
      ? new Date(existingBooking.visitDate).toISOString().split('T')[0]
      : '',
    adults:   existingBooking?.adults   || 1,
    children: existingBooking?.children || 0,
    notes:    existingBooking?.notes    || '',
  });

  // ── Card Payment Form State ───────────────────────────────────────────────
  // Starts empty; validated via validateCard() before processPayment()
  const [card, setCard] = useState({
    cardHolder: '', cardNumber: '', expiryMonth: '', expiryYear: '', cvv: '', billingName: '',
  });

  // ── Cart-Mode Data ────────────────────────────────────────────────────────
  const cartItems  = state.cartItems  || [];                  // Cart items array (mode='cart')
  const grandTotal = state.grandTotal || existingBooking?.totalAmount || 0;  // Pre-computed or existing
  const isCart = mode === 'cart';
  const isPlan = mode === 'plan';

  // ── Lazy Item Load ────────────────────────────────────────────────────────
  // When only an ID was passed in navigation state (not the full document),
  // fetch the item from the server to populate the sidebar summary.
  useEffect(() => {
    if (item) return;
    if (mode === 'package' && state.packageId) {
      packageAPI.getOne(state.packageId).then(({ data }) => setItem(data.package)).catch(() => {});
    }
    if (mode === 'plan' && state.planId) {
      planAPI.getOne(state.planId).then(({ data }) => setItem(data.plan)).catch(() => {});
    }
  }, [mode, state.packageId, state.planId]);

  // ── Total Calculation ─────────────────────────────────────────────────────
  // Recalculated on every render when det (guest counts) or item changes.
  // Cart:    sum of price × (adults + children × 0.5) per cart item
  // Plan:    PLANNER_ADULT_FEE × adults + PLANNER_CHILD_FEE × children
  // Package: item.price × (adults + children × 0.5), children at 50%
  const total = isCart
    ? cartItems.length > 0
      ? Math.round(cartItems.reduce((sum, ci) => sum + ci.price * (det.adults + det.children * 0.5), 0))
      : grandTotal
    : isPlan && item
      ? calcPlanTotal(det.adults, det.children)
      : item
        ? Math.round(item.price * (det.adults + det.children * 0.5))
        : 0;

  // ── Field-level Error Helpers ─────────────────────────────────────────────
  // touch(f): marks a field as having been interacted with by the user
  const touch   = f => setTouched(t => ({ ...t, [f]: true }));
  // getErr(f): returns the error message for f only if the field has been touched
  const getErr  = f => (touched[f] ? errs[f] : '');
  // fmtCard(v): formats card number input with spaces every 4 digits ("1234 5678 ...")
  const fmtCard = v => v.replace(/\D/g,'').slice(0,16).replace(/(.{4})/g,'$1 ').trim();
  // brand: detected card network name shown inline next to the card number input
  const brand   = detectBrand(card.cardNumber);

  // ── Step 1: goToPayment ───────────────────────────────────────────────────
  // Validates the booking details form, builds the booking payload, and calls
  // bookingAPI.create(). On success, stores the booking doc and advances to step 2.
  // The booking is in "pending" state at this point — confirmed only after payment.
  const goToPayment = async (e) => {
    e.preventDefault();
    // Validate visit date (required + must not be in the past)
    const detErrs = {};
    if (!det.visitDate) detErrs.visitDate = 'Visit date required';
    else if (new Date(det.visitDate) < new Date(new Date().toDateString())) detErrs.visitDate = 'Date must be today or future';
    setErrs(detErrs);
    setTouched({ visitDate: true });
    if (Object.keys(detErrs).length) return;
    setProcessing(true);
    try {
      // Build payload — shared fields for all booking types
      const payload = { visitDate: det.visitDate, adults: det.adults, children: det.children, notes: det.notes };
      if (isCart) {
        // Cart booking: includes all cart items mapped to a simple shape
        payload.bookingType = 'cart';
        payload.totalAmount  = total;
        payload.cartItems = cartItems.map(ci => ({
          itemType: ci.itemType,
          package:  ci.package?._id || null,
          plan:     ci.plan?._id    || null,
          name:     ci.package?.name || ci.plan?.name || '',
          price:    ci.price,
          adults:   ci.adults,
          children: ci.children,
        }));
      } else if (isPlan) {
        // Plan booking: includes planId and total based on service fee
        payload.bookingType = 'plan';
        payload.planId      = state.planId || item?._id;
        payload.totalAmount  = total;
      } else {
        // Package booking: includes packageId; server calculates total
        payload.bookingType = 'package';
        payload.packageId   = state.packageId || item?._id;
      }
      const { data } = await bookingAPI.create(payload);
      setBooking(data.booking);
      setStep(2);  // Advance to card payment step
      toast.info('Booking reserved. Complete payment to confirm.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create booking');
    } finally { setProcessing(false); }
  };

  // ── Step 2: processPayment ────────────────────────────────────────────────
  // Validates all 6 card fields. If valid, calls paymentAPI.process() to
  // charge the card (demo simulation — no real charge). On success:
  //   - Clears the cart (cart mode only)
  //   - Navigates to /booking-success with booking context
  const processPayment = async (e) => {
    e.preventDefault();
    const cardErrs = validateCard({ ...card });
    setErrs(cardErrs);
    // Touch all card fields to trigger error display for all at once
    setTouched({ cardHolder:true, cardNumber:true, expiryMonth:true, expiryYear:true, cvv:true, billingName:true });
    if (Object.keys(cardErrs).length) { toast.error('Please fix the errors above'); return; }
    setProcessing(true);
    try {
      await paymentAPI.process({
        bookingId:  booking._id,
        cardNumber: card.cardNumber.replace(/\s/g,''),  // Strip formatting spaces
        cardHolder: card.cardHolder,
        expiry:     `${card.expiryMonth}/${card.expiryYear}`,
        cvv:        card.cvv,
      });
      // Clear CartContext if this was a cart mode booking
      if (isCart) await clearCart();
      // Navigate to success page with full context for success display
      nav('/booking-success', {
        state: { booking, item, totalAmount: booking.totalAmount || total, mode, cartItems: isCart ? cartItems : undefined }
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment failed. Please try again.');
    } finally { setProcessing(false); }
  };

  // ── Inline Error Component ────────────────────────────────────────────────
  // Renders the error message for field f if it has been touched and has an error.
  const Err = ({ f }) => getErr(f) ? <div className={styles.err}>{getErr(f)}</div> : null;

  // Badge label shown in the form title to indicate booking type
  const modeLabel = isPlan ? '🗓️ Day Plan' : isCart ? '🛒 Cart' : '📦 Package';

  // ── Plan Fee Breakdown Component ──────────────────────────────────────────
  // Renders per-person fee rows for plan bookings only.
  // Shows: "Planning fee: LKR 2,000 × N adults → LKR X" and child row (if any).
  const PlanBreakdown = () => {
    if (!isPlan) return null;
    const feeAdults   = PLANNER_ADULT_FEE * det.adults;
    const feeChildren = PLANNER_CHILD_FEE * det.children;
    return (
      <>
        {/* Adult service fee row */}
        <div className={styles.totalRow}>
          <span>Planning fee: LKR {PLANNER_ADULT_FEE.toLocaleString()} × {det.adults} adult{det.adults > 1 ? 's' : ''}</span>
          <span>LKR {feeAdults.toLocaleString()}</span>
        </div>
        {/* Child service fee row — only rendered when children > 0 */}
        {det.children > 0 && (
          <div className={styles.totalRow}>
            <span>Planning fee (child): LKR {PLANNER_CHILD_FEE.toLocaleString()} × {det.children} child{det.children > 1 ? 'ren' : ''}</span>
            <span>LKR {feeChildren.toLocaleString()}</span>
          </div>
        )}
      </>
    );
  };

  return (
    <div className={styles.page}>
      <div className="container">
        {/* ── Progress Steps Indicator ──────────────────────────── */}
        {/* 3-step progress bar: 1=Details, 2=Payment, 3=Confirm   */}
        {/* Steps ≤ current step are highlighted with stepOn style  */}
        <div className={styles.steps}>
          {[{n:1,l:'Details'},{n:2,l:'Payment'},{n:3,l:'Confirm'}].map((s,i) => (
            <div key={s.n} style={{ display:'flex', alignItems:'center' }}>
              <div className={`${styles.step} ${step >= s.n ? styles.stepOn : ''}`}>
                {/* Show ✓ for completed steps, otherwise step number */}
                <span className={styles.stepN}>{step > s.n ? '✓' : s.n}</span>
                <span className={styles.stepL}>{s.l}</span>
              </div>
              {/* Connector line between steps (not after the last step) */}
              {i < 2 && <div className={styles.stepLine} />}
            </div>
          ))}
        </div>

        {/* ── Main Layout: Form + Sidebar ───────────────────────── */}
        <div className={styles.layout}>

          {/* ══════════════════════════════════════════════════════
              STEP 1: Booking Details Form
              Collects visit date, guest counts, special requests.
              Calculates and shows the price breakdown before proceeding.
          ════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <div className="card">
              {/* Form title with mode badge */}
              <h2 className={styles.formTitle}>
                Booking Details{' '}
                <span className="badge badge-gold" style={{ fontSize:'0.72rem', marginLeft:'0.5rem', verticalAlign:'middle' }}>{modeLabel}</span>
              </h2>
              <form onSubmit={goToPayment}>
                {/* ── Visit Date Input ──────────────────────────── */}
                {/* min attribute prevents past dates via browser date picker */}
                <div className="form-group">
                  <label className="form-label">Visit Date *</label>
                  <input className={`form-input ${getErr('visitDate') ? styles.inputErr : ''}`}
                    type="date" min={new Date().toISOString().split('T')[0]}
                    value={det.visitDate}
                    onChange={e => setDet({...det, visitDate: e.target.value})}
                    onBlur={() => touch('visitDate')} />
                  <Err f="visitDate" />
                </div>

                {/* ── Guest Count Selects ───────────────────────── */}
                {/* Side-by-side adults (1-10) and children (0-5) selects */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Adults</label>
                    <select className="form-input form-select" value={det.adults}
                      onChange={e => setDet({...det, adults: parseInt(e.target.value)})}>
                      {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n} Adult{n>1?'s':''}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Children</label>
                    <select className="form-input form-select" value={det.children}
                      onChange={e => setDet({...det, children: parseInt(e.target.value)})}>
                      {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n} Child{n>1?'ren':n===1?'':'ren'}</option>)}
                    </select>
                  </div>
                </div>

                {/* ── Special Requests Textarea ─────────────────── */}
                <div className="form-group">
                  <label className="form-label">Special Requests (optional)</label>
                  <textarea className="form-input form-textarea" style={{ minHeight:72 }}
                    value={det.notes} onChange={e => setDet({...det, notes: e.target.value})}
                    placeholder="Dietary requirements, accessibility needs, etc." />
                </div>

                {/* ── Price Breakdown Box ───────────────────────── */}
                {/* Shows per-person rate + itemised breakdown + grand total */}
                <div className={styles.totalBox}>
                  {/* Package rate reminder: children at 50% */}
                  {!isCart && !isPlan && item && (
                    <div className={styles.totalRow} style={{ opacity:0.65, fontSize:'0.76rem', borderBottom:'1px dashed var(--brd2)', paddingBottom:'0.5rem', marginBottom:'0.25rem' }}>
                      <span>Rate</span>
                      <span>LKR {item.price?.toLocaleString()} / adult · LKR {Math.round(item.price * 0.5).toLocaleString()} / child (50%)</span>
                    </div>
                  )}
                  {/* Plan rate reminder: PLANNER_ADULT_FEE / PLANNER_CHILD_FEE */}
                  {isPlan && (
                    <div className={styles.totalRow} style={{ opacity:0.65, fontSize:'0.76rem', borderBottom:'1px dashed var(--brd2)', paddingBottom:'0.5rem', marginBottom:'0.25rem' }}>
                      <span>Rate</span>
                      <span>LKR {PLANNER_ADULT_FEE.toLocaleString()} / adult · LKR {PLANNER_CHILD_FEE.toLocaleString()} / child</span>
                    </div>
                  )}

                  {/* Package per-person breakdown rows */}
                  {!isCart && !isPlan && item && (
                    <>
                      <div className={styles.totalRow}>
                        <span>LKR {item.price?.toLocaleString()} × {det.adults} adult{det.adults>1?'s':''}</span>
                        <span>LKR {(item.price * det.adults).toLocaleString()}</span>
                      </div>
                      {det.children > 0 && (
                        <div className={styles.totalRow}>
                          <span>LKR {Math.round(item.price*0.5).toLocaleString()} × {det.children} child{det.children>1?'ren':''} (50%)</span>
                          <span>LKR {Math.round(item.price*0.5*det.children).toLocaleString()}</span>
                        </div>
                      )}
                    </>
                  )}
                  {/* Plan service fee breakdown (PlanBreakdown inner component) */}
                  <PlanBreakdown />
                  {/* Cart items breakdown — one row per cart item */}
                  {isCart && cartItems.map(ci => (
                    <div key={ci._id} className={styles.totalRow}>
                      <span>{ci.package?.name || ci.plan?.name} × {det.adults} adult{det.adults>1?'s':''}{det.children>0?` + ${det.children} child`:''}</span>
                      <span>LKR {Math.round(ci.price*(det.adults+det.children*0.5)).toLocaleString()}</span>
                    </div>
                  ))}
                  {/* Grand total row */}
                  <div className={`${styles.totalRow} ${styles.totalFinal}`}>
                    <span>Total</span>
                    <span>LKR {total.toLocaleString()}</span>
                  </div>
                </div>

                {/* Continue to Payment button — disabled while API call is in progress */}
                <button className="btn btn-gold btn-lg btn-block" type="submit" disabled={processing} style={{ marginTop:'1rem' }}>
                  {processing ? 'Creating booking...' : 'Continue to Payment ->'}
                </button>
              </form>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              STEP 2: Card Payment Form
              Collects card holder name, number, expiry, CVV, billing name.
              Validates on blur (field-level) and on submit (all fields).
          ════════════════════════════════════════════════════════ */}
          {step === 2 && (
            <div className="card">
              <h2 className={styles.formTitle}>Secure Payment</h2>
              {/* Demo disclaimer — no real charges */}
              <div className={styles.secureNote}>
                Demo payment - card details are not stored or processed. This is a secure simulation.
              </div>
              <form onSubmit={processPayment} noValidate>
                {/* ── Card Holder Name ──────────────────────────── */}
                <div className="form-group">
                  <label className="form-label">Card Holder Name *</label>
                  <input className={`form-input ${getErr('cardHolder') ? styles.inputErr : ''}`}
                    placeholder="K. MATHUSHA" value={card.cardHolder}
                    onChange={e => setCard({...card, cardHolder: e.target.value})}
                    onBlur={() => { touch('cardHolder'); setErrs(validateCard({...card})); }}
                    autoComplete="cc-name" />
                  <Err f="cardHolder" />
                </div>

                {/* ── Card Number ───────────────────────────────── */}
                {/* fmtCard adds spaces every 4 digits as user types */}
                {/* brand overlay shows detected network name (Visa/MC/Amex) */}
                <div className="form-group">
                  <label className="form-label">Card Number *</label>
                  <div className={styles.cardNumWrap}>
                    <input className={`form-input ${getErr('cardNumber') ? styles.inputErr : ''}`}
                      placeholder="1234 5678 9012 3456" maxLength={19}
                      value={card.cardNumber}
                      onChange={e => setCard({...card, cardNumber: fmtCard(e.target.value)})}
                      onBlur={() => { touch('cardNumber'); setErrs(validateCard({...card})); }}
                      inputMode="numeric" autoComplete="cc-number"
                      style={{ paddingRight: brand ? '3.5rem' : undefined }} />
                    {/* Card brand badge shown inline when brand is detected */}
                    {brand && <div className={styles.brandLabel}>{brand}</div>}
                  </div>
                  <Err f="cardNumber" />
                </div>

                {/* ── Expiry Month / Year + CVV ─────────────────── */}
                {/* 3-column grid: MM | YYYY | CVV */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Month *</label>
                    <input className={`form-input ${getErr('expiryMonth') ? styles.inputErr : ''}`}
                      placeholder="MM" maxLength={2} value={card.expiryMonth}
                      onChange={e => setCard({...card, expiryMonth: e.target.value.replace(/\D/g,'').slice(0,2)})}
                      onBlur={() => { touch('expiryMonth'); setErrs(validateCard({...card})); }}
                      inputMode="numeric" />
                    <Err f="expiryMonth" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Year *</label>
                    <input className={`form-input ${getErr('expiryYear') ? styles.inputErr : ''}`}
                      placeholder="YYYY" maxLength={4} value={card.expiryYear}
                      onChange={e => setCard({...card, expiryYear: e.target.value.replace(/\D/g,'').slice(0,4)})}
                      onBlur={() => { touch('expiryYear'); setErrs(validateCard({...card})); }}
                      inputMode="numeric" />
                    <Err f="expiryYear" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">CVV *</label>
                    {/* CVV toggle: password input with show/hide eye button */}
                    <div className={styles.cvvWrap}>
                      <input className={`form-input ${getErr('cvv') ? styles.inputErr : ''}`}
                        placeholder="..." maxLength={4} type={showCvv ? 'text' : 'password'} value={card.cvv}
                        onChange={e => setCard({...card, cvv: e.target.value.replace(/\D/g,'').slice(0,4)})}
                        onBlur={() => { touch('cvv'); setErrs(validateCard({...card})); }}
                        inputMode="numeric" style={{paddingRight:'2.75rem'}} />
                      {/* Eye toggle icon — switches between show/hide CVV */}
                      <button type="button" className={styles.cvvToggle} onClick={() => setShowCvv(v => !v)}>
                        {showCvv
                          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        }
                      </button>
                    </div>
                    <Err f="cvv" />
                  </div>
                </div>

                {/* ── Billing Name ──────────────────────────────── */}
                <div className="form-group">
                  <label className="form-label">Billing Name *</label>
                  <input className={`form-input ${getErr('billingName') ? styles.inputErr : ''}`}
                    placeholder="Full name as on bank account" value={card.billingName}
                    onChange={e => setCard({...card, billingName: e.target.value})}
                    onBlur={() => { touch('billingName'); setErrs(validateCard({...card})); }} />
                  <Err f="billingName" />
                </div>

                {/* ── Booking Summary (review before paying) ──────── */}
                {/* Compact guest count, visit date, and final amount rows */}
                <div className={styles.totalBox}>
                  <div className={styles.totalRow} style={{ opacity:0.7, fontSize:'0.78rem' }}>
                    <span>Guests</span>
                    <span>{det.adults} adult{det.adults > 1 ? 's' : ''}{det.children > 0 ? ` · ${det.children} child${det.children > 1 ? 'ren' : ''}` : ''}</span>
                  </div>
                  <div className={styles.totalRow} style={{ opacity:0.7, fontSize:'0.78rem' }}>
                    <span>Visit Date</span>
                    <span>{det.visitDate ? new Date(det.visitDate).toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' }) : '—'}</span>
                  </div>
                  {/* Final amount — uses server-confirmed booking.totalAmount when available */}
                  <div className={`${styles.totalRow} ${styles.totalFinal}`}>
                    <span>Amount to Pay</span>
                    <span>LKR {(booking?.totalAmount || total).toLocaleString()}</span>
                  </div>
                </div>

                {/* ── Step 2 Action Buttons ────────────────────── */}
                <div style={{ display:'flex', gap:'0.75rem', marginTop:'1rem' }}>
                  {/* Back button — hidden when resuming an existing booking (step 1 was skipped) */}
                  {!existingBooking && (
                    <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>
                  )}
                  {/* Pay button — shows exact amount in the label */}
                  <button type="submit" className="btn btn-gold btn-lg" style={{ flex:1 }} disabled={processing}>
                    {processing ? 'Processing...' : `Pay LKR ${(booking?.totalAmount || total).toLocaleString()}`}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              SIDEBAR: Item Summary
              Always visible. Shows mode badge, cover image,
              item name, duration, includes (package), fee rows (plan),
              or cart item list. Grand total at the bottom.
          ════════════════════════════════════════════════════════ */}
          <div className={styles.sidebar}>
            <div className="card">
              {/* Mode badge: Package | Day Plan | Cart */}
              <div className="badge badge-gold" style={{ marginBottom:'0.75rem' }}>{modeLabel}</div>

              {/* Cover image — shown when item has a coverImage URL */}
              {item?.coverImage && (
                <div className={styles.pkgImg}>
                  <img src={item.coverImage} alt={item.name}
                    style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'var(--radius-lg) var(--radius-lg) 0 0' }} />
                </div>
              )}

              {item && (
                <>
                  {/* Item name */}
                  <h3 className={styles.pkgName}>{item.name}</h3>
                  {/* Package duration (e.g., "Full Day") */}
                  {item.duration && <div style={{ fontSize:'0.82rem', color:'var(--txt3)', marginBottom:'0.5rem' }}>{item.duration}</div>}
                  {/* Plan estimated duration */}
                  {isPlan && item.estimatedDuration && (
                    <div style={{ fontSize:'0.82rem', color:'var(--txt3)', marginBottom:'0.5rem' }}>⏱ {item.estimatedDuration}</div>
                  )}

                  {/* Package "What's Included" list — shown for package mode */}
                  {!isPlan && item.includes?.length > 0 && (
                    <div className={styles.includeList}>
                      <div style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--txt4)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'0.5rem' }}>Includes</div>
                      {item.includes.map((inc, i) => (
                        <div key={i} style={{ fontSize:'0.8rem', color:'var(--teal)', padding:'2px 0' }}>✓ {inc}</div>
                      ))}
                    </div>
                  )}

                  {/* Plan sidebar: service fee rows + plan stops list */}
                  {isPlan && (
                    <div style={{ marginTop:'0.5rem' }}>
                      <div style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--txt4)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'0.5rem' }}>
                        Planning Fee
                      </div>
                      {/* Adult fee row (always shown) */}
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.8rem', color:'var(--txt2)', padding:'3px 0', borderBottom:'1px solid var(--brd)' }}>
                        <span>LKR {PLANNER_ADULT_FEE.toLocaleString()} × {det.adults} adult{det.adults > 1 ? 's' : ''}</span>
                        <span style={{ color:'var(--gold2)' }}>LKR {(PLANNER_ADULT_FEE * det.adults).toLocaleString()}</span>
                      </div>
                      {/* Child fee row (shown only when children > 0) */}
                      {det.children > 0 && (
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.8rem', color:'var(--txt2)', padding:'3px 0', borderBottom:'1px solid var(--brd)' }}>
                          <span>LKR {PLANNER_CHILD_FEE.toLocaleString()} × {det.children} child{det.children > 1 ? 'ren' : ''}</span>
                          <span style={{ color:'var(--gold2)' }}>LKR {(PLANNER_CHILD_FEE * det.children).toLocaleString()}</span>
                        </div>
                      )}
                      {/* Plan stops list — numbered, sorted by order */}
                      {item.places?.length > 0 && (
                        <div style={{ marginTop:'0.5rem' }}>
                          <div style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--txt4)', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0.5rem 0 0.35rem' }}>
                            Plan Stops ({item.places.length})
                          </div>
                          {[...item.places].sort((a,b)=>a.order-b.order).map((s,i) => (
                            <div key={i} style={{ fontSize:'0.8rem', color:'var(--txt2)', padding:'2px 0' }}>
                              {i+1}. {s.place?.name || 'Stop'}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Cart mode: list each cart item with guest counts */}
              {isCart && cartItems.map(ci => (
                <div key={ci._id} style={{ padding:'0.45rem 0', borderBottom:'1px solid var(--brd)', fontSize:'0.82rem' }}>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <span style={{ color:'var(--txt2)' }}>{ci.package?.name || ci.plan?.name}</span>
                    <span style={{ color:'var(--gold2)', fontWeight:600 }}>LKR {ci.price?.toLocaleString()} / adult</span>
                  </div>
                  <div style={{ fontSize:'0.74rem', color:'var(--txt4)', marginTop:'2px' }}>
                    {ci.adults} adult{ci.adults > 1 ? 's' : ''}{ci.children > 0 ? ` · ${ci.children} child${ci.children > 1 ? 'ren' : ''}` : ''} (in cart)
                  </div>
                </div>
              ))}

              {/* Plan note: entry fees are NOT included in the booking */}
              {isPlan && (
                <div style={{ fontSize:'0.75rem', color:'var(--txt3)', marginTop:'0.5rem', padding:'0.4rem 0.6rem', background:'rgba(255,255,255,0.04)', borderRadius:'var(--radius)', border:'1px dashed var(--brd)' }}>
                  * Attraction entry fees are paid separately at each venue.
                </div>
              )}

              {/* Grand total price display */}
              <div className={styles.priceDisplay}>
                <span style={{ fontSize:'0.8rem', color:'var(--txt3)' }}>Total</span>
                <span style={{ fontFamily:'Cormorant Garamond', fontSize:'1.4rem', fontWeight:700, color:'var(--gold)' }}>
                  LKR {total.toLocaleString()}
                </span>
              </div>
            </div>

            {/* ── Plan Features Unlock Card ──────────────────────── */}
            {/* Shown only for plan mode — reminds what features are unlocked after payment */}
            {isPlan && (
              <div className="card" style={{ marginTop:'0.75rem', background:'rgba(29,184,122,0.05)', border:'1px solid rgba(29,184,122,0.2)' }}>
                <div style={{ fontSize:'0.82rem', color:'var(--teal)', fontWeight:600, marginBottom:'0.35rem' }}>Booking this plan unlocks:</div>
                {['Export PDF Itinerary','Google Maps Multi-Stop Route','Live Navigation Assistance','Transport Suggestions'].map((f,i) => (
                  <div key={i} style={{ fontSize:'0.78rem', color:'var(--txt2)', padding:'2px 0' }}>✓ {f}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
