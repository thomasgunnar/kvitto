const router = require('express').Router();
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');

// GET /api/currencies — returns all cached rates
router.get('/', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM currency_rates ORDER BY currency');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/currencies/convert?amount=100&from=USD
router.get('/convert', authMiddleware, async (req, res) => {
  try {
    const { amount, from } = req.query;
    if (!amount || !from) return res.status(400).json({ error: 'amount and from are required' });

    const [rows] = await pool.query('SELECT rate_to_dkk FROM currency_rates WHERE currency = ?', [from.toUpperCase()]);
    if (rows.length === 0) return res.status(404).json({ error: 'Currency not found' });

    const dkk = parseFloat(amount) * parseFloat(rows[0].rate_to_dkk);
    res.json({ amount_dkk: Math.round(dkk * 100) / 100, rate: rows[0].rate_to_dkk });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
