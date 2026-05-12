const router = require('express').Router();
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');
const { calcNextDate } = require('../services/recurring');

const INTERVAL_LABELS = {
  daily: 'Daglig', weekly: 'Ugentlig',
  monthly: 'Månedlig', yearly: 'Årlig',
};

// GET /api/recurring
router.get('/', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.*, rep.name AS report_name
       FROM recurring_expenses r
       LEFT JOIN reports rep ON rep.id = r.report_id
       WHERE r.user_id = ?
       ORDER BY r.active DESC, r.next_date ASC`,
      [req.userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/recurring
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { description, amount, currency, exchange_rate, category,
            report_id, notes, interval_type, start_date } = req.body;

    if (!description || !amount || !currency || !interval_type || !start_date)
      return res.status(400).json({ error: 'description, amount, currency, interval_type og start_date er påkrævet' });

    // Beregn interval_day for månedlige (gem dag i måneden)
    const interval_day = interval_type === 'monthly'
      ? new Date(start_date).getDate()
      : null;

    const [result] = await pool.query(
      `INSERT INTO recurring_expenses
        (user_id, description, amount, currency, exchange_rate, category,
         report_id, notes, interval_type, interval_day, next_date, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [req.userId, description.trim(), parseFloat(amount), currency.toUpperCase(),
       exchange_rate || null, category || 'other',
       report_id || null, notes || null,
       interval_type, interval_day, start_date]
    );

    const [created] = await pool.query('SELECT * FROM recurring_expenses WHERE id = ?', [result.insertId]);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/recurring/:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const [existing] = await pool.query(
      'SELECT id FROM recurring_expenses WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Not found' });

    const { description, amount, currency, exchange_rate, category,
            report_id, notes, interval_type, next_date, active } = req.body;

    await pool.query(
      `UPDATE recurring_expenses SET
        description=?, amount=?, currency=?, exchange_rate=?, category=?,
        report_id=?, notes=?, interval_type=?, next_date=?, active=?
       WHERE id=? AND user_id=?`,
      [description, parseFloat(amount), currency.toUpperCase(), exchange_rate || null,
       category, report_id || null, notes || null, interval_type, next_date,
       active ? 1 : 0, req.params.id, req.userId]
    );

    const [updated] = await pool.query('SELECT * FROM recurring_expenses WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/recurring/:id/toggle — pause/genaktiver
router.patch('/:id/toggle', authMiddleware, async (req, res) => {
  try {
    const [existing] = await pool.query(
      'SELECT id, active FROM recurring_expenses WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Not found' });

    const newActive = existing[0].active ? 0 : 1;
    await pool.query(
      'UPDATE recurring_expenses SET active = ? WHERE id = ?',
      [newActive, req.params.id]
    );
    res.json({ active: !!newActive });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/recurring/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const [existing] = await pool.query(
      'SELECT id FROM recurring_expenses WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Not found' });
    await pool.query('DELETE FROM recurring_expenses WHERE id = ?', [req.params.id]);
    res.json({ message: 'Slettet' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
