/**
 * pages/admin/AdminCategories.jsx — Admin: Manage Place Categories
 *
 * Full CRUD interface for Category documents. Categories are used to
 * classify places (e.g., "Religious Sites", "Parks & Recreational",
 * "Museums", etc.). Each category has a name, URL-safe slug, emoji icon,
 * hex color, and optional description.
 *
 * Data:
 *  categoryAPI.getAll() — returns all categories.
 *  Categories are shown in the ExplorePage filter bar and on PlaceCards.
 *
 * EMPTY constant:
 *  Default form values for creating a new category.
 *  Color defaults to #c9a84c (the app's gold color).
 *  Icon defaults to 📍 as a generic placeholder.
 *
 * openEdit(c):
 *  Pre-populates the form from an existing category document.
 *  No transformations needed (all fields are primitives).
 *
 * f(k, v):
 *  Shorthand setter for form fields.
 *
 * save(e):
 *  Create vs Update determined by whether `editing` (_id) is set.
 *  On success: updates local cats state and resets form + editing state.
 *
 * Note: Categories cannot be deleted (no del handler).
 *   Deleting a category would require updating all places that reference it.
 *   Instead, admin can rename or repurpose an existing category.
 *
 * Category table columns:
 *  Icon (large emoji), Name, Slug (monospace), Color (swatch square),
 *  Description (truncated to 50 chars), Actions (Edit only)
 *
 * Color input:
 *  Uses <input type="color"> browser color picker.
 *  Stored as a hex string (e.g., "#c9a84c").
 *  Displayed in the table as a 24×24 colored square with border.
 *
 * Slug:
 *  URL-safe identifier used in the ExplorePage ?cat= query parameter.
 *  Must be unique. Should use kebab-case (e.g., "religious-sites").
 *  Admin must enter this manually (no auto-generation from name).
 */

import { useState, useEffect } from 'react';
import { categoryAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import styles from './Admin.module.css';

// ── Default Empty Form Values ─────────────────────────────────────────────────
// Color defaults to the app's gold accent color. Icon to generic 📍 placeholder.
const EMPTY = { name:'', slug:'', icon:'📍', description:'', color:'#c9a84c' };

export default function AdminCategories() {
  // ── State ─────────────────────────────────────────────────────────────────
  const [cats,     setCats]     = useState([]);    // All categories from server
  const [showForm, setShowForm] = useState(false); // Whether to show the form panel
  const [editing,  setEditing]  = useState(null);  // _id of category being edited, or null
  const [form,     setForm]     = useState(EMPTY); // Current form field values
  const toast = useToast();

  // ── Fetch All Categories on Mount ─────────────────────────────────────────
  useEffect(() => { categoryAPI.getAll().then(({ data }) => setCats(data.categories)); }, []);

  // ── openEdit: Pre-populate form from existing category ────────────────────
  // No transformations needed since all fields are primitive strings.
  const openEdit = (c) => { setEditing(c._id); setForm({ ...c }); setShowForm(true); };

  // ── Form Field Setter ─────────────────────────────────────────────────────
  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  // ── Save Handler ──────────────────────────────────────────────────────────
  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        // Update existing category — replace in local state
        const { data } = await categoryAPI.update(editing, form);
        setCats(prev => prev.map(c => c._id === editing ? data.category : c));
        toast.success('Category updated');
      } else {
        // Create new category — append to end of list
        const { data } = await categoryAPI.create(form);
        setCats(prev => [...prev, data.category]);
        toast.success('Category created');
      }
      // Reset form and close panel
      setShowForm(false); setEditing(null); setForm(EMPTY);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  return (
    <div className={styles.adminPageLayout}>
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Manage Categories</h1>
      </div>

      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <div className={styles.topBar}>
        <button className="btn btn-gold" onClick={() => { setEditing(null); setForm(EMPTY); setShowForm(true); }}>+ Add Category</button>
      </div>

      {/* ── Form Panel ──────────────────────────────────────────── */}
      {showForm && (
        <div className={styles.formPanel}>
          <h3 className={styles.formTitle}>{editing ? 'Edit Category' : 'New Category'}</h3>
          <form onSubmit={save}>
            <div className={styles.formGrid}>
              {/* Category name — displayed in filter bar and place cards */}
              <div className="form-group"><label className="form-label">Name *</label><input className="form-input" required value={form.name} onChange={e => f('name', e.target.value)}/></div>
              {/* Slug — URL-safe identifier used in ?cat= query params */}
              <div className="form-group"><label className="form-label">Slug *</label><input className="form-input" required value={form.slug} onChange={e => f('slug', e.target.value)} placeholder="park-recreational"/></div>
              {/* Icon — emoji character displayed in filter bar and on place cards */}
              <div className="form-group"><label className="form-label">Icon (emoji)</label><input className="form-input" value={form.icon} onChange={e => f('icon', e.target.value)} placeholder="🌳"/></div>
              {/* Color — hex color picker; shown as accent color in category badges */}
              <div className="form-group"><label className="form-label">Color</label><input className="form-input" type="color" value={form.color} onChange={e => f('color', e.target.value)} style={{height:42}}/></div>
            </div>
            {/* Optional description for admin reference */}
            <div className="form-group"><label className="form-label">Description</label><textarea className="form-input form-textarea" style={{minHeight:60}} value={form.description} onChange={e => f('description', e.target.value)}/></div>
            {/* Form actions */}
            <div className={styles.formRow}>
              <button className="btn btn-gold" type="submit">Save</button>
              <button className="btn btn-ghost" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Categories Table ─────────────────────────────────────── */}
      <div className={styles.adminCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Icon</th>
              <th>Name</th>
              <th>Slug</th>
              <th>Color</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cats.map(c => (
              <tr key={c._id}>
                {/* Large emoji icon for easy visual identification */}
                <td style={{fontSize:'1.5rem'}}>{c.icon}</td>
                {/* Category name in bold */}
                <td style={{fontWeight:600,color:'var(--txt)'}}>{c.name}</td>
                {/* Slug in monospace — used in URL query params */}
                <td style={{fontFamily:'monospace',fontSize:'0.75rem',color:'var(--txt3)'}}>{c.slug}</td>
                {/* Color swatch: 24×24 square with the category's hex color */}
                <td><div style={{width:24,height:24,borderRadius:4,background:c.color,border:'1px solid var(--brd)'}}/></td>
                {/* Description truncated to 50 characters */}
                <td style={{color:'var(--txt3)',fontSize:'0.8rem'}}>{c.description?.substring(0,50)}</td>
                {/* Edit only — no delete to avoid breaking place references */}
                <td><button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>✏️ Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
