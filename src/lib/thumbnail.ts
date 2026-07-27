import type { Scene } from './types';

export type ThumbnailStyle = 'bold' | 'minimal' | 'vintage' | 'neon' | 'documentary';

export type ThumbnailOptions = {
  style: ThumbnailStyle;
  title: string;
  subtitle?: string;
  sceneImage?: string;
  width?: number;
  height?: number;
};

const THUMB_W = 1280;
const THUMB_H = 720;

export async function generateThumbnail(opts: ThumbnailOptions): Promise<string> {
  const width = opts.width ?? THUMB_W;
  const height = opts.height ?? THUMB_H;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  let img: HTMLImageElement | null = null;
  if (opts.sceneImage) {
    try {
      img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image(); i.crossOrigin = 'anonymous';
        i.onload = () => resolve(i); i.onerror = () => reject(new Error('image load failed'));
        i.src = opts.sceneImage!;
      });
    } catch { img = null; }
  }
  if (img) {
    const imgRatio = img.width / img.height;
    const canvasRatio = width / height;
    let drawW: number, drawH: number;
    if (imgRatio > canvasRatio) { drawH = height; drawW = drawH * imgRatio; }
    else { drawW = width; drawH = drawW / imgRatio; }
    ctx.drawImage(img, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
  } else {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#1a1a2e'); grad.addColorStop(1, '#16213e');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height);
  }
  applyStyleOverlay(ctx, opts.style, width, height);
  drawTitle(ctx, opts.title, opts.subtitle, opts.style, width, height);
  return canvas.toDataURL('image/jpeg', 0.92);
}

function applyStyleOverlay(ctx: CanvasRenderingContext2D, style: ThumbnailStyle, width: number, height: number) {
  switch (style) {
    case 'bold': {
      const grad = ctx.createLinearGradient(0, height * 0.4, 0, height);
      grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.85)');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#ef4444'; ctx.fillRect(0, height * 0.85, width, 6);
      break;
    }
    case 'minimal': { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, width, height); break; }
    case 'vintage': {
      ctx.fillStyle = 'rgba(100, 70, 30, 0.25)'; ctx.fillRect(0, 0, width, height);
      const vig = ctx.createRadialGradient(width / 2, height / 2, height * 0.3, width / 2, height / 2, height * 0.8);
      vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = vig; ctx.fillRect(0, 0, width, height);
      break;
    }
    case 'neon': {
      ctx.fillStyle = 'rgba(10,0,30,0.5)'; ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = '#ec4899'; ctx.lineWidth = 8;
      ctx.shadowColor = '#ec4899'; ctx.shadowBlur = 30;
      ctx.strokeRect(20, 20, width - 40, height - 40);
      ctx.shadowBlur = 0;
      break;
    }
    case 'documentary': {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, width, height * 0.12);
      ctx.fillRect(0, height * 0.88, width, height * 0.12);
      const grad = ctx.createLinearGradient(0, height * 0.6, 0, height);
      grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.7)');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height);
      break;
    }
  }
}

function drawTitle(ctx: CanvasRenderingContext2D, title: string, subtitle: string | undefined, style: ThumbnailStyle, width: number, height: number) {
  const fontSize = Math.round(height * 0.1);
  const subFontSize = Math.round(height * 0.04);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const padding = width * 0.06;
  let titleY = height * 0.72;
  if (style === 'documentary') titleY = height * 0.75;
  if (style === 'minimal') titleY = height * 0.5;
  ctx.font = `900 ${fontSize}px Inter, system-ui, sans-serif`;
  const maxWidth = width - padding * 2;
  const lines = wrapTitle(ctx, title, maxWidth);
  const lineHeight = fontSize * 1.1;
  for (let i = 0; i < lines.length; i++) {
    const y = titleY + i * lineHeight;
    if (style === 'neon') { ctx.shadowColor = '#ec4899'; ctx.shadowBlur = 20; ctx.fillStyle = '#ffffff'; }
    else if (style === 'bold') { ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 10; ctx.fillStyle = '#ffffff'; }
    else { ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 8; ctx.fillStyle = '#ffffff'; }
    ctx.fillText(lines[i], padding, y);
  }
  ctx.shadowBlur = 0;
  if (subtitle) {
    ctx.font = `600 ${subFontSize}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = style === 'neon' ? '#f0abfc' : 'rgba(255,255,255,0.8)';
    const subY = titleY + lines.length * lineHeight + subFontSize * 0.5;
    ctx.fillText(subtitle, padding, subY);
  }
}

function wrapTitle(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) { lines.push(current); current = word; }
    else current = test;
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

export function downloadThumbnail(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl; a.download = `${filename}.jpg`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
