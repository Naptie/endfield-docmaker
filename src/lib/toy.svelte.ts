/**
 * Bilibili Toy JS SDK integration.
 *
 * The Toy platform hosts pages under `/toy/<slug>/`; when running there we
 * lazily inject the official SDK script and expose a small safe wrapper around
 * `window.toy`. On regular deployments (GitHub Pages / Cloudflare / Vercel)
 * nothing is loaded and every helper degrades gracefully.
 */

import { browser } from '$app/environment';
import { SvelteMap } from 'svelte/reactivity';

const TOY_SDK_URL = 'https://s1.hdslb.com/bfs/seed/toy/app/sdk/toy-sdk.js';

/** Path prefix the Toy platform serves pages under. */
const TOY_PATH_PATTERN = /^\/toy\/[^/]+(?:\/|$)/;

export const toyEnv = $state({ ready: false, available: false });

let initPromise: Promise<boolean> | null = null;

let supportCache: SvelteMap<string, boolean> | null = null;

function loadSdkScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TOY_SDK_URL;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Toy SDK'));
    document.head.appendChild(script);
  });
}

/**
 * Detect the Toy environment and load the SDK when appropriate.
 *
 * Resolves to whether the `window.toy` instance is usable. The `?toy` query
 * flag forces detection outside `/toy/` paths for local development.
 */
export function initToy(): Promise<boolean> {
  if (!browser) return Promise.resolve(false);
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // eslint-disable-next-line svelte/prefer-svelte-reactivity -- read-only probe, not reactive state
      const forced = new URLSearchParams(window.location.search).has('toy');
      const hasGlobal = 'toy' in window;
      if (!TOY_PATH_PATTERN.test(window.location.pathname) && !forced && !hasGlobal) {
        return false;
      }
      if (!hasGlobal) {
        await loadSdkScript();
      }
      supportCache = null;
      return 'toy' in window;
    } catch (e) {
      console.error('Error initializing Toy SDK:', e);
      return false;
    } finally {
      toyEnv.ready = true;
      toyEnv.available = 'toy' in window;
    }
  })();

  return initPromise;
}

/**
 * Check whether the current environment supports a Toy ability.
 *
 * Results are cached per ability; always resolves to `false` outside of the
 * Toy environment or when the probe itself fails.
 */
export async function supportsToy(ability: string): Promise<boolean> {
  if (!toyEnv.available) return false;
  supportCache ??= new SvelteMap<string, boolean>();
  if (!supportCache.has(ability)) {
    supportCache.set(ability, await probeSupport(ability));
  }
  return supportCache.get(ability) ?? false;
}

async function probeSupport(ability: string): Promise<boolean> {
  try {
    return await window.toy.isSupport(ability);
  } catch {
    return false;
  }
}
