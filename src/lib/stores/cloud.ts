/**
 * Bilibili Toy cloud storage mirror for the document library.
 *
 * Document metadata (values without thumbnails) is deflated, base64url-encoded
 * and split into chunks under `lib-<docId>-<chunk>` keys so each value stays
 * below the platform's 1 KB limit. Thumbnails never leave the device.
 *
 * Every function is a no-op-safe outside of the Toy environment: they resolve
 * immediately when the SDK is unavailable and reject with the original error
 * otherwise, letting call sites decide how to handle failures.
 */

import { deflateSync, inflateSync } from 'fflate';
import { base64UrlToBytes, bytesToBase64Url } from '$lib/utils/base64';
import type { LibraryDocMeta } from './docs';

/** Cloud key prefix – kept within the platform's `[a-zA-Z0-9_-]` key rules. */
const KEY_PREFIX = 'lib-';

/** Maximum characters per chunked value; safely below the 1024-byte limit. */
const CHUNK_SIZE = 900;

interface CloudDocPayload {
  i: string;
  t: string;
  c: number;
  u: number;
  l: string;
  v: Record<string, unknown>;
}

// ── codec ──────────────────────────────────────────────────────────────

function encodeDoc(meta: LibraryDocMeta): string[] {
  const payload: CloudDocPayload = {
    i: meta.id,
    t: meta.templateId,
    c: meta.createdAt,
    u: meta.updatedAt,
    l: meta.title,
    v: meta.values
  };
  const encoded = bytesToBase64Url(deflateSync(new TextEncoder().encode(JSON.stringify(payload))));
  const chunks: string[] = [];
  for (let i = 0; i < encoded.length; i += CHUNK_SIZE) {
    chunks.push(encoded.slice(i, i + CHUNK_SIZE));
  }
  return chunks;
}

function decodeDoc(chunks: string[]): LibraryDocMeta | null {
  try {
    const decoded = inflateSync(base64UrlToBytes(chunks.join('')));
    const payload = JSON.parse(new TextDecoder().decode(decoded)) as CloudDocPayload;
    if (!payload.i || !payload.t || typeof payload.v !== 'object') return null;
    return {
      id: payload.i,
      templateId: payload.t,
      createdAt: payload.c,
      updatedAt: payload.u,
      title: payload.l,
      values: payload.v
    };
  } catch {
    // Partial or corrupted writes are dropped instead of failing the whole pull.
    return null;
  }
}

const chunkKey = (id: string, index: number) => `${KEY_PREFIX}${id}-${index}`;

const knownChunkCounts = new Map<string, number>();

// ── public API ─────────────────────────────────────────────────────────

/**
 * Latched once the SDK reports cloud storage is unusable for this context
 * (e.g. Bilibili's `?preview=1` sandbox has no real toy id) so we stop
 * retrying on every autosave.
 */
let cloudUnavailable = false;

function noteCloudError(e: unknown): void {
  const message = e instanceof Error ? e.message : String(e);
  if (/not available|handshake/i.test(message)) {
    cloudUnavailable = true;
    console.warn('Toy cloud storage unavailable in this context; sync disabled.');
  }
}

/** Mirror a document entry to Toy cloud storage (upsert, chunked). */
export async function pushDocToCloud(meta: LibraryDocMeta): Promise<void> {
  if (cloudUnavailable || !('toy' in window)) return;

  try {
    await pushDocToCloudInner(meta);
  } catch (e) {
    noteCloudError(e);
    if (!cloudUnavailable) throw e;
  }
}

async function pushDocToCloudInner(meta: LibraryDocMeta): Promise<void> {
  const chunks = encodeDoc(meta);
  const items: Record<string, string> = {};
  chunks.forEach((chunk, i) => {
    items[chunkKey(meta.id, i)] = chunk;
  });

  // Drop now-unused tail chunks from a previous, larger version of the entry.
  const prevCount = knownChunkCounts.get(meta.id) ?? 0;
  const staleKeys: string[] = [];
  for (let i = chunks.length; i < prevCount; i++) {
    staleKeys.push(chunkKey(meta.id, i));
  }
  if (staleKeys.length > 0) {
    await window.toy.removeCloudStorage(staleKeys);
  }

  await window.toy.setCloudStorage(items);
  knownChunkCounts.set(meta.id, chunks.length);
}

/** Read every mirrored document entry from Toy cloud storage. */
export async function pullDocsFromCloud(): Promise<LibraryDocMeta[]> {
  if (cloudUnavailable || !('toy' in window)) return [];

  try {
    return await pullDocsFromCloudInner();
  } catch (e) {
    noteCloudError(e);
    if (!cloudUnavailable) throw e;
    return [];
  }
}

async function pullDocsFromCloudInner(): Promise<LibraryDocMeta[]> {
  const stored = await window.toy.getCloudStorage();
  const grouped = new Map<string, Map<number, string>>();
  for (const [key, value] of Object.entries(stored)) {
    if (!key.startsWith(KEY_PREFIX)) continue;
    const rest = key.slice(KEY_PREFIX.length);
    const sep = rest.lastIndexOf('-');
    if (sep <= 0) continue;
    const id = rest.slice(0, sep);
    const index = Number(rest.slice(sep + 1));
    if (!Number.isInteger(index)) continue;
    let chunks = grouped.get(id);
    if (!chunks) {
      chunks = new Map<number, string>();
      grouped.set(id, chunks);
    }
    chunks.set(index, value);
  }

  const docs: LibraryDocMeta[] = [];
  for (const [id, chunks] of grouped) {
    const ordered = [...chunks.keys()].sort((a, b) => a - b).map((i) => chunks.get(i)!);
    const doc = decodeDoc(ordered);
    if (doc) {
      docs.push(doc);
      knownChunkCounts.set(id, ordered.length);
    }
  }
  return docs;
}

/** Remove a document's mirror from Toy cloud storage. */
export async function deleteDocFromCloud(id: string): Promise<void> {
  if (cloudUnavailable || !('toy' in window)) return;
  const count = knownChunkCounts.get(id);
  if (!count) return; // Never mirrored in this session – nothing to clean up.
  try {
    await window.toy.removeCloudStorage([...Array(count).keys()].map((i) => chunkKey(id, i)));
  } catch (e) {
    noteCloudError(e);
    if (!cloudUnavailable) throw e;
  }
  knownChunkCounts.delete(id);
}
