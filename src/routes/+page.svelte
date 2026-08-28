<script lang="ts">
  /* eslint-disable svelte/no-at-html-tags */
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import endfieldLogoEn from '$lib/assets/endfield-en.svg?raw';
  import endfieldLogoZh from '$lib/assets/endfield-zh.svg?raw';
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Spinner } from '$lib/components/ui/spinner';
  import { Separator } from '$lib/components/ui/separator';
  import * as Tabs from '$lib/components/ui/tabs';
  import { pick, randomId, triggerDownload } from '$lib/utils';
  import { onMount } from 'svelte';
  import typst, {
    loadingState,
    packageLoadingState,
    downloadProgress,
    waitForTypst
  } from '$lib/typst.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import DynamicForm from '$lib/components/DynamicForm.svelte';
  import CompileError from '$lib/components/CompileError.svelte';
  import DocLibrary from '$lib/components/DocLibrary.svelte';
  import ShareQrModal from '$lib/components/ShareQrModal.svelte';
  import PageImageViewer from '$lib/components/PageImageViewer.svelte';
  import * as Dialog from '$lib/components/ui/dialog';
  import LinkSimpleIcon from 'phosphor-svelte/lib/LinkSimpleIcon';
  import FolderOpenIcon from 'phosphor-svelte/lib/FolderOpenIcon';
  import ImageSquareIcon from 'phosphor-svelte/lib/ImageSquareIcon';
  import QrCodeIcon from 'phosphor-svelte/lib/QrCodeIcon';
  import ArrowClockwiseIcon from 'phosphor-svelte/lib/ArrowClockwiseIcon';
  import ArrowSquareOutIcon from 'phosphor-svelte/lib/ArrowSquareOutIcon';
  import DownloadSimpleIcon from 'phosphor-svelte/lib/DownloadSimpleIcon';
  import ShareNetworkIcon from 'phosphor-svelte/lib/ShareNetworkIcon';
  import { TEMPLATES, getTemplate } from '$lib/templates';
  import {
    getAllDocs,
    getDoc,
    putDoc,
    deleteDoc as removeDocFromLibrary,
    stripThumbnail,
    type LibraryDoc
  } from '$lib/stores/docs';
  import { pushDocToCloud, pullDocsFromCloud, deleteDocFromCloud } from '$lib/stores/cloud';
  import { initToy, supportsToy, toyEnv } from '$lib/toy.svelte';
  import {
    decodeDocState,
    buildToyPath,
    buildShareUrl,
    resolveToyPath,
    type DocState
  } from '$lib/utils/link';
  import { uploadDocState, fetchPaste, externalStorageAvailable } from '$lib/utils/paste';
  import { renderPdfPages } from '$lib/utils/render';
  import { scopeTypstSvg } from '$lib/utils/svg';
  import { bytesToBase64Url } from '$lib/utils/base64';

  let isReady = $state(false);
  let isGenerating = $state(false);
  let canDownload = $state(false);
  let canShare = $state(false);
  let isSavingImage = $state(false);
  /** True when the Bilibili App can save images to the album. */
  let canSaveToAlbum = $state(false);

  /**
   * Whether the environment can display PDFs inline (`<object type="pdf">`).
   * Mobile webviews (e.g. inside the Bilibili app) typically cannot – in that
   * case the preview falls back to rasterized page images. `?nopdf` forces
   * the fallback locally for testing.
   */
  const pdfInlineSupported = $derived.by(() => {
    if (typeof navigator === 'undefined') return true;
    if (new URLSearchParams(window.location.search).has('nopdf')) return false;
    if ('pdfViewerEnabled' in navigator) return navigator.pdfViewerEnabled === true;
    return true;
  });

  /** Raster scale (px per pt) for library thumbnails – ~446 px wide A4. */
  const THUMBNAIL_PPP = 0.75;

  // Vector preview of the whole document (all pages, stacked vertically).
  // `typst.svg()` renders straight from the compiler's layout model – no
  // pdf.js round-trip, so it cannot hit the sandbox's per-page raster hang,
  // and it stays crisp at any zoom level.
  let previewSvg = $state<string | undefined>(undefined);
  let isRenderingPreview = $state(false);
  let previewFailed = $state(false);

  /**
   * `pdfViewerEnabled` can report `true` while the viewer still fails to
   * instantiate (e.g. Bilibili's sandboxed preview iframe). When that happens,
   * the `<object>` fallback content becomes visible – we detect it once, then
   * remember the verdict for the whole session (and across reloads) instead of
   * re-probing the broken object on every generation.
   */
  const PDF_OBJECT_BROKEN_KEY = 'pdf-object-broken';
  let pdfObjectBroken = $state(false);

  // Read the persisted verdict defensively – sandboxed iframes may throw
  // `SecurityError` on `localStorage` access, which must not abort the page.
  try {
    pdfObjectBroken =
      typeof localStorage !== 'undefined' && localStorage.getItem(PDF_OBJECT_BROKEN_KEY) === '1';
  } catch {
    /* storage unavailable – the runtime probe below decides instead */
  }

  /** True when running under a Bilibili Toy path (`/toy/<slug>/…`). */
  const isOnToyPath = () =>
    typeof window !== 'undefined' && /^\/toy\/[^/]+(?:\/|$)/.test(window.location.pathname);

  /**
   * Whether the preview must fall back to rasterized page images.
   *
   * Deterministic on Bilibili Toy: the sandboxed iframe reports
   * `pdfViewerEnabled` even though its PDF plugin never instantiates, so we
   * never trust inline PDF there. `?pdf` forces the inline `<object>`
   * (debugging) and `?nopdf` forces raster (testing), regardless of env.
   */
  const rasterRequired = $derived.by(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    if (params.has('pdf')) return false;
    if (!pdfInlineSupported) return true;
    if (pdfObjectBroken) return true;
    return isOnToyPath();
  });

  $effect(() => {
    // A learned failure sticks, and a failed raster must not loop forever –
    // `generatePDF` resets `previewFailed` so a fresh doc retries.
    if (!pdf || previewFailed) return;

    if (rasterRequired) {
      // Kick the SVG render once: when it flips `isRenderingPreview` /
      // `previewSvg` this effect re-runs, but the guards prevent restarts.
      if (!previewSvg && !isRenderingPreview) void refreshPreviewSvg();
      return;
    }

    // Inline `<object>` branch: watch for a silent viewer failure. The fallback
    // content of a broken object gets laid out; two consecutive sightings flip
    // the verdict. A deadline keeps this from probing forever when the sandbox
    // neither loads the PDF nor lays out the fallback.
    const marker = () => document.getElementById('pdf-object-fallback');
    const PROBE_DEADLINE_MS = 8000;
    let strikes = 0;
    const started = Date.now();
    const fail = () => {
      clearInterval(interval);
      if (pdfObjectBroken) return;
      console.warn('Inline PDF viewer unavailable – switching to image preview.');
      pdfObjectBroken = true;
      try {
        localStorage.setItem(PDF_OBJECT_BROKEN_KEY, '1');
      } catch {
        /* private mode etc. – the in-session verdict still applies */
      }
    };
    const interval = setInterval(() => {
      // No failure signal within the full window – assume the viewer is healthy.
      if (Date.now() - started > PROBE_DEADLINE_MS) {
        clearInterval(interval);
        return;
      }
      // Children of a successfully loaded PDF object are never laid out.
      // Two consecutive sightings guard against transient load-time layout.
      if (marker() && (marker()!.offsetHeight > 0 || marker()!.getClientRects().length > 0)) {
        if (++strikes >= 2) fail();
      } else {
        strikes = 0;
      }
    }, 400);
    // Keep watching for the lifetime of the object – failures can surface late.
    return () => {
      clearInterval(interval);
    };
  });

  /**
   * Whether saving images is possible in the current environment:
   * in-app via the album, or in-browser via `<a download>`.
   */
  const saveImageSupported = $derived(canSaveToAlbum || canDownload);

  // Template selection
  const STORAGE_META_KEY = 'endfield-doc:meta';
  let templateId = $state(TEMPLATES[0].id);
  let template = $derived(getTemplate(templateId));

  /** Library entry ids keyed by template – one working document per template. */
  let docIds = $state<Record<string, string>>({});
  const currentDocId = () => docIds[templateId];

  // Form values (keyed by template id)
  let valuesMap = $state<Record<string, Record<string, unknown>>>({});

  // Document library
  let libraryOpen = $state(false);
  let qrOpen = $state(false);
  let libraryDocs = $state<LibraryDoc[]>([]);
  /** Snapshot of `{ templateId, values }` at the last autosave; guards redundant saves. */
  let lastSavedSnapshot = '';
  /** Whether the current document has unsaved edits worth autosaving. */
  let isDirty = $state(false);

  // Ensure values are initialized for the current template
  $effect(() => {
    if (!valuesMap[templateId]) {
      valuesMap[templateId] = template.defaults();
    }
  });

  function getValues(): Record<string, unknown> {
    return valuesMap[templateId] ?? {};
  }

  function setValues(v: Record<string, unknown>) {
    valuesMap[templateId] = v;
  }

  // Storage
  const storageKey = (tid: string) => `endfield-doc:${tid}`;

  const saveToStorage = () => {
    try {
      localStorage.setItem(STORAGE_META_KEY, JSON.stringify({ templateId, docIds }));
      const tpl = getTemplate(templateId);
      localStorage.setItem(
        storageKey(templateId),
        JSON.stringify({ version: tpl.storageVersion, values: valuesMap[templateId] })
      );
    } catch (e) {
      console.error('Error saving to storage:', e);
    }
  };

  const loadFromStorage = () => {
    try {
      // Load meta
      const metaRaw = localStorage.getItem(STORAGE_META_KEY);
      if (metaRaw) {
        const meta = JSON.parse(metaRaw);
        if (meta.templateId && TEMPLATES.some((t) => t.id === meta.templateId)) {
          templateId = meta.templateId;
        }
        if (meta.docIds && typeof meta.docIds === 'object') {
          docIds = meta.docIds;
        }
      }

      // Load all template data
      for (const tpl of TEMPLATES) {
        const raw = localStorage.getItem(storageKey(tpl.id));
        if (!raw) continue;
        const data = JSON.parse(raw);
        if (data.version !== tpl.storageVersion) continue;
        if (data.values) {
          valuesMap[tpl.id] = { ...tpl.defaults(), ...data.values };
        }
      }
    } catch (e) {
      console.error('Error loading from storage:', e);
    } finally {
      isReady = true;
    }
  };

  /** Apply a decoded document state into the editor. */
  function applyDocState(state: DocState) {
    templateId = state.templateId;
    valuesMap[state.templateId] = {
      ...getTemplate(state.templateId).defaults(),
      ...state.values
    };
    docIds[state.templateId] = state.docId ?? docIds[state.templateId] ?? randomId();
    isDirty = true;
    saveToStorage();
  }

  /**
   * Restore editor state from a shared link.
   *
   * Supports two forms:
   *  - `?d=…` – inline deflated-base64 payload (no external service).
   *  - `?p=<pasteKey>` – document stored on Pastebin; the key is resolved by
   *    fetching the raw paste through the CORS proxy.
   *
   * The parameter is stripped afterwards so reloads fall back to regular
   * persistence. Returns true when a shared state was applied.
   */
  const hydrateFromUrl = async (): Promise<boolean> => {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get('d');
      if (raw) {
        const state = decodeDocState(raw);
        if (!state) return false;
        history.replaceState(null, '', window.location.pathname);
        applyDocState(state);
        return true;
      }
      const pasteKey = params.get('p');
      if (pasteKey) {
        history.replaceState(null, '', window.location.pathname);
        const payload = await fetchPaste(pasteKey);
        if (!payload) return false;
        const state = decodeDocState(payload);
        if (!state) return false;
        applyDocState(state);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error restoring shared state:', e);
      return false;
    }
  };

  let debounceTimeout: ReturnType<typeof setTimeout> | undefined = undefined;
  let pdfBlob: Blob | undefined = $state(undefined);
  let pdf: string | undefined = $state(undefined);
  let compileError: string | undefined = $state(undefined);

  const getFileName = () => template.getFileName(getValues());

  const generatePDF = async () => {
    isGenerating = true;
    try {
      console.log('[docmaker] compile: waiting for typst');
      await waitForTypst();
      console.log('[docmaker] compile: generating source');
      const source = template.generateTypstSource(getValues());
      await typst.addSource('/main.typ', source);
      console.log('[docmaker] compile: compiling PDF');
      const data = await typst.pdf();
      console.log('[docmaker] compile: done', data?.byteLength ?? 0, 'bytes');
      packageLoadingState.name = null;
      if (!data) return;
      const blob = new Blob([new Uint8Array(data)], { type: 'application/pdf' });
      pdfBlob = blob;
      pdf = URL.createObjectURL(blob);

      const file = new File([blob], getFileName(), { type: 'application/pdf' });
      if (typeof navigator !== 'undefined' && 'canShare' in navigator) {
        try {
          canShare = navigator.canShare({ files: [file] });
        } catch {
          canShare = false;
        }
      } else {
        canShare = false;
      }

      compileError = undefined;
      // A prior failure must not leave a stale error banner on retry.
      previewFailed = false;
      saveToStorage();
      scheduleAutosave();
      // Environments without a working inline PDF viewer get a vector SVG
      // preview. `rasterRequired` is derived from `pdfObjectBroken`, the
      // `?nopdf` flag, and the Toy path – see its definition above.
      if (rasterRequired) void refreshPreviewSvg();
    } catch (e) {
      compileError = e instanceof Error ? e.message : String(e);
      console.error('Error generating PDF:', e);
    } finally {
      isGenerating = false;
    }
  };

  let isSharing = $state(false);
  /** Share link to show when the clipboard API is blocked. */
  let shareUrl = $state<string | null>(null);
  let shareUrlModalOpen = $state(false);

  /**
   * Share the current document as a state-carrying link.
   *
   *  - Bilibili App: upload the doc to a paste provider and hand `toy.share` a
   *    Toy-relative path (`index.html?p=<key>`); the platform generates the
   *    full share URL. Falls back to the inline `?d=` path.
   *  - Web: share the resolved link via `navigator.share`, else copy to
   *    clipboard.
   */
  const handleShare = async () => {
    if (!pdfBlob || isSharing) return;
    isSharing = true;
    try {
      const state = currentDocState();

      // In-app: platform share panel with a Toy-relative path.
      if (await supportsToy('share')) {
        // Prefer external storage when available (tiny `?p=` path).
        let path: string | null = null;
        const stored = await uploadDocState(state);
        if (stored) path = buildToyPath(state, stored.token);
        path ??= buildToyPath(state);
        if (!path) return;
        try {
          await window.toy.share({ path });
        } catch (e) {
          console.error('Error sharing:', e);
        }
        return;
      }

      // Web: build the shareable link, prefer external storage for a compact URL.
      let url: string | null = null;
      const stored = await uploadDocState(state);
      if (stored) url = resolveToyPath(buildToyPath(state, stored.token) ?? '');
      url ??= buildShareUrl(state);
      if (!url) return;

      // Native share sheet when available (copies a text URL).
      if (canShare) {
        try {
          await navigator.share({ text: url, title: getFileName() });
          return;
        } catch (e) {
          if (e instanceof Error && e.name === 'AbortError') return;
          console.error('Error sharing:', e);
        }
      }
      // Clipboard, falling back to showing the URL in a modal when the
      // clipboard API is blocked (e.g. Toy's sandboxed iframe permissions
      // policy). The modal shows a selectable URL the user can copy manually.
      try {
        await navigator.clipboard.writeText(url);
      } catch (e) {
        console.warn('Clipboard unavailable, showing share link modal:', e);
        shareUrl = url;
        shareUrlModalOpen = true;
      }
    } finally {
      isSharing = false;
    }
  };

  const handleDownload = () => {
    if (!pdf) return;
    triggerDownload(pdf, getFileName());
  };

  // ── Image preview fallback (no inline PDF support) ────────────────────

  let previewSeq = 0;

  /**
   * Re-render the live preview as a whole-document SVG via the Typst worker.
   *
   * This is deliberately *not* pdf.js: rasterizing the PDF page-by-page in
   * Bilibili's sandboxed iframe hangs on pages past the first (pdf.js never
   * resolves its `page.render()`), which left the preview stuck or showing a
   * single page. SVG rendering comes straight from the compiler layout model,
   * covers every page, and is resolution-independent – the original reason the
   * preview pane was built around one stacked SVG image.
   */
  async function refreshPreviewSvg() {
    if (!pdf) return;
    const seq = ++previewSeq;
    isRenderingPreview = true;
    try {
      // The worker serializes a big SVG string back over postMessage; bound
      // the round-trip so a pathological document can't wedge the preview.
      const svg = await Promise.race([
        typst.svg(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('preview svg render timeout')), 60000)
        )
      ]);
      if (seq !== previewSeq) return;
      if (!svg) throw new Error('empty svg');
      // Scope the embedded styles so Typst's `svg { fill: none }` and friends
      // don't leak onto the rest of the page (which turned every icon
      // invisible) – see src/lib/utils/svg.ts.
      previewSvg = scopeTypstSvg(svg);
      previewFailed = false;
    } catch (e) {
      if (seq === previewSeq) previewFailed = true;
      console.error('Error rendering preview svg:', e);
    } finally {
      if (seq === previewSeq) isRenderingPreview = false;
    }
  }

  // ── Document library ───────────────────────────────────────────────────

  let autosaveTimeout: ReturnType<typeof setTimeout> | undefined;

  let thumbnailSeq = 0;

  const currentDocState = (): DocState => ({
    docId: currentDocId(),
    templateId,
    values: getValues()
  });

  /**
   * Whether a document-state link can be built for sharing. With external
   * storage available, the shared path is always tiny (`?p=<key>`), so the
   * button shows for any document. Without it, the inline `?d=` payload must
   * fit the QR length cap. Gates the share button.
   */
  const canShareLink = $derived.by(() => {
    if (!pdf) return false;
    if (externalStorageAvailable) return true;
    return buildToyPath(currentDocState()) !== null;
  });

  /**
   * Whether a state-carrying link still fits into a scannable QR code.
   * With external storage, the QR encodes a tiny `?p=<key>` path and always
   * fits; otherwise the inline payload must stay under the cap.
   */
  const qrPossible = $derived.by(() => {
    if (!pdf) return false;
    if (externalStorageAvailable) return true;
    const state = currentDocState();
    return toyEnv.available ? buildToyPath(state) !== null : buildShareUrl(state) !== null;
  });

  /** Queue an autosave; runs once the editor has settled for a moment. */
  function scheduleAutosave() {
    if (!isDirty) return;
    if (autosaveTimeout) clearTimeout(autosaveTimeout);
    autosaveTimeout = setTimeout(autosave, 1200);
  }

  async function autosave() {
    const snapshot = JSON.stringify({ t: templateId, v: getValues() });
    if (!isDirty || snapshot === lastSavedSnapshot) return;

    const now = Date.now();
    if (!docIds[templateId]) {
      docIds[templateId] = randomId();
      saveToStorage();
    }
    const id = docIds[templateId];
    const existing = await getDoc(id).catch(() => undefined);
    // Strip reactivity – IndexedDB structured clone cannot persist $state proxies.
    const values = $state.snapshot(getValues()) as Record<string, unknown>;
    const doc: LibraryDoc = {
      id,
      templateId,
      title: template.getFileName(values).replace(/\.pdf$/i, ''),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      values,
      thumbnail: existing?.thumbnail
    };

    try {
      await putDoc(doc);
      lastSavedSnapshot = snapshot;
      // Keep the in-memory list ordered by recency for the grid view.
      libraryDocs = [doc, ...libraryDocs.filter((d) => d.id !== id)];
      pushDocToCloud(stripThumbnail(doc)).catch((e) => console.error('Cloud sync failed:', e));
      void refreshThumbnail(doc);
    } catch (e) {
      console.error('Error autosaving document:', e);
    }
  }

  /** Re-rasterize the first page of a saved entry as its thumbnail. */
  async function refreshThumbnail(doc: LibraryDoc) {
    if (!pdfBlob) return;
    const seq = ++thumbnailSeq;
    try {
      const pages = await renderPdfPages(new Uint8Array(await pdfBlob.arrayBuffer()), {
        pages: [0],
        pixelPerPt: THUMBNAIL_PPP
      });
      // A newer render supersedes this one.
      if (seq !== thumbnailSeq || pages.length === 0) return;
      doc.thumbnail = pages[0].blob;
      await putDoc({ ...doc });
      libraryDocs = [...libraryDocs];
    } catch (e) {
      console.error('Error generating thumbnail:', e);
    }
  }

  async function refreshLibrary() {
    try {
      libraryDocs = await getAllDocs();
    } catch (e) {
      console.error('Error loading library:', e);
    }
  }

  /** Merge cloud-mirrored entries into the local store, last write wins. */
  async function mergeCloudDocs() {
    try {
      const remote = await pullDocsFromCloud();
      for (const meta of remote) {
        // The entry being edited right now stays under local control.
        if (meta.id === currentDocId()) continue;
        const local = await getDoc(meta.id);
        if (!local || local.updatedAt < meta.updatedAt) {
          await putDoc({ ...meta, thumbnail: local?.thumbnail });
        }
      }
      await refreshLibrary();
    } catch (e) {
      console.error('Cloud merge failed:', e);
    }
  }

  function handleSelectDoc(doc: LibraryDoc) {
    libraryOpen = false;
    isDirty = false;
    docIds[doc.templateId] = doc.id;
    templateId = doc.templateId;
    valuesMap[doc.templateId] = { ...getTemplate(doc.templateId).defaults(), ...doc.values };
    lastSavedSnapshot = JSON.stringify({ t: doc.templateId, v: valuesMap[doc.templateId] });
    saveToStorage();
    generatePDF();
  }

  async function handleDeleteDoc(id: string) {
    try {
      await removeDocFromLibrary(id);
      await deleteDocFromCloud(id).catch(() => {});
    } catch (e) {
      console.error('Error deleting document:', e);
    } finally {
      libraryDocs = libraryDocs.filter((d) => d.id !== id);
      if (currentDocId() === id) {
        // Keep editing; the next autosave recreates the entry.
        isDirty = true;
        lastSavedSnapshot = '';
      }
    }
  }

  function handleNewDoc() {
    libraryOpen = false;
    qrOpen = false;
    isDirty = false;
    docIds[templateId] = randomId();
    valuesMap[templateId] = template.defaults();
    lastSavedSnapshot = JSON.stringify({ t: templateId, v: valuesMap[templateId] });
    saveToStorage();
    generatePDF();
  }

  $effect(() => {
    if (libraryOpen) void refreshLibrary();
  });

  // ── Image export ───────────────────────────────────────────────────────

  /** Raster scale (px per pt) for album exports / downloads. */
  const EXPORT_PPP = 2;
  /**
   * Safe raster scale for the App album path. `saveImageToAlbum` caps
   * `base64Data` at 5 MB (2 MB recommended); a full A4 page at 2x can exceed
   * that, so album saves render at 1x (≈595×842, ~1–1.5 MB PNG).
   */
  const ALBUM_PPP = 1;
  /** Pastebin-album base64 limit (bytes of the base64 string incl. prefix). */
  const ALBUM_BASE64_LIMIT = 5 * 1024 * 1024;

  async function handleSaveImage() {
    if (!pdfBlob || isSavingImage) return;
    isSavingImage = true;
    try {
      const baseName = getFileName().replace(/\.pdf$/i, '');

      // Bilibili App: save each page to the album. Use a modest raster scale
      // and drop pages whose base64 would exceed the platform cap.
      if (canSaveToAlbum) {
        const pages = await renderPdfPages(new Uint8Array(await pdfBlob.arrayBuffer()), {
          pixelPerPt: ALBUM_PPP
        });
        for (const page of pages) {
          const bytes = new Uint8Array(await page.blob.arrayBuffer());
          const dataUrl = `data:image/png;base64,${bytesToBase64Url(bytes)}`;
          if (dataUrl.length > ALBUM_BASE64_LIMIT) {
            console.warn(`Skipping album save: page exceeds ${ALBUM_BASE64_LIMIT} base64 chars`);
            continue;
          }
          try {
            await window.toy.saveImageToAlbum({
              base64Data: dataUrl,
              hintMsg: m.album_permission_hint()
            });
          } catch (e) {
            console.error('saveImageToAlbum failed:', e);
          }
        }
        return;
      }

      // Web: standard browser download path (user-gesture triggered).
      if (!canDownload) return;
      const pages = await renderPdfPages(new Uint8Array(await pdfBlob.arrayBuffer()), {
        pixelPerPt: EXPORT_PPP
      });
      for (let i = 0; i < pages.length; i++) {
        const blobUrl = URL.createObjectURL(pages[i].blob);
        const suffix = pages.length > 1 ? `-${i + 1}` : '';
        triggerDownload(blobUrl, `${baseName}${suffix}.png`);
      }
    } catch (e) {
      console.error('Error saving images:', e);
    } finally {
      isSavingImage = false;
    }
  }

  /** Schedule a PDF regeneration. Instant for non-text changes, debounced for text. */
  function scheduleGenerate(debounce: boolean) {
    if (debounceTimeout) clearTimeout(debounceTimeout);
    if (debounce) {
      debounceTimeout = setTimeout(generatePDF, 500);
    } else {
      generatePDF();
    }
  }

  // Track template switches – regenerate immediately
  let prevTemplateId: string | undefined;
  $effect(() => {
    if (prevTemplateId !== undefined && templateId !== prevTemplateId) {
      scheduleGenerate(false);
    }
    prevTemplateId = templateId;
  });

  onMount(async () => {
    loadFromStorage();
    hydrateFromUrl();
    if (typeof document !== 'undefined') {
      canDownload = 'download' in document.createElement('a');
    }
    await waitForTypst();
    // Initial render for restored drafts / shared links.
    await generatePDF();
    // Sync the library mirror when running inside Bilibili Toy.
    if (await initToy()) {
      await mergeCloudDocs();
    }
    // Detect album-save support (Bilibili App) to gate the save-image button.
    canSaveToAlbum = await supportsToy('saveImageToAlbum');
  });
