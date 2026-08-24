/**
 * IndexedDB-backed font cache.
 *
 * Stores font blobs keyed by file name with a version tag so the cache
 * can be invalidated when the bundled fonts change.
 */

import { openDB, FONTS_STORE } from './db';

export interface CachedFont {
  /** Font file name (e.g. "SIMHEI.TTF") */
  name: string;
  /** Blob URL data */
  data: Uint8Array;
  /** Version tag used for invalidation */
  version: string;
  /** Whether this is a user-added custom font */
  custom?: boolean;
}

/** Get all cached fonts. */
export async function getAllFonts(): Promise<CachedFont[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FONTS_STORE, 'readonly');
    const req = tx.objectStore(FONTS_STORE).getAll();
    req.onsuccess = () => resolve(req.result as CachedFont[]);
    req.onerror = () => reject(req.error);
  });
}

/** Get a single cached font by name. */
export async function getCachedFont(name: string): Promise<CachedFont | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FONTS_STORE, 'readonly');
    const req = tx.objectStore(FONTS_STORE).get(name);
    req.onsuccess = () => resolve(req.result as CachedFont | undefined);
    req.onerror = () => reject(req.error);
  });
}

/** Store a font in the cache. */
export async function putFont(font: CachedFont): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FONTS_STORE, 'readwrite');
    const req = tx.objectStore(FONTS_STORE).put(font);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Remove a font from the cache. */
export async function removeFont(name: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FONTS_STORE, 'readwrite');
    const req = tx.objectStore(FONTS_STORE).delete(name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Clear all cached fonts. */
export async function clearFontCache(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FONTS_STORE, 'readwrite');
    tx.objectStore(FONTS_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Load fonts with IndexedDB caching. Downloads uncached fonts in parallel
 * with progress tracking, then caches them for next time.
 *
 * @param fonts    Font descriptors (name + URL).
 * @param version  Cache version tag – when it changes the cache is invalidated.
 * @param onProgress Optional callback receiving download progress updates.
 * @returns Blob URLs for every font, in the same order as `fonts`.
 */
export async function loadFontsWithCache(
  fonts: { name: string; url: string }[],
  version: string,
  onProgress?: (progress: import('$lib/utils/download').DownloadProgress) => void
): Promise<string[]> {
  // 1. Check cache for each font
  const cached = await Promise.all(fonts.map((f) => getCachedFont(f.name)));
  const results: (Uint8Array | null)[] = cached.map((c) =>
    c && c.version === version ? c.data : null
  );

  // 2. Determine which fonts need downloading
  const toDownload: { name: string; url: string; idx: number }[] = [];
  for (let i = 0; i < fonts.length; i++) {
    if (!results[i]) {
      toDownload.push({ ...fonts[i], idx: i });
    }
  }

  // 3. Download uncached fonts in parallel with progress
  if (toDownload.length > 0) {
    const { downloadAll } = await import('$lib/utils/download');
    const downloaded = await downloadAll(
      toDownload.map((f) => ({ name: f.name, url: f.url })),
      onProgress
    );

    // Store downloaded fonts into results & cache
    await Promise.all(
      downloaded.map(async (dl, i) => {
        const idx = toDownload[i].idx;
        results[idx] = dl.data;
        await putFont({ name: dl.name, data: dl.data, version });
      })
    );
  } else {
    // All fonts were cached – report instant completion
    onProgress?.({ progress: 1, activeFiles: [] });
  }

  // 4. Create blob URLs
  return results.map((data) => {
    const blob = new Blob([new Uint8Array(data!)], { type: 'font/woff2' });
    return URL.createObjectURL(blob);
  });
}
