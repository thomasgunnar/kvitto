import { useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Sidebar from './components/Sidebar';
import SyncStatus from './components/SyncStatus';
import MobileBanner from './components/MobileBanner';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Reports from './pages/Reports';
import AdminUsers from './pages/AdminUsers';
import ChangePassword from './pages/ChangePassword';
import AcceptInvite from './pages/AcceptInvite';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Recurring from './pages/Recurring';
import ActivityLog from './pages/ActivityLog';
import Statistics from './pages/Statistics';

function ProtectedLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  if (user?.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  const PAGE_TITLES = {
    '/dashboard': 'Dashboard',
    '/expenses': 'Udgifter',
    '/reports': 'Rapporter',
    '/admin/users': 'Brugere',
    '/change-password': 'Skift adgangskode',
    '/profile': 'Profil',
    '/recurring': 'Tilbagevendende udgifter',
    '/activity': 'Aktivitetslog',
    '/statistics': 'Statistik',
  };
  const title = PAGE_TITLES[location.pathname] || 'Kvitto';

  return (
    <div className="app-shell">
      <MobileBanner />
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          style={{ display: 'block' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="menu-btn"
              onClick={() => setSidebarOpen(s => !s)}
              aria-label="Åbn menu"
            >
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M3 6h16M3 11h16M3 16h16"/>
              </svg>
            </button>
            <span className="topbar-title">{title}</span>
          </div>
        </header>

        <SyncStatus />

        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/change-password" element={<ChangePassword forced={user?.mustChangePassword} />} />
          <Route path="/admin/users" element={
            user?.isAdmin ? <AdminUsers /> : <Navigate to="/dashboard" replace />
          } />
          <Route path="/profile" element={<Profile />} />
          <Route path="/recurring" element={<Recurring />} />
          <Route path="/activity" element={<ActivityLog />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </div>
  );
}

function RequireAuth({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/forgot-password" element={user ? <Navigate to="/dashboard" replace /> : <ForgotPassword />} />
      <Route path="/reset-password/:token" element={user ? <Navigate to="/dashboard" replace /> : <ResetPassword />} />
      <Route path="/invite/:token" element={user ? <Navigate to="/dashboard" replace /> : <AcceptInvite />} />
      <Route path="/*" element={<RequireAuth><ProtectedLayout /></RequireAuth>} />
    </Routes>
  );
}
