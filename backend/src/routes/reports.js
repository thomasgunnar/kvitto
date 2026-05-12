const router = require('express').Router();
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');
const { log } = require('../services/activityLog');

const VALID_STATUSES = ['active', 'submitted', 'approved'];

// GET /api/reports
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status } = req.query; // optional filter
    let sql = `
      SELECT r.*,
        COUNT(e.id) AS expense_count,
        COALESCE(SUM(e.amount_dkk), 0) AS total_dkk
       FROM reports r
       LEFT JOIN expenses e ON e.report_id = r.id
       WHERE r.user_id = ?
    `;
    const params = [req.userId];
    if (status) { sql += ' AND r.status = ?'; params.push(status); }
    sql += ' GROUP BY r.id ORDER BY r.created_at DESC';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/reports/:id
router.get('/:id', authMiddleware, async (req, res) => {
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
      'SELECT * FROM expenses WHERE report_id = ? AND user_id = ? ORDER BY expense_date DESC',
      [req.params.id, req.userId]
    );
    res.json({ ...reports[0], expenses });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/reports
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const [result] = await pool.query(
      'INSERT INTO reports (user_id, name, description, status) VALUES (?, ?, ?, ?)',
      [req.userId, name.trim(), description || null, 'active']
    );
    const [created] = await pool.query('SELECT * FROM reports WHERE id = ?', [result.insertId]);
    res.status(201).json({ ...created[0], expense_count: 0, total_dkk: 0 });
    log(req.userId, 'create', 'report', result.insertId, name.trim());
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/reports/:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, description, status } = req.body;
    const [existing] = await pool.query('SELECT id FROM reports WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Report not found' });
    if (status && !VALID_STATUSES.includes(status))
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });

    await pool.query(
      'UPDATE reports SET name = ?, description = ?, status = COALESCE(?, status) WHERE id = ? AND user_id = ?',
      [name?.trim(), description || null, status || null, req.params.id, req.userId]
    );
    const [updated] = await pool.query('SELECT * FROM reports WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/reports/:id/status — skift kun status
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    if (!VALID_STATUSES.includes(status))
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });

    const [existing] = await pool.query('SELECT id FROM reports WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Report not found' });

    await pool.query('UPDATE reports SET status = ? WHERE id = ? AND user_id = ?', [status, req.params.id, req.userId]);
    res.json({ status });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/reports/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT id FROM reports WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Report not found' });
    await pool.query('DELETE FROM reports WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    res.json({ message: 'Report deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/reports/:id/approve-all (godkend alle = sæt status approved)
router.post('/:id/approve-all', authMiddleware, async (req, res) => {
  try {
    const [report] = await pool.query('SELECT id FROM reports WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (report.length === 0) return res.status(404).json({ error: 'Report not found' });
    await pool.query("UPDATE reports SET status = 'approved' WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
    res.json({ status: 'approved' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/reports/:id/summary
router.get('/:id/summary', authMiddleware, async (req, res) => {
  try {
    const [report] = await pool.query('SELECT id FROM reports WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (report.length === 0) return res.status(404).json({ error: 'Report not found' });

    const [byCategory] = await pool.query(
      `SELECT category, COUNT(*) AS count, SUM(amount_dkk) AS total_dkk
       FROM expenses WHERE report_id = ? AND user_id = ? GROUP BY category`,
      [req.params.id, req.userId]
    );
    const [byCurrency] = await pool.query(
      `SELECT currency, COUNT(*) AS count, SUM(amount) AS total_original, SUM(amount_dkk) AS total_dkk
       FROM expenses WHERE report_id = ? AND user_id = ? GROUP BY currency`,
      [req.params.id, req.userId]
    );
    res.json({ by_category: byCategory, by_currency: byCurrency });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
