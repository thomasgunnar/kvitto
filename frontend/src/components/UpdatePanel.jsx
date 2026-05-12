import { useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../hooks/useToast';

export default function UpdatePanel() {
  const toast = useToast();
  const [checking, setChecking]   = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [status, setStatus]       = useState(null); // result fra check
  const [showLog, setShowLog]     = useState(false);
  const [deployLog, setDeployLog] = useState('');

  const handleCheck = async () => {
    setChecking(true);
    setStatus(null);
    try {
      const result = await api.checkUpdate();
      setStatus(result);
    } catch (e) { toast(e.message, 'error'); }
    setChecking(false);
  };

  const handleDeploy = async () => {
    if (!confirm('Er du sikker? Serveren genstarter og vil være utilgængelig i ~1 minut.')) return;
    setDeploying(true);
    try {
      await api.deployUpdate();
      toast('Deploy startet — siden genindlæses automatisk om ca. 90 sekunder');
      // Automatisk genindlæs siden efter deploy er færdigt
      setTimeout(() => window.location.reload(), 90000);
    } catch (e) { toast(e.message, 'error'); }
  };

  const handleShowLog = async () => {
    try {
      const { log } = await api.getDeployLog();
      setDeployLog(log);
      setShowLog(true);
    } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header">
        <span className="card-title">🚀 Systemopdatering</span>
        <button className="btn btn-sm" onClick={handleShowLog}>Se deploy-log</button>
      </div>
      <div className="card-body">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: status ? 16 : 0 }}>
          <button className="btn btn-sm btn-primary" onClick={handleCheck} disabled={checking}>
            {checking ? '🔄 Tjekker...' : '🔍 Tjek for opdateringer'}
          </button>
          {status && !status.error && (
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Nuværende version: <code style={{ color: 'var(--purple)' }}>{status.current}</code>
            </span>
          )}
        </div>

        {/* Ingen opdatering */}
        {status && !status.hasUpdate && !status.error && (
          <div style={{ background: 'var(--green-bg)', borderRadius: 'var(--radius-md)',
            padding: '10px 14px', fontSize: 13, color: 'var(--green)' }}>
            ✓ Du kører den seneste version ({status.current})
          </div>
        )}

        {/* Fejl */}
        {status?.error && (
          <div style={{ background: 'var(--red-bg)', borderRadius: 'var(--radius-md)',
            padding: '10px 14px', fontSize: 13, color: 'var(--red)' }}>
            ⚠ {status.error}
          </div>
        )}

        {/* Ny version tilgængelig */}
        {status?.hasUpdate && (
          <div style={{ border: '0.5px solid var(--purple-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <div style={{ background: 'var(--purple-light)', padding: '10px 14px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--purple)' }}>
                  Ny version tilgængelig: {status.latest}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {new Date(status.latestDate).toLocaleDateString('da-DK', {
                    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
                  })}
                </div>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleDeploy}
                disabled={deploying}
                style={{ whiteSpace: 'nowrap' }}
              >
                {deploying ? '⏳ Deployer...' : '⬆ Installer opdatering'}
              </button>
            </div>

            {/* Commit liste */}
            {status.newCommits?.length > 0 && (
              <div style={{ padding: '8px 0' }}>
                {status.newCommits.map(c => (
                  <div key={c.sha} style={{ display: 'flex', gap: 10, padding: '6px 14px',
                    borderBottom: '0.5px solid var(--border)', alignItems: 'flex-start' }}>
                    <code style={{ fontSize: 11, color: 'var(--text-tertiary)',
                      background: 'var(--bg-secondary)', padding: '1px 5px',
                      borderRadius: 4, flexShrink: 0, marginTop: 1 }}>
                      {c.sha}
                    </code>
                    <div style={{ flex: 1, fontSize: 13 }}>{c.message}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                      {c.author}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Deploy log modal */}
      {showLog && (
        <div className="modal-backdrop" onClick={() => setShowLog(false)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-title">Deploy log</span>
              <button className="modal-close" onClick={() => setShowLog(false)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: 0 }}>
              <pre style={{
                background: '#1a1a18', color: '#e8e6de',
                padding: '16px', margin: 0, fontSize: 11,
                fontFamily: 'Courier New, monospace', lineHeight: 1.6,
                maxHeight: '60vh', overflowY: 'auto',
                whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              }}>
                {deployLog || 'Ingen log endnu'}
              </pre>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setShowLog(false)}>Luk</button>
              <button className="btn btn-sm" onClick={handleShowLog}>🔄 Opdater</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
