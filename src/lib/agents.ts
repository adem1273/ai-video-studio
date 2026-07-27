// AI Agents for the Video Factory.
import type { Scene, ProjectSettings } from './types';
import { generateScript, type AIScene } from './pollinations';
import { searchVideos, type StockVideo } from './pexels';
import { buildSearchQueryFromNarration, extractVisualKeywords } from './visualContext';
import { estimateDuration } from './tts';

export type ScriptResult = { title: string; scenes: AIScene[] };

export async function agentScriptwriter(prompt: string, sceneCount: number, targetLang?: 'tr-TR' | 'en-US'): Promise<ScriptResult> {
  return generateScript(prompt, sceneCount, targetLang);
}

export type VisualDirection = { image_prompt: string; search_query: string; composition: string; mood: string };

export async function agentVisualDirector(scenes: AIScene[], style: string): Promise<VisualDirection[]> {
  const moods = ['calm', 'dramatic', 'tense', 'happy', 'mysterious', 'neutral'] as const;
  const compositions = ['wide aerial shot', 'close-up portrait', 'overhead flat lay', 'medium shot', 'tracking shot', 'establishing wide', 'macro close-up', 'low angle shot'];
  return scenes.map((s, i) => {
    const keywords = extractVisualKeywords(s.narration);
    const searchQuery = keywords.slice(0, 3).join(' ');
    const mood = moods[i % moods.length];
    const composition = compositions[i % compositions.length];
    const imagePrompt = `${s.image_prompt}, ${composition}, ${style} style`;
    return { image_prompt: imagePrompt, search_query: searchQuery || s.search_query || '', composition, mood };
  });
}

export type CuratedVideo = { scene_index: number; video: StockVideo | null; reason: string };

export async function agentVideoCurator(scenes: { narration: string; search_query: string }[], orientation: 'landscape' | 'portrait' | 'square'): Promise<(StockVideo | null)[]> {
  const results: (StockVideo | null)[] = new Array(scenes.length).fill(null);
  const batchSize = 4;
  for (let start = 0; start < scenes.length; start += batchSize) {
    const end = Math.min(start + batchSize, scenes.length);
    const batchPromises: Promise<{ idx: number; videos: StockVideo[] }>[] = [];
    for (let i = start; i < end; i++) {
      const scene = scenes[i];
      if (!scene) continue;
      const narrationQuery = buildSearchQueryFromNarration(scene.narration);
      const rawQuery = scene.search_query || narrationQuery;
      batchPromises.push((async () => {
        const allVideos: StockVideo[] = [];
        if (rawQuery) { const v1 = await searchVideos(rawQuery, 8, orientation); allVideos.push(...v1); }
        if (narrationQuery && narrationQuery !== rawQuery) { const v2 = await searchVideos(narrationQuery, 6, orientation); allVideos.push(...v2); }
        const single = rawQuery?.split(' ').find((w) => w.length > 3);
        if (single && allVideos.length < 3) { const v3 = await searchVideos(single, 5, orientation); allVideos.push(...v3); }
        const seen = new Set<number>();
        const unique = allVideos.filter((v) => { if (seen.has(v.id)) return false; seen.add(v.id); return true; });
        return { idx: i, videos: unique.slice(0, 10) };
      })().catch(() => ({ idx: i, videos: [] })));
    }
    const batchResults = await Promise.all(batchPromises);
    for (const { idx, videos } of batchResults) { if (videos.length > 0) results[idx] = videos[0]; }
  }
  return results;
}

export type SEOResult = { title: string; description: string; tags: string[] };

