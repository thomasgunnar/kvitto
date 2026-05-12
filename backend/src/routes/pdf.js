const router = require('express').Router();
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');
const { generateReportPDF } = require('../services/pdf');

// GET /api/pdf/reports/:id
router.get('/reports/:id', authMiddleware, async (req, res) => {
  try {
    const [reports] = await pool.query(
      `SELECT r.*,
        COUNT(e.id) AS expense_count,
        COALESCE(SUM(e.amount_dkk), 0) AS total_dkk
       FROM reports r
       LEFT JOIN expenses e ON e.report_id = r.id
       WHERE r.id = ? AND r.user_id = ?
       GROUP BY r.id`,
      [req.params.id, req.userId]
    );

    if (reports.length === 0) return res.status(404).json({ error: 'Report not found' });

    const [expenses] = await pool.query(
      'SELECT * FROM expenses WHERE report_id = ? AND user_id = ? ORDER BY expense_date ASC',
      [req.params.id, req.userId]
    );

    const safeName = reports[0].name.replace(/[^a-zA-Z0-9æøåÆØÅ _-]/g, '').trim().replace(/\s+/g, '_');
    const filename = `Rapport_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await generateReportPDF(reports[0], expenses, res);
  } catch (err) {
    console.error('PDF generation error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'PDF generation failed' });
  }
});

module.exports = router;
