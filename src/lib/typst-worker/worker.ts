/**
 * Web Worker that runs the entire typst.ts instance.
 *
 * All heavy operations (WASM compilation, synchronous package fetching, PDF
 * generation) happen here so the main thread stays responsive.
 */

import rendererWasmUrl from '@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm?url';
import compilerWasmUrl from '@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm?url';
import { FetchPackageRegistry, MemoryAccessModel, $typst as typst } from '@myriaddreamin/typst.ts';
import { TypstSnippet } from '@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs';
import type { WritableAccessModel } from '@myriaddreamin/typst.ts/dist/esm/fs/index.mjs';
import type {
  PackageResolveContext,
  PackageSpec
} from '@myriaddreamin/typst.ts/dist/esm/internal.types.mjs';
import { gzipSync } from 'fflate';

import docTempl from '$lib/assets/typst/official-doc.typ?raw';
import tuzhang from '$lib/assets/typst/tuzhang.typ?raw';

import type {
  WorkerRequest,
  WorkerResponse,
  LoadingStatus,
  InitMessage
} from '$lib/typst-worker/protocol';

// ── Helpers ────────────────────────────────────────────────────────────

const post = (msg: WorkerResponse, transfer?: Transferable[]) =>
  self.postMessage(msg, { transfer: transfer ?? [] });

const setStatus = (status: LoadingStatus) => post({ type: 'status', status });

const isGzipData = (data: Uint8Array): boolean =>
  data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b;

const isTarData = (data: Uint8Array): boolean =>
  data.length >= 262 &&
  data[257] === 0x75 && // u
  data[258] === 0x73 && // s
  data[259] === 0x74 && // t
  data[260] === 0x61 && // a
  data[261] === 0x72; // r

// ── Package registry with status reporting ─────────────────────────────

class WorkerPackageRegistry extends FetchPackageRegistry {
  private basePath: string;
  private downloadCount = 0;

  constructor(am: WritableAccessModel, basePath: string) {
    super(am);
    this.basePath = basePath;
  }

  pullPackageData(path: PackageSpec): Uint8Array | undefined {
    const url = this.resolvePath(path);
    const label = `${path.namespace}/${path.name}:${path.version}`;
    this.downloadCount++;

    // Notify main thread about the download
    post({ type: 'packageLoading', name: label, downloaded: this.downloadCount });

    const request = new XMLHttpRequest();
    request.overrideMimeType('text/plain; charset=x-user-defined');
    request.open('GET', url, false);
    request.send(null);

    // Notify main thread download finished
    post({ type: 'packageLoading', name: null, downloaded: this.downloadCount });

    if (
      request.status === 200 &&
      (request.response instanceof String || typeof request.response === 'string')
    ) {
      return Uint8Array.from(request.response, (char) => char.charCodeAt(0));
    }

    return undefined;
  }

  resolvePath(path: PackageSpec): string {
    switch (path.namespace) {
      case 'preview':
        return `https://packages.typst.org/preview/${path.name}-${path.version}.tar.gz`;
      case 'this':
        return `${this.basePath}/typst/${path.name}-${path.version}.tar.gz`;
      default:
        return super.resolvePath(path);
    }
  }

  resolve(spec: PackageSpec, context: PackageResolveContext): string | undefined {
    if (spec.namespace !== 'preview' && spec.namespace !== 'this') {
      return undefined;
    }

    // Check cache
    const path = this.resolvePath(spec);
    if (this.cache.has(path)) {
      return this.cache.get(path)!();
    }

    // Fetch data
    const data = this.pullPackageData(spec);
    if (!data) {
      return undefined;
    }
    const normalizedData = !isGzipData(data) && isTarData(data) ? gzipSync(data) : data;
    if (!isGzipData(normalizedData)) {
      const firstBytes = Array.from(data.subarray(0, 8))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join(' ');
      throw new Error(
        `Package ${spec.namespace}/${spec.name}:${spec.version} is not gzip data (first bytes: ${firstBytes})`
      );
    }

    // Extract package bundle
    const previewDir = `/@memory/fetch/packages/${spec.namespace}/${spec.name}/${spec.version}`;
    const entries: [string, Uint8Array, Date][] = [];
    context.untar(normalizedData, (entryPath: string, entryData: Uint8Array, mtime: number) => {
      entries.push([previewDir + '/' + entryPath, entryData, new Date(mtime)]);
    });
    const accessModel = this.am;
    const cacheClosure = () => {
      for (const [entryPath, entryData, mtime] of entries) {
        accessModel.insertFile(entryPath, entryData, mtime);
      }
      return previewDir;
    };
    this.cache.set(path, cacheClosure);
    return cacheClosure();
  }
}

