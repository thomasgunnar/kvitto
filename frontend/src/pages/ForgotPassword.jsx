import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail]   = useState('');
  const [sent, setSent]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
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
            {sent ? (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>📬</div>
                <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>
                  Tjek din indbakke
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
                  Hvis <strong>{email}</strong> er registreret, har vi sendt et link til at nulstille
                  din adgangskode. Linket er gyldigt i 1 time.
                </p>
                <button className="btn" style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => navigate('/login')}>
                  Tilbage til login
                </button>
              </div>
            ) : (
              <>
                <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                  Glemt adgangskode?
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
                  Indtast din e-mail, så sender vi et link til at vælge en ny adgangskode.
                </p>
                <form onSubmit={handleSubmit}>
                  <div className="form-group" style={{ marginBottom: error ? 8 : 20 }}>
                    <label className="form-label">E-mail</label>
                    <input className="form-input" type="email" placeholder="din@email.dk"
                      value={email} onChange={e => setEmail(e.target.value)}
                      required autoFocus autoComplete="email" />
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
                    {loading ? 'Sender...' : 'Send nulstillingslink'}
                  </button>
                </form>
                <div style={{ textAlign: 'center', marginTop: 14 }}>
                  <button style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)',
                    cursor: 'pointer', fontSize: 13 }}
                    onClick={() => navigate('/login')}>
                    ← Tilbage til login
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
