// ============================================================
//  offlineDB.js — IndexedDB wrapper til offline udgiftskø
// ============================================================

const DB_NAME = 'kvitto-offline';
const DB_VERSION = 1;
const STORE_QUEUE = 'sync-queue';
const STORE_CACHE = 'expense-cache';
const SYNC_TAG = 'kvitto-sync-expenses';

let _db = null;

async function getDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        db.createObjectStore(STORE_CACHE, { keyPath: 'localId' });
      }
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function txPut(db, store, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txGetAll(db, store) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDelete(db, store, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── PUBLIC API ───────────────────────────────────────────────

/**
 * Tilføj en udgift til offline-køen.
 * fields: alle formularfelter (description, amount, currency, ...)
 * receiptFile: File-objekt eller null
 * token: JWT-token til brug ved sync
 */
export async function enqueueExpense(fields, receiptFile, token) {
  const db = await getDB();
  const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  let receiptBlob = null;
  let receiptName = null;

  if (receiptFile) {
    receiptBlob = receiptFile; // File er en Blob
    receiptName = receiptFile.name;
  }

  const item = {
    localId,
    fields,
    receiptBlob,
    receiptName,
    token,
    createdAt: Date.now(),
  };

  // Gem i kø
  await txPut(db, STORE_QUEUE, item);

  // Gem også i lokal cache så brugeren kan se den med det samme
  await txPut(db, STORE_CACHE, {
    localId,
    ...fields,
    amount_dkk: fields.amount_dkk || fields.amount, // estimat
    status: 'draft',
    receipt_path: receiptBlob ? `__local__${localId}` : null,
    _offline: true,
    _receiptObjectURL: receiptFile ? URL.createObjectURL(receiptFile) : null,
    createdAt: Date.now(),
  });

  // Forsøg Background Sync (virker i Chrome/Android)
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const reg = await navigator.serviceWorker.ready;
    await reg.sync.register(SYNC_TAG).catch(() => {});
  } else {
    // iOS fallback — prøv at sende direkte hvis online
    triggerManualSync();
  }

  return localId;
}

/**
 * Hent alle lokalt gemte (endnu ikke synkede) udgifter
 */
export async function getLocalExpenses() {
  const db = await getDB();
  return txGetAll(db, STORE_CACHE);
}

/**
 * Hent antal poster i sync-køen
 */
export async function getQueueCount() {
  const db = await getDB();
  const items = await txGetAll(db, STORE_QUEUE);
  return items.length;
}

/**
 * Fjern en lokal udgift fra cachen (når serveren bekræfter sync)
 */
export async function removeLocalExpense(localId) {
  const db = await getDB();
  await txDelete(db, STORE_CACHE, localId);
}

/**
 * Manuel sync-trigger — bruges på iOS hvor Background Sync ikke virker
 */
export function triggerManualSync() {
  if (!navigator.serviceWorker?.controller) return;
  navigator.serviceWorker.controller.postMessage({ type: 'TRIGGER_SYNC' });
}

/**
 * Lyt på sync-success beskeder fra service workeren
 */
export function onSyncSuccess(callback) {
  if (!('serviceWorker' in navigator)) return () => {};
  const handler = e => {
    if (e.data?.type === 'SYNC_SUCCESS') callback(e.data);
  };
  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
}

/**
 * Er vi online?
 */
export function isOnline() {
  return navigator.onLine;
}
