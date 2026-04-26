/**
 * pages/admin/AdminUsers.jsx — Admin: Manage Users
 *
 * Displays all registered user accounts in a searchable table.
 * Admins can toggle user account status between Active and Suspended.
 *
 * Data:
 *  adminAPI.getUsers() — returns all user accounts with name, email,
 *  nationality, isActive status, and createdAt date.
 *
 * Search:
 *  Client-side filter against both user name and email (case-insensitive).
 *  Matches partial strings in either field.
 *
 * toggle(id):
 *  Calls adminAPI.toggleUser(id) which flips the user's isActive flag on the server.
 *  On success: replaces the user in local state with the updated document.
 *  Button label and style switch dynamically:
 *    Active user   → "Suspend" button (btn-danger, red)
 *    Suspended user → "Activate" button (btn-ghost)
 *
 * Nationality badge:
 *  foreigner → badge-blue  "Tourist"
 *  local     → badge-teal  "Local"
 *
 * Status badge:
 *  isActive=true  → badge-teal  "Active"
 *  isActive=false → badge-coral "Suspended"
 *
 * Table columns:
 *  User (mini avatar + name), Email, Type (nationality badge),
 *  Joined date, Status badge, Action button (Suspend/Activate toggle)
 *
 * Named + default export:
 *  Component exported as both { AdminUsers } and default for flexible import patterns.
 */

// AdminUsers.jsx
import { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import styles from './Admin.module.css';

// Named export (also available as default below)
export function AdminUsers() {
  // ── State ─────────────────────────────────────────────────────────────────
  const [users,  setUsers]  = useState([]);   // All user accounts from server
  const [search, setSearch] = useState('');   // Search filter text
  const toast = useToast();

  // ── Fetch All Users on Mount ──────────────────────────────────────────────
  useEffect(() => { adminAPI.getUsers().then(({ data }) => setUsers(data.users)); }, []);

  // ── Toggle User Active/Suspended Status ───────────────────────────────────
  // Flips the isActive flag server-side, then updates the user in local state.
  const toggle = async (id) => {
    const { data } = await adminAPI.toggleUser(id);
    // Replace just the changed user document; leave others unchanged
    setUsers(prev => prev.map(u => u._id === id ? data.user : u));
    toast.success('User status updated');
  };

  // ── Client-side Search Filter ─────────────────────────────────────────────
  // Matches against both name and email simultaneously (case-insensitive)
  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.adminPageLayout}>
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Manage Users</h1>
        <p className={styles.pageSub}>{users.length} total users</p>
      </div>

      {/* ── Search Bar ──────────────────────────────────────────── */}
      {/* Filters by name or email; no server call needed (all users loaded) */}
      <div className={styles.topBar}>
        <input className={styles.searchInput} placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)}/>
      </div>

      {/* ── Users Table ─────────────────────────────────────────── */}
      <div className={styles.adminCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Type</th>
              <th>Joined</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u._id}>
                {/* ── User cell: mini avatar + name ─────────────── */}
                {/* miniAvatar shows first letter of user's name in a small circle */}
                <td>
                  <div className={styles.userCell}>
                    <div className={styles.miniAvatar}>{u.name?.charAt(0)}</div>
                    <span style={{color:'var(--txt)',fontWeight:500}}>{u.name}</span>
                  </div>
                </td>
                {/* Email in muted text */}
                <td style={{color:'var(--txt3)',fontSize:'0.82rem'}}>{u.email}</td>
                {/* Nationality badge: foreigner=blue "Tourist", local=teal "Local" */}
                <td>
                  <span className={`badge badge-${u.nationality==='foreigner'?'blue':'teal'}`}>
                    {u.nationality==='foreigner'?'Tourist':'Local'}
                  </span>
                </td>
                {/* Join date formatted as DD/MM/YYYY */}
                <td style={{color:'var(--txt3)',fontSize:'0.78rem'}}>{new Date(u.createdAt).toLocaleDateString('en-GB')}</td>
                {/* Status badge: Active=teal, Suspended=coral */}
                <td>
                  {u.isActive
                    ? <span className="badge badge-teal">Active</span>
                    : <span className="badge badge-coral">Suspended</span>
                  }
                </td>
                {/* Toggle button: "Suspend" (danger) for active users, "Activate" (ghost) for suspended */}
                <td>
                  <button
                    className={`btn btn-sm ${u.isActive?'btn-danger':'btn-ghost'}`}
                    onClick={() => toggle(u._id)}
                  >
                    {u.isActive?'Suspend':'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdminUsers;
