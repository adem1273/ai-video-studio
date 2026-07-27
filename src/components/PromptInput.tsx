import { useState, useMemo } from 'react';
import { Wand2, Loader2, Sparkles, Film, ScanLine, CheckCircle2, AlertCircle, Globe, Video, ImageIcon, Clapperboard, X } from 'lucide-react';
import { generateScript, imageUrl, preloadImage, generateVideo, type AIScene, detectLangOverride } from '@/lib/pollinations';
import { generateLocalScript } from '@/lib/scriptGenerator';
import { estimateDuration, detectLang } from '@/lib/tts';
import { searchVideos } from '@/lib/pexels';
import { parseBrief, applyBriefToSettings, buildScenesFromBrief } from '@/lib/briefParser';
import { buildSearchQueryFromNarration, extractVisualKeywords } from '@/lib/visualContext';
import type { Scene, ProjectSettings, MediaSource } from '@/lib/types';

function formatDuration(sec: number): string {
  if (sec < 60) return `${Math.round(sec)} sn`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m} dk ${s} sn`;
}

function totalDuration(scenes: Scene[]): number {
  return scenes.reduce((sum, s) => sum + (s.duration || 0), 0);
}

const TR_TO_EN: Record<string, string> = {
  'uzay': 'space', 'astronot': 'astronaut', 'mars': 'mars', 'gezegen': 'planet',
  'dunya': 'earth', 'gokyuzu': 'sky', 'yildiz': 'star', 'galaksi': 'galaxy',
  'roket': 'rocket', 'fuzesi': 'rocket', 'uydu': 'satellite',
  'sehir': 'city', 'bina': 'building', 'sokak': 'street', 'yol': 'road',
  'araba': 'car', 'trafik': 'traffic', 'kopru': 'bridge', 'tunel': 'tunnel',
  'deniz': 'sea', 'okyanus': 'ocean', 'gol': 'lake', 'nehir': 'river',
  'dag': 'mountain', 'orman': 'forest', 'col': 'desert', 'plaj': 'beach',
  'ada': 'island', 'volkan': 'volcano', 'selale': 'waterfall', 'magara': 'cave',
  'hayvan': 'animal', 'kedi': 'cat', 'kopek': 'dog', 'kus': 'bird', 'balik': 'fish',
  'aslan': 'lion', 'kaplan': 'tiger', 'ayi': 'bear', 'kurt': 'wolf', 'tilki': 'fox',
  'at': 'horse', 'inek': 'cow', 'koyun': 'sheep', 'tavuk': 'chicken',
  'insan': 'person', 'kadin': 'woman', 'erkek': 'man', 'cocuk': 'child',
  'kalabalik': 'crowd', 'grup': 'group', 'aile': 'family',
  'yemek': 'food', 'icecek': 'drink', 'kahve': 'coffee', 'kek': 'cake',
  'tatli': 'dessert', 'mekan': 'restaurant', 'mutfak': 'kitchen',
  'spor': 'sport', 'futbol': 'football', 'basketbol': 'basketball',
  'kosu': 'running', 'yuzme': 'swimming', 'bisiklet': 'bicycle',
  'muzik': 'music', 'gitar': 'guitar', 'piyano': 'piano', 'davul': 'drum',
  'dans': 'dance', 'konser': 'concert', 'sahne': 'stage',
  'teknoloji': 'technology', 'bilgisayar': 'computer', 'telefon': 'phone',
  'robot': 'robot', 'yapay': 'artificial', 'zeka': 'intelligence',
  'bilim': 'science', 'laboratuvar': 'laboratory', 'deney': 'experiment',
  'tarih': 'history', 'antik': 'ancient', 'kale': 'castle', 'saray': 'palace',
  'tapinak': 'temple', 'kilise': 'church', 'cami': 'mosque', 'anit': 'monument',
  'savas': 'war', 'asker': 'soldier', 'ordu': 'army', 'cephe': 'battlefield',
  'tren': 'train', 'istasyon': 'station', 'havalimani': 'airport', 'ucak': 'airplane',
  'gemı': 'ship', 'tekne': 'boat', 'liman': 'harbor',
  'cicek': 'flower', 'agac': 'tree', 'yaprak': 'leaf', 'bahce': 'garden',
  'tarla': 'field', 'ciftlik': 'farm', 'hasat': 'harvest',
  'hava': 'weather', 'yagmur': 'rain', 'kar': 'snow', 'ruzgar': 'wind',
  'gunes': 'sun', 'ay': 'moon', 'bulut': 'cloud', 'simsek': 'lightning',
  'sabah': 'morning', 'aksam': 'evening', 'gece': 'night', 'gunduz': 'daytime',
  'gun': 'day', 'saat': 'clock', 'zaman': 'time', 'gecmis': 'past',
  'gelecek': 'future', 'su': 'water', 'ates': 'fire', 'toprak': 'earth',
  'metal': 'metal', 'tas': 'stone', 'kum': 'sand',
  'isik': 'light', 'karanlik': 'dark', 'renk': 'color', 'golge': 'shadow',
  'enerji': 'energy', 'guclu': 'powerful', 'hizli': 'fast', 'yavas': 'slow',
  'buyuk': 'big', 'kucuk': 'small', 'yeni': 'new', 'eski': 'old',
  'guzel': 'beautiful', 'cirkin': 'ugly', 'temiz': 'clean', 'kirli': 'dirty',
  'sicak': 'hot', 'soguk': 'cold',
  'mutlu': 'happy', 'uzgun': 'sad', 'kizgin': 'angry', 'korkmus': 'scared',
  'saglik': 'health', 'hastane': 'hospital', 'doktor': 'doctor', 'ilac': 'medicine',
  'okul': 'school', 'universite': 'university', 'kitap': 'book', 'kutuphane': 'library',
  'para': 'money', 'banka': 'bank', 'pazar': 'market', 'magaza': 'shop',
  'kalp': 'heart', 'beyin': 'brain', 'goz': 'eye', 'el': 'hand',
  'ask': 'love', 'iliski': 'relationship', 'dugun': 'wedding',
  'tatil': 'vacation', 'seyahat': 'travel', 'macera': 'adventure',
  'korku': 'fear', 'umut': 'hope', 'ruya': 'dream', 'gercek': 'reality',
};

function translateQueryToEnglish(query: string): string {
  const words = query.toLowerCase().split(/\s+/);
  const translated = words.map((w) => TR_TO_EN[w] ?? w);
  return translated.join(' ');
}

function extractSearchQueryFallback(imagePrompt: string): string {
  const STRIP = new Set([
    'cinematic', 'establishing', 'shot', 'wide', 'angle', 'close-up', 'closeup',
    'medium', 'macro', 'aerial', 'view', 'scene', 'photorealistic', 'photoreal',
    'ultra', 'detailed', '4k', '8k', 'hd', 'style', 'lighting', 'dramatic',
    'moody', 'atmospheric', 'shallow', 'depth', 'field', 'blurred', 'background',
    'natural', 'light', 'golden', 'hour', 'sunset', 'sunrise', 'rim', 'side',
    'soft', 'diffused', 'warm', 'cool', 'studio', 'professional', 'clean',
    'modern', 'aesthetic', 'vibrant', 'high', 'contrast', 'low', 'dynamic',
    'epic', 'landscape', 'portrait', 'documentary', 'footage', 'recreation',
    'historical', 'concept', 'conceptual', 'abstract', 'artistic', 'composition',
    'texture', 'pattern', 'mood', 'tone', 'color', 'colors', 'beautiful',
    'stunning', 'amazing', 'breathtaking', 'focal', 'point', 'sharp', 'focus',
    'crisp', 'quality', 'render', '3d', 'digital', 'painting', 'illustration',
    'art', 'photo', 'photography', 'image', 'picture', 'visual', 'theme',
    'subject', 'object', 'overhead', 'flat', 'lay', 'telephoto', 'compression',
    'panoramic', 'scale', 'selective', 'split', 'backlight', 'backlit',
    'silhouette', 'dust', 'particles', 'fog', 'misty', 'glowing', 'edges',
    'futuristic', 'museum', 'gallery', 'display', 'showcase', 'hero',
    'revelation', 'discovery', 'moment', 'incredible', 'surprising',
    'unexpected', 'rare', 'capture', 'jaw-dropping', 'spectacle',
    'eye-catching', 'opening', 'engaging', 'farewell', 'conclusion',
    'ending', 'complete', 'balanced', 'lineup', 'collage', 'highlights',
    'layout', 'montage', 'sequence',
  ]);
  const words = imagePrompt
    .toLowerCase()
    .replace(/[^\w\s,]/g, ' ')
    .split(/[\s,]+/)
    .filter((w) => w.length > 2 && !STRIP.has(w));
  const seen = new Set<string>();
  const unique = words.filter((w) => {
    if (seen.has(w)) return false;
    seen.add(w);
    return true;
  });
  const query = unique.slice(0, 4).join(' ');
  return query.slice(0, 50);
}

type Props = {
  onGenerated: (title: string, scenes: Scene[], settings: ProjectSettings) => void;
  settings: ProjectSettings;
};

const durationOptions: { v: number; label: string; desc: string }[] = [
  { v: 30, label: '30 sn', desc: '~6 sahne' },
  { v: 60, label: '1 dk', desc: '~12 sahne' },
  { v: 180, label: '3 dk', desc: '~36 sahne' },
  { v: 600, label: '10 dk', desc: '~120 sahne' },
];

const SCENE_SECONDS = 5;

export function PromptInput({ onGenerated, settings }: Props) {
  const [prompt, setPrompt] = useState('');
  const [targetDuration, setTargetDuration] = useState(60);
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [manualLang, setManualLang] = useState<'auto' | 'tr-TR' | 'en-US'>('auto');
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  const parsedBrief = useMemo(() => (prompt.trim().length > 20 ? parseBrief(prompt) : null), [prompt]);
  const isBrief = parsedBrief?.detected ?? false;
  const promptLangOverride = useMemo(() => detectLangOverride(prompt), [prompt]);

  // Effective language override: manual dropdown takes priority, then prompt detection
  const langOverride = manualLang !== 'auto'
    ? { lang: manualLang as 'tr-TR' | 'en-US', cleanPrompt: prompt }
    : promptLangOverride;

  const generate = async (overrideMediaSource?: MediaSource) => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setUsedFallback(false);

    try {
      let finalSettings = settings;
      if (overrideMediaSource) {
        finalSettings = { ...finalSettings, mediaSource: overrideMediaSource };
      }
      let title: string;
      let scenes: Scene[];

      // Apply language override to settings so TTS uses the correct voice
      if (langOverride) {
        finalSettings = { ...finalSettings, language: langOverride.lang };
      }

      if (isBrief && parsedBrief && !langOverride) {
        setProgressMsg('Brief analiz ediliyor...');
        const briefSettings = applyBriefToSettings(finalSettings, parsedBrief);
        finalSettings = briefSettings;
        const built = buildScenesFromBrief(parsedBrief, parsedBrief.maxDuration);
        title = parsedBrief.title || 'Untitled';

        scenes = built.map((s, i) => ({
          id: crypto.randomUUID(),
          narration: s.narration,
          image_prompt: s.image_prompt,
          image_url: imageUrl(s.image_prompt, { seed: Math.floor(Math.random() * 1_000_000) + i, width: 1280, height: 720 }),
          duration: s.duration,
          mood: s.mood,
        }));

        if (parsedBrief.endCardText && parsedBrief.endCardDuration) {
          finalSettings = {
            ...finalSettings,
            endCard: {
              enabled: true,
              text: parsedBrief.endCardText,
              duration: parsedBrief.endCardDuration,
              fontColor: 'gold',
            },
          };
        }
        setProgressMsg(`Senaryo hazır: ${scenes.length} sahne · ~${formatDuration(totalDuration(scenes))}`);
      } else {
        // ── AI script generation with fallback to local ──────────────
        // If a brief was detected but a language override is active,
        // strip the video-spec noise from the prompt so the AI doesn't
        // narrate format details like "9:16" or "VISUAL STYLE: dark".
        let aiPrompt = prompt;
        let briefSceneCount: number | null = null;
        if (isBrief && parsedBrief && langOverride) {
          // Apply brief settings (aspect, style, music, etc.) but don't use
          // the brief's pre-written script lines — we want the AI to generate
          // fresh narration in the target language.
          const briefSettings = applyBriefToSettings(finalSettings, parsedBrief);
          briefSettings.language = langOverride.lang;
          finalSettings = briefSettings;

          if (parsedBrief.endCardText && parsedBrief.endCardDuration) {
            finalSettings = {
              ...finalSettings,
              endCard: {
                enabled: true,
                text: parsedBrief.endCardText,
                duration: parsedBrief.endCardDuration,
                fontColor: 'gold',
              },
            };
          }

          // Use the brief's title as the topic, and provide script lines as
          // source material for the AI to adapt in the target language.
          if (parsedBrief.scenes.length > 0) {
            const scriptLines = parsedBrief.scenes.map((s) => s.narration).join('\n');
            aiPrompt = `Topic: ${parsedBrief.title || prompt}\n\nSource material to adapt:\n${scriptLines}`;
          } else if (parsedBrief.title) {
            aiPrompt = parsedBrief.title;
          }
          // Use the scene count from the brief if available
          if (parsedBrief.scenes.length > 0) briefSceneCount = parsedBrief.scenes.length;
        }

        // One scene per SCENE_SECONDS (5s) of target duration
        const sceneCount = briefSceneCount ?? Math.max(3, Math.round(targetDuration / SCENE_SECONDS));
        setProgressMsg('Yapay zeka senaryo oluşturuyor...');
        let aiResult: { title: string; scenes: AIScene[] } | null = null;

        try {
          aiResult = await generateScript(aiPrompt, sceneCount, langOverride?.lang);
        } catch (aiErr) {
          console.warn('AI script generation failed, falling back to local:', aiErr);
          setUsedFallback(true);
        }

        if (aiResult && aiResult.scenes.length > 0) {
          title = aiResult.title;
          const perScene = targetDuration / aiResult.scenes.length;
          const sessionSeed = Math.floor(Math.random() * 1_000_000);
          scenes = aiResult.scenes.map((s, i) => ({
            id: crypto.randomUUID(),
            narration: s.narration,
            image_prompt: s.image_prompt,
            image_url: imageUrl(s.image_prompt, { seed: sessionSeed + i, width: 1280, height: 720 }),
            duration: Math.max(3, Math.min(perScene, estimateDuration(s.narration) + 1)),
            mood: 'neutral' as const,
            search_query: s.search_query || '',
          }));
          setProgressMsg(`Senaryo hazır: ${scenes.length} sahne · ~${formatDuration(totalDuration(scenes))}`);
        } else {
          // Fallback to local template generator
          setProgressMsg('Senaryo oluşturuluyor...');
          const result = generateLocalScript(aiPrompt, sceneCount, settings.style, langOverride?.lang);
          title = result.title;
          const perScene = targetDuration / result.scenes.length;
          const fallbackSessionSeed = Math.floor(Math.random() * 1_000_000);
          scenes = result.scenes.map((s, i) => ({
            id: crypto.randomUUID(),
            narration: s.narration,
            image_prompt: s.image_prompt,
            image_url: imageUrl(s.image_prompt, { seed: fallbackSessionSeed + i, width: 1280, height: 720 }),
            duration: Math.max(3, Math.min(perScene, estimateDuration(s.narration) + 1)),
            mood: 'neutral' as const,
            search_query: '',
          }));
          setProgressMsg(`Senaryo hazır: ${scenes.length} sahne · ~${formatDuration(totalDuration(scenes))}`);
        }
      }

      // ── Stock video search (parallel, limited concurrency) ────────
      const stockEnabled = finalSettings.mediaSource === 'stock' || finalSettings.mediaSource === 'auto';
      if (stockEnabled && scenes.length > 0) {
        const orientation = finalSettings.aspect === '9:16' ? 'portrait' : finalSettings.aspect === '1:1' ? 'square' : 'landscape';
        const batchSize = 3;
        for (let batchStart = 0; batchStart < scenes.length; batchStart += batchSize) {
          const batchEnd = Math.min(batchStart + batchSize, scenes.length);
          const batchPromises = [];
          for (let i = batchStart; i < batchEnd; i++) {
            const scene = scenes[i] as Scene & { search_query?: string };
            // Build search query from narration (content-rich) instead of image_prompt (style-heavy)
            const narrationQuery = buildSearchQueryFromNarration(scene.narration);
            const rawQuery = scene.search_query || narrationQuery || extractSearchQueryFallback(scene.image_prompt);
            if (!rawQuery) continue;
            // Translate Turkish keywords to English for Pexels (English-only API)
            const enQuery = translateQueryToEnglish(rawQuery);
            // Also build a broader fallback query from individual visual keywords
            const keywordFallback = extractVisualKeywords(scene.narration, 3).join(' ');
            const enKeywordFallback = translateQueryToEnglish(keywordFallback);
            batchPromises.push(
              (async () => {
                const o = orientation as 'landscape' | 'portrait' | 'square';
                // Strategy 1: narration-derived query (translated to English)
                let videos = await searchVideos(enQuery, 8, o);
                // Strategy 2: original Turkish query (sometimes works)
                if (videos.length === 0 && rawQuery !== enQuery) {
                  videos = await searchVideos(rawQuery, 8, o);
                }
                // Strategy 3: broader keyword fallback (fewer, more common words)
                if (videos.length === 0 && enKeywordFallback && enKeywordFallback !== enQuery) {
                  videos = await searchVideos(enKeywordFallback, 6, o);
                }
                // Strategy 4: single most relevant keyword
                if (videos.length === 0) {
                  const single = enQuery.split(' ').find((w) => w.length > 3);
                  if (single) videos = await searchVideos(single, 5, o);
                }
                return { i, videos, query: rawQuery, enQuery };
              })().catch(() => ({ i, videos: [], query: rawQuery, enQuery })),
            );
          }
          const results = await Promise.all(batchPromises);
          for (const { i, videos, query } of results) {
            if (videos.length > 0) {
              const v = videos[0];
              scenes[i] = {
                ...scenes[i],
                video_url: v.video_url,
                video_poster: v.image_url,
                video_alt_urls: videos.slice(1, 5).map((vv) => vv.video_url),
              };
            }
          }
          const done = Math.min(batchEnd, scenes.length);
          const stockCount = scenes.filter((s) => s.video_url).length;
          setProgressMsg(`Stok video aranıyor... (${done}/${scenes.length}) · ${stockCount} video bulundu · ~${formatDuration(totalDuration(scenes))}`);
        }
      }

      // ── AI image generation (parallel, limited concurrency) ──────────
      const aiImageEnabled = finalSettings.mediaSource === 'ai';
      if (aiImageEnabled && scenes.length > 0) {
        const { width: iw, height: ih } = finalSettings.aspect === '9:16'
          ? { width: 720, height: 1280 }
          : finalSettings.aspect === '1:1'
            ? { width: 720, height: 720 }
            : { width: 1280, height: 720 };
        const batchSize = 4;
        for (let batchStart = 0; batchStart < scenes.length; batchStart += batchSize) {
          const batchEnd = Math.min(batchStart + batchSize, scenes.length);
          const batchPromises = [];
          for (let i = batchStart; i < batchEnd; i++) {
            const scene = scenes[i];
            const seed = Math.floor(Math.random() * 1_000_000);
            const url = imageUrl(scene.image_prompt, { width: iw, height: ih, seed });
            batchPromises.push(
              preloadImage(url, 20000)
                .then(() => ({ i, url, ok: true }))
                .catch(() => ({ i, url: '', ok: false })),
            );
          }
          const results = await Promise.all(batchPromises);
          for (const { i, url, ok } of results) {
            if (ok && url) {
              scenes[i] = { ...scenes[i], image_url: url };
              setProgressMsg(`AI görsel üretildi: Sahne ${i + 1}`);
            } else {
              setProgressMsg(`AI görsel başarısız: Sahne ${i + 1}`);
            }
          }
          const done = Math.min(batchEnd, scenes.length);
          setProgressMsg(`AI görseller üretiliyor... (${done}/${scenes.length})`);
        }
      }

      // ── AI video generation (parallel, limited concurrency) ──────────
      const aiVideoEnabled = finalSettings.mediaSource === 'ai-video';
      if (aiVideoEnabled && scenes.length > 0) {
        const batchSize = 2;
        for (let batchStart = 0; batchStart < scenes.length; batchStart += batchSize) {
          const batchEnd = Math.min(batchStart + batchSize, scenes.length);
          const batchPromises = [];
          for (let i = batchStart; i < batchEnd; i++) {
            const scene = scenes[i];
            const videoPrompt = `${scene.image_prompt}, ${finalSettings.style} style, cinematic motion`;
            const seed = Math.floor(Math.random() * 2_147_483_647);
            batchPromises.push(
              generateVideo(videoPrompt, {
                duration: Math.min(10, Math.max(3, scene.duration)),
                resolution: finalSettings.resolution,
                seed,
                aspect: finalSettings.aspect,
              })
                .then((blob) => ({ i, blob, ok: true }))
                .catch(() => ({ i, blob: null, ok: false })),
            );
          }
          const results = await Promise.all(batchPromises);
          for (const { i, blob, ok } of results) {
            if (ok && blob && blob.size > 0) {
              const url = URL.createObjectURL(blob);
              scenes[i] = {
                ...scenes[i],
                ai_video_url: url,
                ai_video_status: 'ready',
              };
              setProgressMsg(`AI video üretildi: Sahne ${i + 1}`);
            } else {
              scenes[i] = { ...scenes[i], ai_video_status: 'failed' };
              setProgressMsg(`AI video başarısız: Sahne ${i + 1} — görsel kullanılacak`);
            }
          }
          const done = Math.min(batchEnd, scenes.length);
          setProgressMsg(`AI video üretiliyor... (${done}/${scenes.length})`);
        }
      }

      setProgressMsg(null);
      onGenerated(title, scenes, finalSettings);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setProgressMsg(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
          Video Fikri
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={5}
          className="w-full rounded-xl bg-slate-950 border border-slate-800 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-blue-500 resize-none transition"
          placeholder="Örn: Mars'ta bir astronotun günü boyunca yaşadıkları..."
          disabled={loading}
        />
      </div>

      {/* Brief detection */}
      {isBrief && parsedBrief && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <ScanLine size={14} />
            Brief algılandı — ayarlar otomatik uygulanacak
          </div>
          <div className="flex flex-wrap gap-1.5">
            {parsedBrief.detectionReasons.map((r, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs text-emerald-300 bg-emerald-500/10 rounded-full px-2 py-0.5">
                <CheckCircle2 size={10} />
                {r}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Target duration */}
      {!isBrief && (
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
            Hedef Süre <span className="text-slate-600 normal-case font-normal">(her 5 sn = 1 sahne)</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {durationOptions.map((s) => (
              <button
                key={s.v}
                onClick={() => setTargetDuration(s.v)}
                disabled={loading}
                className={`rounded-lg p-3 text-center transition disabled:opacity-40 ${
                  targetDuration === s.v
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <div className="text-sm font-medium">{s.label}</div>
                <div className="text-xs opacity-60 mt-0.5">{s.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Language selector */}
      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
          Anlatım Dili
        </label>
        <div className="grid grid-cols-3 gap-2">
          {([
            { v: 'auto', label: 'Otomatik', desc: 'Prompt\'a göre' },
            { v: 'tr-TR', label: 'Türkçe', desc: 'Türkçe seslendirme' },
            { v: 'en-US', label: 'English', desc: 'English narration' },
          ] as const).map((opt) => (
            <button
              key={opt.v}
              onClick={() => setManualLang(opt.v)}
              disabled={loading}
              className={`rounded-lg p-3 text-center transition disabled:opacity-40 ${
                manualLang === opt.v
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <div className="text-sm font-medium flex items-center justify-center gap-1.5">
                {opt.v !== 'auto' && <Globe size={12} />}
                {opt.label}
              </div>
              <div className="text-xs opacity-60 mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
        {langOverride && manualLang === 'auto' && (
          <p className="text-xs text-blue-300 mt-2 flex items-center gap-1.5">
            <Globe size={12} />
            Prompt'ta dil komutu algılandı: <strong>{langOverride.lang === 'tr-TR' ? 'Türkçe' : 'English'}</strong>
          </p>
        )}
      </div>

      {/* Info banner */}
      <div className="rounded-lg bg-slate-800/50 border border-slate-700 px-4 py-3 text-xs text-slate-300 flex items-start gap-2">
        <Sparkles size={14} className="mt-0.5 shrink-0 text-blue-400" />
        <div>
          Yapay zeka senaryoyu yazar, her sahne için görsel oluşturur ve seslendirme ekler.
          Stok videolar Pexels'ten otomatik bulunur. Tamamen tarayıcıda çalışır.
        </div>
      </div>

      {/* Progress */}
      {progressMsg && (
        <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-4 py-3 text-xs text-blue-300 flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" />
          {progressMsg}
        </div>
      )}

      {/* Fallback notice */}
      {usedFallback && !loading && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-xs text-amber-300 flex items-center gap-2">
          <AlertCircle size={14} />
          AI servisi geçici olarak yanıt vermedi, yerel senaryo üretici kullanıldı.
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <button
        onClick={() => setShowMediaPicker(true)}
        disabled={loading || !prompt.trim()}
        className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-semibold transition disabled:opacity-40 shadow-lg shadow-blue-600/20"
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            {progressMsg ? 'İşleniyor...' : 'Senaryo oluşturuluyor...'}
          </>
        ) : (
          <>
            <Wand2 size={18} />
            {isBrief ? 'Brief ile Video Oluştur' : 'Video Oluştur'}
          </>
        )}
      </button>

      {showMediaPicker && (
        <MediaSourcePicker
          current={settings.mediaSource}
          onPick={(source) => {
            setShowMediaPicker(false);
            generate(source);
          }}
          onClose={() => setShowMediaPicker(false)}
        />
      )}
    </div>
  );
}

function MediaSourcePicker({
  current,
  onPick,
  onClose,
}: {
  current: MediaSource;
  onPick: (source: MediaSource) => void;
  onClose: () => void;
}) {
  const options: { v: MediaSource; label: string; desc: string; icon: typeof Film; color: string }[] = [
    { v: 'stock', label: 'Hazır Stok Video', desc: 'Pexels telifsiz videolar — hızlı ve gerçekçi', icon: Film, color: 'from-blue-500 to-cyan-500' },
    { v: 'ai', label: 'Yapay Zeka Görseli', desc: 'Her sahne için AI ile özel görsel üretilir', icon: ImageIcon, color: 'from-emerald-500 to-teal-500' },
    { v: 'ai-video', label: 'Yapay Zeka Videosu', desc: 'Her sahne için AI ile hareketli video klipleri üretilir (en yavaş)', icon: Clapperboard, color: 'from-amber-500 to-orange-500' },
    { v: 'auto', label: 'Otomatik', desc: 'Önce stok video, bulunamazsa AI görsel kullanılır', icon: Sparkles, color: 'from-slate-500 to-slate-600' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Video size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Görsel Kaynağını Seç</h2>
              <p className="text-xs text-slate-400">Videonuzdaki görseller nasıl oluşturulsun?</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition p-1">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {options.map((opt) => {
            const Icon = opt.icon;
            const isActive = current === opt.v;
            return (
              <button
                key={opt.v}
                onClick={() => onPick(opt.v)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition text-left ${
                  isActive
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-slate-800 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${opt.color} flex items-center justify-center shrink-0`}>
                  <Icon size={22} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{opt.label}</span>
                    {isActive && <CheckCircle2 size={15} className="text-blue-400" />}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-6 py-3 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-500">Seçiminizi yaptıktan sonra video oluşturma başlayacak</p>
        </div>
      </div>
    </div>
  );
}
