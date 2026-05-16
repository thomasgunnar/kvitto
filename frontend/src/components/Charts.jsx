import { useMemo } from 'react';

// ── FARVER ────────────────────────────────────────────────────
const CAT_COLORS = {
  travel:    '#534AB7',
  food:      '#1D9E75',
  hotel:     '#E8A838',
  transport: '#E05C5C',
  other:     '#9c9a92',
};

const CAT_LABEL = {
  travel: 'Rejse', food: 'Mad', hotel: 'Hotel',
  transport: 'Transport', other: 'Andet',
};

function fmtDKK(n, short = false) {
  if (short && n >= 1000) return (n / 1000).toLocaleString('da-DK', { maximumFractionDigits: 1 }) + 'k';
  return Number(n).toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ── MÅNEDLIG SØJLEDIAGRAM ─────────────────────────────────────
export function MonthlyBarChart({ expenses }) {
  const data = useMemo(() => {
    const months = {};
    const now = new Date();

    // Initialiser de seneste 6 måneder
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('da-DK', { month: 'short' });
      months[key] = { label, total: 0, month: d.getMonth(), year: d.getFullYear() };
    }

    expenses.forEach(e => {
      if (!e.expense_date || e._offline) return;
      const key = e.expense_date.slice(0, 7);
      if (months[key]) months[key].total += parseFloat(e.amount_dkk || 0);
    });

    return Object.values(months);
  }, [expenses]);

  const maxVal = Math.max(...data.map(d => d.total), 1);
  const W = 100, H = 80, barW = 12, gap = 4;
  const chartW = data.length * (barW + gap) - gap;
  const startX = (W - chartW) / 2;

  // Nuværende måned
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
        Udgifter per måned
      </div>
      <svg viewBox={`0 0 ${W} ${H + 20}`} style={{ width: '100%', overflow: 'visible' }}>
        {/* Baseline */}
        <line x1={startX - 2} y1={H} x2={startX + chartW + 2} y2={H}
          stroke="var(--border)" strokeWidth="0.5" />

        {data.map((d, i) => {
          const barH = Math.max((d.total / maxVal) * (H - 10), d.total > 0 ? 2 : 0);
          const x = startX + i * (barW + gap);
          const y = H - barH;
          const isCurrentMonth = i === data.length - 1;

          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH}
                rx="2"
                fill={isCurrentMonth ? 'var(--purple)' : 'var(--purple-light)'}
                stroke={isCurrentMonth ? 'none' : 'var(--purple-border)'}
                strokeWidth="0.5"
              />
              {/* Beløb over søjlen */}
              {d.total > 0 && (
                <text x={x + barW / 2} y={y - 2}
                  textAnchor="middle" fontSize="5"
                  fill={isCurrentMonth ? 'var(--purple)' : 'var(--text-tertiary)'}>
                  {fmtDKK(d.total, true)}
                </text>
              )}
              {/* Måned label */}
              <text x={x + barW / 2} y={H + 10}
                textAnchor="middle" fontSize="6"
                fill={isCurrentMonth ? 'var(--purple)' : 'var(--text-tertiary)'}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── KATEGORI DONUT ────────────────────────────────────────────
export function CategoryDonut({ expenses }) {
  const data = useMemo(() => {
    const cats = {};
    expenses.forEach(e => {
      if (e._offline) return;
      const cat = e.category || 'other';
      cats[cat] = (cats[cat] || 0) + parseFloat(e.amount_dkk || 0);
    });
    const total = Object.values(cats).reduce((s, v) => s + v, 0);
    if (total === 0) return [];
    return Object.entries(cats)
      .map(([cat, val]) => ({ cat, val, pct: val / total }))
      .sort((a, b) => b.val - a.val);
  }, [expenses]);

  const total = data.reduce((s, d) => s + d.val, 0);

  if (data.length === 0) return null;

  // Byg donut segmenter
  const R = 28, r = 18, cx = 38, cy = 38;
  let angle = -Math.PI / 2;

  const segments = data.map(d => {
    const sweep = d.pct * 2 * Math.PI;
    const x1 = cx + R * Math.cos(angle);
    const y1 = cy + R * Math.sin(angle);
    angle += sweep;
    const x2 = cx + R * Math.cos(angle);
    const y2 = cy + R * Math.sin(angle);
    const x3 = cx + r * Math.cos(angle);
    const y3 = cy + r * Math.sin(angle);
    const x4 = cx + r * Math.cos(angle - sweep);
    const y4 = cy + r * Math.sin(angle - sweep);
    const large = sweep > Math.PI ? 1 : 0;
    return {
      ...d,
      path: `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${r} ${r} 0 ${large} 0 ${x4} ${y4} Z`,
    };
  });

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
        Fordeling per kategori
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <svg viewBox="0 0 76 76" style={{ width: 90, flexShrink: 0 }}>
          {segments.map((s, i) => (
            <path key={i} d={s.path} fill={CAT_COLORS[s.cat] || '#ccc'} />
          ))}
          {/* Center tekst */}
          <text x={cx} y={cy - 3} textAnchor="middle" fontSize="6"
            fill="var(--text-tertiary)">Total</text>
          <text x={cx} y={cy + 5} textAnchor="middle" fontSize="7" fontWeight="bold"
            fill="var(--text-primary)">{fmtDKK(total, true)}</text>
        </svg>

        {/* Legende */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {segments.slice(0, 5).map(s => (
            <div key={s.cat} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0,
                background: CAT_COLORS[s.cat] || '#ccc' }} />
              <div style={{ flex: 1, fontSize: 11, color: 'var(--text-secondary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {CAT_LABEL[s.cat] || s.cat}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)',
                flexShrink: 0 }}>
                {Math.round(s.pct * 100)}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 30-DAGES TRENDLINJE ───────────────────────────────────────
export function TrendLine({ expenses }) {
  const data = useMemo(() => {
    const days = {};
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days[key] = 0;
    }

    expenses.forEach(e => {
      if (!e.expense_date || e._offline) return;
      const key = e.expense_date;
      if (key in days) days[key] += parseFloat(e.amount_dkk || 0);
    });

    return Object.entries(days).map(([date, val]) => ({ date, val }));
  }, [expenses]);

  // Kumulativ sum
  const cumulative = useMemo(() => {
    let sum = 0;
    return data.map(d => { sum += d.val; return { ...d, cum: sum }; });
  }, [data]);

  const maxCum = Math.max(...cumulative.map(d => d.cum), 1);
  const W = 100, H = 50;
  const points = cumulative.map((d, i) => {
    const x = (i / (cumulative.length - 1)) * W;
    const y = H - (d.cum / maxCum) * (H - 4);
    return `${x},${y}`;
  }).join(' ');

  const totalMonth = data.reduce((s, d) => s + d.val, 0);
  const daysWithExpenses = data.filter(d => d.val > 0).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
          Seneste 30 dage
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          {daysWithExpenses} dage med udgifter
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 8}`} style={{ width: '100%', overflow: 'visible' }}>
        {/* Gradient fill */}
        <defs>
          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#534AB7" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#534AB7" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Fill under kurven */}
        <polygon
          points={`0,${H} ${points} ${W},${H}`}
          fill="url(#trendGrad)"
        />

        {/* Linje */}
        <polyline points={points}
          fill="none" stroke="#534AB7" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round" />

        {/* Endepunkt */}
        {cumulative.length > 0 && (() => {
          const last = cumulative[cumulative.length - 1];
          const x = W;
          const y = H - (last.cum / maxCum) * (H - 4);
          return <circle cx={x} cy={y} r="2" fill="#534AB7" />;
        })()}

        {/* Labels */}
        <text x="0" y={H + 8} fontSize="5.5" fill="var(--text-tertiary)">
          {data[0]?.date.slice(5).replace('-', '/')}
        </text>
        <text x={W} y={H + 8} fontSize="5.5" textAnchor="end" fill="var(--text-tertiary)">
          I dag
        </text>
        <text x={W} y={H - (cumulative[cumulative.length-1]?.cum / maxCum) * (H-4) - 4}
          fontSize="6" textAnchor="end" fill="#534AB7" fontWeight="bold">
          {fmtDKK(totalMonth, true)} DKK
        </text>
      </svg>
    </div>
  );
}
