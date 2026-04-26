/**
 * pages/admin/AdminPlaces.jsx — Admin: Manage Places
 *
 * Full CRUD interface for Place documents. Admins can create new places,
 * edit existing ones, and deactivate (soft-delete) them. All 11 Colombo
 * attractions are managed here.
 *
 * Data:
 *  placeAPI.getAllAdmin() — returns all places including inactive ones
 *    (public API only returns active; admin sees all)
 *  categoryAPI.getAll()  — returns all categories for the category dropdown
 *
 * EMPTY constant:
 *  Default form values used when creating a new place (also used to reset
 *  after a save). All string fields default to empty string; booleans to false;
 *  tickets to 0 for all four tiers; openingTime defaults to '08:00'.
 *
 * Form State Management:
 *  f(k, v)  — shorthand setter for a top-level form field: setForm({...form, [k]: v})
 *  ft(k, v) — shorthand setter for a nested tickets field: setForm({...form, tickets: {..., [k]: v}})
 *  Both handlers are used throughout the form's onChange attributes.
 *
 * openNew():
 *  Resets form to EMPTY and clears editing state, then shows the form panel.
 *
 * openEdit(p):
 *  Populates form from existing place document `p`.
 *  Key transformations:
 *   - category: extracts _id from populated object (handles both populated {_id} and raw string)
 *   - preparationTips: Array → newline-separated string (for textarea editing)
 *   - safetyTips:      Array → newline-separated string
 *   - tags:            Array → comma-separated string
 *   - tickets:         uses p.tickets or EMPTY.tickets as fallback
 *
 * save(e):
 *  Builds payload from form state with these transformations:
 *   - preparationTips: newline string → filtered array
 *   - safetyTips:      newline string → filtered array
 *   - tags:            comma string → trimmed, filtered array
 *   - lat/lng:         string → parseFloat
 *  Create vs Update: determined by whether `editing` (_id) is set.
 *  On success: updates local places state without refetch, hides form panel.
 *
 * del(id):
 *  Soft-delete (deactivate) via placeAPI.delete().
 *  Filters the place from local state for immediate UI update.
 *  Uses 'Deactivate' language (not 'Delete') to match soft-delete behavior.
 *
 * Ticket price fields:
 *  Only shown when form.entryType === 'paid'.
 *  Four tiers: localAdult, localChild, foreignerAdult, foreignerChild.
 *  Field labels are auto-generated from the key using camelCase → space conversion.
 *
 * Featured + Parking checkboxes:
 *  isFeatured:      marks place for display on homepage featured section
 *  parkingAvailable: shown on place detail page as parking info
 *
 * Places table columns:
 *  Place (name + truncated address), Category badge, Distance from REF,
 *  Entry type badge (Free=teal / Paid=coral), Rating, Featured badge, Status, Actions
 *
 * Search:
 *  Client-side filter against place name (case-insensitive).
 */

