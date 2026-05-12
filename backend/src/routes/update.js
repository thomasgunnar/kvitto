const router  = require('express').Router();
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { admin } = require('../middleware/auth');
const { log }   = require('../services/activityLog');

const GITHUB_REPO = process.env.GITHUB_REPO || 'dit-brugernavn/kvitto';
const APP_DIR     = process.env.APP_DIR || '/opt/kvitto';

// Hent nuværende commit hash
async function getCurrentCommit() {
  try {
    const { stdout } = await execAsync('git rev-parse HEAD', { cwd: APP_DIR });
    return stdout.trim();
  } catch {
    return null;
  }
}

// Hent seneste commit fra GitHub API (ingen auth nødvendig for public repo)
async function getLatestCommit() {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/commits/main`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Kvitto-App' }
  });
  if (!res.ok) throw new Error(`GitHub API svarede med ${res.status}`);
  return res.json();
}

// Hent commits siden nuværende version
async function getCommitsSince(since) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/commits?sha=main&per_page=20`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Kvitto-App' } });
  if (!res.ok) throw new Error(`GitHub API fejl: ${res.status}`);
  const commits = await res.json();

  // Returner commits indtil vi rammer nuværende version
  const result = [];
  for (const c of commits) {
    if (c.sha === since) break;
    result.push({
      sha: c.sha.slice(0, 7),
      message: c.commit.message.split('\n')[0],
      author: c.commit.author.name,
      date: c.commit.author.date,
    });
  }
  return result;
}

// GET /api/admin/update/check — tjek for opdateringer
router.get('/check', admin, async (req, res) => {
  try {
    const [current, latest] = await Promise.all([
      getCurrentCommit(),
      getLatestCommit(),
    ]);

    if (!current) {
      return res.json({
        hasUpdate: false,
        error: 'Kan ikke finde git commit — er appen installeret via git?',
      });
    }

    const latestSha  = latest.sha;
    const hasUpdate  = current !== latestSha;

    let newCommits = [];
    if (hasUpdate) {
      newCommits = await getCommitsSince(current);
    }

    res.json({
      hasUpdate,
      current: current.slice(0, 7),
      latest: latestSha.slice(0, 7),
      latestMessage: latest.commit.message.split('\n')[0],
      latestDate: latest.commit.author.date,
      newCommits,
    });
  } catch (err) {
    console.error('Update check fejl:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/update/deploy — kør deploy
router.post('/deploy', admin, async (req, res) => {
  // Svar med det samme — deploy kører i baggrunden
  res.json({ message: 'Deploy startet — tjek log for status' });

  try {
    log(req.userId, 'update', 'system', null, 'deploy startet');
    const { stdout, stderr } = await execAsync(`bash ${APP_DIR}/deploy.sh`, {
      cwd: APP_DIR,
      timeout: 300000, // 5 minutter max
      env: { ...process.env, PATH: `/usr/local/bin:${process.env.PATH}` },
    });
    console.log('[Deploy] Output:', stdout);
    if (stderr) console.warn('[Deploy] Stderr:', stderr);
    log(req.userId, 'update', 'system', null, 'deploy færdig');
  } catch (err) {
    console.error('[Deploy] Fejl:', err.message);
    log(req.userId, 'update', 'system', null, 'deploy fejlede: ' + err.message);
  }
});

// GET /api/admin/update/log — hent deploy log
router.get('/log', admin, async (req, res) => {
  try {
    const { stdout } = await execAsync(`tail -100 /var/log/kvitto/deploy.log 2>/dev/null || echo "Ingen log endnu"`);
    res.json({ log: stdout });
  } catch {
    res.json({ log: 'Ingen deploy log fundet' });
  }
});

module.exports = router;
