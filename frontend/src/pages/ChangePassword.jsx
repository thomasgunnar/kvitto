import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';

export default function ChangePassword({ forced = false }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.newPassword !== form.confirmPassword) {
      setError('De nye adgangskoder matcher ikke'); return;
    }
    if (form.newPassword.length < 8) {
      setError('Ny adgangskode skal være mindst 8 tegn'); return;
    }
    setSaving(true);
    try {
      await api.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast('Adgangskode ændret');
      if (forced) {
        // Re-login so token reflects mustChangePassword = false
        logout();
        navigate('/login');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg-tertiary)', padding: 16
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 48, height: 48, background: 'var(--purple)', borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 700, color: '#fff', margin: '0 auto 12px'
          }}>🔑</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>
            {forced ? 'Skift adgangskode' : 'Skift adgangskode'}
          </div>
          {forced && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
              Din adgangskode er blevet nulstillet af en admin.<br />
              Du skal vælge en ny for at fortsætte.
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nuværende adgangskode</label>
                <input
                  className="form-input" type="password"
                  placeholder={forced ? 'Den midlertidige kode du fik' : '••••••••'}
                  value={form.currentPassword}
                  onChange={e => set('currentPassword', e.target.value)}
                  required autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Ny adgangskode</label>
                <input
                  className="form-input" type="password"
                  placeholder="Mindst 8 tegn"
                  value={form.newPassword}
                  onChange={e => set('newPassword', e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: error ? 8 : 20 }}>
                <label className="form-label">Gentag ny adgangskode</label>
                <input
                  className="form-input" type="password"
                  placeholder="Gentag ny adgangskode"
                  value={form.confirmPassword}
                  onChange={e => set('confirmPassword', e.target.value)}
                  required
                />
              </div>
              {error && (
                <div style={{
                  background: 'var(--red-bg)', color: 'var(--red)',
                  fontSize: 13, padding: '8px 12px', borderRadius: 6, marginBottom: 16
                }}>{error}</div>
              )}
              <button
                type="submit" className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: 10 }}
                disabled={saving}
              >
                {saving ? 'Gemmer...' : 'Gem ny adgangskode'}
              </button>
            </form>
            {!forced && (
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 13 }}
                  onClick={() => navigate('/dashboard')}
                >
                  Annuller
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
