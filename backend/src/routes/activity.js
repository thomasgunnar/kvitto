const router = require('express').Router();
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');

const ACTION_LABELS = {
  create:        'Oprettede',
  update:        'Opdaterede',
  delete:        'Slettede',
  status_change: 'Ændrede status på',
  bulk_assign:   'Tilknyttede udgifter til',
  export_pdf:    'Eksporterede PDF for',
  export_csv:    'Eksporterede CSV for',
  login:         'Loggede ind',
  invite_sent:   'Sendte invitation til',
  reset_password:'Nulstillede adgangskode for',
};

const ENTITY_LABELS = {
  expense:   'udgift',
  report:    'rapport',
  recurring: 'tilbagevendende udgift',
  user:      'bruger',
};

// GET /api/activity
router.get('/', authMiddleware, async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;

    const [rows] = await pool.query(
      `SELECT a.*, u.name AS user_name
       FROM activity_log a
       JOIN users u ON u.id = a.user_id
       WHERE a.user_id = ?
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [req.userId, limit, offset]
    );

    const [total] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM activity_log WHERE user_id = ?',
      [req.userId]
    );

    res.json({
      items: rows.map(r => ({
        ...r,
        actionLabel: ACTION_LABELS[r.action] || r.action,
        entityLabel: ENTITY_LABELS[r.entity_type] || r.entity_type,
        details: r.details ? JSON.parse(r.details) : null,
      })),
      total: total[0].cnt,
      limit,
      offset,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
