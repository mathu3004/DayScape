/**
 * pages/user/PlannerPage.jsx — Trip Planner (Create New Plan)
 *
 * The interactive day-trip builder where users can:
 *  1. Search and add places from a scrollable list on the left
 *  2. View and edit the itinerary on the right (reorder, add notes)
 *  3. Save the completed plan to their account via planAPI.create()
 *
 * Data sources:
 *  - placeAPI.getAll({}) — all 11 places for the picker list
 *  - sessionStorage['plannerPlaces'] — pre-populated by PlaceCard "+ Plan" or
 *    LiveMapPage "+ Plan" buttons; cleared after successful save
 *
 * ARRIVAL_TIMES:
 *  8 preset time slots assigned in order to each stop.
 *  When a stop is added or reordered, its visitTime is reassigned from ARRIVAL_TIMES[index].
 *
 * Estimated cost (totalCost):
 *  Sum of place.tickets.localAdult for each stop. Shown in the summary bar.
 *  Used as estimatedTotalCost when creating the plan document.
 *
 * Estimated duration (estDur):
 *  planPlaces.length × 1.5 hours per stop. Shows as "X.X hours (est.)".
 *
 * PDF/route gate:
 *  An info note at the top explains that PDF export and route navigation are
 *  locked behind a booking + payment. Users must save first, then book the plan.
 *
 * Plan operations:
 *  addPlace    — Adds a place to the end; prevents duplicates.
 *  removePlace — Removes by _id; re-numbers remaining stops.
 *  moveUp/Down — Swaps adjacent items; re-assigns order numbers and ARRIVAL_TIMES.
 *  updateNote  — Updates the notes field for a single stop.
 *  savePlan    — Validates name and ≥1 place; posts to planAPI.create(); navigates to plan detail.
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { placeAPI, planAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import styles from './Planner.module.css';

// ── Arrival times — assigned sequentially to itinerary stops ─────────────────
// When a stop is at position i, it gets ARRIVAL_TIMES[i] as its visitTime.
const ARRIVAL_TIMES = ['8:00 AM','9:30 AM','11:00 AM','12:30 PM','2:00 PM','3:30 PM','5:00 PM','6:30 PM'];

export default function PlannerPage() {
  // ── State ─────────────────────────────────────────────────────────────────
  const [places,     setPlaces]     = useState([]);                  // Filtered picker list
  const [planPlaces, setPlanPlaces] = useState([]);                  // Current itinerary stops
  const [allPlaces,  setAllPlaces]  = useState([]);                  // All 11 places (for search)
  const [search,     setSearch]     = useState('');                  // Picker search query
  const [planName,   setPlanName]   = useState('My Colombo Day Trip'); // Plan name input
  const [planDesc,   setPlanDesc]   = useState('');                  // Optional description
  const [saving,     setSaving]     = useState(false);               // Prevents double-save
  const toast = useToast();
  const nav   = useNavigate();

  // ── Fetch All Places + Load from sessionStorage ───────────────────────────
  // Loads all 11 places for the picker list.
  // Reads any pre-populated places from sessionStorage (set by PlaceCard/LiveMapPage)
  // and converts them to planItem format with order + visitTime.
  useEffect(() => {
    placeAPI.getAll({}).then(({ data }) => setAllPlaces(data.places));
    const saved = sessionStorage.getItem('plannerPlaces');
    if (saved) {
      try { setPlanPlaces(JSON.parse(saved).map((p, i) => ({ place: p, order: i + 1, notes: '', visitTime: ARRIVAL_TIMES[i] || '' }))); }
      catch {}  // Silently ignore malformed sessionStorage data
    }
  }, []);

  // ── Filter Picker List on Search ─────────────────────────────────────────
  // Client-side filter: matches against name and category name.
  useEffect(() => {
    const q = search.toLowerCase();
    setPlaces(allPlaces.filter(p => p.name.toLowerCase().includes(q) || p.category?.name?.toLowerCase().includes(q)));
  }, [search, allPlaces]);

  // ── Itinerary Operations ──────────────────────────────────────────────────

  // addPlace: appends a place to the end. Duplicate-prevention via _id check.
  const addPlace    = (place) => { if (planPlaces.find(p => p.place._id === place._id)) { toast.info('Already in plan'); return; } setPlanPlaces(prev => [...prev, { place, order: prev.length + 1, notes: '', visitTime: ARRIVAL_TIMES[prev.length] || '' }]); toast.success(`${place.name} added`); };

  // removePlace: filters out by _id and re-numbers remaining items from 1.
  const removePlace = (id) => setPlanPlaces(prev => prev.filter(p => p.place._id !== id).map((p, i) => ({ ...p, order: i + 1, visitTime: ARRIVAL_TIMES[i] || '' })));

  // moveUp: swaps item at index i with the one above it; re-assigns order + visitTime.
  const moveUp      = (i) => { if (i === 0) return; const n = [...planPlaces]; [n[i-1],n[i]] = [n[i],n[i-1]]; setPlanPlaces(n.map((p,j) => ({...p, order:j+1, visitTime:ARRIVAL_TIMES[j]||''}))); };

  // moveDown: swaps item at index i with the one below it; re-assigns order + visitTime.
  const moveDown    = (i) => { if (i === planPlaces.length-1) return; const n = [...planPlaces]; [n[i],n[i+1]] = [n[i+1],n[i]]; setPlanPlaces(n.map((p,j) => ({...p, order:j+1, visitTime:ARRIVAL_TIMES[j]||''}))); };

  // updateNote: immutably replaces the notes field for a single stop by _id.
  const updateNote  = (id, notes) => setPlanPlaces(prev => prev.map(p => p.place._id === id ? { ...p, notes } : p));

  // ── Summary Calculations ──────────────────────────────────────────────────
  // totalCost: sum of localAdult ticket prices — only an estimate (different for foreigners)
  const totalCost = planPlaces.reduce((s, p) => s + (p.place.tickets?.localAdult || 0), 0);
  // estDur: 1.5 hours per stop as a rough estimate
  const estDur    = `${(planPlaces.length * 1.5).toFixed(1)} hours (est.)`;

  // ── Save Plan ─────────────────────────────────────────────────────────────
  // Validates name and ≥1 place, creates plan via API, clears sessionStorage,
  // and navigates to the new plan's detail page.
  const savePlan = async () => {
    if (!planName) { toast.error('Please name your plan'); return; }
    if (planPlaces.length === 0) { toast.error('Add at least one place'); return; }
    setSaving(true);
    try {
      const { data } = await planAPI.create({
        name: planName, description: planDesc,
        // Map planPlaces to the format the API expects
        places: planPlaces.map(p => ({ place: p.place._id, order: p.order, visitTime: p.visitTime, notes: p.notes, duration: p.place.estimatedDuration })),
        estimatedTotalCost: totalCost, estimatedDuration: estDur,
      });
      // Clear sessionStorage after successful save so next visit to /planner is clean
      sessionStorage.removeItem('plannerPlaces');
      toast.success('Plan saved! Book your plan to unlock PDF export and route access.');
      nav(`/plans/${data.plan._id}`);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <div className={styles.page}>
      <div className="container">
        {/* ── Page Header ───────────────────────────────────────── */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Trip Planner</h1>
            <div className="gold-divider"/>
            <p style={{ color:'var(--txt3)' }}>Build and save your personalised Colombo day-trip itinerary</p>
          </div>
          <div className={styles.headerActions}>
            {/* NOTE: Export PDF is only available AFTER booking and paying - see Saved Plans */}
            <Link to="/plans" className="btn btn-outline">My Saved Plans</Link>
            <button className="btn btn-gold" onClick={savePlan} disabled={saving}>
              {saving ? 'Saving...' : '💾 Save Plan'}
            </button>
          </div>
        </div>

        {/* ── PDF Gate Info Note ─────────────────────────────────── */}
        {/* Explains that premium features (PDF, Maps route) require booking + payment */}
        <div style={{ background:'rgba(201,168,76,0.06)', border:'1px solid rgba(201,168,76,0.2)', borderRadius:'var(--radius)', padding:'0.75rem 1rem', marginBottom:'1.5rem', fontSize:'0.82rem', color:'var(--gold3)', display:'flex', alignItems:'center', gap:'0.5rem' }}>
          <span>🔒</span>
          <span><strong>Note:</strong> Save your plan first, then book and pay to unlock Export PDF, Google Maps Route, and Navigation features.</span>
        </div>

        {/* ── Two-column layout: place picker + plan builder ─────── */}
        <div className={styles.layout}>
          {/* ── Left: Place Picker ────────────────────────────── */}
          {/* Searchable list of all places; shows a teal ✓ when a place is in the plan */}
          <div className={styles.picker}>
            <div className={styles.pickerHeader}>Browse & Add Places</div>
            {/* Search input — filters allPlaces by name and category client-side */}
            <input className="form-input" placeholder="Search attractions..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom:'0.75rem' }}/>
            <div className={styles.pickList}>
              {places.map(p => {
                const inPlan = planPlaces.find(pp => pp.place._id === p._id);
                return (
                  <div key={p._id} className={styles.pickItem}>
                    {/* Category icon */}
                    <div className={styles.pickIcon}>{p.category?.icon || '📍'}</div>
                    <div className={styles.pickInfo}>
                      <div className={styles.pickName}>{p.name}</div>
                      {/* Meta: distance from reference + entry fee */}
                      <div className={styles.pickMeta}>{p.distanceFromReference} km · {p.entryType === 'free' ? 'Free' : `LKR ${p.tickets?.localAdult}`}</div>
                    </div>
                    {/* Add button — teal ✓ when already in plan; disabled to prevent re-add */}
                    <button className={`btn btn-sm ${inPlan ? 'btn-teal' : 'btn-ghost'}`} onClick={() => addPlace(p)} disabled={!!inPlan}>
                      {inPlan ? '✓' : '+'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Right: Plan Builder ──────────────────────────── */}
          <div className={styles.builder}>
            {/* Plan metadata: name + optional description */}
            <div className="card" style={{ marginBottom:'1rem' }}>
              <div className={styles.planMeta}>
                <div className="form-group" style={{ flex:1 }}>
                  <label className="form-label">Plan Name</label>
                  <input className="form-input" value={planName} onChange={e => setPlanName(e.target.value)}/>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <textarea className="form-input form-textarea" style={{ minHeight:60 }} value={planDesc} onChange={e => setPlanDesc(e.target.value)} placeholder="Add notes about your plan..."/>
              </div>
            </div>

            {/* ── Summary Bar ──────────────────────────────────── */}
            {/* Shows stop count, estimated duration, and estimated total entry cost */}
            <div className={styles.summaryBar}>
              <div className={styles.sumItem}><span className={styles.sumN}>{planPlaces.length}</span><span className={styles.sumL}>Stops</span></div>
              <div className={styles.sumDiv}/>
              <div className={styles.sumItem}><span className={styles.sumN}>{estDur}</span><span className={styles.sumL}>Duration</span></div>
              <div className={styles.sumDiv}/>
              <div className={styles.sumItem}><span className={styles.sumN}>LKR {totalCost.toLocaleString()}</span><span className={styles.sumL}>Est. Cost</span></div>
            </div>

            {/* ── Itinerary List ────────────────────────────────── */}
            <div className="card">
              <div className={styles.itinHeader}>Itinerary</div>
              {planPlaces.length === 0 ? (
                // Empty state shown when no stops have been added yet
                <div className="empty-state" style={{ padding:'2rem' }}>
                  <div className="empty-state-icon">🗓️</div>
                  <h3>No stops yet</h3>
                  <p>Search and add places from the left panel</p>
                </div>
              ) : (
                <div className={styles.itinList}>
                  {planPlaces.map((item, i) => (
                    <div key={item.place._id}>
                      <div className={styles.itinStop}>
                        {/* Step number indicator */}
                        <div className={styles.itinNum}>{i + 1}</div>
                        {/* Thumbnail image */}
                        <div className={styles.itinImg}>
                          {item.place.coverImage && <img src={item.place.coverImage} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'var(--radius)' }}/>}
                        </div>
                        <div className={styles.itinInfo}>
                          <div className={styles.itinName}>{item.place.name}</div>
                          {/* Visit time (from ARRIVAL_TIMES) + estimated duration */}
                          <div className={styles.itinMeta}>{item.visitTime || '--'} · {item.place.estimatedDuration}</div>
                          {/* Per-stop note input */}
                          <input className={styles.itinNote} placeholder="Add note..." value={item.notes} onChange={e => updateNote(item.place._id, e.target.value)}/>
                        </div>
                        {/* Reorder + remove controls */}
                        <div className={styles.itinActions}>
                          <button className={styles.moveBtn} onClick={() => moveUp(i)} disabled={i===0}>↑</button>
                          <button className={styles.moveBtn} onClick={() => moveDown(i)} disabled={i===planPlaces.length-1}>↓</button>
                          <button className={styles.removeBtn} onClick={() => removePlace(item.place._id)}>✕</button>
                        </div>
                      </div>
                      {/* Travel time indicator between consecutive stops */}
                      {i < planPlaces.length - 1 && <div className={styles.itinArrow}>↓ ~30 min travel</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Save + Clear Row ───────────────────────────────── */}
            <div className={styles.saveRow}>
              {/* Save button — disabled while saving or when plan has no stops */}
              <button className="btn btn-gold btn-lg" onClick={savePlan} disabled={saving || planPlaces.length === 0}>
                {saving ? 'Saving...' : '💾 Save Plan to Account'}
              </button>
              {/* Clear button — resets the itinerary without saving */}
              <button className="btn btn-ghost" onClick={() => { setPlanPlaces([]); toast.info('Plan cleared'); }}>🗑️ Clear</button>
            </div>
            {/* After-save hint about booking to unlock features */}
            <p style={{ fontSize:'0.75rem', color:'var(--txt4)', textAlign:'center', marginTop:'0.5rem' }}>
              After saving, visit your plan to Book it and unlock PDF export and route navigation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
