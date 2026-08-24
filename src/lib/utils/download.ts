/**
 * General-purpose parallel download utility with byte-level progress tracking.
 *
 * Downloads multiple files concurrently using `fetch()` + `ReadableStream`,
 * reporting overall progress (0 → 1) and which files are actively downloading.
 */

/** A single download target. */
export interface DownloadItem {
  /** Human-readable name shown in the UI (e.g. "SIMHEI.TTF"). */
  name: string;
  /** URL to fetch. */
  url: string;
}

/** Progress snapshot emitted during a batch download. */
export interface DownloadProgress {
  /** Overall progress across all files, 0 → 1. */
  progress: number;
  /** Names of files currently being downloaded. */
  activeFiles: string[];
}

/** Resolved data for one download item. */
export interface DownloadResult {
  name: string;
  data: Uint8Array;
}

/**
 * Download multiple files in parallel with progress tracking.
 *
 * @param items     Files to download.
 * @param onProgress Called whenever progress changes (throttled to ≤ 60 fps).
 * @returns Resolved data for every item, in the same order as `items`.
 */
export async function downloadAll(
  items: DownloadItem[],
  onProgress?: (progress: DownloadProgress) => void
): Promise<DownloadResult[]> {
  if (items.length === 0) return [];

  // Per-file tracking
  const loaded = new Array<number>(items.length).fill(0);
  const totals = new Array<number>(items.length).fill(0);
  const active = new Set<string>();
  let totalKnown = 0;

  // Throttle progress callbacks to avoid excessive UI updates
  let rafPending = false;
  const emitProgress = () => {
    if (!onProgress) return;
    if (rafPending) return;
    rafPending = true;
    // Use queueMicrotask if not in a browser (e.g. SSR), otherwise use rAF
    const schedule =
      typeof requestAnimationFrame === 'function' ? requestAnimationFrame : queueMicrotask;
    schedule(() => {
      rafPending = false;
      const totalBytes = totals.reduce((a, b) => a + b, 0);
      const loadedBytes = loaded.reduce((a, b) => a + b, 0);
      const progress =
        totalBytes > 0 ? loadedBytes / totalBytes : Math.min(totalKnown / items.length, 1);
      onProgress({ progress: Math.min(progress, 1), activeFiles: [...active] });
    });
  };

  const downloadOne = async (item: DownloadItem, idx: number): Promise<DownloadResult> => {
    active.add(item.name);
    emitProgress();

    const res = await fetch(item.url);

    const contentLength = Number(res.headers.get('content-length') || 0);
    totals[idx] = contentLength || 0;
    if (contentLength) totalKnown++;

    if (!res.body || !contentLength) {
      // Fallback: no streaming – just read the whole body
      const buf = await res.arrayBuffer();
      const data = new Uint8Array(buf);
      loaded[idx] = data.byteLength;
      totals[idx] = data.byteLength;
      totalKnown++;
      active.delete(item.name);
      emitProgress();
      return { name: item.name, data };
    }

    // Stream read with progress
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      loaded[idx] = received;
      emitProgress();
    }

    // Merge chunks into a single Uint8Array
    const data = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      data.set(chunk, offset);
      offset += chunk.byteLength;
    }

    active.delete(item.name);
    emitProgress();
    return { name: item.name, data };
  };

  const results = await Promise.all(items.map((item, idx) => downloadOne(item, idx)));

  // Final 100% callback
  onProgress?.({ progress: 1, activeFiles: [] });

  return results;
}
