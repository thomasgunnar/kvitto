// ============================================================
//  Kvitto Service Worker — v2
//  - App shell caching
//  - Background Sync for offline expense queue
// ============================================================

const CACHE = 'kvitto-v2';
const SYNC_TAG = 'kvitto-sync-expenses';
const DB_NAME = 'kvitto-offline';
const DB_VERSION = 1;
const STORE_QUEUE = 'sync-queue';

// ── INSTALL ──────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(['/', '/dashboard', '/manifest.json']))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) {
    e.respondWith(fetch(e.request));
    return;
  }
  // Cache-first for app shell
  e.respondWith(
    caches.match(e.request).then(cached => {
      const net = fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});

// ── INDEXEDDB HELPER ─────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllFromStore(db, store) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function deleteFromStore(db, store, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── BACKGROUND SYNC ──────────────────────────────────────────
self.addEventListener('sync', e => {
  if (e.tag === SYNC_TAG) {
    e.waitUntil(processSyncQueue());
  }
});

async function processSyncQueue() {
  const db = await openDB();
  const items = await getAllFromStore(db, STORE_QUEUE);

  for (const item of items) {
    try {
      await sendToServer(item);
      await deleteFromStore(db, STORE_QUEUE, item.id);
      // Notify open clients
      const clients = await self.clients.matchAll();
      clients.forEach(c => c.postMessage({
        type: 'SYNC_SUCCESS',
        expenseId: item.localId,
        item,
      }));
    } catch (err) {
      console.error('[SW] Sync failed for item', item.id, err);
      // Leave in queue — will retry on next sync
    }
  }
}

async function sendToServer(item) {
  const token = item.token;

  // Build FormData from stored fields
  const fd = new FormData();
  Object.entries(item.fields).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') fd.append(k, v);
  });

  // Re-attach receipt blob if present
  if (item.receiptBlob && item.receiptBlob.size > 0) {
    fd.append('receipt', item.receiptBlob, item.receiptName || 'receipt.jpg');
  }

  const res = await fetch('/api/expenses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── MESSAGE — manual sync trigger (iOS fallback) ──────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'TRIGGER_SYNC') {
    processSyncQueue().then(() => {
      e.source?.postMessage({ type: 'SYNC_DONE' });
    });
  }
});
