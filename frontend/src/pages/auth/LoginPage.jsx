/**
 * pages/auth/LoginPage.jsx — Authentication Pages (Login + Register + Admin Login)
 *
 * This single file contains THREE exported page components plus two SVG icon
 * components, keeping all authentication UI in one place:
 *
 *  EyeIcon     — SVG "open eye" for password visibility toggle (show password)
 *  EyeOffIcon  — SVG "eye with slash" for password visibility toggle (hide password)
 *
 *  LoginPage      (named + default export)
 *   - Email + password form
 *   - On success: calls AuthContext.login(), shows success toast, navigates /dashboard
 *   - On failure: shows error toast from API response
 *   - Link to /register + link to /admin/login
 *
 *  RegisterPage   (named export — re-exported as default in RegisterPage.jsx)
 *   - Name, email, password (min 6 chars), phone (optional), nationality select
 *   - On success: calls AuthContext.register(), shows success toast, navigates /dashboard
 *   - Password length validated client-side before API call
 *
 *  AdminLoginPage (named export — re-exported as default in AdminLoginPage.jsx)
 *   - Admin email + password form
 *   - On success: calls AuthContext.adminLogin(), navigates /admin/dashboard
 *   - Badge-labelled with "Admin Access" for visual differentiation
 *   - Link back to /login for regular users who accidentally land here
 *
 * All three forms share:
 *  - showPw state for password visibility toggle with EyeIcon/EyeOffIcon
 *  - loading state to disable submit button and show "submitting..." label
 *  - Shared Auth.module.css stylesheet
 */

// LoginPage.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import styles from './Auth.module.css';

// ── EyeIcon ───────────────────────────────────────────────────────────────────
// SVG icon for showing a password (open eye).
// Rendered inside the password field's visibility toggle button.
const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);

// ── EyeOffIcon ────────────────────────────────────────────────────────────────
// SVG icon for hiding a password (eye with a diagonal slash).
// Rendered when the password is currently visible (showPw === true).
const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

// ── LoginPage ─────────────────────────────────────────────────────────────────
// Standard user login form. Calls AuthContext.login() with email + password.
// On success navigates to /dashboard. Error shown via ToastContext.
export function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  // Controlled form state — email and password fields
  const [form, setForm] = useState({ email: '', password: '' });
  // Prevents double-submit while waiting for API response
  const [loading, setLoading] = useState(false);
  // Toggles password input between type="password" and type="text"
  const [showPw, setShowPw] = useState(false);

  // ── Form Submit Handler ───────────────────────────────────────────────────
  // Calls AuthContext.login() which stores the JWT and updates user state.
  // Navigates to /dashboard on success; shows API error message on failure.
  const handle = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Welcome back!');
      nav('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* DayScape logo link back to the homepage */}
        <Link to="/" className={styles.logo}>Day<em>Scape</em></Link>
        <h2 className={styles.title}>Welcome Back</h2>
        <p className={styles.sub}>Sign in to your DayScape account</p>
        <form onSubmit={handle}>
          {/* Email field */}
          <div className="form-group"><label className="form-label">Email Address</label><input className="form-input" type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@email.com"/></div>
          {/* Password field with visibility toggle button */}
          <div className="form-group"><label className="form-label">Password</label><div className={styles.pwWrap}><input className="form-input" type={showPw?'text':'password'} required value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="••••••••" style={{paddingRight:'2.75rem'}}/><button type="button" className={styles.pwToggle} onClick={()=>setShowPw(v=>!v)}>{showPw?<EyeOffIcon/>:<EyeIcon/>}</button></div></div>
          {/* Submit button — disabled while waiting for API response */}
          <button className="btn btn-gold btn-block btn-lg" type="submit" disabled={loading} style={{marginTop:'0.5rem'}}>{loading ? 'Signing in...' : 'Sign In'}</button>
        </form>
        {/* Registration link for new users */}
        <div className={styles.footer}>
          Don't have an account? <Link to="/register" className={styles.link}>Create one</Link>
        </div>
        {/* Admin portal link — shown below the form for admin access */}
        <div className={styles.adminLink}><Link to="/admin/login">Admin Login →</Link></div>
      </div>
    </div>
  );
}

