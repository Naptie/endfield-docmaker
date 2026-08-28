/**
 * PDF page rasterization via pdf.js.
 *
 * The generated PDF embeds all fonts, so rasterizing it is guaranteed to be
 * visually identical to the document. pdf.js is lazy-loaded; nothing is
 * fetched unless a raster is requested (image preview fallback, thumbnails,
 * album export).
 *
 * The worker source is inlined into the bundle and served from a blob URL –
 * the Bilibili Toy static layer 404s `.mjs` assets.
 */

import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

export interface RenderedPage {
  /** Page width in PDF points. */
  width: number;
  /** Page height in PDF points. */
  height: number;
  /** PNG-encoded raster of the page. */
  blob: Blob;
}

export interface RenderPdfOptions {
  /** 1-based page indices to render; defaults to every page. */
  pages?: number[];
  /** Raster scale in pixels per point (defaults to `2`). */
  pixelPerPt?: number;
}

let pdfjsReady: Promise<void> | null = null;

async function initPdfjs(): Promise<void> {
  pdfjsReady ??= (async () => {
    const { default: workerSource } = await import('pdfjs-dist/build/pdf.worker.min.mjs?raw');
    const blob = new Blob([workerSource], { type: 'text/javascript' });
    GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
  })();
  return pdfjsReady;
}

/**
 * Rasterize pages of a PDF document to PNG blobs.
 *
 * @param pdf  The PDF bytes (copied internally; the input is not detached).
 * @param opts  See {@link RenderPdfOptions}. `pixelPerPt` defaults to `2`.
 */
export async function renderPdfPages(
  pdf: Uint8Array,
  opts: RenderPdfOptions = {}
): Promise<RenderedPage[]> {
  const { pages, pixelPerPt = 2 } = opts;
  await initPdfjs();

  // pdf.js may transfer the buffer – hand it a private copy.
  const task = getDocument({ data: new Uint8Array(pdf) });
  const doc: PDFDocumentProxy = await task.promise;

  const indices = (pages ?? Array.from({ length: doc.numPages }, (_, i) => i))
    .map((i) => i + 1)
    .filter((n) => n >= 1 && n <= doc.numPages);

  const out: RenderedPage[] = [];
  for (const num of indices) {
    const page = await doc.getPage(num);
    // PDF user units are points, so `scale` is pixels per point.
    const viewport = page.getViewport({ scale: pixelPerPt });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not acquire 2d context');
    // Opaque white paper – the raster must not carry transparency.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;

    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
    );
    out.push({
      width: viewport.width / pixelPerPt,
      height: viewport.height / pixelPerPt,
      blob
    });
  }
  await task.destroy();
  return out;
}
