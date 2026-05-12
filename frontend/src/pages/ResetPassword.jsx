import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate  = useNavigate();

  const [valid, setValid]   = useState(null); // null=loading, true, false
  const [email, setEmail]   = useState('');
  const [form, setForm]     = useState({ password: '', confirm: '' });
  const [error, setError]   = useState('');
  const [done, setDone]     = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.verifyResetToken(token)
      .then(d => { setEmail(d.email); setValid(true); })
      .catch(() => setValid(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Adgangskoderne matcher ikke'); return; }
    if (form.password.length < 8)       { setError('Adgangskode skal være mindst 8 tegn'); return; }
    setSaving(true);
    try {
      await api.resetPassword(token, form.password);
      setDone(true);
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg-tertiary)', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {logoBlock}
        <div className="card">
          <div className="card-body">

            {/* Loading */}
            {valid === null && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                <div className="spinner" />
              </div>
            )}

            {/* Ugyldigt token */}
            {valid === false && (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>⏰</div>
                <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                  Linket er udløbet
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
                  Nulstillingslinket er ugyldigt eller udløbet. Anmod om et nyt link.
                </p>
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => navigate('/forgot-password')}>
                  Anmod om nyt link
                </button>
              </div>
            )}

            {/* Succes */}
            {done && (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
                <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                  Adgangskode opdateret
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                  Din adgangskode er ændret. Du kan nu logge ind.
                </p>
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => navigate('/login')}>
                  Gå til login
                </button>
              </div>
            )}

            {/* Formular */}
            {valid && !done && (
              <>
                <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                  Vælg ny adgangskode
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                  Konto: <strong>{email}</strong>
                </p>
                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label className="form-label">Ny adgangskode</label>
                    <input className="form-input" type="password" placeholder="Mindst 8 tegn"
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      required autoFocus autoComplete="new-password" />
                  </div>
                  <div className="form-group" style={{ marginBottom: error ? 8 : 20 }}>
                    <label className="form-label">Gentag adgangskode</label>
                    <input className="form-input" type="password" placeholder="Gentag adgangskode"
                      value={form.confirm}
                      onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
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
                    {saving ? 'Gemmer...' : 'Gem ny adgangskode'}
                  </button>
                </form>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
