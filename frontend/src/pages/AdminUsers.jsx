import { useState, useEffect } from 'react';
import { api } from '../api/client';
import UpdatePanel from '../components/UpdatePanel';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';

export default function AdminUsers() {
  const toast = useToast();
  const { user: me } = useAuth();
  const [users, setUsers]     = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('users'); // 'users' | 'invites'
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting]       = useState(false);
  const [resetResult, setResetResult] = useState(null);
  const [deleteId, setDeleteId]       = useState(null);
  const [inviteResult, setInviteResult] = useState(null);

  const load = async () => {
    try {
      const [u, i] = await Promise.all([api.getUsers(), api.getInvites()]);
      setUsers(u); setInvites(i);
    } catch (e) { toast(e.message, 'error'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const result = await api.sendInvite(inviteEmail.trim());
      setInviteResult(result);
      setInviteEmail('');
      await load();
      if (result.mailError) {
        toast('Invitation oprettet — men e-mail fejlede. Kopiér linket manuelt.', 'error');
      } else {
        toast(`Invitation sendt til ${inviteEmail}`);
      }
    } catch (e) { toast(e.message, 'error'); }
    setInviting(false);
  };

  const handleReset = async (id) => {
    try {
      const result = await api.resetUserPassword(id);
      setResetResult(result);
    } catch (e) { toast(e.message, 'error'); }
  };

  const handleToggleAdmin = async (id) => {
    try {
      const result = await api.toggleAdmin(id);
      toast(result.isAdmin ? 'Admin-rettigheder tildelt' : 'Admin-rettigheder fjernet');
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteUser(id);
      toast('Bruger slettet');
      setDeleteId(null);
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const handleRevokeInvite = async (id) => {
    try {
      await api.revokeInvite(id);
      toast('Invitation annulleret');
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>Brugere</h1>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>
          Administrer brugere og send invitationer
        </p>
      </div>

      <UpdatePanel />

      {/* Inviter ny bruger */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><span className="card-title">Invitér ny bruger</span></div>
        <div className="card-body">
          <form onSubmit={handleInvite} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              className="form-input"
              type="email"
              placeholder="email@eksempel.dk"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              style={{ flex: 1, minWidth: 220 }}
              required
            />
            <button type="submit" className="btn btn-primary" disabled={inviting}>
              {inviting ? 'Sender...' : '✉ Send invitation'}
            </button>
          </form>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
            Brugeren modtager en e-mail med et link der er gyldigt i 48 timer.
          </p>
        </div>
      </div>

      {/* Faner */}
      <div className="filter-row" style={{ marginBottom: 14 }}>
        <button className={`filter-chip${tab === 'users' ? ' active' : ''}`}
          onClick={() => setTab('users')}>
          Brugere ({users.length})
        </button>
        <button className={`filter-chip${tab === 'invites' ? ' active' : ''}`}
          onClick={() => setTab('invites')}>
          Afventende invitationer ({invites.length})
        </button>
      </div>

      {tab === 'users' && (
        <div className="card">
          {users.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👤</div>
              <div className="empty-title">Ingen brugere</div>
            </div>
          ) : (
            <div>
              {users.map((u, i) => (
                <div key={u.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  borderBottom: i < users.length - 1 ? '0.5px solid var(--border)' : 'none',
                  flexWrap: 'wrap',
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: u.isAdmin ? 'var(--purple-light)' : 'var(--bg-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 600,
                    color: u.isAdmin ? 'var(--purple)' : 'var(--text-secondary)',
                  }}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 13, display: 'flex',
                      alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {u.name}
                      {u.id === me?.id && (
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>(dig)</span>
                      )}
                      {u.isAdmin && (
                        <span className="badge badge-approved" style={{ fontSize: 10 }}>Admin</span>
                      )}
                      {u.mustChangePassword && (
                        <span className="badge badge-pending" style={{ fontSize: 10 }}>Skal skifte kode</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {u.email} · {u.expense_count} udgifter
                    </div>
                  </div>

                  {/* Handlinger */}
                  {u.id !== me?.id && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button className="btn btn-sm" onClick={() => handleReset(u.id)}
                        title="Nulstil adgangskode">🔑</button>
                      <button className="btn btn-sm" onClick={() => handleToggleAdmin(u.id)}
                        title={u.isAdmin ? 'Fjern admin' : 'Gør til admin'}>
                        {u.isAdmin ? '👤' : '⭐'}
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => setDeleteId(u.id)}
                        title="Slet bruger">🗑️</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'invites' && (
        <div className="card">
          {invites.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✉️</div>
              <div className="empty-title">Ingen afventende invitationer</div>
              <div className="empty-text">Invitationer vises her indtil de accepteres eller udløber</div>
            </div>
          ) : (
            <div>
              {invites.map((inv, i) => (
                <div key={inv.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  borderBottom: i < invites.length - 1 ? '0.5px solid var(--border)' : 'none',
                  flexWrap: 'wrap',
                }}>
                  <div style={{ fontSize: 20 }}>✉️</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{inv.email}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      Inviteret af {inv.invited_by_name} ·{' '}
                      Udløber {new Date(inv.expires_at).toLocaleDateString('da-DK', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </div>
                  </div>
                  <button className="btn btn-sm btn-danger"
                    onClick={() => handleRevokeInvite(inv.id)}>
                    Annullér
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reset-kode modal */}
      {resetResult && (
        <div className="modal-backdrop" onClick={() => setResetResult(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-title">Adgangskode nulstillet</span>
              <button className="modal-close" onClick={() => setResetResult(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Giv denne midlertidige kode til <strong>{resetResult.user.name}</strong>.
                Brugeren bliver bedt om at skifte den ved næste login.
              </p>
              <div style={{
                background: 'var(--bg-secondary)', borderRadius: 8, padding: '14px 18px',
                textAlign: 'center', fontSize: 24, fontFamily: 'monospace',
                fontWeight: 700, letterSpacing: 4, color: 'var(--purple)',
                border: '1.5px dashed var(--purple-border)',
              }}>
                {resetResult.tempPassword}
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-primary" onClick={() => {
                navigator.clipboard?.writeText(resetResult.tempPassword);
                toast('Kopieret');
              }}>Kopiér</button>
              <button className="btn" onClick={() => setResetResult(null)}>Luk</button>
            </div>
          </div>
        </div>
      )}

      {/* Invite-link modal (når mail fejler) */}
      {inviteResult?.mailError && (
        <div className="modal-backdrop" onClick={() => setInviteResult(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-title">Send invite-link manuelt</span>
              <button className="modal-close" onClick={() => setInviteResult(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--amber-bg)', color: 'var(--amber)',
                fontSize: 13, padding: '8px 12px', borderRadius: 6, marginBottom: 14 }}>
                ⚠ E-mailen kunne ikke sendes: {inviteResult.mailError}
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                Kopiér dette link og send det manuelt:
              </p>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 8,
                padding: '10px 14px', fontSize: 12, wordBreak: 'break-all',
                fontFamily: 'monospace', color: 'var(--purple)' }}>
                {inviteResult.inviteUrl}
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-primary" onClick={() => {
                navigator.clipboard?.writeText(inviteResult.inviteUrl);
                toast('Link kopieret');
              }}>Kopiér link</button>
              <button className="btn" onClick={() => setInviteResult(null)}>Luk</button>
            </div>
          </div>
        </div>
      )}

      {/* Slet-bekræftelse */}
      {deleteId && (
        <div className="modal-backdrop" onClick={() => setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head"><span className="modal-title">Slet bruger?</span></div>
            <div className="modal-body">
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                Dette sletter brugeren og alle vedkommendes udgifter og rapporter permanent.
              </p>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setDeleteId(null)}>Annuller</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteId)}>Slet bruger</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
