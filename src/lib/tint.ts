const loadImage = (src: string): Promise<HTMLImageElement> => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

const getEffectiveOpacity = (red: number, green: number, blue: number, alpha: number): number => {
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return (luminance * alpha) / 255;
};

/**
 * Shift an image so its alpha-weighted centroid sits at the geometric center.
 * Returns a canvas with the recentered content (square, sized to fit).
 */
const recenterImage = (img: HTMLImageElement): OffscreenCanvas => {
  // Draw to a temporary canvas to read pixel data
  const tmp = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
  const tmpCtx = tmp.getContext('2d')!;
  tmpCtx.drawImage(img, 0, 0);
  const imageData = tmpCtx.getImageData(0, 0, tmp.width, tmp.height);
  const { data } = imageData;

  // Compute alpha-weighted centroid
  let sumX = 0,
    sumY = 0,
    totalWeight = 0;
  for (let y = 0; y < tmp.height; y++) {
    for (let x = 0; x < tmp.width; x++) {
      const offset = (tmp.width * y + x) * 4;
      const weight = getEffectiveOpacity(
        data[offset],
        data[offset + 1],
        data[offset + 2],
        data[offset + 3]
      );
      if (weight > 0) {
        sumX += x * weight;
        sumY += y * weight;
        totalWeight += weight;
      }
    }
  }

  if (totalWeight === 0) return tmp;

  const centroidX = sumX / totalWeight;
  const centroidY = sumY / totalWeight;
  const imgCx = tmp.width / 2;
  const imgCy = tmp.height / 2;
  const dx = imgCx - centroidX;
  const dy = imgCy - centroidY;

  // If offset is negligible, skip
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return tmp;

  // Create a new canvas large enough to hold the shifted image
  const newW = Math.ceil(tmp.width + Math.abs(dx) * 2);
  const newH = Math.ceil(tmp.height + Math.abs(dy) * 2);
  const canvas = new OffscreenCanvas(newW, newH);
  const ctx = canvas.getContext('2d')!;
  // Draw the original image shifted so centroid lands at new canvas center
  const drawX = newW / 2 - centroidX;
  const drawY = newH / 2 - centroidY;
  ctx.drawImage(img, drawX, drawY);
  return canvas;
};

/**
 * Recenter an SVG so its visual centroid sits at the geometric center,
 * and produce a square viewBox for uniform sizing.
 */
export const recenterSvg = async (raw: string): Promise<string> => {
  const vbMatch = raw.match(/viewBox="([^"]+)"/);
  if (!vbMatch) return raw;
  const [vbMinX, vbMinY, vbWidth, vbHeight] = vbMatch[1].split(/\s+/).map(Number);

  // Rasterize at a reasonable resolution for centroid computation
  const targetSize = 256;
  const scale = targetSize / Math.max(vbWidth, vbHeight);
  const renderW = Math.round(vbWidth * scale);
  const renderH = Math.round(vbHeight * scale);
  const renderSvg = raw.replace('<svg', `<svg width="${renderW}" height="${renderH}"`);

  const blob = new Blob([renderSvg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const canvas = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    let sumX = 0,
      sumY = 0,
      totalWeight = 0;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const offset = (canvas.width * y + x) * 4;
        const weight = getEffectiveOpacity(
          data[offset],
          data[offset + 1],
          data[offset + 2],
          data[offset + 3]
        );
        if (weight > 0) {
          sumX += x * weight;
          sumY += y * weight;
          totalWeight += weight;
        }
      }
    }

    if (totalWeight === 0) return raw;

    // Convert centroid to viewBox coordinates
    const centroidVbX = vbMinX + (sumX / totalWeight / canvas.width) * vbWidth;
    const centroidVbY = vbMinY + (sumY / totalWeight / canvas.height) * vbHeight;

    // Square viewBox centered on centroid, large enough to contain all content
    const halfSide = Math.max(
      centroidVbX - vbMinX,
      vbMinX + vbWidth - centroidVbX,
      centroidVbY - vbMinY,
      vbMinY + vbHeight - centroidVbY
    );

    const newViewBox = `${centroidVbX - halfSide} ${centroidVbY - halfSide} ${halfSide * 2} ${halfSide * 2}`;
    return raw.replace(vbMatch[0], `viewBox="${newViewBox}"`);
  } finally {
    URL.revokeObjectURL(url);
  }
};

export const tintSvg = (
  raw: string,
  color: [number, number, number],
  alpha: number = 1
): Uint8Array => {
  const hex = '#' + color.map((c) => c.toString(16).padStart(2, '0')).join('');
  // Use CSS !important to override any embedded fill styles (e.g. .cls-1 { fill: #fff })
  const fillCss = `* { fill: ${hex} !important; }`;
  let tinted = raw.includes('</style>')
    ? raw.replace('</style>', `${fillCss}</style>`)
    : raw.replace('<svg', `<svg style="fill: ${hex}"`);
  // Set opacity as an SVG attribute on the root (not CSS *) to avoid compounding on nested elements
  if (alpha < 1) {
    tinted = tinted.replace('<svg', `<svg opacity="${alpha}"`);
  }
  return new TextEncoder().encode(tinted);
};

export const tintImage = async (
  src: string,
  color: [number, number, number],
  alpha: number = 1,
  doRecenter: boolean = false
): Promise<Uint8Array> => {
  const img = await loadImage(src);
  let canvas: OffscreenCanvas, ctx: OffscreenCanvasRenderingContext2D;
  if (doRecenter) {
    canvas = recenterImage(img);
    ctx = canvas.getContext('2d')!;
  } else {
    canvas = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
    ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    data[i + 3] = Math.round(
      getEffectiveOpacity(data[i], data[i + 1], data[i + 2], data[i + 3]) * alpha
    );
    data[i] = color[0];
    data[i + 1] = color[1];
    data[i + 2] = color[2];
  }

  ctx.putImageData(imageData, 0, 0);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return new Uint8Array(await blob.arrayBuffer());
};
