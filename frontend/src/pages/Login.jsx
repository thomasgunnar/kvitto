import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg-tertiary)', padding: 16,
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, background: 'var(--purple)', borderRadius: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 700, color: '#fff', margin: '0 auto 12px',
          }}>K</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Kvitto</div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>Udgiftsstyring</div>
        </div>

        <div className="card">
          <div className="card-body">
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Log ind</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">E-mail</label>
                <input className="form-input" type="email" placeholder="din@email.dk"
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required autoComplete="email" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Adgangskode</label>
                <input className="form-input" type="password" placeholder="••••••••"
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required autoComplete="current-password" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <button type="button"
                  style={{ background: 'none', border: 'none', color: 'var(--purple)',
                    cursor: 'pointer', fontSize: 12, padding: 0 }}
                  onClick={() => navigate('/forgot-password')}>
                  Glemt adgangskode?
                </button>
              </div>
              {error && (
                <div style={{ background: 'var(--red-bg)', color: 'var(--red)',
                  fontSize: 13, padding: '8px 12px', borderRadius: 6, marginBottom: 16 }}>
                  {error}
                </div>
              )}
              <button type="submit" className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: 10 }}
                disabled={loading}>
                {loading ? 'Logger ind...' : 'Log ind'}
              </button>
            </form>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text-tertiary)' }}>
          Adgang kræver en invitation fra en administrator.
        </p>
      </div>
    </div>
  );
}
