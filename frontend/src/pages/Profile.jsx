import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useToast } from '../hooks/useToast';
import { useTheme } from '../hooks/useTheme';

function Toggle({ on, onChange, disabled }) {
  return (
    <button onClick={onChange} disabled={disabled} style={{
      width: 48, height: 28, borderRadius: 14, border: 'none',
      background: on ? 'var(--purple)' : 'var(--bg-tertiary)',
      cursor: 'pointer', position: 'relative', flexShrink: 0,
      transition: 'background 0.2s',
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3,
        left: on ? 23 : 3,
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

export default function Profile() {
  const toast    = useToast();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [user, setUser]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    api.me().then(u => { setUser(u); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleToggleNotifications = async () => {
    setSaving(true);
    try {
      const newVal = !user.emailNotifications;
      await api.setNotifications(newVal);
      setUser(u => ({ ...u, emailNotifications: newVal }));
      toast(newVal ? 'E-mail notifikationer slået til' : 'E-mail notifikationer slået fra');
    } catch (e) { toast(e.message, 'error'); }
    setSaving(false);
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div className="page">
      <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>Profil</h1>

      {/* Konto */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header"><span className="card-title">Konto</span></div>
        <div className="card-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Navn',   value: user?.name },
              { label: 'E-mail', value: user?.email },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: 'var(--text-tertiary)' }}>{row.label}</span>
                <span style={{ fontWeight: 500 }}>{row.value}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ color: 'var(--text-tertiary)' }}>Rolle</span>
              <span className={`badge ${user?.isAdmin ? 'badge-approved' : 'badge-draft'}`}>
                {user?.isAdmin ? 'Admin' : 'Bruger'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Udseende */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header"><span className="card-title">Udseende</span></div>
        <div className="card-body">
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Farvetema</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { val: 'auto',  label: '🖥 System' },
              { val: 'light', label: '☀️ Lyst' },
              { val: 'dark',  label: '🌙 Mørkt' },
            ].map(opt => (
              <button key={opt.val}
                className={`filter-chip${theme === opt.val ? ' active' : ''}`}
                onClick={() => setTheme(opt.val)}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notifikationer */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header"><span className="card-title">Notifikationer</span></div>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>E-mail ved udgifter</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>
                Send e-mail med detaljer og kvittering ved opret/rediger
              </div>
            </div>
            <Toggle on={!!user?.emailNotifications} onChange={handleToggleNotifications} disabled={saving} />
          </div>
          <div style={{ marginTop: 10, fontSize: 12,
            color: user?.emailNotifications ? 'var(--green)' : 'var(--text-tertiary)' }}>
            {user?.emailNotifications ? '✓ Slået til' : '✗ Slået fra'}
          </div>
        </div>
      </div>

      {/* Sikkerhed */}
      <div className="card">
        <div className="card-header"><span className="card-title">Sikkerhed</span></div>
        <div className="card-body">
          <button className="btn" onClick={() => navigate('/change-password')}>
            🔑 Skift adgangskode
          </button>
        </div>
      </div>
    </div>
  );
}
