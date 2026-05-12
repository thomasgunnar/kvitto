import { useState, useEffect } from 'react';
import { getQueueCount, onSyncSuccess, removeLocalExpense, triggerManualSync } from '../api/offlineDB';

export function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  const [justSynced, setJustSynced] = useState(0);

  const refreshQueue = async () => {
    const count = await getQueueCount();
    setQueueCount(count);
  };

  useEffect(() => {
    refreshQueue();

    const onOnline = async () => {
      setOnline(true);
      // Trigger sync når vi kommer online
      triggerManualSync();
    };
    const onOffline = () => setOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // Lyt på sync-success fra service worker
    const unsub = onSyncSuccess(async (data) => {
      await removeLocalExpense(data.item.localId);
      setJustSynced(n => n + 1);
      refreshQueue();
    });

    // Tjek kø hvert 30 sek
    const interval = setInterval(refreshQueue, 30000);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      unsub();
      clearInterval(interval);
    };
  }, []);

  return { online, queueCount, justSynced, refreshQueue };
}
