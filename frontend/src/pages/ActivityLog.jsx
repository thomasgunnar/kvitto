import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useToast } from '../hooks/useToast';

const ACTION_ICONS = {
  create:        '➕',
  update:        '✏️',
  delete:        '🗑️',
  status_change: '🔄',
  bulk_assign:   '📋',
  export_pdf:    '📄',
  export_csv:    '📊',
  login:         '🔑',
  invite_sent:   '✉️',
  reset_password:'🔑',
};

const ENTITY_COLORS = {
  expense:   'var(--purple)',
  report:    'var(--green)',
  recurring: 'var(--amber)',
  user:      'var(--text-secondary)',
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return 'Lige nu';
  if (mins  < 60) return `${mins} min. siden`;
  if (hours < 24) return `${hours} t. siden`;
  if (days  < 7)  return `${days} dag${days !== 1 ? 'e' : ''} siden`;
  return new Date(dateStr).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ActivityLog() {
  const toast = useToast();
  const [items, setItems]   = useState([]);
  const [total, setTotal]   = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 50;

  const load = useCallback(async (off = 0) => {
    setLoading(true);
    try {
      const data = await api.getActivity({ limit, offset: off });
      if (off === 0) setItems(data.items);
      else setItems(prev => [...prev, ...data.items]);
      setTotal(data.total);
      setOffset(off);
    } catch (e) { toast(e.message, 'error'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(0); }, [load]);

  return (
    <div className="page">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>Aktivitetslog</h1>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>
          {total} handlinger registreret
        </p>
      </div>

      {items.length === 0 && !loading ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <div className="empty-title">Ingen aktivitet endnu</div>
            <div className="empty-text">Handlinger registreres automatisk når du bruger Kvitto</div>
          </div>
        </div>
      ) : (
        <div className="card">
          {items.map((item, i) => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px',
              borderBottom: i < items.length - 1 ? '0.5px solid var(--border)' : 'none',
            }}>
              {/* Ikon */}
              <div style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: 'var(--bg-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15,
              }}>
                {ACTION_ICONS[item.action] || '•'}
              </div>

              {/* Tekst */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 500 }}>{item.actionLabel} </span>
                  <span style={{
                    color: ENTITY_COLORS[item.entity_type] || 'var(--text-secondary)',
                    fontWeight: 500,
                  }}>
                    {item.entityLabel}
                  </span>
                  {item.entity_name && (
                    <span style={{ color: 'var(--text-secondary)' }}>: {item.entity_name}</span>
                  )}
                </div>

                {/* Detaljer */}
                {item.details && (
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {item.action === 'bulk_assign' && `${item.details.expense_count} udgifter`}
                    {item.action === 'status_change' && item.details.status && (
                      item.details.status === 'active' ? 'Afvist' :
                      item.details.status === 'submitted' ? '→ Sendt til godkendelse' :
                      item.details.status === 'approved' ? '→ Godkendt' : ''
                    )}
                    {item.action === 'export_csv' && item.details.count && `${item.details.count} rækker`}
                    {(item.action === 'create' || item.action === 'update') &&
                      item.details?.currency && item.details.currency !== 'DKK' &&
                      `${item.details.currency}`}
                  </div>
                )}
              </div>

              {/* Tidspunkt */}
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0,
                whiteSpace: 'nowrap', paddingTop: 2 }}>
                {timeAgo(item.created_at)}
              </div>
            </div>
          ))}

          {/* Indlæs mere */}
          {items.length < total && (
            <div style={{ padding: '12px 16px', textAlign: 'center',
              borderTop: '0.5px solid var(--border)' }}>
              <button className="btn btn-sm" onClick={() => load(offset + limit)} disabled={loading}>
                {loading ? 'Indlæser...' : `Indlæs mere (${total - items.length} tilbage)`}
              </button>
            </div>
          )}
        </div>
      )}

      {loading && items.length === 0 && (
        <div className="loading-center"><div className="spinner" /></div>
      )}
    </div>
  );
}