export async function agentSEO(prompt: string, scenes: Scene[], title: string, targetLang?: 'tr-TR' | 'en-US'): Promise<SEOResult> {
  const isTurkish = targetLang === 'tr-TR' || (!targetLang && /[çğıöşüÇĞİÖŞÜ]/.test(prompt));
  const topic = prompt.trim().slice(0, 60);
  const powerWords = isTurkish ? ['Eksiksiz', 'Detaylı', 'Şaşırtıcı', 'Gizemli', 'İlginç'] : ['Ultimate', 'Complete', 'Secret', 'Surprising', 'Hidden'];
  const powerWord = powerWords[Math.floor(Math.random() * powerWords.length)];
  const seoTitle = `${powerWord} ${title}`.slice(0, 70);
  const sceneSummary = scenes.map((s, i) => isTurkish ? `Bölüm ${i + 1}: ${s.narration.slice(0, 100)}` : `Part ${i + 1}: ${s.narration.slice(0, 100)}`).join('\n');
  const description = isTurkish
    ? `${topic} hakkında her şey bu videoda! ${scenes.length} bölümde detaylıca anlattık.\n\n${sceneSummary}\n\nBeğendiyseniz abone olun ve beğenmeyi unutmayın!\n\n#video #${topic.replace(/\s+/g, '')} #içerik`
    : `Everything about ${topic} in this video! ${scenes.length} parts explained in detail.\n\n${sceneSummary}\n\nSubscribe and like if you enjoyed!\n\n#video #${topic.replace(/\s+/g, '')} #content`;
  const tags = [...prompt.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter((w) => w.length > 3).slice(0, 8), isTurkish ? 'video' : 'video', isTurkish ? 'belgesel' : 'documentary', isTurkish ? 'bilgi' : 'facts', isTurkish ? 'eğitici' : 'educational'];
  return { title: seoTitle, description, tags };
}

export type FactoryProgress = { agent: string; message: string; step: number; totalSteps: number };
export type FactoryResult = { title: string; scenes: Scene[]; settings: ProjectSettings; seo: SEOResult };

export async function runFactoryMode(prompt: string, sceneCount: number, settings: ProjectSettings, targetLang: 'tr-TR' | 'en-US' | undefined, onProgress: (p: FactoryProgress) => void): Promise<FactoryResult> {
  const finalSettings = targetLang ? { ...settings, language: targetLang } : settings;
  const totalSteps = 4;
  onProgress({ agent: 'Senarist', message: 'Yapay zeka senaryo yazıyor...', step: 1, totalSteps });
  const script = await agentScriptwriter(prompt, sceneCount, targetLang);
  let scenes: Scene[] = script.scenes.map((s) => ({ id: crypto.randomUUID(), narration: s.narration, image_prompt: s.image_prompt, search_query: s.search_query || '', duration: Math.max(3, estimateDuration(s.narration) + 1), mood: 'neutral' as const }));
  onProgress({ agent: 'Senarist', message: `Senaryo hazır: ${scenes.length} sahne`, step: 1, totalSteps });
  onProgress({ agent: 'Görsel Yönetmen', message: 'Her sahne için görsel kompozisyon planlanıyor...', step: 2, totalSteps });
  const directions = await agentVisualDirector(script.scenes, finalSettings.style);
  scenes = scenes.map((s, i) => ({ ...s, image_prompt: directions[i]?.image_prompt || s.image_prompt, search_query: directions[i]?.search_query || s.search_query, mood: (directions[i]?.mood as Scene['mood']) || 'neutral' }));
  onProgress({ agent: 'Görsel Yönetmen', message: `Görsel planlama tamam: ${scenes.length} sahne`, step: 2, totalSteps });
  onProgress({ agent: 'Video Küratör', message: 'Pexels ve Pixabay\'da en uygun videolar seçiliyor...', step: 3, totalSteps });
  const orientation = finalSettings.aspect === '9:16' ? 'portrait' : finalSettings.aspect === '1:1' ? 'square' : 'landscape';
  const curated = await agentVideoCurator(scenes.map((s) => ({ narration: s.narration, search_query: s.search_query || '' })), orientation);
  scenes = scenes.map((s, i) => { const video = curated[i]; if (video) return { ...s, video_url: video.video_url, video_poster: video.image_url }; return s; });
  const stockCount = scenes.filter((s) => s.video_url).length;
  onProgress({ agent: 'Video Küratör', message: `${stockCount}/${scenes.length} sahne için stok video bulundu`, step: 3, totalSteps });
  onProgress({ agent: 'SEO Uzmanı', message: 'YouTube için başlık, açıklama ve etiketler optimize ediliyor...', step: 4, totalSteps });
  const seo = await agentSEO(prompt, scenes, script.title, targetLang);
  onProgress({ agent: 'SEO Uzmanı', message: `YouTube metadata hazır: "${seo.title.slice(0, 40)}..."`, step: 4, totalSteps });
  return { title: script.title, scenes, settings: finalSettings, seo };
}
