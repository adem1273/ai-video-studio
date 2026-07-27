import type { Scene } from './types';

export type YouTubeMeta = { title: string; description: string; tags: string[] };

const HOOK_PHRASES = [
  'Bu videoda hiç bilmediğiniz detayları keşfedeceksiniz!',
  'İzlediğiniz en kapsamlı içerik burada!',
  'Her şeyi adım adım anlattık — kaçırmayın!',
  'Profesyonellerin bilmediği sırları paylaşıyoruz.',
  'Bu içerik ile her şey çok daha kolay!',
];

const CTA_PHRASES = [
  'Beğendiyseniz abone olmayı ve like basmayı unutmayın!',
  'Yorumlarda düşüncelerinizi paylaşın!',
  'Daha fazla içerik için kanalı takip edin!',
  'Videoyu arkadaşlarınızla paylaşın!',
];

const HASHTAG_POOL = ['video', 'içerik', 'türkiye', 'eğitim', 'bilgi', 'ipucu', 'rehber', 'nasıl', 'öğretici', 'ilginç', 'keşif', 'yeni', '2025', '2026'];

export function generateYouTubeMeta(prompt: string, scenes: Scene[], title: string): YouTubeMeta {
  let ytTitle = title;
  if (ytTitle.length > 70) ytTitle = ytTitle.slice(0, 67) + '...';
  if (ytTitle.length < 50 && !ytTitle.includes('|')) { ytTitle = `${ytTitle} | Tam Rehber`; if (ytTitle.length > 70) ytTitle = ytTitle.slice(0, 67) + '...'; }
  const hook = HOOK_PHRASES[Math.floor(Math.random() * HOOK_PHRASES.length)];
  const cta = CTA_PHRASES[Math.floor(Math.random() * CTA_PHRASES.length)];
  const timestamps = buildTimestamps(scenes, 4);
  const promptWords = prompt.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter((w) => w.length > 3).slice(0, 5);
  const summary = `Bu videoda ${prompt.slice(0, 100)} konusunda detaylı bir içerik hazırladık.`;
  const hashtags = promptWords.map((w) => `#${w}`).join(' ');
  const description = `${hook}\n\n${summary}\n\n${timestamps}\n\n${cta}\n\n${hashtags || '#video #içerik'}`;
  const tags = [...promptWords, ...HASHTAG_POOL.slice(0, 10 - Math.min(promptWords.length, 5))].slice(0, 15);
  return { title: ytTitle, description, tags };
}

export function buildTimestamps(scenes: Scene[], titleOffset: number = 0): string {
  let currentTime = titleOffset;
  const lines: string[] = ['⏱ Zaman çizelgesi:'];
  if (titleOffset > 0) lines.push(`0:00 Giriş`);
  for (let i = 0; i < scenes.length; i++) {
    const mins = Math.floor(currentTime / 60);
    const secs = Math.floor(currentTime % 60);
    const stamp = `${mins}:${String(secs).padStart(2, '0')}`;
    const label = scenes[i].narration.slice(0, 40) || `Sahne ${i + 1}`;
    lines.push(`${stamp} ${label}${scenes[i].narration.length > 40 ? '...' : ''}`);
    currentTime += scenes[i].duration;
  }
  return lines.join('\n');
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
