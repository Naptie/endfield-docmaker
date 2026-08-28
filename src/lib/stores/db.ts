/**
 * Shared IndexedDB instance for the application.
 *
 * Stores:
 *  - `files`: per-template user assets (images, etc.)
 *  - `fonts`: cached font blobs for Typst
 *  - `docs`: saved document library entries (values + thumbnail)
 */

const DB_NAME = 'endfield-docmaker';
const DB_VERSION = 3;
export const FILES_STORE = 'files';
export const FONTS_STORE = 'fonts';
export const DOCS_STORE = 'docs';

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(FILES_STORE)) {
        const store = db.createObjectStore(FILES_STORE, { keyPath: 'id' });
        store.createIndex('templateId', 'templateId', { unique: false });
      }
      if (!db.objectStoreNames.contains(FONTS_STORE)) {
        db.createObjectStore(FONTS_STORE, { keyPath: 'name' });
      }
      if (!db.objectStoreNames.contains(DOCS_STORE)) {
        const store = db.createObjectStore(DOCS_STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

/** Clear all data from every IndexedDB store. */
export async function clearAllStores(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction([FILES_STORE, FONTS_STORE, DOCS_STORE], 'readwrite');
  tx.objectStore(FILES_STORE).clear();
  tx.objectStore(FONTS_STORE).clear();
  tx.objectStore(DOCS_STORE).clear();
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
