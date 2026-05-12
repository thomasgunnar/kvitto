const router  = require('express').Router();
const XLSX    = require('xlsx');
const { pool }        = require('../db');
const authMiddleware  = require('../middleware/auth');
const { log }         = require('../services/activityLog');

const CAT_LABELS = {
  travel: 'Rejse', food: 'Mad & drikke', hotel: 'Hotel',
  transport: 'Transport', other: 'Andet',
};

function fmtDate(d) {
  return new Date(d).toLocaleDateString('da-DK');
}

// GET /api/export/expenses.xlsx  — alle udgifter
// GET /api/export/report/:id.xlsx — udgifter i én rapport
router.get(['/expenses.xlsx', '/report/:id.xlsx'], authMiddleware, async (req, res) => {
  try {
    const reportId = req.params.id || null;
    let sql = `
      SELECT e.*, r.name AS report_name, r.status AS report_status
      FROM expenses e
      LEFT JOIN reports r ON e.report_id = r.id
      WHERE e.user_id = ?
    `;
    const params = [req.userId];
    if (reportId) { sql += ' AND e.report_id = ?'; params.push(reportId); }
    sql += ' ORDER BY e.expense_date ASC';

    const [expenses] = await pool.query(sql, params);

    // Byg Excel-rækker
    const rows = expenses.map(e => ({
      'Dato':             fmtDate(e.expense_date),
      'Beskrivelse':      e.description,
      'Kategori':         CAT_LABELS[e.category] || e.category,
      'Rapport':          e.report_name || '',
      'Rapport status':   e.report_status === 'approved' ? 'Godkendt'
                        : e.report_status === 'submitted' ? 'Til godkendelse'
                        : e.report_status === 'active'    ? 'Igangværende' : '',
      'Beløb':            parseFloat(e.amount),
      'Valuta':           e.currency,
      'Kurs':             e.exchange_rate && e.currency !== 'DKK'
                          ? parseFloat(parseFloat(e.exchange_rate).toFixed(4)) : '',
      'Beløb (DKK)':      parseFloat(parseFloat(e.amount_dkk).toFixed(2)),
      'Noter':            e.notes || '',
      'Kvittering':       e.receipt_path ? 'Ja' : 'Nej',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    // Kolonne-bredder
    ws['!cols'] = [
      { wch: 12 }, { wch: 35 }, { wch: 15 }, { wch: 25 }, { wch: 20 },
      { wch: 12 }, { wch: 8  }, { wch: 10 }, { wch: 14 }, { wch: 30 }, { wch: 10 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Udgifter');

    // Tilføj summary sheet
    const total = expenses.reduce((s, e) => s + parseFloat(e.amount_dkk), 0);
    const byCat = {};
    expenses.forEach(e => {
      const cat = CAT_LABELS[e.category] || e.category;
      byCat[cat] = (byCat[cat] || 0) + parseFloat(e.amount_dkk);
    });

    const summaryRows = [
      { 'Oversigt': 'Total udgifter', 'Antal': expenses.length, 'Beløb (DKK)': parseFloat(total.toFixed(2)) },
      {},
      { 'Oversigt': 'Per kategori', 'Antal': '', 'Beløb (DKK)': '' },
      ...Object.entries(byCat).map(([cat, amt]) => ({
        'Oversigt': cat, 'Antal': expenses.filter(e => (CAT_LABELS[e.category] || e.category) === cat).length,
        'Beløb (DKK)': parseFloat(amt.toFixed(2))
      })),
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    wsSummary['!cols'] = [{ wch: 25 }, { wch: 8 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Oversigt');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = reportId
      ? `Rapport_${reportId}_${new Date().toISOString().slice(0,10)}.xlsx`
      : `Udgifter_${new Date().toISOString().slice(0,10)}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);

    log(req.userId, 'export_csv', reportId ? 'report' : 'expense',
        reportId ? parseInt(reportId) : null, filename, { count: expenses.length });
  } catch (err) {
    console.error('Excel export fejl:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Eksport fejlede' });
  }
});

module.exports = router;
