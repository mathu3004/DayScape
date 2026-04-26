/**
 * pages/admin/AdminPackages.jsx — Admin: Manage Tour Packages
 *
 * Full CRUD interface for Package documents. Admins can create new packages,
 * edit existing ones, deactivate them, and assign which Places are included.
 *
 * Data:
 *  packageAPI.getAll()      — returns all packages (including inactive)
 *  placeAPI.getAllAdmin()    — returns all 11 places for the "Included Places" picker
 *
 * EMPTY constant:
 *  Default form values for creating a new package.
 *  includes/excludes start as empty strings (textarea input),
 *  places starts as an empty array (togglePlace adds _id strings).
 *
 * openEdit(p):
 *  Pre-populates form from existing package `p`.
 *  Key transformations:
 *   - includes: Array → newline-separated string
 *   - excludes: Array → newline-separated string
 *   - places:   Array of Place docs (or _id strings) → array of _id strings
 *     Handles both populated Place objects and raw _id strings via (pl._id || pl).
 *
 * f(k, v):
 *  Shorthand setter for a top-level form field.
 *
 * togglePlace(id):
 *  Adds or removes a place _id from form.places array (used for the
 *  multi-select "Included Places" pill buttons).
 *  Toggled state: highlight when selected (gold border + gold background).
 *
 * save(e):
 *  Transforms form data before sending to API:
 *   - price:         string → parseFloat
 *   - originalPrice: string → parseFloat (falls back to price if empty)
 *   - includes:      newline string → filtered array
 *   - excludes:      newline string → filtered array
 *  Create vs Update: determined by whether `editing` (_id) is set.
 *  After success: updates local packages state; resets form and editing state.
 *
 * del(id):
 *  Soft-delete (deactivate) via packageAPI.delete().
 *  Removes from local state for immediate UI update.
 *
 * Package categories:
 *  Fixed list: general, cultural, scenic, family, nature, luxury
 *  (No create/delete needed; these are display categories)
 *
 * Package table columns:
 *  Package name, Category badge, Duration, Price (LKR), Discount badge, Places count, Actions
 *
 * Discount badge:
 *  Shown as badge-coral with the discount % when discount > 0.
 *  Shows '-' when no discount is applied.
 *
 * isFeatured checkbox:
 *  Marks package for display in featured/highlighted sections.
 *
 * Included Places multi-select:
 *  Rendered as a flex-wrap of pill buttons (one per place).
 *  Selected places have gold border + gold background.
 *  Clicking a selected place removes it; clicking unselected adds it.
 */

