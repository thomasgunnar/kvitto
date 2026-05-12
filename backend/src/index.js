require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const { testConnection }   = require('./db');
const { startCurrencyCron } = require('./services/currency');
const { startRecurringCron } = require('./services/recurring');
const { verifySmtp }       = require('./services/mailer');
const authMiddleware       = require('./middleware/auth');

const app = express();

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── RECEIPTS ──────────────────────────────────────────────────────────────────
// Støtter Authorization-header (fetch) OG ?token= query param (<img src>)
const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');

app.get('/api/receipts/:filename', (req, res, next) => {
  if (req.query.token && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}, authMiddleware, (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(uploadDir, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.sendFile(filePath);
});

// ── ROUTES ────────────────────────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/expenses',   require('./routes/expenses'));
app.use('/api/reports',    require('./routes/reports'));
app.use('/api/currencies', require('./routes/currencies'));
app.use('/api/pdf',        require('./routes/pdf'));
app.use('/api/admin',      require('./routes/admin'));
app.use('/api/recurring',  require('./routes/recurring'));
app.use('/api/activity',   require('./routes/activity'));
app.use('/api/export',     require('./routes/export'));
app.use('/api/admin/update', require('./routes/update'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ── FRONTEND (production) ─────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ── ERROR HANDLER ─────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `File too large. Max ${process.env.MAX_FILE_SIZE_MB || 10}MB` });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── START ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT) || 3001;

async function start() {
  await testConnection();
  startCurrencyCron();
  startRecurringCron();
  verifySmtp();
  app.listen(PORT, () => {
    console.log(`✓ Kvitto API running on port ${PORT}`);
    console.log(`  Health: http://localhost:${PORT}/api/health`);
  });
}

start().catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});
