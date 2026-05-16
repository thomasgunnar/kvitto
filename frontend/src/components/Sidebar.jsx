import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const IconDash = () => (
  <svg viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/></svg>
);
const IconExpenses = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M2 6h12M5 9.5h2M9 9.5h2"/></svg>
);
const IconReports = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 2h10v12H3z"/><path d="M5.5 5.5h5M5.5 8.5h5M5.5 11.5h3"/></svg>
);
const IconUsers = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="6" cy="5" r="2"/><path d="M2 13c0-2.2 1.8-4 4-4s4 1.8 4 4"/><circle cx="12" cy="5" r="1.5"/><path d="M12 9c1.7 0 3 1.3 3 3"/></svg>
);
const IconKey = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="6" cy="8" r="3.5"/><path d="M9 8h6M13 6v4"/></svg>
);
const IconActivity = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 12h2M5 8h2M8 4h2M11 10h2"/><path d="M2 14v-2M5 14v-6M8 14v-10M11 14v-4"/></svg>
);

const IconRecurring = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 8a6 6 0 1 0 1-3.5"/><path d="M2 2v4h4"/></svg>
);

const IconLogout = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 2H3v12h3M10 5l3 3-3 3M13 8H7"/></svg>
);
const IconUser = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="5.5" r="2.5"/><path d="M3 13c0-2.8 2.2-5 5-5s5 2.2 5 5"/></svg>
);

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  const linkClass = ({ isActive }) => `nav-item${isActive ? ' active' : ''}`;

  const handleNav = () => { onClose(); };

  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      <div className="sidebar-logo">
        <div className="logo-mark">K</div>
        <span className="logo-text">Kvitto</span>
      </div>

      <nav className="nav-section">
        <div className="nav-label">Overblik</div>
        <NavLink to="/dashboard" className={linkClass} onClick={handleNav}>
          <IconDash /> Dashboard
        </NavLink>
        <NavLink to="/expenses" className={linkClass} onClick={handleNav}>
          <IconExpenses /> Udgifter
        </NavLink>

        <div className="nav-label" style={{ marginTop: 8 }}>Rapporter</div>
        <NavLink to="/reports" className={linkClass} onClick={handleNav}>
          <IconReports /> Rapporter
        </NavLink>
        <NavLink to="/recurring" className={linkClass} onClick={handleNav}>
          <IconRecurring /> Tilbagevendende
        </NavLink>

        <div className="nav-label" style={{ marginTop: 8 }}>Oversigter</div>
        <NavLink to="/activity" className={linkClass} onClick={handleNav}>
          <IconActivity /> Aktivitetslog
        </NavLink>

        {user?.isAdmin && (
          <>
            <div className="nav-label" style={{ marginTop: 8 }}>Admin</div>
            <NavLink to="/admin/users" className={linkClass} onClick={handleNav}>
              <IconUsers /> Brugere
            </NavLink>
          </>
        )}
      </nav>

      <div className="nav-bottom">
        <div style={{ padding: '4px 18px 0', fontSize: 10, color: 'var(--text-tertiary)', opacity: 0.6 }}>
          {typeof __APP_VERSION__ !== 'undefined' ? `v${__APP_VERSION__}` : ''}
        </div>
        <NavLink to="/change-password" className={linkClass} onClick={handleNav}>
          <IconKey /> Skift kode
        </NavLink>
        <NavLink to="/profile" className={linkClass} onClick={handleNav} style={{ fontSize: 13 }}>
          <IconUser />
          {user?.name}
          {user?.isAdmin && (
            <span style={{
              fontSize: 10, background: 'var(--purple-light)', color: 'var(--purple)',
              padding: '1px 6px', borderRadius: 99, marginLeft: 4
            }}>Admin</span>
          )}
        </NavLink>
        <button
          className="nav-item"
          style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          onClick={handleLogout}
        >
          <IconLogout /> Log ud
        </button>
      </div>
    </aside>
  );
}
