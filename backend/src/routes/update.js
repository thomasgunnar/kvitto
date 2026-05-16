const router  = require('express').Router();
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { admin } = require('../middleware/auth');
const { log }   = require('../services/activityLog');

const GITHUB_REPO = process.env.GITHUB_REPO || 'dit-brugernavn/kvitto';
const APP_DIR     = process.env.APP_DIR || '/opt/kvitto';

async function getCurrentCommit() {
  try {
    const { stdout } = await execAsync('git rev-parse HEAD', { cwd: APP_DIR });
    return stdout.trim();
  } catch { return null; }
}

async function getLatestCommit() {
  const url = 'https://api.github.com/repos/' + GITHUB_REPO + '/commits/main';
  const res = await fetch(url, { headers: { 'User-Agent': 'Kvitto-App' } });
  if (!res.ok) throw new Error('GitHub API svarede med ' + res.status);
  return res.json();
}

async function getCommitsSince(since) {
  const url = 'https://api.github.com/repos/' + GITHUB_REPO + '/commits?sha=main&per_page=20';
  const res = await fetch(url, { headers: { 'User-Agent': 'Kvitto-App' } });
  if (!res.ok) throw new Error('GitHub API fejl: ' + res.status);
  const commits = await res.json();
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

router.get('/check', admin, async (req, res) => {
  try {
    const [current, latest] = await Promise.all([getCurrentCommit(), getLatestCommit()]);
    if (!current) return res.json({ hasUpdate: false, error: 'Kan ikke finde git commit' });
    const latestSha = latest.sha;
    const hasUpdate = current !== latestSha;
    const newCommits = hasUpdate ? await getCommitsSince(current) : [];
    res.json({
      hasUpdate,
      current: current.slice(0, 7),
      latest: latestSha.slice(0, 7),
      latestMessage: latest.commit.message.split('\n')[0],
      latestDate: latest.commit.author.date,
      newCommits,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/deploy', admin, async (req, res) => {
  res.json({ message: 'Deploy startet' });
  try {
    log(req.userId, 'update', 'system', null, 'deploy startet');
    const { spawn } = require('child_process');
    const nodePath = '/root/.nvm/versions/node/v20.20.2/bin';
    const newPath = nodePath + ':/usr/local/bin:' + (process.env.PATH || '');
    const child = spawn('bash', ['/opt/kvitto-deploy.sh'], {
      detached: true,
      stdio: 'ignore',
      env: Object.assign({}, process.env, { PATH: newPath }),
    });
    child.unref();
    console.log('[Deploy] PID:', child.pid);
  } catch (err) {
    console.error('[Deploy] Fejl:', err.message);
  }
});

router.get('/log', admin, async (req, res) => {
  try {
    const { stdout } = await execAsync('tail -100 /var/log/kvitto/deploy.log 2>/dev/null || echo "Ingen log endnu"');
    res.json({ log: stdout });
  } catch {
    res.json({ log: 'Ingen deploy log fundet' });
  }
});

module.exports = router;