// ── RegisterPage ──────────────────────────────────────────────────────────────
// New user registration form. Collects name, email, password, phone, and
// visitor nationality (local / foreigner — affects ticket pricing throughout the app).
// Client-side password length check prevents trivially short passwords.
export function RegisterPage() {
  const { register } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  // Full registration form state — nationality defaults to 'local'
  const [form, setForm] = useState({ name:'', email:'', password:'', phone:'', nationality:'local' });
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // ── Form Submit Handler ───────────────────────────────────────────────────
  // Client-side validation: password must be at least 6 characters.
  // Calls AuthContext.register() then navigates to /dashboard on success.
  const handle = async (e) => {
    e.preventDefault();
    // Validate password length before hitting the API
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await register(form);
      toast.success('Account created! Welcome to DayScape.');
      nav('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* DayScape logo link back to the homepage */}
        <Link to="/" className={styles.logo}>Day<em>Scape</em></Link>
        <h2 className={styles.title}>Create Account</h2>
        <p className={styles.sub}>Join DayScape and start planning your Colombo day-trip</p>
        <form onSubmit={handle}>
          {/* Full name field */}
          <div className="form-group"><label className="form-label">Full Name</label><input className="form-input" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="K. Mathusha"/></div>
          {/* Email field */}
          <div className="form-group"><label className="form-label">Email Address</label><input className="form-input" type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@email.com"/></div>
          {/* Password field with visibility toggle */}
          <div className="form-group"><label className="form-label">Password</label><div className={styles.pwWrap}><input className="form-input" type={showPw?'text':'password'} required value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Min. 6 characters" style={{paddingRight:'2.75rem'}}/><button type="button" className={styles.pwToggle} onClick={()=>setShowPw(v=>!v)}>{showPw?<EyeOffIcon/>:<EyeIcon/>}</button></div></div>
          {/* Phone — optional field, stored for booking communications */}
          <div className="form-group"><label className="form-label">Phone (optional)</label><input className="form-input" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="+94 77 123 4567"/></div>
          {/* Nationality select — determines ticket pricing tier (local vs foreigner) */}
          <div className="form-group"><label className="form-label">Visitor Type</label>
            <select className="form-input form-select" value={form.nationality} onChange={e=>setForm({...form,nationality:e.target.value})}>
              <option value="local">Local Resident</option><option value="foreigner">International Tourist</option>
            </select>
          </div>
          {/* Submit button — disabled during API call */}
          <button className="btn btn-gold btn-block btn-lg" type="submit" disabled={loading} style={{marginTop:'0.5rem'}}>{loading ? 'Creating account...' : 'Create Account'}</button>
        </form>
        {/* Sign-in link for returning users */}
        <div className={styles.footer}>Already have an account? <Link to="/login" className={styles.link}>Sign in</Link></div>
      </div>
    </div>
  );
}

// ── AdminLoginPage ────────────────────────────────────────────────────────────
// Separate login form for administrator accounts. Uses AuthContext.adminLogin()
// which stores the token under a different key and sets the 'admin' state.
// Navigates to /admin/dashboard on successful authentication.
export function AdminLoginPage() {
  const { adminLogin } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  // Admin form state — same structure as user login (email + password)
  const [form, setForm] = useState({ email:'', password:'' });
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // ── Form Submit Handler ───────────────────────────────────────────────────
  // Calls AuthContext.adminLogin() which hits the /api/admin/auth/login endpoint.
  // On success navigates to the admin dashboard; on failure shows the API error.
  const handle = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await adminLogin(form.email, form.password);
      toast.success('Admin login successful');
      nav('/admin/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid admin credentials');
    } finally { setLoading(false); }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* DayScape logo link back to the homepage */}
        <Link to="/" className={styles.logo}>Day<em>Scape</em></Link>
        {/* Visual differentiation from the user login page */}
        <div className="badge badge-gold" style={{marginBottom:'1rem'}}>Admin Access</div>
        <h2 className={styles.title}>Admin Portal</h2>
        <p className={styles.sub}>Sign in with your administrator credentials</p>
        <form onSubmit={handle}>
          {/* Admin email field — placeholder shows the expected domain */}
          <div className="form-group"><label className="form-label">Admin Email</label><input className="form-input" type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="admin@dayscape.lk"/></div>
          {/* Admin password with visibility toggle */}
          <div className="form-group"><label className="form-label">Password</label><div className={styles.pwWrap}><input className="form-input" type={showPw?'text':'password'} required value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="••••••••" style={{paddingRight:'2.75rem'}}/><button type="button" className={styles.pwToggle} onClick={()=>setShowPw(v=>!v)}>{showPw?<EyeOffIcon/>:<EyeIcon/>}</button></div></div>
          {/* Submit button — disabled during API call */}
          <button className="btn btn-gold btn-block btn-lg" type="submit" disabled={loading} style={{marginTop:'0.5rem'}}>{loading ? 'Signing in...' : 'Admin Sign In'}</button>
        </form>
        {/* Link back to user login in case an admin accidentally navigated here */}
        <div className={styles.adminLink}><Link to="/login">← User Login</Link></div>
      </div>
    </div>
  );
}

// Default export is LoginPage (the primary auth route at /login).
// RegisterPage and AdminLoginPage are re-exported as defaults from their
// own single-line files: RegisterPage.jsx and AdminLoginPage.jsx.
export default LoginPage;
