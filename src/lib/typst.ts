import rendererWasmUrl from '@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm?url';
import compilerWasmUrl from '@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm?url';
import { FetchPackageRegistry, MemoryAccessModel, $typst as typst } from '@myriaddreamin/typst.ts';
import { TypstSnippet } from '@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs';
import type { WritableAccessModel } from '@myriaddreamin/typst.ts/dist/esm/fs/index.mjs';
import type {
  PackageResolveContext,
  PackageSpec
} from '@myriaddreamin/typst.ts/dist/esm/internal.types.mjs';
import docTempl from '$lib/assets/typst/official-doc.typ?raw';
import tuzhang from '$lib/assets/typst/tuzhang.typ?raw';
import stampEndfieldInds from '$lib/assets/typst/stamp-endfield-industries.png';
import { getAssetData, getFontBlobUrl } from '$lib';
import { base } from '$app/paths';

const fonts: { name: string; url: string }[] = [
  'FZXIAOBIAOSONG-B05.TTF',
  'SIMFANG.TTF',
  'SIMHEI.TTF',
  'SIMKAI.TTF',
  'STSONG.TTF'
].map((name) => ({ name, url: `${base}/fonts/${name}` }));

let isInitialized = false;
let initializationPromise: Promise<void> | null = null;
// let isFontsLoaded = false;
// let fontsLoadPromise: Promise<{ fileName: string; url: string }[]> | null = null;
// let cachedFonts: { fileName: string; url: string }[] = [];

class InjectedRegistry extends FetchPackageRegistry {
  constructor(private am_: WritableAccessModel) {
    super(am_);
  }

  resolvePath(path: PackageSpec): string {
    switch (path.namespace) {
      case 'preview':
        return `https://packages.typst.org/preview/${path.name}-${path.version}.tar.gz`;
      default:
        return super.resolvePath(path);
    }
  }

  resolve(spec: PackageSpec, context: PackageResolveContext): string | undefined {
    if (spec.namespace !== 'preview') {
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

    // Extract package bundle to the underlying access model `this.am`
    const previewDir = `/@memory/fetch/packages/${spec.namespace}/${spec.name}/${spec.version}`;
    const entries: [string, Uint8Array, Date][] = [];
    context.untar(data, (path: string, data: Uint8Array, mtime: number) => {
      entries.push([previewDir + '/' + path, data, new Date(mtime)]);
    });
    const cacheClosure = () => {
      for (const [path, data, mtime] of entries) {
        this.am_.insertFile(path, data, mtime);
      }

      // Return the resolved directory to the package
      // It is then used to access the package data by the access model `this.am`
      return previewDir;
    };
    this.cache.set(path, cacheClosure);

    // Trigger write out
    return cacheClosure();
  }
}

// export const preloadFonts = async (): Promise<{ fileName: string; url: string }[]> => {
//   if (fontsLoadPromise) {
//     return fontsLoadPromise;
//   }

//   if (isFontsLoaded) {
//     return cachedFonts;
//   }

//   fontsLoadPromise = (async () => {
//     try {
//       const loaded = await loadFontsWithCache(fonts);
//       cachedFonts = loaded;
//       isFontsLoaded = true;
//       return loaded;
//     } catch (e) {
//       console.error('Error preloading fonts:', e);
//       fontsLoadPromise = null;
//       throw e;
//     }
//   })();

//   return fontsLoadPromise;
// };

export const initializeTypst = async () => {
  if (initializationPromise) {
    return initializationPromise;
  }

  if (isInitialized) {
    return;
  }

  initializationPromise = (async () => {
    try {
      // Prepare fonts
      //   await preloadFonts();
      const blobUrls = await Promise.all(fonts.map((f) => getFontBlobUrl(f.url)));

      // Init
      const accessModel = new MemoryAccessModel();
      const injectedRegistry = new InjectedRegistry(accessModel);

      // Configure WASM modules before any calls that trigger lazy init
      typst.setCompilerInitOptions({
        getModule: () => compilerWasmUrl
      });
      typst.setRendererInitOptions({
        getModule: () => rendererWasmUrl
      });
      typst.use(
        TypstSnippet.withPackageRegistry(injectedRegistry),
        TypstSnippet.withAccessModel(accessModel),
        TypstSnippet.disableDefaultFontAssets(),
        TypstSnippet.preloadFonts(blobUrls)
      );

      // Load template files and assets (triggers compiler init)
      await typst.addSource('/official-doc.typ', docTempl);
      await typst.addSource('/tuzhang.typ', tuzhang);
      await typst.mapShadow(
        '/stamp-endfield-industries.png',
        await getAssetData(stampEndfieldInds)
      );

      isInitialized = true;
      console.log(`Typst initialized`);
    } catch (e) {
      console.error('Error initializing Typst:', e);
      initializationPromise = null;
      throw e;
    }
  })();

  return initializationPromise;
};

export const waitForTypst = async () => {
  if (isInitialized) return;
  if (initializationPromise) {
    await initializationPromise;
  } else {
    await initializeTypst();
  }
};

export default typst;
