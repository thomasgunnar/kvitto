import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useToast } from '../hooks/useToast';
import { getDefaultCurrency } from '../hooks/useCurrency';

const CAT_ICON  = { travel: '✈️', food: '🍽️', hotel: '🏨', transport: '🚕', other: '📦' };
const CAT_LABEL = { travel: 'Rejse', food: 'Mad', hotel: 'Hotel', transport: 'Transport', other: 'Andet' };
const CURRENCIES = ['DKK','EUR','USD','GBP','NOK','SEK','CHF','JPY','PLN'];
const INTERVALS = [
  { value: 'daily',   label: 'Daglig' },
  { value: 'weekly',  label: 'Ugentlig' },
  { value: 'monthly', label: 'Månedlig' },
  { value: 'yearly',  label: 'Årlig' },
];

function fmtDKK(n) {
  return Number(n).toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function RecurringModal({ item, reports, onClose, onSaved, toast }) {
  const isEdit = !!item;
  const [form, setForm] = useState(item
    ? { ...item, report_id: item.report_id || '', notes: item.notes || '',
        exchange_rate: item.exchange_rate ? String(parseFloat(item.exchange_rate)) : '' }
    : {
        description: '', amount: '', currency: getDefaultCurrency(),
        exchange_rate: '', category: 'other',
        interval_type: 'monthly',
        start_date: new Date().toISOString().slice(0, 10),
        report_id: '', notes: '',
      }
  );
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.description || !form.amount || !form.start_date) {
      toast('Udfyld beskrivelse, beløb og startdato', 'error'); return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await api.updateRecurring(item.id, {
          ...form, next_date: form.next_date || form.start_date,
          active: item.active,
        });
        toast('Tilbagevendende udgift opdateret');
      } else {
        await api.createRecurring(form);
        toast('Tilbagevendende udgift oprettet');
      }
      onSaved(); onClose();
    } catch (e) { toast(e.message, 'error'); }
    setSaving(false);
  };

  const showRate = form.currency !== 'DKK';

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <span className="modal-title">{isEdit ? 'Rediger tilbagevendende' : 'Ny tilbagevendende udgift'}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Beskrivelse *</label>
            <input className="form-input" placeholder="Fx husleje, abonnement..."
              value={form.description} onChange={e => set('description', e.target.value)} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Beløb *</label>
              <div className="amount-group">
                <input className="form-input amount-input" type="number" min="0" step="0.01"
                  placeholder="0,00" value={form.amount} onChange={e => set('amount', e.target.value)} />
                <select className="form-select" value={form.currency}
                  onChange={e => set('currency', e.target.value)}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Gentagelse</label>
              <select className="form-select" value={form.interval_type}
                onChange={e => set('interval_type', e.target.value)}>
                {INTERVALS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
          </div>

          {showRate && (
            <div className="form-group">
              <label className="form-label">Fast valutakurs (valgfrit)</label>
              <input className="form-input" type="number" min="0" step="0.0001"
                placeholder="Lad stå tom for dagskurs"
                value={form.exchange_rate} onChange={e => set('exchange_rate', e.target.value)}
                style={{ maxWidth: 160 }} />
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                Tom = brug dagskursen på oprettelsestidspunktet
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{isEdit ? 'Næste oprettelse' : 'Første oprettelse'} *</label>
              <input className="form-input" type="date"
                value={isEdit ? form.next_date : form.start_date}
                onChange={e => set(isEdit ? 'next_date' : 'start_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Kategori</label>
              <select className="form-select" value={form.category}
                onChange={e => set('category', e.target.value)}>
                {Object.entries(CAT_LABEL).map(([k, v]) =>
                  <option key={k} value={k}>{CAT_ICON[k]} {v}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Rapport</label>
            <select className="form-select" value={form.report_id}
              onChange={e => set('report_id', e.target.value)}>
              <option value="">— Ingen rapport —</option>
              {reports.filter(r => r.status !== 'approved').map(r =>
                <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Noter</label>
            <textarea className="form-textarea" rows={2} placeholder="Valgfrie noter..."
              value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Annuller</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Gemmer...' : isEdit ? 'Gem ændringer' : 'Opret'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Recurring() {
  const toast = useToast();
  const [items, setItems]     = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const load = async () => {
    try {
      const [rec, rep] = await Promise.all([api.getRecurring(), api.getReports()]);
      setItems(rec); setReports(rep);
    } catch (e) { toast(e.message, 'error'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleToggle = async (id) => {
    try {
      const result = await api.toggleRecurring(id);
      toast(result.active ? 'Genaktiveret' : 'Sat på pause');
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteRecurring(id);
      toast('Slettet');
      setDeleteId(null);
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  const active  = items.filter(i => i.active);
  const paused  = items.filter(i => !i.active);

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>Tilbagevendende udgifter</h1>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true); }}>
          + Ny
        </button>
      </div>

      {items.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">🔄</div>
            <div className="empty-title">Ingen tilbagevendende udgifter</div>
            <div className="empty-text">
              Opret tilbagevendende udgifter der automatisk oprettes dagligt, ugentligt, månedligt eller årligt
            </div>
          </div>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)',
                marginBottom: 10 }}>Aktive ({active.length})</div>
              <div className="card" style={{ marginBottom: 16 }}>
                {active.map((item, i) => (
                  <RecurringRow key={item.id} item={item}
                    isLast={i === active.length - 1}
                    onEdit={() => { setEditing(item); setShowModal(true); }}
                    onToggle={() => handleToggle(item.id)}
                    onDelete={() => setDeleteId(item.id)} />
                ))}
              </div>
            </>
          )}

          {paused.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-tertiary)',
                marginBottom: 10 }}>På pause ({paused.length})</div>
              <div className="card" style={{ opacity: 0.7 }}>
                {paused.map((item, i) => (
                  <RecurringRow key={item.id} item={item}
                    isLast={i === paused.length - 1}
                    onEdit={() => { setEditing(item); setShowModal(true); }}
                    onToggle={() => handleToggle(item.id)}
                    onDelete={() => setDeleteId(item.id)} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {showModal && (
        <RecurringModal item={editing} reports={reports}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={load} toast={toast} />
      )}

      {deleteId && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-head"><span className="modal-title">Slet tilbagevendende udgift?</span></div>
            <div className="modal-body">
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                Fremtidige udgifter oprettes ikke længere. Allerede oprettede udgifter påvirkes ikke.
              </p>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setDeleteId(null)}>Annuller</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteId)}>Slet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RecurringRow({ item, isLast, onEdit, onToggle, onDelete }) {
  const INTERVAL_LABEL = { daily:'Daglig', weekly:'Ugentlig', monthly:'Månedlig', yearly:'Årlig' };
  const nextDate = new Date(item.next_date).toLocaleDateString('da-DK',
    { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
      borderBottom: isLast ? 'none' : '0.5px solid var(--border)',
      flexWrap: 'wrap',
    }}>
      <div style={{ fontSize: 22, flexShrink: 0 }}>{CAT_ICON[item.category]}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: 13 }}>{item.description}</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <span>🔄 {INTERVAL_LABEL[item.interval_type]}</span>
          <span>📅 Næste: {nextDate}</span>
          {item.report_name && <span>📋 {item.report_name}</span>}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>
          {fmtDKK(item.amount)} {item.currency}
        </div>
        {item.exchange_rate && item.currency !== 'DKK' && (
          <div style={{ fontSize: 11, color: 'var(--purple)' }}>
            kurs {parseFloat(item.exchange_rate).toFixed(4)}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button className="btn btn-sm" title={item.active ? 'Sæt på pause' : 'Genaktiver'}
          onClick={onToggle}>
          {item.active ? '⏸' : '▶'}
        </button>
        <button className="btn btn-sm btn-icon" title="Rediger" onClick={onEdit}>✏️</button>
        <button className="btn btn-sm btn-icon btn-danger" title="Slet" onClick={onDelete}>🗑️</button>
      </div>
    </div>
  );
}