import { useState, useEffect } from 'react';
import { packageAPI, placeAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import styles from './Admin.module.css';

// ── Default Empty Form Values ─────────────────────────────────────────────────
// includes/excludes are newline-separated strings for textarea editing.
// places is an array of place _id strings (not objects).
const EMPTY = {
  name:'', description:'', price:'', duration:'1 Day', maxPeople:10,
  includes:'', excludes:'', coverImage:'', category:'general',
  discount:0, originalPrice:'', places:[]
};

export default function AdminPackages() {
  // ── State ─────────────────────────────────────────────────────────────────
  const [packages,  setPackages]  = useState([]);    // All packages from server
  const [allPlaces, setAllPlaces] = useState([]);    // All places for the included-places picker
  const [showForm,  setShowForm]  = useState(false); // Whether to show the form panel
  const [editing,   setEditing]   = useState(null);  // _id of package being edited, or null
  const [form,      setForm]      = useState(EMPTY); // Current form field values
  const toast = useToast();

  // ── Fetch Packages + Places on Mount ─────────────────────────────────────
  useEffect(() => {
    packageAPI.getAll().then(({ data }) => setPackages(data.packages));
    // getAllAdmin returns all places including inactive ones (for complete picker list)
    placeAPI.getAllAdmin().then(({ data }) => setAllPlaces(data.places));
  }, []);

  // ── openEdit: Pre-populate form from existing package ────────────────────
  const openEdit = (p) => {
    setEditing(p._id);
    setForm({
      ...p,
      // Arrays → newline-separated strings for textarea editing
      includes: p.includes?.join('\n') || '',
      excludes: p.excludes?.join('\n') || '',
      // Normalize places to array of _id strings
      // Handles both populated Place objects ({_id, name, ...}) and raw _id strings
      places: p.places?.map(pl => pl._id || pl) || []
    });
    setShowForm(true);
  };

  // ── Form Field Setter ─────────────────────────────────────────────────────
  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  // ── togglePlace: Add or remove a place from the included places array ──────
  const togglePlace = (id) => setForm(prev => ({
    ...prev,
    places: prev.places.includes(id)
      ? prev.places.filter(p => p !== id)  // Remove if already selected
      : [...prev.places, id]               // Add if not selected
  }));

  // ── Save Handler ──────────────────────────────────────────────────────────
  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        price:         parseFloat(form.price),
        // originalPrice falls back to price if left empty (no original/sale distinction)
        originalPrice: parseFloat(form.originalPrice) || parseFloat(form.price),
        // Newline strings → filtered arrays (remove empty lines)
        includes: form.includes.split('\n').filter(Boolean),
        excludes: form.excludes.split('\n').filter(Boolean),
      };
      if (editing) {
        // Update existing package — replace in local state
        const { data } = await packageAPI.update(editing, payload);
        setPackages(prev => prev.map(p => p._id === editing ? data.package : p));
        toast.success('Package updated');
      } else {
        // Create new package — prepend to list
        const { data } = await packageAPI.create(payload);
        setPackages(prev => [data.package, ...prev]);
        toast.success('Package created');
      }
      // Reset form and close panel
      setShowForm(false); setEditing(null); setForm(EMPTY);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  // ── Deactivate Handler ────────────────────────────────────────────────────
  const del = async (id) => {
    if (!confirm('Deactivate this package?')) return;
    await packageAPI.delete(id);
    setPackages(prev => prev.filter(p => p._id !== id));
    toast.success('Package deactivated');
  };

  return (
    <div className={styles.adminPageLayout}>
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Manage Packages</h1>
        <p className={styles.pageSub}>{packages.length} active packages</p>
      </div>

      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <div className={styles.topBar}>
        <button className="btn btn-gold" onClick={() => { setEditing(null); setForm(EMPTY); setShowForm(true); }}>+ Add Package</button>
      </div>

      {/* ── Form Panel ──────────────────────────────────────────── */}
      {showForm && (
        <div className={styles.formPanel}>
          <h3 className={styles.formTitle}>{editing ? 'Edit Package' : 'New Package'}</h3>
          <form onSubmit={save}>
            {/* ── Core Fields ──────────────────────────────────── */}
            <div className={styles.formGrid}>
              <div className="form-group"><label className="form-label">Package Name *</label><input className="form-input" required value={form.name} onChange={e => f('name', e.target.value)}/></div>
              {/* Fixed category list: general, cultural, scenic, family, nature, luxury */}
              <div className="form-group"><label className="form-label">Category</label>
                <select className="form-input form-select" value={form.category} onChange={e => f('category', e.target.value)}>
                  {['general','cultural','scenic','family','nature','luxury'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {/* Price (required) and optional original price (for showing discount) */}
              <div className="form-group"><label className="form-label">Price (LKR) *</label><input className="form-input" type="number" required value={form.price} onChange={e => f('price', e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Original Price (LKR)</label><input className="form-input" type="number" value={form.originalPrice} onChange={e => f('originalPrice', e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Duration</label><input className="form-input" value={form.duration} onChange={e => f('duration', e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Max People</label><input className="form-input" type="number" value={form.maxPeople} onChange={e => f('maxPeople', parseInt(e.target.value))}/></div>
              {/* Discount percentage: 0-100 */}
              <div className="form-group"><label className="form-label">Discount (%)</label><input className="form-input" type="number" min="0" max="100" value={form.discount} onChange={e => f('discount', parseInt(e.target.value)||0)}/></div>
              <div className="form-group"><label className="form-label">Cover Image URL</label><input className="form-input" value={form.coverImage} onChange={e => f('coverImage', e.target.value)} placeholder="https://..."/></div>
            </div>

            {/* Description textarea (required) */}
            <div className="form-group"><label className="form-label">Description *</label><textarea className="form-input form-textarea" required value={form.description} onChange={e => f('description', e.target.value)}/></div>

            {/* ── Includes / Excludes (newline-separated) ──────── */}
            <div className={styles.formGrid}>
              <div className="form-group"><label className="form-label">Includes (one per line)</label><textarea className="form-input form-textarea" value={form.includes} onChange={e => f('includes', e.target.value)} placeholder="Professional guide&#10;Transport&#10;Lunch"/></div>
              <div className="form-group"><label className="form-label">Excludes (one per line)</label><textarea className="form-input form-textarea" value={form.excludes} onChange={e => f('excludes', e.target.value)} placeholder="Personal meals&#10;Souvenirs"/></div>
            </div>

            {/* ── Included Places Multi-Select ─────────────────── */}
            {/* Pill-button toggle: gold highlight when selected, ghost when not */}
            <div className="form-group">
              <label className="form-label">Included Places</label>
              <div style={{display:'flex',flexWrap:'wrap',gap:'0.5rem',padding:'0.75rem',background:'var(--bg3)',borderRadius:'var(--radius)',border:'1px solid var(--brd2)'}}>
                {allPlaces.map(p => (
                  <button type="button" key={p._id} onClick={() => togglePlace(p._id)}
                    style={{
                      padding:'4px 12px', borderRadius:'100px', border:'1px solid',
                      borderColor: form.places.includes(p._id) ? 'var(--gold3)' : 'var(--brd2)',
                      background:  form.places.includes(p._id) ? 'var(--gold4)' : 'none',
                      color:       form.places.includes(p._id) ? 'var(--gold2)' : 'var(--txt3)',
                      fontSize:'0.78rem', cursor:'pointer', fontFamily:'DM Sans'
                    }}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Featured checkbox */}
            <div style={{display:'flex',gap:'0.75rem',alignItems:'center',marginBottom:'1rem'}}>
              <label style={{display:'flex',alignItems:'center',gap:'0.5rem',fontSize:'0.875rem',color:'var(--txt2)',cursor:'pointer'}}>
                <input type="checkbox" checked={form.isFeatured||false} onChange={e => f('isFeatured', e.target.checked)}/> Featured Package
              </label>
            </div>

            {/* ── Form Actions ─────────────────────────────────── */}
            <div className={styles.formRow}>
              <button className="btn btn-gold" type="submit">Save Package</button>
              <button className="btn btn-ghost" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Packages Table ──────────────────────────────────────── */}
      <div className={styles.adminCard}>
        <table className={styles.table}>
          <thead><tr><th>Package</th><th>Category</th><th>Duration</th><th>Price</th><th>Discount</th><th>Places</th><th>Actions</th></tr></thead>
          <tbody>
            {packages.map(p => (
              <tr key={p._id}>
                {/* Package name */}
                <td><div style={{fontWeight:600,color:'var(--txt)'}}>{p.name}</div></td>
                {/* Category badge */}
                <td><span className="badge badge-gold" style={{fontSize:'0.68rem'}}>{p.category}</span></td>
                {/* Duration string (e.g., "Full Day", "Half Day") */}
                <td style={{color:'var(--txt2)',fontSize:'0.82rem'}}>{p.duration}</td>
                {/* Price in gold Cormorant Garamond */}
                <td style={{color:'var(--gold2)',fontWeight:600,fontFamily:'Cormorant Garamond',fontSize:'1rem'}}>LKR {p.price?.toLocaleString()}</td>
                {/* Discount: badge-coral with %, or '-' if no discount */}
                <td>{p.discount>0?<span className="badge badge-coral">{p.discount}%</span>:'-'}</td>
                {/* Number of places included in the package */}
                <td style={{color:'var(--txt3)',fontSize:'0.82rem'}}>{p.places?.length||0} places</td>
                {/* Edit: opens form panel | Deactivate: soft-delete */}
                <td>
                  <div style={{display:'flex',gap:'0.5rem'}}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>✏️</button>
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
