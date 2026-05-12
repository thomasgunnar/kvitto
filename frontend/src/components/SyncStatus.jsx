import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { triggerManualSync } from '../api/offlineDB';

export default function SyncStatus() {
  const { online, queueCount, justSynced } = useOnlineStatus();

  // Intet at vise hvis online og ingen kø
  if (online && queueCount === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 'calc(env(safe-area-inset-top) + 56px)', // under topbar
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 200,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: online ? 'var(--green-bg)' : 'var(--amber-bg)',
      color: online ? 'var(--green)' : 'var(--amber)',
      border: `0.5px solid ${online ? '#b6d98a' : '#e8c99a'}`,
      borderRadius: 99,
      padding: '6px 14px',
      fontSize: 12,
      fontWeight: 500,
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      whiteSpace: 'nowrap',
      cursor: online && queueCount > 0 ? 'pointer' : 'default',
    }}
      onClick={() => online && queueCount > 0 && triggerManualSync()}
      title={online && queueCount > 0 ? 'Klik for at synkronisere nu' : ''}
    >
      {!online && (
        <>
          <span>📵</span>
          <span>
            Offline
            {queueCount > 0 && ` · ${queueCount} udgift${queueCount !== 1 ? 'er' : ''} venter`}
          </span>
        </>
      )}
      {online && queueCount > 0 && (
        <>
          <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>↻</span>
          <span>Synkroniserer {queueCount} udgift{queueCount !== 1 ? 'er' : ''}...</span>
        </>
      )}
    </div>
  );
}
