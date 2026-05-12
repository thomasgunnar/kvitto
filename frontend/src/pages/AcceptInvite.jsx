import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../hooks/useAuth';

export default function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [invite, setInvite] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getInvite(token)
      .then(data => { setInvite(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Adgangskoderne matcher ikke'); return;
    }
    if (form.password.length < 8) {
      setError('Adgangskode skal være mindst 8 tegn'); return;
    }
    setSaving(true);
    try {
      const data = await api.acceptInvite(token, { name: form.name, password: form.password });
      // Log ind automatisk med det nye token
      localStorage.setItem('kvitto_token', data.token);
      localStorage.setItem('kvitto_user', JSON.stringify(data.user));
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const logoBlock = (
    <div style={{ textAlign: 'center', marginBottom: 28 }}>
      <div style={{
        width: 52, height: 52, background: 'var(--purple)', borderRadius: 13,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26, fontWeight: 700, color: '#fff', margin: '0 auto 12px',
      }}>K</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>Kvitto</div>
    </div>
  );

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg-tertiary)' }}>
      <div className="spinner" />
    </div>
  );

  if (error && !invite) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg-tertiary)', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {logoBlock}
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏰</div>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              Invitation ugyldig
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              {error}
            </p>
            <button className="btn" onClick={() => navigate('/login')}>
              Gå til login
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg-tertiary)', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {logoBlock}

        <div className="card">
          <div className="card-body">
            <div style={{ background: 'var(--purple-light)', borderRadius: 8,
              padding: '10px 14px', marginBottom: 20, fontSize: 13, color: 'var(--purple)' }}>
              Du er inviteret af <strong>{invite?.invitedByName}</strong>.<br />
              Din e-mail: <strong>{invite?.email}</strong>
            </div>

            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Opret din konto</h2>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Dit navn</label>
                <input className="form-input" type="text" placeholder="Dit fulde navn"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required autoFocus autoComplete="name" />
              </div>
              <div className="form-group">
                <label className="form-label">Adgangskode</label>
                <input className="form-input" type="password" placeholder="Mindst 8 tegn"
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required autoComplete="new-password" />
              </div>
              <div className="form-group" style={{ marginBottom: error ? 8 : 20 }}>
                <label className="form-label">Gentag adgangskode</label>
                <input className="form-input" type="password" placeholder="Gentag adgangskode"
                  value={form.confirmPassword}
                  onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  required autoComplete="new-password" />
              </div>

              {error && (
                <div style={{ background: 'var(--red-bg)', color: 'var(--red)',
                  fontSize: 13, padding: '8px 12px', borderRadius: 6, marginBottom: 16 }}>
                  {error}
                </div>
              )}

              <button type="submit" className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: 10 }}
                disabled={saving}>
                {saving ? 'Opretter konto...' : 'Opret konto og log ind'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
