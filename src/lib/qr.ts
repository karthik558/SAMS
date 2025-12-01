import QRCode from 'qrcode';
export async function composeQrWithLabel(qrDataUrl: string, opts: {
  assetId: string;
  topText?: string;
  width?: number; // total canvas width
  qrSize?: number; // inner QR pixel size
  padding?: number;
  borderColor?: string;
  textColor?: string;
  backgroundColor?: string;
  hideBottomText?: boolean;
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
    hideBottomText = false,
  } = opts;

  const hasTopText = !!topText;
  const topHeight = hasTopText ? 18 : 0;
  const topGap = hasTopText ? 8 : 0;
  const bottomHeight = hideBottomText ? 0 : 16;
  const bottomGap = hideBottomText ? 0 : 8;

  const totalHeight = padding + topHeight + topGap + qrSize + bottomGap + bottomHeight + padding;
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
  const qrY = padding + topHeight + topGap; 
  ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

  // Bottom asset id (small)
  if (!hideBottomText) {
    ctx.font = '600 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(assetId, width / 2, qrY + qrSize + bottomGap + 10); // 10 is approx text height baseline adjustment
  }

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

// Create a labeled QR PNG for an asset. Accepts optional topText override.
export async function generateQrPng(opts: {
  assetId: string;
  assetName?: string;
  property?: string;
  topText?: string;
  urlBase?: string; // optional override for base URL
}): Promise<string> {
  const base = (import.meta as any)?.env?.VITE_PUBLIC_BASE_URL || 'https://samsproject.in';
  const normalizedBase = (base || '').replace(/\/$/, '');
  const qrLink = `${normalizedBase}/assets/${opts.assetId}`;

  const rawQrDataUrl = await QRCode.toDataURL(qrLink, {
    width: 512,
    margin: 2,
    color: { dark: '#000000', light: '#FFFFFF' },
    errorCorrectionLevel: 'M',
  });

  const topText = opts.topText || '';

  return composeQrWithLabel(rawQrDataUrl, {
    assetId: opts.assetId,
    topText,
    hideBottomText: true,
  });
}

// Download a data URL as a file
export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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

// Common label size presets for roll printers (Dymo, Brother QL, Zebra, etc.)
export type LabelPreset = { id: string; name: string; widthIn: number; heightIn: number };
export const LABEL_PRESETS: LabelPreset[] = [
  { id: '2x1in', name: '2" x 1" (Dymo/Brother)', widthIn: 2, heightIn: 1 },
  { id: '3x1in', name: '3" x 1"', widthIn: 3, heightIn: 1 },
  { id: '3x2in', name: '3" x 2"', widthIn: 3, heightIn: 2 },
  { id: '4x3in', name: '4" x 3"', widthIn: 4, heightIn: 3 },
  { id: '4x6in', name: '4" x 6" (Shipping/Zebra)', widthIn: 4, heightIn: 6 },
  { id: '62x29mm', name: '62mm x 29mm (Brother DK-22205)', widthIn: 62/25.4, heightIn: 29/25.4 },
  { id: '62x100mm', name: '62mm x 100mm', widthIn: 62/25.4, heightIn: 100/25.4 },
];

// Print given images as one label per page with a specific page size (inches).
// This works with most label printer drivers via the browser Print dialog.
export async function printImagesAsLabels(images: string[], opts: {
  widthIn: number;
  heightIn: number;
  orientation?: 'portrait' | 'landscape';
  fit?: 'contain' | 'cover';
}) {
  const { widthIn, heightIn, orientation = 'portrait', fit = 'contain' } = opts;
  if (!images.length) return;
  const pageCss = `@page { size: ${widthIn}in ${heightIn}in ${orientation}; margin: 0; }`;
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  doc?.open();
  const pages = images.map((src, i) => (
    `<div class="page"><img src="${src}" alt="label-${i}" /></div>`
  )).join('');
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <title>Labels</title>
    <style>
      ${pageCss}
      html, body { margin: 0; padding: 0; }
      .page { width: ${widthIn}in; height: ${heightIn}in; display: flex; align-items: center; justify-content: center; break-after: page; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page img { width: 100%; height: 100%; object-fit: ${fit}; display: block; }
    </style>
  </head>
  <body>
    ${pages}
  </body>
</html>`;
  doc?.write(html);
  doc?.close();
  const trigger = () => {
    try {
      iframe.contentWindow?.focus();
      setTimeout(() => iframe.contentWindow?.print(), 50);
    } finally {
      setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 1000);
    }
  };
  // Ensure first image is loaded before printing
  const firstImg = doc?.querySelector('img') as HTMLImageElement | null;
  if (firstImg && !firstImg.complete) firstImg.onload = () => setTimeout(trigger, 50); else setTimeout(trigger, 300);
}
