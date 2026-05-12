const router = require('express').Router();
const path   = require('path');
const fs     = require('fs');
const { pool }             = require('../db');
const authMiddleware       = require('../middleware/auth');
const upload               = require('../middleware/upload');
const { sendExpenseEmail } = require('../services/mailer');
const { log }              = require('../services/activityLog');

// GET /api/expenses
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { report_id, category, from, to } = req.query;
    let sql = `
      SELECT e.*, r.name AS report_name, r.status AS report_status
      FROM expenses e
      LEFT JOIN reports r ON e.report_id = r.id
      WHERE e.user_id = ?
    `;
    const params = [req.userId];
    if (report_id) { sql += ' AND e.report_id = ?'; params.push(report_id); }
    if (category)  { sql += ' AND e.category = ?';  params.push(category); }
    if (from)      { sql += ' AND e.expense_date >= ?'; params.push(from); }
    if (to)        { sql += ' AND e.expense_date <= ?'; params.push(to); }
    sql += ' ORDER BY e.expense_date DESC, e.created_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/expenses/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT e.*, r.name AS report_name, r.status AS report_status
       FROM expenses e LEFT JOIN reports r ON e.report_id = r.id
       WHERE e.id = ? AND e.user_id = ?`,
      [req.params.id, req.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Expense not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

async function calcDKK(amount, currency, manualRate) {
  const amt = parseFloat(amount);
  if (currency === 'DKK') return { amount_dkk: amt, exchange_rate: 1.0 };
  if (manualRate && parseFloat(manualRate) > 0) {
    const rate = parseFloat(manualRate);
    return { amount_dkk: Math.round(amt * rate * 100) / 100, exchange_rate: rate };
  }
  const [rates] = await pool.query('SELECT rate_to_dkk FROM currency_rates WHERE currency = ?', [currency.toUpperCase()]);
  const rate = rates.length > 0 ? parseFloat(rates[0].rate_to_dkk) : 1;
  return { amount_dkk: Math.round(amt * rate * 100) / 100, exchange_rate: rate };
}

async function getUserInfo(userId) {
  const [rows] = await pool.query('SELECT email, email_notifications FROM users WHERE id = ?', [userId]);
  return rows.length > 0 ? rows[0] : null;
}

async function maybeSendMail(userId, expense, isUpdate) {
  try {
    const user = await getUserInfo(userId);
    if (!user || !user.email_notifications) return;
    let reportName = null;
    if (expense.report_id) {
      const [rep] = await pool.query('SELECT name FROM reports WHERE id = ?', [expense.report_id]);
      if (rep.length > 0) reportName = rep[0].name;
    }
    const uploadDir  = process.env.UPLOAD_DIR || './uploads';
    const receiptPath = expense.receipt_path ? path.join(uploadDir, expense.receipt_path) : null;
    await sendExpenseEmail({ to: user.email, expense: { ...expense, report_name: reportName }, isUpdate, receiptPath });
  } catch (err) {
    console.warn('[Mail] Kvitteringsmail fejlede:', err.message);
  }
}

// POST /api/expenses
router.post('/', authMiddleware, upload.single('receipt'), async (req, res) => {
  try {
    const { description, amount, currency, category, expense_date, report_id, notes, exchange_rate } = req.body;
    if (!description || !amount || !currency || !expense_date)
      return res.status(400).json({ error: 'description, amount, currency and expense_date are required' });

    const { amount_dkk, exchange_rate: rate } = await calcDKK(amount, currency, exchange_rate);
    const receipt_path = req.file ? req.file.filename : null;

    const [result] = await pool.query(
      `INSERT INTO expenses (user_id, report_id, description, amount, currency, amount_dkk, exchange_rate, category, expense_date, receipt_path, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.userId, report_id || null, description.trim(), parseFloat(amount),
       currency.toUpperCase(), amount_dkk, rate, category || 'other', expense_date, receipt_path, notes || null]
    );

    const [created] = await pool.query('SELECT * FROM expenses WHERE id = ?', [result.insertId]);
    res.status(201).json(created[0]);

    log(req.userId, 'create', 'expense', result.insertId, description.trim(),
      { amount_dkk, currency: currency.toUpperCase() });
    maybeSendMail(req.userId, created[0], false);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/expenses/:id
