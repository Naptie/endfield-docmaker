const loadImage = (src: string): Promise<HTMLImageElement> => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
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
      const alpha = data[(tmp.width * y + x) * 4 + 3];
      if (alpha > 0) {
        sumX += x * alpha;
        sumY += y * alpha;
        totalWeight += alpha;
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
  const [r, g, b] = color.map((c) => c / 255);

  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i] * r;
    data[i + 1] = data[i + 1] * g;
    data[i + 2] = data[i + 2] * b;
    data[i + 3] = data[i + 3] * alpha;
  }

  ctx.putImageData(imageData, 0, 0);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return new Uint8Array(await blob.arrayBuffer());
};
