import { useState, useEffect } from 'react';
import { api, receiptUrl } from '../api/client';
import { useToast } from '../hooks/useToast';
import ExpenseModal from '../components/ExpenseModal';

const CAT_ICON  = { travel: '✈️', food: '🍽️', hotel: '🏨', transport: '🚕', other: '📦' };
const CAT_LABEL = { travel: 'Rejse', food: 'Mad', hotel: 'Hotel', transport: 'Transport', other: 'Andet' };
const REPORT_STATUS = {
  active:    { label: 'Igangværende',          badge: 'badge-draft'    },
  submitted: { label: 'Sendt til godkendelse', badge: 'badge-pending'  },
  approved:  { label: 'Godkendt',              badge: 'badge-approved' },
};

function fmtDKK(n) {
  return Number(n).toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DKK';
}

function makeExpenseCopy(e) {
  const { id, created_at, report_name, report_status, receipt_path, ...rest } = e;
  return {
    ...rest,
    description: `Kopi af ${e.description}`,
    expense_date: new Date().toISOString().slice(0, 10),
    report_id: e.report_id || '',
    notes: e.notes || '',
    exchange_rate: e.exchange_rate ? String(parseFloat(e.exchange_rate)) : '',
  };
}

export default function Expenses() {
  const toast = useToast();
  const [expenses, setExpenses]         = useState([]);
  const [reports, setReports]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [catFilter, setCatFilter]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');
  const [showModal, setShowModal]       = useState(false);
  const [editing, setEditing]           = useState(null);
  const [copying, setCopying]           = useState(null);
  const [viewReceipt, setViewReceipt]   = useState(null);
  const [deleteId, setDeleteId]         = useState(null);

  // Bulk-tilknytning
  const [selected, setSelected]         = useState(new Set());
  const [showBulk, setShowBulk]         = useState(false);
  const [bulkReport, setBulkReport]     = useState('');
  const [bulkSaving, setBulkSaving]     = useState(false);

  // Excel eksport
  const [exporting, setExporting]       = useState(false);

  const load = async () => {
    try {
      const [exp, rep] = await Promise.all([api.getExpenses(), api.getReports()]);
      setExpenses(exp); setReports(rep);
    } catch (e) { toast(e.message, 'error'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = expenses.filter(e => {
    if (catFilter && e.category !== catFilter) return false;
    if (statusFilter) {
      if (statusFilter === 'none' && e.report_id) return false;
      if (statusFilter !== 'none' && e.report_status !== statusFilter) return false;
    }
    if (dateFrom && e.expense_date < dateFrom) return false;
    if (dateTo   && e.expense_date > dateTo)   return false;
    return true;
  });

  const totalFiltered = filtered.reduce((s, e) => s + parseFloat(e.amount_dkk || 0), 0);
  const allSelected   = filtered.length > 0 && filtered.every(e => selected.has(e.id));

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map(e => e.id)));
  };

  const handleBulkAssign = async () => {
    setBulkSaving(true);
    try {
      const ids = Array.from(selected);
      await api.bulkAssign(ids, bulkReport || null);
      toast(`${ids.length} udgift${ids.length !== 1 ? 'er' : ''} tilknyttet`);
      setSelected(new Set());
      setShowBulk(false);
      setBulkReport('');
      load();
    } catch (e) { toast(e.message, 'error'); }
    setBulkSaving(false);
  };

  const handleExport = async () => {
    setExporting(true);
    try { await api.downloadExpensesExcel(); toast('Excel fil downloadet'); }
    catch (e) { toast(e.message, 'error'); }
    setExporting(false);
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteExpense(id);
      toast('Udgift slettet');
      setDeleteId(null);
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const clearFilters = () => { setCatFilter(''); setStatusFilter(''); setDateFrom(''); setDateTo(''); };
  const hasFilters = catFilter || statusFilter || dateFrom || dateTo;

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>Udgifter</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" onClick={handleExport} disabled={exporting}>
            {exporting ? '...' : '📊 Excel'}
          </button>
          {selected.size > 0 && (
            <button className="btn btn-sm"
              style={{ background: 'var(--purple-light)', color: 'var(--purple)', borderColor: 'var(--purple-border)' }}
              onClick={() => setShowBulk(true)}>
              📋 Tilknyt {selected.size} valgte
            </button>
          )}
          <button className="btn btn-primary btn-sm"
            onClick={() => { setEditing(null); setCopying(null); setShowModal(true); }}>
            + Tilføj udgift
          </button>
        </div>
      </div>

      {/* Datofilter */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>Periode:</span>
        <input type="date" className="form-input" value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          style={{ width: 150, fontSize: 13, padding: '5px 10px' }} />
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>—</span>
        <input type="date" className="form-input" value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          style={{ width: 150, fontSize: 13, padding: '5px 10px' }} />
        {(dateFrom || dateTo) && (
          <button className="btn btn-sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>✕</button>
        )}
      </div>

      {/* Rapport-status filter */}
      <div className="filter-row">
        {[
          { val: '',         label: 'Alle' },
          { val: 'none',     label: 'Ingen rapport' },
          ...Object.entries(REPORT_STATUS).map(([k, v]) => ({ val: k, label: v.label }))
        ].map(f => (
          <button key={f.val}
            className={`filter-chip${statusFilter === f.val ? ' active' : ''}`}
            onClick={() => setStatusFilter(f.val)}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Kategorifilter */}
      <div className="filter-row">
        <button className={`filter-chip${catFilter === '' ? ' active' : ''}`}
          onClick={() => setCatFilter('')}>Alle kategorier</button>
        {Object.entries(CAT_LABEL).map(([k, v]) => (
          <button key={k}
            className={`filter-chip${catFilter === k ? ' active' : ''}`}
            onClick={() => setCatFilter(catFilter === k ? '' : k)}>
            {CAT_ICON[k]} {v}
          </button>
        ))}
        {hasFilters && (
          <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={clearFilters}>
            ✕ Nulstil
          </button>
        )}
      </div>

      {/* Resultat-summary */}
      {filtered.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10,
          display: 'flex', justifyContent: 'space-between' }}>
          <span>{filtered.length} udgift{filtered.length !== 1 ? 'er' : ''}
            {selected.size > 0 && ` · ${selected.size} valgt`}
          </span>
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{fmtDKK(totalFiltered)}</span>
        </div>
      )}

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <div className="empty-title">Ingen udgifter fundet</div>
            <div className="empty-text">Prøv et andet filter eller tilføj en ny udgift</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleAll}
                      style={{ cursor: 'pointer', width: 15, height: 15 }} />
                  </th>
                  <th>Udgift</th>
                  <th>Kategori</th>
                  <th>Dato</th>
                  <th>Rapport</th>
                  <th className="td-right">Beløb</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => {
                  const rCfg    = e.report_status ? REPORT_STATUS[e.report_status] : null;
                  const isSelected = selected.has(e.id);
                  return (
                    <tr key={e.id} style={{ background: isSelected ? 'var(--purple-light)' : undefined }}>
                      <td>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(e.id)}
                          style={{ cursor: 'pointer', width: 15, height: 15 }} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="receipt-thumb"
                            style={{ cursor: e.receipt_path ? 'zoom-in' : 'default' }}
                            onClick={() => e.receipt_path && setViewReceipt(receiptUrl(e.receipt_path))}>
                            {e.receipt_path
                              ? <img src={receiptUrl(e.receipt_path)} alt="" />
                              : <span style={{ fontSize: 14 }}>{CAT_ICON[e.category]}</span>}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500 }}>{e.description}</div>
                            {e.notes && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{e.notes}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{CAT_LABEL[e.category]}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                        {new Date(e.expense_date).toLocaleDateString('da-DK')}
                      </td>
                      <td>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{e.report_name || '—'}</div>
                        {rCfg && <span className={`badge ${rCfg.badge}`} style={{ marginTop: 3, fontSize: 10 }}>{rCfg.label}</span>}
                      </td>
                      <td className="td-right">
                        <div style={{ fontWeight: 600 }}>{fmtDKK(e.amount_dkk)}</div>
                        {e.currency !== 'DKK' && (
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                            {parseFloat(e.amount).toLocaleString('da-DK')} {e.currency}
                          </div>
                        )}
                        {e.currency !== 'DKK' && e.exchange_rate && (
                          <div style={{ fontSize: 11, color: 'var(--purple)', marginTop: 1 }}>
                            kurs {parseFloat(e.exchange_rate).toFixed(4)}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-sm btn-icon" title="Rediger"
                            onClick={() => { setEditing(e); setCopying(null); setShowModal(true); }}>✏️</button>
                          <button className="btn btn-sm btn-icon" title="Kopiér"
                            onClick={() => { setCopying(makeExpenseCopy(e)); setEditing(null); setShowModal(true); }}>📋</button>
                          <button className="btn btn-sm btn-icon" title="Slet"
                            onClick={() => setDeleteId(e.id)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk-tilknytning modal */}
      {showBulk && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowBulk(false)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-title">Tilknyt {selected.size} udgifter til rapport</span>
              <button className="modal-close" onClick={() => setShowBulk(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Vælg rapport</label>
                <select className="form-select" value={bulkReport}
                  onChange={e => setBulkReport(e.target.value)}>
                  <option value="">— Fjern rapport-tilknytning —</option>
                  {reports.filter(r => r.status !== 'approved').map(r =>
                    <option key={r.id} value={r.id}>{r.name}</option>
                  )}
                </select>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setShowBulk(false)}>Annuller</button>
              <button className="btn btn-primary" onClick={handleBulkAssign} disabled={bulkSaving}>
                {bulkSaving ? 'Gemmer...' : `Tilknyt ${selected.size} udgifter`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt lightbox */}
      {viewReceipt && (
        <div className="modal-backdrop" onClick={() => setViewReceipt(null)}>
          <img src={viewReceipt} alt="Kvittering"
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} />
        </div>
      )}

      {/* Slet bekræftelse */}
      {deleteId && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-head"><span className="modal-title">Slet udgift?</span></div>
            <div className="modal-body">
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                Denne handling kan ikke fortrydes.
              </p>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setDeleteId(null)}>Annuller</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteId)}>Slet</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <ExpenseModal expense={editing || copying} isCopy={!!copying} reports={reports}
          onClose={() => { setShowModal(false); setEditing(null); setCopying(null); }}
          onSaved={load} />
      )}
    </div>
  );
}