</script>

<!-- Hero Section -->
<section class="relative flex flex-col items-center justify-center px-6 pt-12 pb-10">
  <div
    class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--color-muted)_0%,transparent_70%)]"
  ></div>
  <div class="relative flex flex-col items-center gap-6">
    <div class="flex items-center gap-4">
      <div
        role="img"
        aria-label="Endfield Logo"
        class="h-16 drop-shadow-md sm:h-20 dark:text-white [&>svg]:h-full [&>svg]:w-auto"
      >
        {@html getLocale() === 'zh' ? endfieldLogoZh : endfieldLogoEn}
      </div>
      <div class="mt-2">
        <h1 class="font-sans text-3xl font-bold tracking-tight sm:text-5xl">
          {m.app_name()}
        </h1>
        <p class="text-muted-foreground mt-1 text-sm sm:text-base">
          {m[`subtitle_${pick([1, 2, 3, 4] as const)}`]()}
        </p>
      </div>
    </div>
  </div>
</section>

<Separator />

<!-- Document Maker Section -->
<section
  class="mx-auto w-full max-w-400 px-4 py-8 sm:px-6 lg:flex lg:min-h-[calc(100vh-15rem)] lg:flex-col lg:px-8"
>
  <div class="grid grid-cols-1 gap-6 lg:flex-1 lg:grid-cols-2 lg:grid-rows-[1fr]">
    <!-- Left: Form -->
    <Card class="border-border/50 flex flex-col">
      <CardHeader>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex min-w-0 items-center gap-2">
            <CardTitle class="text-base font-semibold">{m.app_name()}</CardTitle>
            <Button
              variant="outline"
              size="sm"
              class="cursor-pointer"
              onclick={() => (libraryOpen = true)}
            >
              <FolderOpenIcon class="size-3.5" />
              <span class="hidden sm:inline">{m.library()}</span>
            </Button>
          </div>
          <Tabs.Root
            value={templateId}
            onValueChange={(v) => {
              if (v) templateId = v;
            }}
          >
            <Tabs.List variant="line">
              {#each TEMPLATES as tpl (tpl.id)}
                <Tabs.Trigger value={tpl.id} class="cursor-pointer">{tpl.name()}</Tabs.Trigger>
              {/each}
            </Tabs.List>
          </Tabs.Root>
        </div>
      </CardHeader>
      <CardContent class="flex flex-1 flex-col">
        <DynamicForm
          {template}
          {templateId}
          values={getValues()}
          onchange={(v, opts) => {
            setValues(v);
            isDirty = true;
            scheduleGenerate(opts?.debounce ?? false);
          }}
          onfileschange={() => {
            isDirty = true;
            scheduleGenerate(false);
          }}
          disabled={!isReady}
        />
      </CardContent>
    </Card>

    <!-- Right: PDF Preview -->
    <Card class="border-border/50 flex flex-col">
      <CardHeader class="flex items-center justify-between">
        <CardTitle class="text-base font-semibold">{m.preview()}</CardTitle>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="outline"
            class="cursor-pointer"
            size="sm"
            onclick={generatePDF}
            disabled={!pdf || isGenerating}
            title={m.regenerate()}
          >
            {#if !pdf || isGenerating}
              <Spinner class="size-3.5" />
            {:else}
              <ArrowClockwiseIcon class="size-3.5" />
            {/if}
            <span class="hidden sm:inline">{m.regenerate()}</span>
          </Button>
          <Button
            variant="outline"
            class="cursor-pointer"
            size="sm"
            onclick={() => window.open(pdf, '_blank')}
            disabled={!pdf}
            title={m.open_in_new_tab()}
          >
            <ArrowSquareOutIcon class="size-3.5" />
            <span class="hidden sm:inline">{m.open_in_new_tab()}</span>
          </Button>
          {#if saveImageSupported}
            <Button
              variant="outline"
              class="cursor-pointer"
              size="sm"
              onclick={handleSaveImage}
              disabled={!pdf || isSavingImage}
              title={m.save_image()}
            >
              {#if isSavingImage}
                <Spinner class="size-3.5" />
              {:else}
                <ImageSquareIcon class="size-3.5" />
              {/if}
              <span class="hidden sm:inline">{m.save_image()}</span>
            </Button>
          {/if}
          {#if qrPossible}
            <Button
              variant="outline"
              class="cursor-pointer"
              size="sm"
              onclick={() => (qrOpen = true)}
              disabled={!pdf}
              title={m.qr_code()}
            >
              <QrCodeIcon class="size-3.5" />
              <span class="hidden sm:inline">{m.qr_code()}</span>
            </Button>
          {/if}
          {#if canShareLink}
            <!-- Shares a state-carrying link (Pastebin / native share / clipboard) -->
            <Button
              variant="outline"
              class="cursor-pointer"
              size="sm"
              onclick={handleShare}
              disabled={!pdf || isSharing}
              title={m.share()}
            >
              {#if isSharing}
                <Spinner class="size-3.5" />
              {:else}
                <ShareNetworkIcon class="size-3.5" />
              {/if}
              <span class="hidden sm:inline">{m.share()}</span>
            </Button>
          {/if}
          {#if canDownload}
            <!-- Desktops prefer file downloads -->
            <Button
              variant="outline"
              class="hidden cursor-pointer sm:inline-flex"
              size="sm"
              onclick={handleDownload}
              disabled={!pdf}
              title={m.download()}
            >
              <DownloadSimpleIcon class="size-3.5" />
              {m.download()}
            </Button>
          {/if}
        </div>
      </CardHeader>
      <CardContent class="min-h-150 flex-1 p-0 pb-0">
        {#if compileError}
          <CompileError error={compileError} />
        {:else if pdf && !rasterRequired}
          <object
            data={pdf}
            type="application/pdf"
            class="h-full min-h-150 w-full"
            title={m.preview()}
          >
            <!-- Rendered only when the PDF viewer fails to load – triggers the
                 image fallback via `pdfObjectBroken`. -->
            <p id="pdf-object-fallback" class="text-muted-foreground p-6 text-sm">
              {m.pdf_not_available()}
              <a href={pdf} class="underline">{m.pdf_download()}</a>
            </p>
          </object>
        {:else if pdf && previewSvg}
          <PageImageViewer svg={previewSvg} />
        {:else if pdf && previewFailed}
          <p class="text-muted-foreground p-6 text-sm">{m.pdf_not_available()}</p>
        {:else if pdf && isRenderingPreview}
          <div class="flex h-full min-h-150 flex-col items-center justify-center gap-3">
            <Spinner class="size-10" />
            <p class="text-muted-foreground text-sm">{m.rendering_preview()}</p>
          </div>
        {:else}
          <div class="flex flex-col items-center justify-center gap-3 p-6 sm:p-8">
            <Spinner class="size-10" />
            {#if packageLoadingState.name}
              <p class="text-muted-foreground text-sm">
                {m.loading_package({ name: packageLoadingState.name })}
              </p>
              <!-- Package download: indeterminate progress bar -->
              <div class="bg-muted h-1.5 w-48 overflow-hidden rounded-full">
                <div
                  class="bg-foreground/40 h-full w-1/3 animate-[progress-slide_1.2s_ease-in-out_infinite] rounded-full"
                ></div>
              </div>
            {:else if loadingState.status}
              <p class="text-muted-foreground text-sm">
                {#if loadingState.status === 'loading_fonts' && downloadProgress.activeFiles.length > 0}
                  {#if downloadProgress.activeFiles.length > 3}
                    {m.loading_fonts_count({ count: String(downloadProgress.activeFiles.length) })}
                  {:else}
                    {m.loading_fonts_named({ files: downloadProgress.activeFiles.join(', ') })}
                  {/if}
                {:else}
                  {m[loadingState.status]()}
                {/if}
              </p>
              {#if loadingState.status === 'loading_fonts' && downloadProgress.progress > 0 && downloadProgress.progress < 1}
                <!-- Font download: determinate progress bar -->
                <div class="bg-muted h-1.5 w-48 overflow-hidden rounded-full">
                  <div
                    class="bg-foreground/60 h-full rounded-full transition-[width] duration-200 ease-out"
                    style="width: {downloadProgress.progress * 100}%"
                  ></div>
                </div>
              {/if}
            {/if}
          </div>
        {/if}
      </CardContent>
    </Card>
  </div>
</section>

<DocLibrary
  bind:open={libraryOpen}
  docs={libraryDocs}
  onselect={handleSelectDoc}
  ondelete={handleDeleteDoc}
  onnew={handleNewDoc}
/>

<ShareQrModal bind:open={qrOpen} docState={currentDocState()} />

<!-- Shown when the clipboard API is blocked: displays the full share link so
     the user can copy it manually. The link wraps and is fully visible. -->
<Dialog.Root bind:open={shareUrlModalOpen}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2">
        <LinkSimpleIcon class="size-4" />
        {m.share()}
      </Dialog.Title>
      <Dialog.Description>{m.share_desc()}</Dialog.Description>
    </Dialog.Header>
    <div class="px-4 pb-4">
      {#if shareUrl}
        <a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary bg-muted hover:bg-muted/70 block w-full rounded-md border p-3 text-xs break-all select-text"
          onclick={() => {
            // Best-effort copy on click; the link also opens in a new tab.
            const url = shareUrl;
            if (!url) return;
            try {
              navigator.clipboard.writeText(url).catch(() => {});
            } catch {
              /* clipboard blocked – the link is still selectable */
            }
          }}
        >
          {shareUrl}
        </a>
      {/if}
    </div>
  </Dialog.Content>
</Dialog.Root>
