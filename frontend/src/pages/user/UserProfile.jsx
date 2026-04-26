/**
 * pages/user/UserProfile.jsx — Edit User Profile + Change Password
 *
 * Provides two forms for the authenticated user to update their account:
 *
 *  1. Edit Profile form
 *     - Fields: Full Name (required), Phone (optional), Visitor Type (local/foreigner)
 *     - On save: calls authAPI.updateProfile(form) then calls AuthContext.updateUser()
 *       to sync the in-memory user state with the new data without requiring re-login
 *
 *  2. Change Password form
 *     - Fields: Current Password, New Password (min 6 chars via minLength attribute)
 *     - On save: calls authAPI.changePassword(pwForm)
 *     - Resets the password form to empty strings on success
 *
 * Layout: two-column grid
 *  Left  — Avatar card (initials circle, name, email, nationality badge)
 *  Right — Edit Profile card + Change Password card stacked vertically
 *
 * Nationality badge:
 *  'foreigner' → blue badge "International Tourist"
 *  'local'     → teal badge "Local Resident"
 *
 * Named + default export:
 *  App.jsx imports as default. Named export for selective imports.
 */

// UserProfile.jsx
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import styles from './User.module.css';

// ── UserProfile ───────────────────────────────────────────────────────────────
export function UserProfile() {
  const { user, updateUser } = useAuth();  // updateUser syncs context after profile save
  const toast = useToast();

  // ── Profile Form State ────────────────────────────────────────────────────
  // Pre-populated from the current user object in AuthContext
  const [form, setForm] = useState({ name: user?.name||'', phone: user?.phone||'', nationality: user?.nationality||'local' });

  // ── Password Form State ───────────────────────────────────────────────────
  // Separate state — cleared on successful password change
  const [pwForm, setPwForm] = useState({ currentPassword:'', newPassword:'' });

  // Shared loading state — prevents double-submits on both forms
  const [saving, setSaving] = useState(false);

  // ── Save Profile Handler ──────────────────────────────────────────────────
  // Calls the PATCH /api/auth/profile endpoint.
  // On success, updateUser() syncs the new user data into AuthContext so Navbar
  // and other components reflect the updated name/phone/nationality immediately.
  const saveProfile = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const { data } = await authAPI.updateProfile(form);
      updateUser(data.user); toast.success('Profile updated!');
    } catch { toast.error('Failed to update'); } finally { setSaving(false); }
  };

  // ── Change Password Handler ───────────────────────────────────────────────
  // Calls the PUT /api/auth/change-password endpoint with current and new passwords.
  // Resets the form to empty strings on success so the user must re-type if needed.
  const changePw = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await authAPI.changePassword(pwForm);
      toast.success('Password changed!'); setPwForm({ currentPassword:'', newPassword:'' });
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); } finally { setSaving(false); }
  };

  return (
    <div className={styles.page}><div className="container">
      <h1 className={styles.pageTitle}>My Profile</h1><div className={styles.goldDiv}/>
      {/* ── Two-column profile grid ──────────────────────────────── */}
      <div className={styles.profileGrid}>

        {/* ── Left: Avatar info card ────────────────────────────── */}
        {/* Shows avatar initial circle, name, email, and nationality badge */}
        <div className={styles.profileCard}>
          {/* Large avatar circle with first letter of user's name */}
          <div className={styles.avatar} style={{width:72,height:72,margin:'0 auto',fontSize:'1.8rem'}}>{user?.name?.charAt(0)}</div>
          <div className={styles.profileName}>{user?.name}</div>
          <div className={styles.profileEmail}>{user?.email}</div>
          {/* Nationality badge — blue for foreigner, teal for local */}
          <div className={`badge ${user?.nationality==='foreigner'?'badge-blue':'badge-teal'}`}>{user?.nationality==='foreigner'?'International Tourist':'Local Resident'}</div>
        </div>

        {/* ── Right: Forms column ──────────────────────────────── */}
        <div>
          {/* ── Edit Profile Form ──────────────────────────────── */}
          <div className="card" style={{marginBottom:'1rem'}}>
            <h3 style={{fontFamily:'Cormorant Garamond',fontSize:'1.2rem',marginBottom:'1rem'}}>Edit Profile</h3>
            <form onSubmit={saveProfile}>
              {/* Full name — required field */}
              <div className="form-group"><label className="form-label">Full Name</label><input className="form-input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></div>
              {/* Phone — optional, used for booking communications */}
              <div className="form-group"><label className="form-label">Phone Number</label><input className="form-input" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="+94 77 123 4567"/></div>
              {/* Nationality select — affects ticket pricing tier throughout the app */}
              <div className="form-group"><label className="form-label">Visitor Type</label>
                <select className="form-input form-select" value={form.nationality} onChange={e=>setForm({...form,nationality:e.target.value})}>
                  <option value="local">Local Resident</option><option value="foreigner">International Tourist</option>
                </select>
              </div>
              {/* Submit button — disabled while API call is in progress */}
              <button className="btn btn-gold" type="submit" disabled={saving}>{saving?'Saving...':'Save Changes'}</button>
            </form>
          </div>

          {/* ── Change Password Form ────────────────────────────── */}
          <div className="card">
            <h3 style={{fontFamily:'Cormorant Garamond',fontSize:'1.2rem',marginBottom:'1rem'}}>Change Password</h3>
            <form onSubmit={changePw}>
              {/* Current password — required for security verification on the server */}
              <div className="form-group"><label className="form-label">Current Password</label><input className="form-input" type="password" value={pwForm.currentPassword} onChange={e=>setPwForm({...pwForm,currentPassword:e.target.value})} required/></div>
              {/* New password — minLength=6 enforced by HTML5 validation */}
              <div className="form-group"><label className="form-label">New Password</label><input className="form-input" type="password" value={pwForm.newPassword} onChange={e=>setPwForm({...pwForm,newPassword:e.target.value})} required minLength={6}/></div>
              {/* Submit button — uses btn-outline to visually differentiate from Save Profile */}
              <button className="btn btn-outline" type="submit" disabled={saving}>Change Password</button>
            </form>
          </div>
        </div>
      </div>
    </div></div>
  );
}

export default UserProfile;
