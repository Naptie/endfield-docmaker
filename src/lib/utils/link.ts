/**
 * Document state ⇄ share-link codec.
 *
 * The current template and form values are deflated into a compact base64url
 * payload carried in the `d` query parameter. On Bilibili Toy the payload is
 * passed to `share`/`getQrCode` as a Toy-relative path; elsewhere it is merged
 * into the current page URL so any QR scanner lands on a pre-filled editor.
 */

import { deflateSync, inflateSync } from 'fflate';
import { base64UrlToBytes, bytesToBase64Url } from '$lib/utils/base64';
import { TEMPLATES } from '$lib/templates';

const PARAM = 'd';

/**
 * Maximum encoded link length for reliable on-screen QR scanning.
 * Roughly matches the byte capacity of a version-20 code at ECC level M.
 */
export const MAX_QR_URL_LENGTH = 1500;

export interface DocState {
  docId?: string;
  templateId: string;
  values: Record<string, unknown>;
}

interface PackedState {
  /** Document id (optional – anonymous links create fresh entries). */
  i?: string;
  t: string;
  v: Record<string, unknown>;
}

/** Encode document state into the URL payload string. */
export function encodeDocState(state: DocState): string {
  const packed: PackedState = { i: state.docId, t: state.templateId, v: state.values };
  const bytes = deflateSync(new TextEncoder().encode(JSON.stringify(packed)), { level: 9 });
  return bytesToBase64Url(bytes);
}

/** Decode a URL payload back into document state; returns `null` when invalid. */
export function decodeDocState(payload: string): DocState | null {
  try {
    const bytes = inflateSync(base64UrlToBytes(payload));
    const packed = JSON.parse(new TextDecoder().decode(bytes)) as PackedState;
    if (!packed.t || !TEMPLATES.some((t) => t.id === packed.t)) return null;
    if (typeof packed.v !== 'object' || packed.v === null) return null;
    return { docId: packed.i, templateId: packed.t, values: packed.v };
  } catch {
    return null;
  }
}

/**
 * Build the full state-carrying URL for the current page (inline payload).
 * Returns `null` when the URL exceeds {@link MAX_QR_URL_LENGTH}.
 */
export function buildShareUrl(state: DocState): string | null {
  const url = new URL(window.location.href);
  url.searchParams.set(PARAM, encodeDocState(state));
  url.hash = '';
  return url.toString().length <= MAX_QR_URL_LENGTH ? url.toString() : null;
}

/**
 * Build the Toy-root-relative path for `toy.share` / `toy.getQrCode`, carrying
 * either an inline payload (`?d=…`) or a Pastebin paste key (`?p=…`).
 *
 * The paste-key form is preferred when external storage is available – the URL
 * stays tiny regardless of document size, with no base64 bloat.
 * Returns `null` when the path exceeds {@link MAX_QR_URL_LENGTH}.
 */
export function buildToyPath(state: DocState, pasteKey?: string): string | null {
  const path = pasteKey
    ? `index.html?p=${pasteKey}`
    : `index.html?${PARAM}=${encodeDocState(state)}`;
  return path.length <= MAX_QR_URL_LENGTH ? path : null;
}

/**
 * Resolve a Toy-relative path into an absolute share URL.
 * Mirrors how the platform resolves `toy.share` / `toy.getQrCode` paths.
 */
export function resolveToyPath(path: string): string {
  const base = window.location.origin + window.location.pathname.replace(/index\.html$/, '');
  return new URL(path, base.endsWith('/') ? base : base + '/').toString();
}