// ── WASM fetch helper ──────────────────────────────────────────────────

const fetchGzip = async (url: string): Promise<Response> => {
  const res = await fetch(url);
  const decompressed = res.body!.pipeThrough(new DecompressionStream('gzip'));
  return new Response(decompressed, { headers: { 'Content-Type': 'application/wasm' } });
};

// ── Initialization ─────────────────────────────────────────────────────

async function handleInit(msg: InitMessage) {
  try {
    setStatus('loading_fonts');

    // Create blob URLs from the raw font data
    const blobUrls: string[] = msg.fontData.map((buf) => {
      const blob = new Blob([new Uint8Array(buf)], { type: 'font/woff2' });
      return URL.createObjectURL(blob);
    });

    // Configure WASM modules
    setStatus('loading_wasm');
    const accessModel = new MemoryAccessModel();
    const registry = new WorkerPackageRegistry(accessModel, msg.basePath);

    typst.setCompilerInitOptions({
      getModule: () => (msg.isDev ? compilerWasmUrl : fetchGzip(compilerWasmUrl + '.gz'))
    });
    typst.setRendererInitOptions({
      getModule: () => rendererWasmUrl
    });
    typst.use(
      TypstSnippet.withPackageRegistry(registry),
      TypstSnippet.withAccessModel(accessModel),
      TypstSnippet.disableDefaultFontAssets(),
      TypstSnippet.preloadFonts(blobUrls)
    );

    // Load template files (triggers compiler init)
    setStatus('loading_templates');
    await typst.addSource('/official-doc.typ', docTempl);
    await typst.addSource('/tuzhang.typ', tuzhang);

    // Map pre-processed logo assets into the VFS
    for (const mapping of msg.logoMappings) {
      await typst.mapShadow(mapping.path, new Uint8Array(mapping.data));
    }

    setStatus('');
    post({ type: 'initDone' });
    console.log('Typst worker initialized');
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('Typst worker init error:', e);
    post({ type: 'initError', error });
  }
}

// ── Message handler ────────────────────────────────────────────────────

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;

  switch (msg.type) {
    case 'init':
      await handleInit(msg);
      break;

    case 'addSource':
      try {
        await typst.addSource(msg.path, msg.content);
        post({ type: 'result', id: msg.id });
      } catch (err) {
        post({
          type: 'error',
          id: msg.id,
          error: err instanceof Error ? err.message : String(err)
        });
      }
      break;

    case 'mapShadow':
      try {
        await typst.mapShadow(msg.path, new Uint8Array(msg.data));
        post({ type: 'result', id: msg.id });
      } catch (err) {
        post({
          type: 'error',
          id: msg.id,
          error: err instanceof Error ? err.message : String(err)
        });
      }
      break;

    case 'unmapShadow':
      try {
        await typst.unmapShadow(msg.path);
        post({ type: 'result', id: msg.id });
      } catch (err) {
        post({
          type: 'error',
          id: msg.id,
          error: err instanceof Error ? err.message : String(err)
        });
      }
      break;

    case 'pdf':
      try {
        const data = await typst.pdf();
        if (data) {
          const buffer = data.buffer as ArrayBuffer;
          post({ type: 'result', id: msg.id, data: buffer }, [buffer]);
        } else {
          post({ type: 'result', id: msg.id });
        }
      } catch (err) {
        post({
          type: 'error',
          id: msg.id,
          error: err instanceof Error ? err.message : String(err)
        });
      }
      break;
  }
};
