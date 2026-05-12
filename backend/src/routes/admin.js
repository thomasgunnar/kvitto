const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('../db');
const { admin } = require('../middleware/auth');
const { sendInviteEmail } = require('../services/mailer');

// GET /api/admin/users
router.get('/users', admin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.is_admin, u.must_change_password, u.created_at,
        COUNT(e.id) AS expense_count
       FROM users u
       LEFT JOIN expenses e ON e.user_id = u.id
       GROUP BY u.id ORDER BY u.created_at ASC`
    );
    res.json(rows.map(u => ({
      ...u,
      isAdmin: !!u.is_admin,
      mustChangePassword: !!u.must_change_password,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/invites — list pending invites
router.get('/invites', admin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT i.*, u.name AS invited_by_name
       FROM invites i
       JOIN users u ON u.id = i.invited_by
       WHERE i.used_at IS NULL AND i.expires_at > NOW()
       ORDER BY i.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/invite — send invite email
router.post('/invite', admin, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    // Tjek om brugeren allerede eksisterer
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing.length > 0)
      return res.status(409).json({ error: 'En bruger med denne e-mail eksisterer allerede' });

    // Tjek om der allerede er en aktiv invite
    const [activeInvite] = await pool.query(
      'SELECT id FROM invites WHERE email = ? AND used_at IS NULL AND expires_at > NOW()',
      [email.toLowerCase().trim()]
    );
    if (activeInvite.length > 0)
      return res.status(409).json({ error: 'Der er allerede sendt en aktiv invitation til denne e-mail' });

    // Generer token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 timer

    await pool.query(
      'INSERT INTO invites (token, email, invited_by, expires_at) VALUES (?, ?, ?, ?)',
      [token, email.toLowerCase().trim(), req.userId, expiresAt]
    );

    // Hent inviterens navn
    const [inviter] = await pool.query('SELECT name FROM users WHERE id = ?', [req.userId]);
    const inviteUrl = `${process.env.APP_URL}/invite/${token}`;

    // Send e-mail
    try {
      await sendInviteEmail({
        to: email,
        inviterName: inviter[0]?.name || 'En administrator',
        inviteUrl,
      });
      res.json({ message: `Invitation sendt til ${email}`, inviteUrl });
    } catch (mailErr) {
      console.error('Mail fejl:', mailErr.message);
      // Returner URL selvom mail fejler — admin kan kopiere det manuelt
      res.status(207).json({
        message: 'Invitation oprettet men e-mail kunne ikke sendes',
        inviteUrl,
        mailError: mailErr.message,
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/admin/invites/:id — annuller invitation
router.delete('/invites/:id', admin, async (req, res) => {
  try {
    await pool.query('DELETE FROM invites WHERE id = ?', [req.params.id]);
    res.json({ message: 'Invitation annulleret' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/users/:id/reset-password
router.post('/users/:id/reset-password', admin, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    if (targetId === req.userId)
      return res.status(400).json({ error: 'Use change-password to change your own password' });

    const [rows] = await pool.query('SELECT id, name, email FROM users WHERE id = ?', [targetId]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const tempPassword =
      Math.random().toString(36).slice(2, 6).toUpperCase() + '-' +
      Math.random().toString(36).slice(2, 6).toUpperCase();

    const hash = await bcrypt.hash(tempPassword, 12);
    await pool.query(
      'UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?',
      [hash, targetId]
    );

    res.json({ message: `Password reset for ${rows[0].name}`, tempPassword, user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/users/:id/toggle-admin
router.post('/users/:id/toggle-admin', admin, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    if (targetId === req.userId)
      return res.status(400).json({ error: 'Cannot change your own admin status' });

    const [rows] = await pool.query('SELECT is_admin FROM users WHERE id = ?', [targetId]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const newAdmin = rows[0].is_admin ? 0 : 1;
    await pool.query('UPDATE users SET is_admin = ? WHERE id = ?', [newAdmin, targetId]);
    res.json({ isAdmin: !!newAdmin });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', admin, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    if (targetId === req.userId)
      return res.status(400).json({ error: 'Cannot delete your own account' });
    await pool.query('DELETE FROM users WHERE id = ?', [targetId]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
