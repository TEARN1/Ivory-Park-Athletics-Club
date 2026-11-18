/**
 * IndexedDB dual-layer persistent storage engine for Ivory Park Athletics Club.
 * Provides offline-resilient storage for GPS breadcrumbs, lap splits, and session recovery
 * that survives browser memory pressure and device restarts.
 */

const DB_NAME = "ipac_offline_store";
const DB_VERSION = 1;
const STORE_SESSIONS = "cached_sessions";
const STORE_BREADCRUMBS = "gps_breadcrumbs";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_BREADCRUMBS)) {
        db.createObjectStore(STORE_BREADCRUMBS, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSaveBreadcrumbs(sessionId: string, points: { lat: number; lon: number; t: number }[]): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_BREADCRUMBS, "readwrite");
    const store = tx.objectStore(STORE_BREADCRUMBS);
    store.put({ id: sessionId, points, updatedAt: Date.now() });
  } catch {}
}

export async function idbGetBreadcrumbs(sessionId: string): Promise<{ lat: number; lon: number; t: number }[] | null> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_BREADCRUMBS, "readonly");
      const store = tx.objectStore(STORE_BREADCRUMBS);
      const req = store.get(sessionId);
      req.onsuccess = () => resolve(req.result ? req.result.points : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}
