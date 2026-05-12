import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { enqueueExpense, isOnline } from '../api/offlineDB';
import { useToast } from '../hooks/useToast';
import { getDefaultCurrency, setPreferredCurrency } from '../hooks/useCurrency';
import { receiptUrl } from '../api/client';

const CATEGORIES = [
  { value: 'travel',    label: 'Rejse',     icon: '✈️' },
  { value: 'food',      label: 'Mad',       icon: '🍽️' },
  { value: 'hotel',     label: 'Hotel',     icon: '🏨' },
  { value: 'transport', label: 'Transport', icon: '🚕' },
  { value: 'other',     label: 'Andet',     icon: '📦' },
];

const CURRENCIES = ['DKK','EUR','USD','GBP','NOK','SEK','CHF','JPY','PLN'];

export default function ExpenseModal({ expense, isCopy, reports, onClose, onSaved }) {
  const toast = useToast();
  const defaultCurrency = getDefaultCurrency();

  const [form, setForm] = useState(expense
    ? {
        ...expense,
        expense_date: expense.expense_date?.slice(0, 10),
        report_id: expense.report_id || '',
        notes: expense.notes || '',
        exchange_rate: expense.exchange_rate ? String(parseFloat(expense.exchange_rate)) : '',
      }
    : {
        description: '', amount: '', currency: defaultCurrency,
        category: 'other',
        expense_date: new Date().toISOString().slice(0, 10),
        report_id: '', notes: '', exchange_rate: '',
      }
  );
  const [file, setFile]       = useState(null);
  const [preview, setPreview] = useState(expense?.receipt_path ? receiptUrl(expense.receipt_path) : null);
  const [autoRate, setAutoRate] = useState(''); // auto-hentet kurs som hint
  const [rateEdited, setRateEdited] = useState(false); // har brugeren redigeret kursen?
  const [amountDKK, setAmountDKK] = useState(''); // beregnet DKK-beløb
  const [saving, setSaving]   = useState(false);
  const [drag, setDrag]       = useState(false);
  const fileRef = useRef();

  // Husk valutavalg
  useEffect(() => {
    if (form.currency) setPreferredCurrency(form.currency);
  }, [form.currency]);

  // Auto-hent kurs når valuta eller beløb ændres
  useEffect(() => {
    if (!form.amount || form.currency === 'DKK') {
      setAutoRate('');
      setAmountDKK(form.amount ? `${parseFloat(form.amount).toLocaleString('da-DK', { minimumFractionDigits: 2 })} DKK` : '');
      return;
    }
    const t = setTimeout(async () => {
      try {
        const { amount_dkk, rate } = await api.convert(form.amount, form.currency);
        const rateStr = parseFloat(rate).toFixed(4);
        setAutoRate(rateStr);
        // Kun sæt kurs automatisk hvis brugeren ikke har redigeret den
        if (!rateEdited) {
          setForm(f => ({ ...f, exchange_rate: rateStr }));
        }
        // Beregn DKK med den aktuelle kurs (manuel eller auto)
        const activeRate = rateEdited && form.exchange_rate ? parseFloat(form.exchange_rate) : parseFloat(rate);
        const dkk = Math.round(parseFloat(form.amount) * activeRate * 100) / 100;
        setAmountDKK(`≈ ${dkk.toLocaleString('da-DK', { minimumFractionDigits: 2 })} DKK`);
      } catch { setAutoRate(''); }
    }, 400);
    return () => clearTimeout(t);
  }, [form.amount, form.currency]);

  // Genberegn DKK når manuel kurs ændres
  useEffect(() => {
    if (!form.amount || !form.exchange_rate || form.currency === 'DKK') return;
    const rate = parseFloat(form.exchange_rate);
    if (isNaN(rate) || rate <= 0) return;
    const dkk = Math.round(parseFloat(form.amount) * rate * 100) / 100;
    setAmountDKK(`= ${dkk.toLocaleString('da-DK', { minimumFractionDigits: 2 })} DKK`);
  }, [form.exchange_rate]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    if (f.type.startsWith('image/')) setPreview(URL.createObjectURL(f));
    else setPreview(null);
  };

  const handleSubmit = async () => {
    if (!form.description || !form.amount || !form.expense_date) {
      toast('Udfyld venligst beskrivelse, beløb og dato', 'error');
      return;
    }
    setSaving(true);
    try {
      if (expense && !isCopy) {
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => { if (v !== '') fd.append(k, v); });
        if (file) fd.append('receipt', file);
        await api.updateExpense(expense.id, fd);
        toast('Udgift opdateret');
        onSaved(); onClose();
        return;
      }

      if (!isOnline()) {
        let amount_dkk = parseFloat(form.amount);
        try {
          if (form.exchange_rate && parseFloat(form.exchange_rate) > 0) {
            amount_dkk = Math.round(parseFloat(form.amount) * parseFloat(form.exchange_rate) * 100) / 100;
          } else {
            const rates = JSON.parse(localStorage.getItem('kvitto_rates') || '{}');
            amount_dkk = Math.round(parseFloat(form.amount) * (rates[form.currency] || 1) * 100) / 100;
          }
        } catch {}
        const token = localStorage.getItem('kvitto_token');
        await enqueueExpense({ ...form, amount_dkk }, file || null, token);
        toast('Gemt offline — synkroniseres når du er online 📵');
        onSaved(); onClose();
        return;
      }

      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v !== '') fd.append(k, v); });
      if (file) fd.append('receipt', file);
      await api.createExpense(fd);
      toast('Udgift gemt');
      onSaved(); onClose();
    } catch (err) {
      if (!navigator.onLine || err.message?.includes('fetch')) {
        try {
          const token = localStorage.getItem('kvitto_token');
          await enqueueExpense(form, file || null, token);
          toast('Gemt offline 📵');
          onSaved(); onClose();
        } catch { toast('Kunne ikke gemme udgiften', 'error'); }
      } else {
        toast(err.message, 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const activeReports = reports.filter(r => r.status !== 'approved');
  const showCurrencyFields = form.currency !== 'DKK';

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <span className="modal-title">{isCopy ? 'Kopiér udgift' : expense && !isCopy ? 'Rediger udgift' : 'Tilføj udgift'}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Beskrivelse *</label>
            <input className="form-input" placeholder="Fx fly til Berlin, kundefrokost..."
              value={form.description} onChange={e => set('description', e.target.value)} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Beløb *</label>
              <div className="amount-group">
                <input className="form-input amount-input" type="number" min="0" step="0.01"
                  placeholder="0,00" value={form.amount}
                  onChange={e => set('amount', e.target.value)} />
                <select className="form-select" value={form.currency}
                  onChange={e => { set('currency', e.target.value); setRateEdited(false); }}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Dato *</label>
              <input className="form-input" type="date" value={form.expense_date}
                onChange={e => set('expense_date', e.target.value)} />
            </div>
          </div>

          {/* Valutakurs — kun hvis ikke DKK */}
          {showCurrencyFields && (
            <div className="form-group">
              <label className="form-label">
                Valutakurs (DKK pr. 1 {form.currency})
                {autoRate && !rateEdited && (
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 8, fontWeight: 400 }}>
                    Dagskurs: {autoRate}
                  </span>
                )}
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="form-input"
                  type="number" min="0" step="0.0001"
                  placeholder={autoRate || '0,0000'}
                  value={form.exchange_rate}
                  onChange={e => {
                    set('exchange_rate', e.target.value);
                    setRateEdited(true);
                  }}
                  style={{ maxWidth: 160 }}
                />
                {rateEdited && autoRate && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ fontSize: 12, whiteSpace: 'nowrap' }}
                    onClick={() => {
                      set('exchange_rate', autoRate);
                      setRateEdited(false);
                    }}
                  >
                    ↺ Brug dagskurs ({autoRate})
                  </button>
                )}
              </div>
              {amountDKK && (
                <div style={{ fontSize: 12, color: 'var(--purple)', marginTop: 5, fontWeight: 500 }}>
                  {amountDKK}
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Kategori</label>
            <div className="cat-grid">
              {CATEGORIES.map(c => (
                <button key={c.value} type="button"
                  className={`cat-chip${form.category === c.value ? ' active' : ''}`}
                  onClick={() => set('category', c.value)}>
                  <span className="icon">{c.icon}</span>{c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Rapport</label>
            <select className="form-select" value={form.report_id}
              onChange={e => set('report_id', e.target.value)}>
              <option value="">— Ingen rapport —</option>
              {activeReports.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Kvittering</label>
            {preview ? (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img src={preview} alt="Kvittering" style={{ maxWidth: '100%', maxHeight: 180,
                  borderRadius: 8, border: '0.5px solid var(--border)' }} />
                <button className="btn btn-sm btn-danger"
                  style={{ position: 'absolute', top: 6, right: 6 }}
                  onClick={() => { setFile(null); setPreview(null); }}>Fjern</button>
              </div>
            ) : (
              <div className={`upload-zone${drag ? ' drag' : ''}`}
                onDragOver={e => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
                onClick={() => fileRef.current?.click()}>
                <div className="upload-icon">📎</div>
                <div className="upload-text">Klik eller træk kvittering hertil</div>
                <div className="upload-hint">JPG, PNG, WEBP eller PDF · maks 10 MB</div>
                <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf"
                  style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
              </div>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Noter</label>
            <textarea className="form-textarea" placeholder="Valgfrie noter..."
              value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Annuller</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Gemmer...' : expense ? 'Gem ændringer' : 'Gem udgift'}
          </button>
        </div>
      </div>
    </div>
  );
}
