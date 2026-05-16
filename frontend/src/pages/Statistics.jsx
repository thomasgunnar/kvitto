import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { getLocalExpenses } from '../api/offlineDB';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { MonthlyBarChart, CategoryDonut, TrendLine } from '../components/Charts';
import { useToast } from '../hooks/useToast';

function fmtDKK(n) {
  return Number(n).toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' DKK';
}

const CAT_LABEL = { travel: 'Rejse', food: 'Mad', hotel: 'Hotel', transport: 'Transport', other: 'Andet' };
const CAT_COLORS = { travel: '#534AB7', food: '#1D9E75', hotel: '#E8A838', transport: '#E05C5C', other: '#9c9a92' };

export default function Statistics() {
  const toast = useToast();
  const { online } = useOnlineStatus();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [exp, localExp] = await Promise.all([
          online ? api.getExpenses() : Promise.resolve([]),
          getLocalExpenses(),
        ]);
        setExpenses([...localExp.map(e => ({ ...e, _offline: true })), ...exp]);
      } catch (e) { toast(e.message, 'error'); }
      setLoading(false);
    };
    load();
  }, [online]);

  const serverExpenses = expenses.filter(e => !e._offline);

  // Beregn nøgletal
  const total     = serverExpenses.reduce((s, e) => s + parseFloat(e.amount_dkk || 0), 0);
  const thisMonth = serverExpenses.filter(e => {
    const d = new Date(e.expense_date), now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const lastMonth = serverExpenses.filter(e => {
    const d = new Date(e.expense_date), now = new Date();
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
  });
  const totalThisMonth = thisMonth.reduce((s, e) => s + parseFloat(e.amount_dkk || 0), 0);
  const totalLastMonth = lastMonth.reduce((s, e) => s + parseFloat(e.amount_dkk || 0), 0);
  const monthDiff = totalLastMonth > 0
    ? Math.round(((totalThisMonth - totalLastMonth) / totalLastMonth) * 100)
    : null;

  // Top kategori
  const byCat = {};
  serverExpenses.forEach(e => {
    byCat[e.category] = (byCat[e.category] || 0) + parseFloat(e.amount_dkk || 0);
  });
  const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];

  // Gennemsnit pr. udgift
  const avg = serverExpenses.length > 0 ? total / serverExpenses.length : 0;

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>Statistik</h1>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>
          Overblik over dine udgiftsmønstre
        </p>
      </div>

      {serverExpenses.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <div className="empty-title">Ingen data endnu</div>
            <div className="empty-text">Statistik vises når du har registreret udgifter</div>
          </div>
        </div>
      ) : (
        <>
          {/* Nøgletal */}
          <div className="stat-grid" style={{ marginBottom: 16 }}>
            <div className="stat-card">
              <div className="stat-label">Denne måned</div>
              <div className="stat-value" style={{ fontSize: 18 }}>{fmtDKK(totalThisMonth)}</div>
              {monthDiff !== null && (
                <div className="stat-sub" style={{ color: monthDiff > 0 ? 'var(--red)' : 'var(--green)' }}>
                  {monthDiff > 0 ? '↑' : '↓'} {Math.abs(monthDiff)}% vs. sidste måned
                </div>
              )}
            </div>
            <div className="stat-card">
              <div className="stat-label">Total alle udgifter</div>
              <div className="stat-value" style={{ fontSize: 18 }}>{fmtDKK(total)}</div>
              <div className="stat-sub">{serverExpenses.length} udgifter</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Gennemsnit pr. udgift</div>
              <div className="stat-value" style={{ fontSize: 18 }}>{fmtDKK(avg)}</div>
            </div>
            {topCat && (
              <div className="stat-card">
                <div className="stat-label">Største kategori</div>
                <div className="stat-value" style={{ fontSize: 16, marginTop: 4 }}>
                  {CAT_LABEL[topCat[0]] || topCat[0]}
                </div>
                <div className="stat-sub">{fmtDKK(topCat[1])}</div>
              </div>
            )}
          </div>

          {/* Trendlinje */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-body">
              <TrendLine expenses={serverExpenses} />
            </div>
          </div>

          {/* Søjlediagram + Donut side om side */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 14,
            marginBottom: 14,
          }}>
            <div className="card">
              <div className="card-body">
                <MonthlyBarChart expenses={serverExpenses} />
              </div>
            </div>
            <div className="card">
              <div className="card-body">
                <CategoryDonut expenses={serverExpenses} />
              </div>
            </div>
          </div>

          {/* Kategori tabel */}
          <div className="card">
            <div className="card-header"><span className="card-title">Fordeling per kategori</span></div>
            <div>
              {Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([cat, amt], i, arr) => (
                <div key={cat} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  borderBottom: i < arr.length - 1 ? '0.5px solid var(--border)' : 'none',
                }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, flexShrink: 0,
                    background: CAT_COLORS[cat] || '#ccc' }} />
                  <div style={{ flex: 1, fontSize: 13 }}>{CAT_LABEL[cat] || cat}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {serverExpenses.filter(e => e.category === cat).length} stk
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{fmtDKK(amt)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', width: 36, textAlign: 'right' }}>
                    {Math.round((amt / total) * 100)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
