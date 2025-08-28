export async function composeQrWithLabel(qrDataUrl: string, opts: {
  assetId: string;
  topText?: string;
  width?: number; // total canvas width
  qrSize?: number; // inner QR pixel size
  padding?: number;
  borderColor?: string;
  textColor?: string;
  backgroundColor?: string;
}): Promise<string> {
  const {
    assetId,
    topText = 'Scan to view asset',
    width = 360,
    qrSize = 300,
    padding = 16,
    borderColor = '#E5E7EB', // tailwind zinc-200
    textColor = '#111827',   // tailwind gray-900
    backgroundColor = '#FFFFFF',
  } = opts;

  const totalHeight = padding + 18 /*top*/ + 8 /*gap*/ + qrSize + 8 /*gap*/ + 16 /*bottom text*/ + padding;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return qrDataUrl;

  // Background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Card border (rounded)
  const radius = 12;
  ctx.save();
  roundedRect(ctx, 1, 1, width - 2, totalHeight - 2, radius);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Top caption
  ctx.fillStyle = textColor;
  ctx.font = '500 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const topY = padding;
  if (topText) ctx.fillText(topText, width / 2, topY);

  // Draw QR in center
  const img = await loadImage(qrDataUrl);
  const qrX = (width - qrSize) / 2;
  const qrY = topY + 18 + 8; // below caption
  ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

  // Bottom asset id (small)
  ctx.font = '600 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(assetId, width / 2, qrY + qrSize + 18);

  return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// Compose a grid sheet image (single PNG) from a list of labeled QR images
export async function composeQrGridSheet(images: string[], opts?: {
  columns?: number;
  cellWidth?: number;
  cellHeight?: number;
  gap?: number;
  padding?: number;
  backgroundColor?: string;
}): Promise<string> {
  const columns = opts?.columns ?? 3;
  const cellWidth = opts?.cellWidth ?? 360;
  const cellHeight = opts?.cellHeight ?? 360; // our labeled QR default height ~360
  const gap = opts?.gap ?? 12;
  const padding = opts?.padding ?? 16;
  const backgroundColor = opts?.backgroundColor ?? '#FFFFFF';

  if (!images.length) throw new Error('No images to compose');
  const rows = Math.ceil(images.length / columns);
  const width = padding * 2 + columns * cellWidth + (columns - 1) * gap;
  const height = padding * 2 + rows * cellHeight + (rows - 1) * gap;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return images[0];
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

  const imgs = await Promise.all(images.map(src => loadImage(src)));
  for (let i = 0; i < imgs.length; i++) {
    const r = Math.floor(i / columns);
    const c = i % columns;
    const x = padding + c * (cellWidth + gap);
    const y = padding + r * (cellHeight + gap);
    ctx.drawImage(imgs[i], x, y, cellWidth, cellHeight);
  }
  return canvas.toDataURL('image/png');
}

export function mmToPx(mm: number, dpi = 96): number {
  return Math.round((mm / 25.4) * dpi);
}

export function computeA4Layout(opts?: {
  orientation?: 'portrait' | 'landscape';
  columns?: number;
  marginMm?: number;
  gapMm?: number;
  dpi?: number;
}) {
  const orientation = opts?.orientation ?? 'portrait';
  const columns = Math.max(1, opts?.columns ?? 3);
  const marginMm = opts?.marginMm ?? 10;
  const gapMm = opts?.gapMm ?? 4;
  const dpi = opts?.dpi ?? 96;

  const pageWmm = orientation === 'portrait' ? 210 : 297;
  const pageHmm = orientation === 'portrait' ? 297 : 210;
  const width = mmToPx(pageWmm, dpi);
  const height = mmToPx(pageHmm, dpi);
  const marginPx = mmToPx(marginMm, dpi);
  const gapPx = mmToPx(gapMm, dpi);
  const cellWidth = Math.floor((width - marginPx * 2 - gapPx * (columns - 1)) / columns);
  const cellHeight = cellWidth;
  const rows = Math.floor((height - marginPx * 2 + gapPx) / (cellHeight + gapPx));
  const capacity = Math.max(1, rows * columns);
  return { width, height, marginPx, gapPx, cellWidth, cellHeight, rows, columns, capacity, dpi };
}

// Compose a single A4-sized PNG sheet. If more images than fit, extra are ignored.
export async function composeQrA4Sheet(images: string[], opts?: {
  orientation?: 'portrait' | 'landscape';
  columns?: number;
  marginMm?: number;
  gapMm?: number;
  dpi?: number; // canvas density; 96 works well for browsers
}): Promise<{ dataUrl: string; capacity: number }>{
  const dpi = opts?.dpi ?? 192; // higher DPI for sharper PNG
  const { width, height, marginPx, gapPx, cellWidth, cellHeight, rows, columns, capacity } = computeA4Layout({ ...opts, dpi });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { dataUrl: images[0] || '', capacity };
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  const slice = images.slice(0, capacity);
  const imgs = await Promise.all(slice.map(src => loadImage(src)));
  for (let i = 0; i < imgs.length; i++) {
    const r = Math.floor(i / columns);
    const c = i % columns;
    const x = marginPx + c * (cellWidth + gapPx);
    const y = marginPx + r * (cellHeight + gapPx);
    ctx.drawImage(imgs[i], x, y, cellWidth, cellHeight);
  }
  return { dataUrl: canvas.toDataURL('image/png'), capacity };
}
