import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, receiptUrl } from '../api/client';
import { useToast } from '../hooks/useToast';

function fmtDKK(n) {
  return Number(n).toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' DKK';
}

const CAT_ICON  = { travel: '✈️', food: '🍽️', hotel: '🏨', transport: '🚕', other: '📦' };
const CAT_LABEL = { travel: 'Rejse', food: 'Mad', hotel: 'Hotel', transport: 'Transport', other: 'Andet' };

const STATUS_CFG = {
  active:    { label: 'Igangværende',          badge: 'badge-draft',    next: 'submitted', nextLabel: '📤 Send til godkendelse' },
  submitted: { label: 'Sendt til godkendelse', badge: 'badge-pending',  next: 'approved',  nextLabel: '✓ Markér som godkendt' },
  approved:  { label: 'Godkendt / Afsluttet',  badge: 'badge-approved', next: null,        nextLabel: null },
};

function ReportDetail({ id, onBack, onDeleted, toast }) {
  const [report, setReport]   = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [viewReceipt, setViewReceipt] = useState(null);
  const [showReject, setShowReject] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([api.getReport(id), api.getReportSummary(id)])
      .then(([r, s]) => { setReport(r); setSummary(s); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleAdvanceStatus = async () => {
    const cfg = STATUS_CFG[report.status];
    if (!cfg?.next) return;
    setAdvancing(true);
    try {
      await api.setReportStatus(id, cfg.next);
      toast(`Rapport markeret som: ${STATUS_CFG[cfg.next].label}`);
      load();
    } catch (e) { toast(e.message, 'error'); }
    setAdvancing(false);
  };

  const handleReject = async () => {
    setRejecting(true);
    try {
      await api.setReportStatus(id, 'active', rejectComment);
      toast('Rapport sendt tilbage til igangværende');
      setShowReject(false);
      setRejectComment('');
      load();
    } catch (e) { toast(e.message, 'error'); }
    setRejecting(false);
  };

  const handleDelete = async () => {
    if (!confirm('Slet rapport? Udgifter beholdes men mister tilknytning.')) return;
    try { await api.deleteReport(id); toast('Rapport slettet'); onDeleted(); }
    catch (e) { toast(e.message, 'error'); }
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  const cfg = STATUS_CFG[report.status];
  const isApproved = report.status === 'approved';

  return (
    <div className="page">
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <button className="btn btn-sm" onClick={onBack}>← Tilbage</button>
          <h1 style={{ fontSize: 17, fontWeight: 600, flex: 1, minWidth: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {report.name}
          </h1>
          <span className={`badge ${cfg.badge}`}>{cfg.label}</span>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {cfg.next && (
            <button className="btn btn-sm btn-primary" onClick={handleAdvanceStatus} disabled={advancing}>
              {advancing ? 'Opdaterer...' : cfg.nextLabel}
            </button>
          )}
          {report.status === 'submitted' && (
            <button className="btn btn-sm btn-danger" onClick={() => setShowReject(true)}>
              ✕ Afvis
            </button>
          )}
          {isApproved && (
            <button className="btn btn-sm"
              style={{ background: 'var(--amber-bg)', color: 'var(--amber)', borderColor: 'var(--amber)' }}
              onClick={async () => {
                await api.setReportStatus(id, 'active');
                toast('Rapport genåbnet'); load();
              }}>
              ↩ Genåbn rapport
            </button>
          )}
          <button className="btn btn-sm" onClick={async () => {
            setDownloading(true);
            try { await api.downloadReportPDF(id, report.name); toast('PDF hentet'); }
            catch (e) { toast(e.message, 'error'); }
            setDownloading(false);
          }} disabled={downloading}>
            {downloading ? '...' : '⬇ PDF'}
          </button>
          <button className="btn btn-sm" onClick={async () => {
            try { await api.downloadReportExcel(id, report.name); toast('Excel fil downloadet'); }
            catch (e) { toast(e.message, 'error'); }
          }}>
            📊 Excel
          </button>
          {!isApproved && (
            <button className="btn btn-sm btn-danger" onClick={handleDelete}>Slet</button>
          )}
        </div>
      </div>

      {report.description && (
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 10 }}>
          {report.description}
        </p>
      )}
      {report.reject_comment && (
        <div style={{ background: 'var(--red-bg)', border: '0.5px solid var(--red)',
          borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 14,
          fontSize: 13, color: 'var(--red)' }}>
          <strong>Afvist:</strong> {report.reject_comment}
        </div>
      )}

      <div className="stat-grid" style={{ marginBottom: 14 }}>
        <div className="stat-card">
          <div className="stat-label">Total</div>
          <div className="stat-value">{fmtDKK(report.total_dkk)}</div>
          <div className="stat-sub">{report.expense_count} udgifter</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Status</div>
          <div className="stat-value" style={{ fontSize: 15, marginTop: 4 }}>
            <span className={`badge ${cfg.badge}`}>{cfg.label}</span>
          </div>
        </div>
      </div>

      {summary?.by_category?.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-header"><span className="card-title">Fordeling per kategori</span></div>
          <div style={{ padding: '8px 0' }}>
            {summary.by_category.map(c => (
              <div key={c.category} style={{ display: 'flex', alignItems: 'center',
                gap: 12, padding: '8px 18px' }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{CAT_ICON[c.category]}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13 }}>{CAT_LABEL[c.category] || c.category}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{fmtDKK(c.total_dkk)}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 2, background: 'var(--purple)',
                      width: `${Math.min(100, (c.total_dkk / report.total_dkk) * 100)}%` }} />
                  </div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                  {c.count} stk
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">Udgifter</span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {report.expenses?.length || 0} poster
          </span>
        </div>
        {!report.expenses?.length ? (
          <div className="empty-state">
            <div className="empty-icon">📄</div>
            <div className="empty-title">Ingen udgifter i rapporten</div>
            <div className="empty-text">Tilknyt udgifter via Udgifter-siden</div>
          </div>
        ) : (
          report.expenses.map((e, i) => (
            <div key={e.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
              borderBottom: i < report.expenses.length - 1 ? '0.5px solid var(--border)' : 'none',
            }}>
              <div className="receipt-thumb"
                style={{ flexShrink: 0, cursor: e.receipt_path ? 'zoom-in' : 'default' }}
                onClick={() => e.receipt_path && setViewReceipt(receiptUrl(e.receipt_path))}>
                {e.receipt_path
                  ? <img src={receiptUrl(e.receipt_path)} alt="" />
                  : <span style={{ fontSize: 14 }}>{CAT_ICON[e.category]}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 13,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.description}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {new Date(e.expense_date).toLocaleDateString('da-DK')}
                  {e.currency !== 'DKK' && ` · ${parseFloat(e.amount).toLocaleString('da-DK')} ${e.currency}`}
                </div>
              </div>
              <div style={{ fontWeight: 600, fontSize: 13, flexShrink: 0 }}>
                {fmtDKK(e.amount_dkk)}
              </div>
            </div>
          ))
        )}
      </div>

      {viewReceipt && (
        <div className="modal-backdrop" onClick={() => setViewReceipt(null)}>
          <img src={viewReceipt} alt="Kvittering" style={{ maxWidth: '92vw', maxHeight: '85vh',
            borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} />
        </div>
      )}
    </div>
  );
}

export default function Reports() {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [reports, setReports]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName]       = useState('');
  const [newDesc, setNewDesc]       = useState('');
  const [saving, setSaving]         = useState(false);

  const load = async () => {
    try { setReports(await api.getReports()); }
    catch (e) { toast(e.message, 'error'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) { toast('Rapportnavn er påkrævet', 'error'); return; }
    setSaving(true);
    try {
      const r = await api.createReport({ name: newName.trim(), description: newDesc.trim() });
      toast('Rapport oprettet');
      setShowCreate(false); setNewName(''); setNewDesc('');
      await load();
      setSelectedId(r.id);
    } catch (e) { toast(e.message, 'error'); }
    setSaving(false);
  };

  if (selectedId) {
    return <ReportDetail id={selectedId}
      onBack={() => { setSelectedId(null); load(); }}
      onDeleted={() => { setSelectedId(null); load(); }}
      toast={toast} />;
  }

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  // Filtrér: afsluttede gemmes væk som standard
  const visible = statusFilter
    ? reports.filter(r => r.status === statusFilter)
    : reports.filter(r => r.status !== 'approved');

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>Rapporter</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Ny</button>
      </div>

      {/* Status filter */}
      <div className="filter-row">
        {[
          { val: '',          label: 'Aktive' },
          { val: 'active',    label: 'Igangværende' },
          { val: 'submitted', label: 'Til godkendelse' },
          { val: 'approved',  label: 'Godkendt' },
        ].map(f => (
          <button key={f.val} className={`filter-chip${statusFilter === f.val ? ' active' : ''}`}
            onClick={() => setStatusFilter(f.val)}>
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <div className="empty-title">
              {statusFilter === 'approved' ? 'Ingen afsluttede rapporter' : 'Ingen aktive rapporter'}
            </div>
            <div className="empty-text">
              {statusFilter === 'approved'
                ? 'Godkendte rapporter vises her'
                : 'Opret en rapport for at samle dine udgifter'}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {visible.map(r => {
            const cfg = STATUS_CFG[r.status];
            return (
              <div key={r.id} className="card" style={{ cursor: 'pointer' }}
                onClick={() => setSelectedId(r.id)}>
                <div style={{ padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start',
                    justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{r.name}</div>
                    <span className={`badge ${cfg.badge}`} style={{ flexShrink: 0 }}>
                      {cfg.label}
                    </span>
                  </div>
                  {r.description && (
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>
                      {r.description}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Total</div>
                      <div style={{ fontSize: 18, fontWeight: 600 }}>{fmtDKK(r.total_dkk)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Udgifter</div>
                      <div style={{ fontSize: 18, fontWeight: 600 }}>{r.expense_count}</div>
                    </div>
                  </div>
                </div>
                <div style={{ padding: '8px 18px', borderTop: '0.5px solid var(--border)',
                  fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {new Date(r.created_at).toLocaleDateString('da-DK')} · Tryk for detaljer →
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <div className="modal-backdrop"
          onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-head">
              <span className="modal-title">Ny rapport</span>
              <button className="modal-close" onClick={() => setShowCreate(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Rapportnavn *</label>
                <input className="form-input" placeholder="Fx Berlin Q2, Kundebesøg maj..."
                  value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Beskrivelse</label>
                <textarea className="form-textarea" placeholder="Valgfri beskrivelse..."
                  value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2} />
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setShowCreate(false)}>Annuller</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                {saving ? 'Opretter...' : 'Opret rapport'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
