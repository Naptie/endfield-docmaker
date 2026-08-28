/**
 * External document storage for sharing.
 *
 * Multiple providers are tried in order so a share never fails just because
 * one service is rate-limited:
 *   1. Pastebin (needs `VITE_PASTEBIN_DEV_KEY`) – reliable when under its
 *      (low) free-tier daily cap.
 *   2. GitHub Gist (anonymous) – no paste-count cap, only an hourly IP rate
 *      limit; good as a higher-limit alternative.
 *   3. Inline `?d=` payload (no network) – always works.
 *
 * The share flow:
 *   1. Encode the document state as compact JSON (reusing the link codec).
 *   2. POST it to the provider through `px.phi.zone/?url=…` (a CORS proxy –
 *      these services send no CORS headers, so a direct browser fetch is
 *      blocked).
 *   3. Share the Toy-relative path `index.html?p=<pasteKey>` (fits `toy.share`
 *      / `toy.getQrCode`, which only accept Toy-relative paths).
 *   4. Recipients open that path; the app fetches the paste back (again via
 *      the proxy) and rebuilds the document state.
 *
 * Callers fall back to the inline `?d=` payload when every provider fails, so
 * sharing never fully breaks.
 */

import { encodeDocState } from '$lib/utils/link';
import type { DocState } from '$lib/utils/link';

/** User-provided CORS proxy (forwards requests and adds CORS headers). */
const CORS_PROXY = 'https://px.phi.zone/?url=';

/** localStorage key mapping a docId to its last-shared token + content hash. */
const SHARE_CACHE_KEY = 'endfield-doc:share-cache';

/** Pastebin API endpoint + raw base. */
const PASTEBIN_API = 'https://pastebin.com/api/api_post.php';
const PASTEBIN_RAW = 'https://pastebin.com/raw/';

/** GitHub gist API. */
const GIST_API = 'https://api.github.com/gists';

/** Build-time Pastebin developer key (set via `VITE_PASTEBIN_DEV_KEY`). */
const PASTEBIN_DEV_KEY: string = import.meta.env.VITE_PASTEBIN_DEV_KEY ?? '';

/** Build-time GitHub token (set via `VITE_GITHUB_TOKEN`) with `gist` scope. */
const GITHUB_TOKEN: string = import.meta.env.VITE_GITHUB_TOKEN ?? '';

/**
 * True when a Pastebin dev key is configured.
 * Note: Pastebin's free tier is capped at 25 pastes/day, so it's usable but
 * limited.
 */
export const pastebinConfigured = PASTEBIN_DEV_KEY.length > 0;

/**
 * True when a GitHub token is configured.
 * GitHub no longer allows *anonymous* gist creation (401 "Requires
 * authentication"), so gists only work with a PAT carrying the `gist` scope.
 * Gists have no daily paste cap – a much higher free limit than Pastebin.
 */
export const gistConfigured = GITHUB_TOKEN.length > 0;

/**
 * True when any external paste provider is available (Pastebin with a key, or
 * gist with a token). When true, shared paths use the tiny `?p=<key>` form and
 * are never limited by the QR length cap. When false, sharing falls back to
 * the inline `?d=` payload.
 */
export const externalStorageAvailable = pastebinConfigured || gistConfigured;

/** Proxy a request: prepend the CORS proxy to `url` preserving method/body. */
function proxied(url: string, init: RequestInit): Promise<Response> {
  return fetch(`${CORS_PROXY}${encodeURIComponent(url)}`, init);
}

/** Encode a request body as `application/x-www-form-urlencoded`. */
function formUrlencoded(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

/** The stored payload is the base64url document-state string. */
const payloadOf = (state: DocState): string => encodeDocState(state);

// ── Providers ──────────────────────────────────────────────────────────

/**
 * A provider stores a document-state payload and returns a token that can be
 * resolved back to the raw payload later (the paste key / gist id).
 */
interface PasteProvider {
  name: string;
  /** Upload and return the retrieval token, or `null` on failure. */
  put(payload: string, dedupId?: string): Promise<string | null>;
  /** Resolve a token back to the raw payload, or `null` on failure. */
  get(token: string): Promise<string | null>;
}

const pastebin: PasteProvider = {
  name: 'pastebin',
  async put(payload, dedupId) {
    const body = formUrlencoded({
      api_dev_key: PASTEBIN_DEV_KEY,
      api_option: 'paste',
      api_paste_code: payload,
      api_paste_private: '1', // 1 = unlisted
      api_paste_expire_date: '1D',
      // Pastebin's API title field – used as the dedup marker.
      api_paste_name: dedupId ? `endfield-${dedupId}` : 'Endfield Docmaker document'
    });
    const res = await proxied(PASTEBIN_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    if (!res.ok) throw new Error(`Pastebin ${res.status}`);
    const text = (await res.text()).trim();
    const match = text.match(/pastebin\.com\/([A-Za-z0-9]+)/);
    if (!match) throw new Error(`Pastebin unexpected: ${text.slice(0, 80)}`);
    return match[1];
  },
  async get(token) {
    const res = await proxied(`${PASTEBIN_RAW}${token}`, { method: 'GET' });
    if (!res.ok) throw new Error(`Pastebin raw ${res.status}`);
    return (await res.text()).trim();
  }
};

const gist: PasteProvider = {
  name: 'gist',
  async put(payload, dedupId) {
    // Remote dedup: reuse an existing gist whose description carries the same
    // content hash, so unchanged documents never create duplicate gists.
    if (dedupId) {
      const existing = await findGistByDedup(dedupId);
      if (existing) return existing;
    }
    const body = JSON.stringify({
      description: dedupId
        ? `Endfield Docmaker document (${dedupId})`
        : 'Endfield Docmaker document',
      public: false,
      files: { 'doc.txt': { content: payload } }
    });
    const res = await proxied(GIST_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${GITHUB_TOKEN}`
      },
      body
    });
    if (!res.ok) throw new Error(`Gist ${res.status}`);
    const data = (await res.json()) as { id?: string };
    if (!data.id) throw new Error('Gist no id');
    return data.id;
  },
  async get(token) {
    // Fetch via the API (not the raw URL, which 404s for secret gists without
    // a revision hash). The response embeds the file content directly.
    const res = await proxied(`${GIST_API}/${token}`, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${GITHUB_TOKEN}`
      }
    });
    if (!res.ok) throw new Error(`Gist fetch ${res.status}`);
    const data = (await res.json()) as {
      files?: Record<string, { content?: string }>;
    };
    const content = data.files?.['doc.txt']?.content;
    if (!content) throw new Error('Gist content missing');
    return content.trim();
  }
};

