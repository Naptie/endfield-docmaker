/**
 * Message protocol between the main thread and the Typst worker.
 */

// ── Main → Worker ──────────────────────────────────────────────────────

export interface InitMessage {
  type: 'init';
  /** Raw font data (ArrayBuffers) to load into the compiler. */
  fontData: ArrayBuffer[];
  /** Logo/asset files to map into the VFS. */
  logoMappings: { path: string; data: ArrayBuffer }[];
  /** Whether we're in dev mode. */
  isDev: boolean;
  /** SvelteKit base path. */
  basePath: string;
}

export interface AddSourceMessage {
  type: 'addSource';
  id: number;
  path: string;
  content: string;
}

export interface MapShadowMessage {
  type: 'mapShadow';
  id: number;
  path: string;
  data: ArrayBuffer;
}

export interface UnmapShadowMessage {
  type: 'unmapShadow';
  id: number;
  path: string;
}

export interface PdfMessage {
  type: 'pdf';
  id: number;
}

export type WorkerRequest =
  | InitMessage
  | AddSourceMessage
  | MapShadowMessage
  | UnmapShadowMessage
  | PdfMessage;

// ── Worker → Main ──────────────────────────────────────────────────────

export type LoadingStatus = 'loading_fonts' | 'loading_wasm' | 'loading_templates' | '';

export interface StatusMessage {
  type: 'status';
  status: LoadingStatus;
}

export interface PackageLoadingMessage {
  type: 'packageLoading';
  /** Package display name, or `null` when all downloads completed. */
  name: string | null;
  /** Number of packages downloaded so far (including current). */
  downloaded: number;
}

export interface InitDoneMessage {
  type: 'initDone';
}

export interface InitErrorMessage {
  type: 'initError';
  error: string;
}

export interface ResultMessage {
  type: 'result';
  id: number;
  data?: ArrayBuffer;
}

export interface ErrorMessage {
  type: 'error';
  id: number;
  error: string;
}

export type WorkerResponse =
  | StatusMessage
  | PackageLoadingMessage
  | InitDoneMessage
  | InitErrorMessage
  | ResultMessage
  | ErrorMessage;