import { useState, useEffect } from 'react';
import { placeAPI, categoryAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import styles from './Admin.module.css';

// ── Default Empty Form Values ─────────────────────────────────────────────────
// Used when creating a new place or resetting the form after save.
// All required fields start empty; default values provide sensible starting points.
const EMPTY = {
  name:'', slug:'', shortDescription:'', fullDescription:'',
  address:'', lat:'', lng:'',
  openingTime:'08:00', closingTime:'17:00',
  bestTimeOfDay:'Morning', bestSeason:'November to April',
  estimatedDuration:'1-2 hours', entryType:'free',
  tickets:{ localAdult:0, localChild:0, foreignerAdult:0, foreignerChild:0 },
  coverImage:'',
  preparationTips:'', safetyTips:'', dressCode:'', travelNotes:'',
  parkingAvailable:false, contactInfo:'', website:'', tags:'',
  isFeatured:false, category:''
};

export default function AdminPlaces() {
  // ── State ─────────────────────────────────────────────────────────────────
  const [places,     setPlaces]     = useState([]);    // All places (including inactive)
  const [categories, setCategories] = useState([]);    // All categories for select dropdown
  const [showForm,   setShowForm]   = useState(false); // Whether to show the form panel
  const [editing,    setEditing]    = useState(null);  // _id of place being edited, or null (create mode)
  const [form,       setForm]       = useState(EMPTY); // Current form field values
  const [search,     setSearch]     = useState('');    // Search text for client-side filter
  const [saving,     setSaving]     = useState(false); // Prevents double-save
  const toast = useToast();

  // ── Fetch Places + Categories on Mount ───────────────────────────────────
  // getAllAdmin returns all places (public getAll only returns active ones).
  useEffect(() => {
    placeAPI.getAllAdmin().then(({ data }) => setPlaces(data.places));
    categoryAPI.getAll().then(({ data }) => setCategories(data.categories));
  }, []);

  // ── Client-side Search Filter ─────────────────────────────────────────────
  const filtered = places.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  // ── openNew: Reset form and show for creation ─────────────────────────────
  const openNew = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };

  // ── openEdit: Pre-populate form from existing place ───────────────────────
  // Transforms arrays to editable string formats for textarea/input fields.
  const openEdit = (p) => {
    setEditing(p._id);
    setForm({
      ...EMPTY,
      ...p,
      // Extract _id from populated category object (handles both forms)
      category: p.category?._id || p.category || '',
      // Arrays → newline-separated strings for textarea editing
      preparationTips: p.preparationTips?.join('\n') || '',
      safetyTips:      p.safetyTips?.join('\n')      || '',
      // Array → comma-separated string for tags input
      tags:    p.tags?.join(', ') || '',
      tickets: p.tickets || EMPTY.tickets,
    });
    setShowForm(true);
  };

  // ── Form Field Setters ────────────────────────────────────────────────────
  // f(k, v): updates a top-level form field by key
  const f  = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  // ft(k, v): updates a nested tickets field by key (parseInt ensures numeric values)
  const ft = (k, v) => setForm(prev => ({ ...prev, tickets: { ...prev.tickets, [k]: parseInt(v) || 0 } }));

  // ── Save Handler ──────────────────────────────────────────────────────────
  // Transforms form strings back to their correct types before sending to API.
  const save = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = {
        ...form,
        // Newline strings → filtered arrays (removes empty lines)
        preparationTips: form.preparationTips.split('\n').filter(Boolean),
        safetyTips:      form.safetyTips.split('\n').filter(Boolean),
        // Comma string → trimmed, non-empty array
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        // String inputs → numeric types
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
      };
      if (editing) {
        // Update existing place — replace in local state by _id
        const { data } = await placeAPI.update(editing, payload);
        setPlaces(prev => prev.map(p => p._id === editing ? data.place : p));
        toast.success('Place updated');
      } else {
        // Create new place — prepend to local state for immediate visibility
        const { data } = await placeAPI.create(payload);
        setPlaces(prev => [data.place, ...prev]);
        toast.success('Place created');
      }
      setShowForm(false);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  // ── Deactivate Handler ────────────────────────────────────────────────────
  // Soft-deletes the place (sets isActive=false on the server).
  // Removes from local state for immediate UI update without refetch.
  const del = async (id) => {
    if (!confirm('Deactivate this place?')) return;
    await placeAPI.delete(id);
    setPlaces(prev => prev.filter(p => p._id !== id));
    toast.success('Place deactivated');
  };

  return (
    <div className={styles.adminPageLayout}>
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Manage Places</h1>
        <p className={styles.pageSub}>{places.length} total places</p>
      </div>

      {/* ── Top Bar: Search + Add Button ────────────────────────── */}
      <div className={styles.topBar}>
        <input className={styles.searchInput} placeholder="Search places..." value={search} onChange={e => setSearch(e.target.value)}/>
        <button className="btn btn-gold" onClick={openNew}>+ Add New Place</button>
      </div>

      {/* ── Form Panel (Create / Edit) ───────────────────────────── */}
      {/* Only shown when showForm is true */}
      {showForm && (
        <div className={styles.formPanel}>
          <h3 className={styles.formTitle}>{editing ? 'Edit Place' : 'Add New Place'}</h3>
          <form onSubmit={save}>
            {/* ── Core Fields Grid ─────────────────────────────── */}
            <div className={styles.formGrid}>
              <div className="form-group"><label className="form-label">Place Name *</label><input className="form-input" required value={form.name} onChange={e => f('name', e.target.value)}/></div>
              {/* Category select — populated from categoryAPI.getAll() */}
              <div className="form-group"><label className="form-label">Category *</label>
                <select className="form-input form-select" required value={form.category} onChange={e => f('category', e.target.value)}>
                  <option value="">Select category</option>
                  {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
              {/* Coordinates — step=0.0001 allows precision to ~11m */}
              <div className="form-group"><label className="form-label">Latitude *</label><input className="form-input" type="number" step="0.0001" required value={form.lat} onChange={e => f('lat', e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Longitude *</label><input className="form-input" type="number" step="0.0001" required value={form.lng} onChange={e => f('lng', e.target.value)}/></div>
              {/* Opening/closing times stored as "HH:MM" strings */}
              <div className="form-group"><label className="form-label">Opening Time</label><input className="form-input" type="time" value={form.openingTime} onChange={e => f('openingTime', e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Closing Time</label><input className="form-input" type="time" value={form.closingTime} onChange={e => f('closingTime', e.target.value)}/></div>
              {/* Entry type: free or paid — controls whether ticket prices are shown */}
              <div className="form-group"><label className="form-label">Entry Type</label>
                <select className="form-input form-select" value={form.entryType} onChange={e => f('entryType', e.target.value)}>
                  <option value="free">Free</option><option value="paid">Paid</option>
                </select>
              </div>
              <div className="form-group"><label className="form-label">Cover Image URL</label><input className="form-input" value={form.coverImage} onChange={e => f('coverImage', e.target.value)} placeholder="https://..."/></div>
            </div>

            {/* ── Ticket Prices (only shown for paid entry type) ── */}
            {/* Four pricing tiers: localAdult, localChild, foreignerAdult, foreignerChild */}
            {form.entryType === 'paid' && (
              <div className={styles.formGrid}>
                {['localAdult','localChild','foreignerAdult','foreignerChild'].map(k => (
                  <div className="form-group" key={k}>
                    {/* Auto-generate label by inserting space before capitals */}
                    <label className="form-label">{k.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase())} (LKR)</label>
                    <input className="form-input" type="number" value={form.tickets[k]} onChange={e => ft(k, e.target.value)}/>
                  </div>
                ))}
              </div>
            )}

            {/* ── Text Fields ──────────────────────────────────── */}
            <div className="form-group"><label className="form-label">Address</label><input className="form-input" value={form.address} onChange={e => f('address', e.target.value)}/></div>
            <div className="form-group"><label className="form-label">Short Description *</label><textarea className="form-input form-textarea" style={{minHeight:60}} required value={form.shortDescription} onChange={e => f('shortDescription', e.target.value)}/></div>
            <div className="form-group"><label className="form-label">Full Description</label><textarea className="form-input form-textarea" value={form.fullDescription} onChange={e => f('fullDescription', e.target.value)}/></div>

            {/* ── Tips (newline-separated, stored as arrays) ───── */}
            <div className={styles.formGrid}>
              <div className="form-group"><label className="form-label">Preparation Tips (one per line)</label><textarea className="form-input form-textarea" style={{minHeight:80}} value={form.preparationTips} onChange={e => f('preparationTips', e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Safety Tips (one per line)</label><textarea className="form-input form-textarea" style={{minHeight:80}} value={form.safetyTips} onChange={e => f('safetyTips', e.target.value)}/></div>
            </div>

            {/* ── Miscellaneous Fields ─────────────────────────── */}
            <div className={styles.formGrid}>
              {/* Tags: stored as array, edited as comma-separated string */}
              <div className="form-group"><label className="form-label">Tags (comma separated)</label><input className="form-input" value={form.tags} onChange={e => f('tags', e.target.value)} placeholder="park, family, free"/></div>
              <div className="form-group"><label className="form-label">Contact Info</label><input className="form-input" value={form.contactInfo} onChange={e => f('contactInfo', e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Best Time of Day</label><input className="form-input" value={form.bestTimeOfDay} onChange={e => f('bestTimeOfDay', e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Best Season</label><input className="form-input" value={form.bestSeason} onChange={e => f('bestSeason', e.target.value)}/></div>
            </div>

            {/* ── Boolean Checkboxes ───────────────────────────── */}
            <div style={{display:'flex',gap:'0.75rem',alignItems:'center',marginTop:'0.5rem',marginBottom:'1rem'}}>
              {/* isFeatured: shows place on homepage featured section */}
              <label style={{display:'flex',alignItems:'center',gap:'0.5rem',fontSize:'0.875rem',color:'var(--txt2)',cursor:'pointer'}}>
                <input type="checkbox" checked={form.isFeatured} onChange={e => f('isFeatured', e.target.checked)}/> Featured Place
              </label>
              {/* parkingAvailable: shown as info badge on place detail page */}
              <label style={{display:'flex',alignItems:'center',gap:'0.5rem',fontSize:'0.875rem',color:'var(--txt2)',cursor:'pointer'}}>
                <input type="checkbox" checked={form.parkingAvailable} onChange={e => f('parkingAvailable', e.target.checked)}/> Parking Available
              </label>
            </div>

            {/* ── Form Submit / Cancel ─────────────────────────── */}
            <div className={styles.formRow}>
              {/* Button label changes based on create vs edit mode */}
              <button className="btn btn-gold" type="submit" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update Place' : 'Create Place'}</button>
              <button className="btn btn-ghost" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Places Table ────────────────────────────────────────── */}
      <div className={styles.adminCard}>
        <table className={styles.table}>
          <thead><tr><th>Place</th><th>Category</th><th>Dist.</th><th>Entry</th><th>Rating</th><th>Featured</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p._id}>
                {/* Name + truncated address */}
                <td>
                  <div style={{fontWeight:600,color:'var(--txt)',marginBottom:'2px'}}>{p.name}</div>
                  <div style={{fontSize:'0.72rem',color:'var(--txt3)'}}>{p.address?.substring(0,35)}</div>
                </td>
                {/* Category badge */}
                <td><span className="badge badge-gold" style={{fontSize:'0.68rem'}}>{p.category?.name || '-'}</span></td>
                {/* Distance from REF (pre-calculated on server) */}
                <td style={{color:'var(--txt2)'}}>{p.distanceFromReference} km</td>
                {/* Entry type: Free=teal badge, Paid=coral badge */}
                <td>{p.entryType === 'free' ? <span className="badge badge-teal">Free</span> : <span className="badge badge-coral">Paid</span>}</td>
                {/* Average rating from reviews (1 decimal place) */}
                <td style={{color:'var(--gold)'}}>{p.rating?.toFixed(1) || '-'}</td>
                {/* Featured: star badge or dash */}
                <td>{p.isFeatured ? <span className="badge badge-gold">⭐</span> : '-'}</td>
                {/* Active status: Active=teal, Inactive=coral */}
                <td>{p.isActive ? <span className="badge badge-teal">Active</span> : <span className="badge badge-coral">Inactive</span>}</td>
                {/* Edit opens form panel; Deactivate soft-deletes */}
                <td>
                  <div style={{display:'flex',gap:'0.5rem'}}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>✏️ Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => del(p._id)}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