/**
 * Providers tried in order; the first that succeeds wins.
 * Gist is preferred when a token is configured (no daily cap); Pastebin is the
 * secondary option when it isn't rate-limited.
 */
const providers: PasteProvider[] = [
  ...(gistConfigured ? [gist] : []),
  ...(pastebinConfigured ? [pastebin] : [])
];

/** FNV-1a hash of the payload, used as a short stable dedup id. */
function hashPayload(payload: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * Look up a gist whose description carries `dedupId` and return its id.
 *
 * The description hash is a 32-bit FNV-1a of the exact stored payload – a
 * strong enough dedup signal for this use case. We trust it directly rather
 * than re-fetching each candidate's content (which added a fragile round-trip
 * that could transiently fail and cause duplicate gists).
 */
async function findGistByDedup(dedupId: string): Promise<string | null> {
  try {
    // List the user's gists (newest first, up to 100). Secret gists are
    // included for the authenticated user.
    const res = await proxied(`${GIST_API}?per_page=100`, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${GITHUB_TOKEN}`
      }
    });
    if (!res.ok) return null;
    const gists = (await res.json()) as Array<{ id: string; description: string | null }>;
    return gists.find((g) => g.description?.includes(dedupId))?.id ?? null;
  } catch {
    /* listing failed – fall through to creating */
    return null;
  }
}

// ── Local share cache ──────────────────────────────────────────────────

interface ShareCacheEntry {
  /** Content hash of the last-shared doc state. */
  hash: string;
  /** Token (paste key / gist id). */
  token: string;
  /** Provider name. */
  provider: string;
}

function readShareCache(): Record<string, ShareCacheEntry> {
  try {
    const raw = localStorage.getItem(SHARE_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ShareCacheEntry>) : {};
  } catch {
    return {};
  }
}

function writeShareCache(cache: Record<string, ShareCacheEntry>) {
  try {
    localStorage.setItem(SHARE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* storage unavailable – cache is best-effort */
  }
}

/**
 * Upload a document state to external storage, avoiding duplicate uploads:
 *
 *  1. Local dedup – if this `docId` was already shared with the identical
 *     content hash this session (or previously), reuse the cached token.
 *  2. Remote dedup – the gist provider embeds the content hash in the gist
 *     description and reuses an existing gist with the same content.
 *
 * Returns `{ token, provider }`, or `null` when every provider fails.
 */
export async function uploadDocState(
  state: DocState
): Promise<{ token: string; provider: string } | null> {
  const payload = payloadOf(state);
  const dedupId = hashPayload(payload);

  // Local dedup: same doc + same content → reuse the previous token.
  const cache = readShareCache();
  const cached = state.docId ? cache[state.docId] : undefined;
  if (cached && cached.hash === dedupId) {
    console.log(`[paste] reusing cached ${cached.provider} token for ${state.docId}`);
    return { token: cached.token, provider: cached.provider };
  }

  for (const p of providers) {
    try {
      const token = await p.put(payload, dedupId);
      if (token) {
        console.log(`[paste] uploaded via ${p.name}`);
        if (state.docId) {
          cache[state.docId] = { hash: dedupId, token, provider: p.name };
          writeShareCache(cache);
        }
        return { token, provider: p.name };
      }
    } catch (e) {
      console.warn(`[paste] ${p.name} failed:`, e instanceof Error ? e.message : e);
    }
  }
  return null;
}

/**
 * Fetch a raw stored payload by token.
 *
 * Pastebin keys and gist ids are short alphanumeric tokens; try each provider
 * until one resolves it.
 */
export async function fetchPaste(token: string): Promise<string | null> {
  for (const p of providers) {
    try {
      const payload = await p.get(token);
      if (payload && payload.length > 0) return payload;
    } catch {
      // try the next provider
    }
  }
  return null;
}
