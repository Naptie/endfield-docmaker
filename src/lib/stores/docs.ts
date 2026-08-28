/**
 * IndexedDB-backed document library.
 *
 * Every generated document is autosaved as a library entry containing the form
 * values plus a PNG thumbnail of its first page. Entries are keyed by a stable
 * id so they can be mirrored to Bilibili Toy cloud storage and merged across
 * devices (see `$lib/stores/cloud`).
 */

import { openDB, DOCS_STORE } from './db';

export interface LibraryDoc {
  /** Stable identifier shared between local storage and the cloud mirror. */
  id: string;
  templateId: string;
  /** Human-readable document title (file name without extension). */
  title: string;
  /** Creation timestamp (ms since epoch). */
  createdAt: number;
  /** Last update timestamp (ms since epoch); used for merge ordering. */
  updatedAt: number;
  values: Record<string, unknown>;
  /** PNG raster of the first page; local-only (never synced). */
  thumbnail?: Blob;
}

/** Library entry without the binary thumbnail – the cloud-syncable shape. */
export type LibraryDocMeta = Omit<LibraryDoc, 'thumbnail'>;

export const stripThumbnail = (doc: LibraryDoc): LibraryDocMeta => ({
  id: doc.id,
  templateId: doc.templateId,
  title: doc.title,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
  values: doc.values
});

/** Get all saved documents, most recently updated first. */
export async function getAllDocs(): Promise<LibraryDoc[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOCS_STORE, 'readonly');
    const req = tx.objectStore(DOCS_STORE).getAll();
    req.onsuccess = () =>
      resolve((req.result as LibraryDoc[]).sort((a, b) => b.updatedAt - a.updatedAt));
    req.onerror = () => reject(req.error);
  });
}

export async function getDoc(id: string): Promise<LibraryDoc | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOCS_STORE, 'readonly');
    const req = tx.objectStore(DOCS_STORE).get(id);
    req.onsuccess = () => resolve(req.result as LibraryDoc | undefined);
    req.onerror = () => reject(req.error);
  });
}

/** Add or overwrite a document entry. */
export async function putDoc(doc: LibraryDoc): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOCS_STORE, 'readwrite');
    tx.objectStore(DOCS_STORE).put(doc);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteDoc(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOCS_STORE, 'readwrite');
    tx.objectStore(DOCS_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
