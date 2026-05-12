const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');

function makeToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, isAdmin: !!user.is_admin },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'name, email and password are required' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0)
      return res.status(409).json({ error: 'Email already in use' });

    // First user ever becomes admin
    const [count] = await pool.query('SELECT COUNT(*) AS cnt FROM users');
    const isAdmin = count[0].cnt === 0 ? 1 : 0;

    const hash = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, is_admin) VALUES (?, ?, ?, ?)',
      [name.trim(), email.toLowerCase().trim(), hash, isAdmin]
    );

    const user = { id: result.insertId, name: name.trim(), email: email.toLowerCase(), is_admin: isAdmin };
    res.status(201).json({ token: makeToken(user), user: { ...user, mustChangePassword: false } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'email and password are required' });

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (rows.length === 0)
      return res.status(401).json({ error: 'Invalid email or password' });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match)
      return res.status(401).json({ error: 'Invalid email or password' });

    res.json({
      token: makeToken(user),
      user: {
        id: user.id, name: user.name, email: user.email,
        isAdmin: !!user.is_admin,
        mustChangePassword: !!user.must_change_password,
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, is_admin, must_change_password, email_notifications, created_at FROM users WHERE id = ?',
      [req.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const u = rows[0];
    res.json({ ...u, isAdmin: !!u.is_admin, mustChangePassword: !!u.must_change_password, emailNotifications: !!u.email_notifications });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/auth/notifications
router.patch('/notifications', authMiddleware, async (req, res) => {
  try {
    const { emailNotifications } = req.body;
    if (typeof emailNotifications !== 'boolean')
      return res.status(400).json({ error: 'emailNotifications (boolean) er paakraeved' });
    await pool.query('UPDATE users SET email_notifications = ? WHERE id = ?', [emailNotifications ? 1 : 0, req.userId]);
    res.json({ emailNotifications });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/change-password — bruger skifter sit eget password
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    if (newPassword.length < 8)
      return res.status(400).json({ error: 'New password must be at least 8 characters' });

    const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.userId]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?',
      [hash, req.userId]
    );
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/forgot-password — anmod om reset-link
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email er påkrævet' });

    const [rows] = await pool.query(
      'SELECT id, name FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    // Svar altid OK — afslør ikke om e-mailen eksisterer
    if (rows.length === 0)
      return res.json({ message: 'Hvis e-mailen findes, er der sendt et link' });

    const user = rows[0];
    const token = require('crypto').randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 time

    // Ugyldiggør tidligere tokens for samme bruger
    await pool.query(
      'UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL',
      [user.id]
    );

    await pool.query(
      'INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)',
      [token, user.id, expiresAt]
    );

    const resetUrl = `${process.env.APP_URL}/reset-password/${token}`;
    const { sendResetEmail } = require('../services/mailer');

    try {
      await sendResetEmail({ to: email, userName: user.name, resetUrl });
    } catch (mailErr) {
      console.error('Reset mail fejl:', mailErr.message);
    }

    res.json({ message: 'Hvis e-mailen findes, er der sendt et link' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/reset-password/:token — valider token
router.get('/reset-password/:token', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT pr.id, u.email FROM password_resets pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.token = ? AND pr.used_at IS NULL AND pr.expires_at > NOW()`,
      [req.params.token]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: 'Linket er ugyldigt eller udløbet' });
    res.json({ email: rows[0].email });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/reset-password/:token — sæt ny adgangskode
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 8)
      return res.status(400).json({ error: 'Adgangskode skal være mindst 8 tegn' });

    const [rows] = await pool.query(
      `SELECT pr.id, pr.user_id FROM password_resets pr
       WHERE pr.token = ? AND pr.used_at IS NULL AND pr.expires_at > NOW()`,
      [req.params.token]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: 'Linket er ugyldigt eller udløbet' });

    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?',
      [hash, rows[0].user_id]
    );
    await pool.query(
      'UPDATE password_resets SET used_at = NOW() WHERE id = ?',
      [rows[0].id]
    );

    res.json({ message: 'Adgangskode opdateret' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/invite/:token — hent invite-info (e-mail til at præudfylde formularen)
router.get('/invite/:token', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT i.email, i.expires_at, u.name AS invited_by_name
       FROM invites i JOIN users u ON u.id = i.invited_by
       WHERE i.token = ? AND i.used_at IS NULL AND i.expires_at > NOW()`,
      [req.params.token]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: 'Invitationen er ugyldig eller udløbet' });
    res.json({ email: rows[0].email, invitedByName: rows[0].invited_by_name });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/invite/:token — acceptér invitation og opret bruger
router.post('/invite/:token', async (req, res) => {
  try {
    const { name, password } = req.body;
    if (!name || !password)
      return res.status(400).json({ error: 'name og password er påkrævet' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Adgangskode skal være mindst 8 tegn' });

    // Hent og valider token
    const [invites] = await pool.query(
      'SELECT * FROM invites WHERE token = ? AND used_at IS NULL AND expires_at > NOW()',
      [req.params.token]
    );
    if (invites.length === 0)
      return res.status(404).json({ error: 'Invitationen er ugyldig eller udløbet' });

    const invite = invites[0];

    // Tjek at e-mailen ikke allerede er i brug
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [invite.email]);
    if (existing.length > 0)
      return res.status(409).json({ error: 'En konto med denne e-mail eksisterer allerede' });

    const hash = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, is_admin) VALUES (?, ?, ?, 0)',
      [name.trim(), invite.email, hash]
    );

    // Markér invitation som brugt
    await pool.query('UPDATE invites SET used_at = NOW() WHERE id = ?', [invite.id]);

    const user = { id: result.insertId, name: name.trim(), email: invite.email, is_admin: 0 };
    res.status(201).json({ token: makeToken(user), user: { ...user, isAdmin: false, mustChangePassword: false } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
