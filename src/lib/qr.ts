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
