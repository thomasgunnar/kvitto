import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { getLocalExpenses } from '../api/offlineDB';
import { receiptUrl } from '../api/client';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import ExpenseModal from '../components/ExpenseModal';

const CAT_ICON  = { travel: '✈️', food: '🍽️', hotel: '🏨', transport: '🚕', other: '📦' };
const CAT_LABEL = { travel: 'Rejse', food: 'Mad', hotel: 'Hotel', transport: 'Transport', other: 'Andet' };

function fmtDKK(n) {
  return Number(n).toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' DKK';
}

export default function Dashboard() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const { online, justSynced } = useOnlineStatus();
  const [expenses, setExpenses] = useState([]);
  const [reports, setReports]   = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading]   = useState(true);

  const load = async () => {
    try {
      const [exp, rep] = online
        ? await Promise.all([api.getExpenses(), api.getReports()])
        : [[], []];
      const localExp = await getLocalExpenses();
      setExpenses([...localExp.map(e => ({ ...e, _offline: true })), ...exp]);
      setReports(rep);
    } catch {
      const localExp = await getLocalExpenses();
      setExpenses(localExp.map(e => ({ ...e, _offline: true })));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [online, justSynced]);

  const active    = reports.filter(r => r.status === 'active');
  const submitted = reports.filter(r => r.status === 'submitted');
  const approved  = reports.filter(r => r.status === 'approved');

  const thisMonth = expenses.filter(e => {
    if (e._offline) return false;
    const d = new Date(e.expense_date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totalMonth   = thisMonth.reduce((s, e) => s + parseFloat(e.amount_dkk || 0), 0);
  const unassigned   = expenses.filter(e => !e.report_id && !e._offline);
  const serverExpenses = expenses.filter(e => !e._offline);

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Goddag, {user?.name?.split(' ')[0]} 👋</h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 4 }}>
          Her er et overblik over dine udgifter og rapporter
        </p>
      </div>

      {/* Rapport-status kort */}
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
        Rapporter
      </div>
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'pointer' }}
          onClick={() => navigate('/reports?status=active')}>
          <div className="stat-label">Igangværende</div>
          <div className="stat-value">{active.length}</div>
          <div className="stat-sub">{fmtDKK(active.reduce((s, r) => s + parseFloat(r.total_dkk || 0), 0))}</div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }}
          onClick={() => navigate('/reports?status=submitted')}>
          <div className="stat-label">Til godkendelse</div>
          <div className="stat-value" style={{ color: 'var(--amber)' }}>{submitted.length}</div>
          <div className="stat-sub">{fmtDKK(submitted.reduce((s, r) => s + parseFloat(r.total_dkk || 0), 0))}</div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }}
          onClick={() => navigate('/reports?status=approved')}>
          <div className="stat-label">Godkendt</div>
          <div className="stat-value" style={{ color: 'var(--green)' }}>{approved.length}</div>
          <div className="stat-sub">{fmtDKK(approved.reduce((s, r) => s + parseFloat(r.total_dkk || 0), 0))}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Denne måned</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{fmtDKK(totalMonth)}</div>
          <div className="stat-sub">{thisMonth.length} poster</div>
        </div>
      </div>

      {/* Advarsel — udgifter uden rapport */}
      {unassigned.length > 0 && (
        <div style={{ background: 'var(--amber-bg)', border: '0.5px solid #e8c99a',
          borderRadius: 'var(--radius-md)', padding: '10px 14px',
          fontSize: 13, color: 'var(--amber)', marginBottom: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>⚠ {unassigned.length} udgift{unassigned.length !== 1 ? 'er' : ''} er ikke tilknyttet en rapport</span>
          <button className="btn btn-sm" style={{ fontSize: 12 }}
            onClick={() => navigate('/expenses')}>Vis</button>
        </div>
      )}

      {/* Seneste udgifter */}
      <div style={{ display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
          Seneste udgifter
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" onClick={() => navigate('/expenses')}>Se alle</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ Tilføj</button>
        </div>
      </div>

      <div className="card">
        {expenses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🧾</div>
            <div className="empty-title">Ingen udgifter endnu</div>
            <div className="empty-text">Tryk "+ Tilføj" for at registrere din første udgift</div>
          </div>
        ) : (
          <div>
            {expenses.slice(0, 8).map((e, i) => (
              <div key={e.localId || e.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
                borderBottom: i < Math.min(expenses.length, 8) - 1 ? '0.5px solid var(--border)' : 'none',
                cursor: 'pointer',
              }} onClick={() => navigate('/expenses')}>
                <div className="receipt-thumb" style={{ flexShrink: 0 }}>
                  {e._offline && e._receiptObjectURL
                    ? <img src={e._receiptObjectURL} alt="" />
                    : e.receipt_path && !e._offline
                      ? <img src={receiptUrl(e.receipt_path)} alt="" />
                      : <span style={{ fontSize: 14 }}>{CAT_ICON[e.category] || '📦'}</span>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 13,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.description}
                    {e._offline && <span className="offline-badge" style={{ marginLeft: 6 }}>Offline</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {e.report_name || 'Ingen rapport'} · {CAT_LABEL[e.category] || 'Andet'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{fmtDKK(e.amount_dkk || 0)}</div>
                  {e.currency !== 'DKK' && (
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {parseFloat(e.amount).toLocaleString('da-DK')} {e.currency}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <ExpenseModal reports={reports} onClose={() => setShowModal(false)} onSaved={load} />
      )}
    </div>
  );
}
