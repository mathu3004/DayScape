/**
 * pages/user/EditPlanPage.jsx — Edit Existing Saved Plan
 *
 * Allows the user to modify an existing plan: rename it, update the description,
 * set or change the visit date, add/remove places, reorder stops, and update
 * per-stop notes. On save, calls planAPI.update() and navigates back to the plan
 * detail page. Also provides a delete option with a confirm dialog.
 *
 * Route: /plans/:id/edit — id = MongoDB _id of the plan to edit.
 *
 * TIMES:
 *  Same 8 arrival time slots used in PlannerPage.
 *  When stops are added or reordered, visitTime is re-assigned from TIMES[index].
 *
 * Data loading:
 *  Promise.all([planAPI.getOne(id), placeAPI.getAll({})]) fetches in parallel:
 *   - Existing plan (to pre-populate all form fields and current stop list)
 *   - All 11 places (for the place picker panel on the left)
 *  On error: shows toast and navigates away to /plans.
 *
 * Pre-population logic:
 *  planName  ← plan.name
 *  planDesc  ← plan.description || ''
 *  planDate  ← plan.planDate split to 'YYYY-MM-DD' format || ''
 *  planPlaces ← plan.places sorted by .order, then mapped to internal format:
 *    { place, order, notes, visitTime, duration }
 *  allPlaces ← all 11 places for the picker list
 *
 * Place picker (left panel):
 *  Filtered client-side by `search` text against place.name.
 *  Each place shows: category icon, name, distance + entry price.
 *  Button label toggles between:
 *    "✓ In Plan" (teal, clicking REMOVES the place from plan)
 *    "+ Add"     (ghost, clicking ADDS the place to plan)
 *  This is different from PlannerPage where clicking a "✓ In Plan" button is disabled.
 *  In EditPlanPage the button is always clickable and acts as a toggle.
 *
 * Itinerary operations (identical logic to PlannerPage):
 *  addPlace(place)    — appends; prevents duplicates; assigns TIMES[index]
 *  removePlace(id)    — filters out by _id; re-numbers remaining items from 1
 *  moveUp(i)          — swaps index i with i-1; re-assigns order + visitTime
 *  moveDown(i)        — swaps index i with i+1; re-assigns order + visitTime
 *  updateNote(id, v)  — immutably updates the notes field for a single stop
 *
 * Summary calculations:
 *  totalCost = sum of place.tickets.localAdult for each stop
 *  estDur    = "~X.X hours" (planPlaces.length × 1.5 hours per stop)
 *
 * save():
 *  Validates: planName not empty, at least 1 place.
 *  Calls planAPI.update(id, payload) where payload includes:
 *    name, description, planDate (or undefined if empty), places array,
 *    estimatedTotalCost, estimatedDuration
 *  On success: toast + navigate to /plans/:id
 *  On error: shows toast with server message or generic fallback.
 *
 * deletePlan():
 *  Confirms with native dialog using the current planName.
 *  Calls planAPI.delete(id) + shows success toast + navigates to /plans.
 *
 * Layout (same two-column layout as PlannerPage):
 *  Left:  place picker with search input
 *  Right: plan metadata form (name, date, description) + summary bar + itinerary list
 *
 * NOTE: Export PDF is NOT available on this page.
 *   PDF export is only unlocked after booking and payment.
 *   It is intentionally omitted from this edit view to preserve the payment gate.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { planAPI, placeAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import styles from './Planner.module.css';

// ── Arrival Times ─────────────────────────────────────────────────────────────
// 8 preset time slots assigned by index position to each itinerary stop.
// Identical to PlannerPage's ARRIVAL_TIMES (exported under a different constant name here).
const TIMES = ['8:00 AM','9:30 AM','11:00 AM','12:30 PM','2:00 PM','3:30 PM','5:00 PM','6:30 PM'];

export default function EditPlanPage() {
  // ── Route Params + Context ────────────────────────────────────────────────
  const { id } = useParams();   // MongoDB _id of the plan being edited
  const nav    = useNavigate();
  const toast  = useToast();

  // ── State ─────────────────────────────────────────────────────────────────
  const [plan,       setPlan]       = useState(null);    // Original plan document (for reference)
  const [allPlaces,  setAllPlaces]  = useState([]);      // All 11 places from the server
  const [planPlaces, setPlanPlaces] = useState([]);      // Current itinerary stops (editable)
  const [planName,   setPlanName]   = useState('');      // Plan name (pre-populated from plan)
  const [planDesc,   setPlanDesc]   = useState('');      // Optional description
  const [planDate,   setPlanDate]   = useState('');      // Visit date in YYYY-MM-DD format
  const [search,     setSearch]     = useState('');      // Picker search filter text
  const [saving,     setSaving]     = useState(false);   // Prevents double-save
  const [loading,    setLoading]    = useState(true);    // Initial data fetch loading flag

  // ── Parallel Data Fetch ───────────────────────────────────────────────────
  // Fetches the existing plan and all places at the same time.
  // Pre-populates all form fields from the existing plan data.
  // Redirects to /plans on error (plan not found or access denied).
  useEffect(() => {
    Promise.all([planAPI.getOne(id), placeAPI.getAll({})])
      .then(([p, places]) => {
        const pl = p.data.plan;
        setPlan(pl);
        // Pre-populate form fields from existing plan
        setPlanName(pl.name);
        setPlanDesc(pl.description || '');
        // Convert ISO date string to YYYY-MM-DD for <input type="date">
        setPlanDate(pl.planDate ? pl.planDate.split('T')[0] : '');
        // Sort existing stops by order and convert to internal planPlaces format
        const sorted = [...pl.places].sort((a, b) => a.order - b.order);
        setPlanPlaces(sorted.map((item, i) => ({
          place: item.place,            // Populated Place document
          order: i + 1,                 // Re-numbered from 1 to match array index
          notes: item.notes || '',      // Per-stop user note
          visitTime: item.visitTime || TIMES[i] || '',  // Keep original time or assign from TIMES
          duration: item.duration || '',               // Per-stop estimated duration
        })));
        setAllPlaces(places.data.places);
      })
      .catch(() => { toast.error('Could not load plan'); nav('/plans'); })
      .finally(() => setLoading(false));
  }, [id]);

  // ── Client-side Picker Filter ─────────────────────────────────────────────
  // Filters allPlaces against the search text (case-insensitive name match).
  const filtered = allPlaces.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  // ── Itinerary Operations ──────────────────────────────────────────────────

  // addPlace: appends a place to the itinerary; prevents duplicates via _id check.
  // Assigns the next available TIMES slot as visitTime.
  const addPlace = (place) => {
    if (planPlaces.find(p => p.place._id === place._id)) { toast.info('Already in plan'); return; }
    const i = planPlaces.length;  // Current length = new item's index
    setPlanPlaces(prev => [...prev, { place, order: i + 1, notes: '', visitTime: TIMES[i] || '', duration: place.estimatedDuration || '' }]);
    toast.success(`${place.name} added`);
  };

  // removePlace: removes a stop by place._id and re-numbers all remaining stops.
  // Re-assigns TIMES slots to keep times consistent after removal.
  const removePlace = (placeId) => {
    setPlanPlaces(prev => prev.filter(p => p.place._id !== placeId).map((p, i) => ({ ...p, order: i + 1, visitTime: TIMES[i] || '' })));
  };

  // moveUp: swaps the stop at index i with the one above it (index i-1).
  // Re-assigns order numbers and TIMES slots to match new positions.
  const moveUp = (i) => {
    if (i === 0) return;  // Already at the top
    const n = [...planPlaces]; [n[i-1], n[i]] = [n[i], n[i-1]];
    setPlanPlaces(n.map((p, j) => ({ ...p, order: j + 1, visitTime: TIMES[j] || '' })));
  };

  // moveDown: swaps the stop at index i with the one below it (index i+1).
  // Re-assigns order numbers and TIMES slots to match new positions.
  const moveDown = (i) => {
    if (i === planPlaces.length - 1) return;  // Already at the bottom
    const n = [...planPlaces]; [n[i], n[i+1]] = [n[i+1], n[i]];
    setPlanPlaces(n.map((p, j) => ({ ...p, order: j + 1, visitTime: TIMES[j] || '' })));
  };

  // updateNote: immutably updates the notes field for a single stop identified by place._id.
  const updateNote = (placeId, notes) => setPlanPlaces(prev => prev.map(p => p.place._id === placeId ? { ...p, notes } : p));

  // ── Summary Calculations ──────────────────────────────────────────────────
  // totalCost: sum of localAdult ticket prices — estimate only (differs for foreigners)
  const totalCost  = planPlaces.reduce((s, p) => s + (p.place.tickets?.localAdult || 0), 0);
  // estDur: 1.5 hours per stop as a rough estimate of total time needed
  const estDur     = `~${(planPlaces.length * 1.5).toFixed(1)} hours`;

  // ── Save Handler ──────────────────────────────────────────────────────────
  // Validates required fields, then calls planAPI.update() to persist changes.
  // Navigates back to the plan detail page on success.
  const save = async () => {
    if (!planName.trim()) { toast.error('Plan name is required'); return; }
    if (planPlaces.length === 0) { toast.error('Add at least one place'); return; }
    setSaving(true);
    try {
      await planAPI.update(id, {
        name: planName.trim(),
        description: planDesc,
        planDate: planDate || undefined,  // Omit field if empty string (no date set)
        // Map planPlaces to the shape the API expects (place _id, not full object)
        places: planPlaces.map(p => ({
          place: p.place._id, order: p.order,
          visitTime: p.visitTime, notes: p.notes, duration: p.duration,
        })),
        estimatedTotalCost: totalCost,
        estimatedDuration: estDur,
      });
      toast.success('Plan updated!');
      nav(`/plans/${id}`);  // Return to plan detail page
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to update plan'); }
    finally { setSaving(false); }
  };

  // ── Delete Plan Handler ────────────────────────────────────────────────────
  // Prompts with native confirm() using the plan name for clarity.
  // On confirm: calls planAPI.delete() then navigates to /plans.
  const deletePlan = async () => {
    if (!confirm(`Delete "${planName}"? This cannot be undone.`)) return;
    await planAPI.delete(id);
    toast.success('Plan deleted');
    nav('/plans');
  };

  // ── Loading State ─────────────────────────────────────────────────────────
  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div className={styles.page}>
      <div className="container">
        {/* ── Page Header ───────────────────────────────────────── */}
        <div className={styles.header}>
          <div>
            {/* Breadcrumb back to plan detail */}
            <div style={{ marginBottom:'0.5rem' }}>
              <Link to={`/plans/${id}`} style={{ fontSize:'0.85rem', color:'var(--gold3)' }}>← Back to Plan</Link>
            </div>
            <h1 className={styles.title}>Edit Plan</h1>
            <div className="gold-divider" />
            <p style={{ color:'var(--txt3)', fontSize:'0.875rem' }}>Rename, reorder stops, add or remove places</p>
          </div>
          {/* NOTE: Export PDF is NOT shown here — only available after booking/payment */}
          <div className={styles.headerActions}>
            {/* Delete with confirm — placed in header for quick access */}
            <button className="btn btn-danger btn-sm" onClick={deletePlan}>🗑️ Delete Plan</button>
            {/* Save button — disabled while API call is in progress */}
            <button className="btn btn-gold" onClick={save} disabled={saving}>{saving ? 'Saving...' : '💾 Save Changes'}</button>
          </div>
        </div>

        {/* ── Two-column layout: picker + builder ───────────────── */}
        <div className={styles.layout}>

          {/* ── Left: Place Picker Panel ──────────────────────── */}
          {/* Searchable list of all places; clicking toggles add/remove */}
          <div className={styles.picker}>
            <div className={styles.pickerHeader}>Add / Replace Places</div>
            {/* Search input — filters allPlaces client-side by name */}
            <input className="form-input" placeholder="Search all 11 attractions..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom:'0.75rem' }} />
            <div className={styles.pickList}>
              {filtered.map(p => {
                // Check if this place is already in the current itinerary
                const inPlan = planPlaces.find(pp => pp.place._id === p._id);
                return (
                  <div key={p._id} className={styles.pickItem}>
                    {/* Category icon from place's category.icon field */}
                    <div className={styles.pickIcon}>{p.category?.icon || '📍'}</div>
                    <div className={styles.pickInfo}>
                      <div className={styles.pickName}>{p.name}</div>
                      {/* Distance from reference location + entry fee */}
                      <div className={styles.pickMeta}>{p.distanceFromReference} km · {p.entryType === 'free' ? 'Free' : `LKR ${p.tickets?.localAdult}`}</div>
                    </div>
                    {/* Toggle button: "✓ In Plan" (removes) or "+ Add" (adds) */}
                    {/* Unlike PlannerPage, in EditPlanPage "✓ In Plan" is clickable and removes the place */}
                    <button
                      className={`btn btn-sm ${inPlan ? 'btn-teal' : 'btn-ghost'}`}
                      onClick={() => inPlan ? removePlace(p._id) : addPlace(p)}
                    >
                      {inPlan ? '✓ In Plan' : '+ Add'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Right: Plan Builder ──────────────────────────── */}
          <div className={styles.builder}>
            {/* ── Plan Metadata Card ─────────────────────────── */}
            {/* Name, visit date, and description fields */}
            <div className="card" style={{ marginBottom:'1rem' }}>
              <div className={styles.planMeta}>
                {/* Plan name — required field (validated in save()) */}
                <div className="form-group" style={{ flex:1 }}>
                  <label className="form-label">Plan Name *</label>
                  <input className="form-input" value={planName} onChange={e => setPlanName(e.target.value)} />
                </div>
                {/* Visit date — optional, stored separately from bookingDate */}
                <div className="form-group">
                  <label className="form-label">Visit Date</label>
                  <input className="form-input" type="date" value={planDate} onChange={e => setPlanDate(e.target.value)} />
                </div>
              </div>
              {/* Optional description textarea */}
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-input form-textarea" style={{ minHeight:56 }} value={planDesc} onChange={e => setPlanDesc(e.target.value)} />
              </div>
            </div>

            {/* ── Summary Bar ──────────────────────────────────── */}
            {/* Live stats: stop count, estimated duration, estimated entry cost */}
            <div className={styles.summaryBar}>
              <div className={styles.sumItem}><span className={styles.sumN}>{planPlaces.length}</span><span className={styles.sumL}>Stops</span></div>
              <div className={styles.sumDiv} />
              <div className={styles.sumItem}><span className={styles.sumN}>{estDur}</span><span className={styles.sumL}>Duration</span></div>
              <div className={styles.sumDiv} />
              <div className={styles.sumItem}><span className={styles.sumN}>LKR {totalCost.toLocaleString()}</span><span className={styles.sumL}>Est. Cost</span></div>
            </div>

            {/* ── Itinerary Card ────────────────────────────────── */}
            <div className="card">
              <div className={styles.itinHeader}>Reorder Stops (use arrows to move)</div>
              {planPlaces.length === 0 ? (
                // Empty state — no stops currently in the plan
                <div className="empty-state" style={{ padding:'2rem' }}>
                  <div className="empty-state-icon">🗓️</div>
                  <h3>No stops</h3>
                  <p>Add places from the panel on the left</p>
                </div>
              ) : (
                // List of current itinerary stops
                <div className={styles.itinList}>
                  {planPlaces.map((item, i) => (
                    <div key={item.place._id}>
                      {/* ── Individual Stop Row ──────────────── */}
                      <div className={styles.itinStop}>
                        {/* Sequential position number */}
                        <div className={styles.itinNum}>{i + 1}</div>
                        {/* Place thumbnail image */}
                        <div className={styles.itinImg}>
                          {item.place.coverImage && <img src={item.place.coverImage} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'var(--radius)' }} />}
                        </div>
                        <div className={styles.itinInfo}>
                          {/* Place name */}
                          <div className={styles.itinName}>{item.place.name}</div>
                          {/* Visit time (from TIMES array) + estimated duration */}
                          <div className={styles.itinMeta}>{item.visitTime} · {item.place.estimatedDuration}</div>
                          {/* Per-stop note input — pre-populated with existing note */}
                          <input className={styles.itinNote} placeholder="Add note for this stop..." value={item.notes} onChange={e => updateNote(item.place._id, e.target.value)} />
                        </div>
                        {/* Reorder + remove controls */}
                        <div className={styles.itinActions}>
                          {/* Move up — disabled when at index 0 (already first) */}
                          <button className={styles.moveBtn} onClick={() => moveUp(i)} disabled={i === 0} title="Move up">↑</button>
                          {/* Move down — disabled when at last index */}
                          <button className={styles.moveBtn} onClick={() => moveDown(i)} disabled={i === planPlaces.length - 1} title="Move down">↓</button>
                          {/* Remove stop — filters it out and re-numbers remaining */}
                          <button className={styles.removeBtn} onClick={() => removePlace(item.place._id)} title="Remove">✕</button>
                        </div>
                      </div>
                      {/* Travel time estimate between consecutive stops */}
                      {i < planPlaces.length - 1 && <div className={styles.itinArrow}>↓ ~30 min travel</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Save / Cancel / Delete Row ────────────────────── */}
            <div className={styles.saveRow}>
              {/* Save Changes — disabled while saving or when no stops added */}
              <button className="btn btn-gold btn-lg" onClick={save} disabled={saving || planPlaces.length === 0}>
                {saving ? 'Saving...' : '💾 Save Changes'}
              </button>
              {/* Cancel — returns to plan detail without saving */}
              <button className="btn btn-outline" onClick={() => nav(`/plans/${id}`)}>Cancel</button>
              {/* Delete Plan — triggers confirm() modal */}
              <button className="btn btn-danger" onClick={deletePlan}>🗑️ Delete Plan</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