router.put('/:id', authMiddleware, upload.single('receipt'), async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT * FROM expenses WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Expense not found' });
    const exp = existing[0];

    const { description, amount, currency, category, expense_date, report_id, notes, exchange_rate } = req.body;
    const newCurrency = (currency || exp.currency).toUpperCase();
    const newAmount   = parseFloat(amount || exp.amount);
    const { amount_dkk, exchange_rate: rate } = await calcDKK(
      newAmount, newCurrency, exchange_rate !== undefined ? exchange_rate : exp.exchange_rate
    );

    let receipt_path = exp.receipt_path;
    if (req.file) {
      if (exp.receipt_path) {
        const oldPath = path.join(process.env.UPLOAD_DIR || './uploads', exp.receipt_path);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      receipt_path = req.file.filename;
    }

    await pool.query(
      `UPDATE expenses SET description=?, amount=?, currency=?, amount_dkk=?, exchange_rate=?,
       category=?, expense_date=?, report_id=?, receipt_path=?, notes=? WHERE id=? AND user_id=?`,
      [(description || exp.description).trim(), newAmount, newCurrency, amount_dkk, rate,
       category || exp.category, expense_date || exp.expense_date,
       report_id !== undefined ? (report_id || null) : exp.report_id,
       receipt_path, notes !== undefined ? notes : exp.notes, req.params.id, req.userId]
    );

    const [updated] = await pool.query('SELECT * FROM expenses WHERE id = ?', [req.params.id]);
    res.json(updated[0]);

    log(req.userId, 'update', 'expense', parseInt(req.params.id), (description || exp.description).trim());
    maybeSendMail(req.userId, updated[0], true);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT * FROM expenses WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Expense not found' });
    if (existing[0].receipt_path) {
      const fp = path.join(process.env.UPLOAD_DIR || './uploads', existing[0].receipt_path);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    await pool.query('DELETE FROM expenses WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    log(req.userId, 'delete', 'expense', parseInt(req.params.id), existing[0].description);
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/expenses/:id/receipt
router.delete('/:id/receipt', authMiddleware, async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT receipt_path FROM expenses WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Expense not found' });
    if (!existing[0].receipt_path) return res.status(404).json({ error: 'No receipt attached' });
    const fp = path.join(process.env.UPLOAD_DIR || './uploads', existing[0].receipt_path);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    await pool.query('UPDATE expenses SET receipt_path = NULL WHERE id = ?', [req.params.id]);
    res.json({ message: 'Receipt deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/expenses/bulk-assign — tilknyt flere udgifter til en rapport
router.post('/bulk-assign', authMiddleware, async (req, res) => {
  try {
    const { expense_ids, report_id } = req.body;
    if (!Array.isArray(expense_ids) || expense_ids.length === 0)
      return res.status(400).json({ error: 'expense_ids array er påkrævet' });

    // Verificer at alle udgifter tilhører brugeren
    const [owned] = await pool.query(
      `SELECT id FROM expenses WHERE id IN (${expense_ids.map(() => '?').join(',')}) AND user_id = ?`,
      [...expense_ids, req.userId]
    );
    if (owned.length !== expense_ids.length)
      return res.status(403).json({ error: 'En eller flere udgifter tilhører ikke dig' });

    await pool.query(
      `UPDATE expenses SET report_id = ? WHERE id IN (${expense_ids.map(() => '?').join(',')}) AND user_id = ?`,
      [report_id || null, ...expense_ids, req.userId]
    );

    // Log
    let reportName = null;
    if (report_id) {
      const [rep] = await pool.query('SELECT name FROM reports WHERE id = ?', [report_id]);
      if (rep.length > 0) reportName = rep[0].name;
    }
    log(req.userId, 'bulk_assign', 'report', report_id, reportName,
      { expense_count: expense_ids.length });

    res.json({ updated: expense_ids.length, report_id: report_id || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
