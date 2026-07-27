// Pollinations.ai free APIs — no key required.
import { generateLocalScript } from './scriptGenerator';

const TEXT_API = 'https://text.pollinations.ai';
const IMAGE_API = 'https://image.pollinations.ai/prompt';
const REFERRER = 'montaj.app';

export type LangOverride = { lang: 'tr-TR' | 'en-US'; cleanPrompt: string } | null;

export function detectLangOverride(prompt: string): LangOverride {
  const t = prompt.toLowerCase();
  const trPatterns = [
    /(?:bunu\s+)?t[uü]rk[cç]e\s+(?:[uü]ret|yaz|anlat|olu[sş]tur|haz.?rla)/,
    /(?:[uü]ret|yaz|anlat|olu[sş]tur|haz.?rla)\s+(?:bunu\s+)?t[uü]rk[cç]e/,
    /t[uü]rk[cç]e\s+(?:olarak\s+)?(?:[uü]ret|yaz|anlat)/,
    /(?:sonunda|en sonunda)\s+(?:bunu\s+)?t[uü]rk[cç]e\s+(?:[uü]ret|yaz)/,
    /(?:produce|generate|make|create|write)\s+(?:this\s+)?(?:in\s+)?turkish/,
    /(?:in\s+)?turkish\s+(?:please|pls)?$/,
  ];
  for (const p of trPatterns) { if (p.test(t)) return { lang: 'tr-TR', cleanPrompt: prompt.replace(new RegExp(p.source, 'gi'), '').trim() }; }
  const enPatterns = [
    /(?:bunu\s+)?ingilizce\s+(?:[uü]ret|yaz|anlat|olu[sş]tur|haz.?rla)/,
    /(?:[uü]ret|yaz|anlat|olu[sş]tur|haz.?rla)\s+(?:bunu\s+)?ingilizce/,
    /ingilizce\s+(?:olarak\s+)?(?:[uü]ret|yaz|anlat)/,
    /(?:produce|generate|make|create|write)\s+(?:this\s+)?(?:in\s+)?english/,
    /(?:in\s+)?english\s+(?:please|pls)?$/,
  ];
  for (const p of enPatterns) { if (p.test(t)) return { lang: 'en-US', cleanPrompt: prompt.replace(new RegExp(p.source, 'gi'), '').trim() }; }
  return null;
}

export type AIScene = { narration: string; image_prompt: string; search_query: string };

export async function generateScript(prompt: string, sceneCount: number, targetLang?: 'tr-TR' | 'en-US'): Promise<{ title: string; scenes: AIScene[] }> {
  const langInstruction = targetLang === 'tr-TR'
    ? 'CRITICAL: ALL narration and the title MUST be in Turkish (Türkçe). Write every narration line in Turkish, even if the user prompt is in English. Subtitles will be in Turkish.'
    : targetLang === 'en-US'
      ? 'CRITICAL: ALL narration and the title MUST be in English. Write every narration line in English, even if the user prompt is in Turkish.'
      : 'Narration language must match the user\'s prompt language (Turkish prompt → Turkish narration, English → English).';
  const systemPrompt = `You are a professional video scriptwriter and researcher. Create a compelling, FACTUAL video script about the user's topic.\n\nCritical rules:\n- ${langInstruction}\n- The language instruction applies ONLY to the narration text and title. It does NOT affect the visual content. Do NOT add Turkish flags, Turkish cultural symbols, Turkish landmarks, or any country-specific imagery just because the narration is in Turkish. The visuals must match the TOPIC, not the language.\n- The user's input may contain video production specifications (format, aspect ratio, duration, visual style, etc.). IGNORE all production specifications — your job is to write NARRATION about the TOPIC, not about video settings.\n- Research the topic thoroughly. Include real facts, names, dates, and specific details — NOT generic filler.\n- Each scene's narration must contain concrete information that teaches or tells something specific about the topic.\n- Do NOT use generic phrases like "let's explore" or "this is interesting". Instead, state actual facts: names, numbers, events, causes, effects.\n- Each "image_prompt" must describe EXACTLY what the narration is talking about. Be specific about the subject, action, and setting.\n- Each "image_prompt" must describe a visual that looks like REAL DOCUMENTARY FOOTAGE or REAL NEWS PHOTOGRAPHY — not AI art. Use words like "documentary photograph", "news photo", "real footage", "handheld", "natural lighting", "candid".\n- Each "search_query" must be 2-4 SIMPLE English nouns that directly describe the MAIN SUBJECT of that scene's narration.\n- The search_query MUST be in English even if narration is in Turkish.\n- CRITICAL: The search_query must use CONCRETE VISUAL NOUNS that a stock video library would have — real objects, places, people, buildings, natural phenomena.\n- Output ONLY valid JSON, no markdown, no explanation.\n- The JSON must have: "title" (string), "scenes" (array).\n- Each scene has: "narration" (1-3 sentences spoken aloud, max 30 words), "image_prompt" (detailed visual description in English, documentary/photojournalism style), "search_query" (2-4 simple English nouns for stock video search).\n- Aim for ${sceneCount} scenes.`;
  const body = { model: 'openai', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: `User request: ${prompt}` }], referrer: REFERRER };
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(`${TEXT_API}/openai`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.status === 402 || res.status === 429) { lastError = new Error(`Rate limited (${res.status}), retrying...`); const wait = Math.min(10000 * Math.pow(1.5, attempt), 60000); await new Promise((r) => setTimeout(r, wait)); continue; }
      if (!res.ok) throw new Error(`Script generation failed (${res.status})`);
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty response from API');
      let parsed: unknown;
      try { parsed = JSON.parse(content); } catch { const match = content.match(/\{[\s\S]*\}/); if (!match) throw new Error('Could not parse script response'); parsed = JSON.parse(match[0]); }
      const result = parsed as { title: string; scenes: AIScene[] };
      if (!result.title || !Array.isArray(result.scenes) || result.scenes.length === 0) throw new Error('Invalid script structure');
      result.scenes = result.scenes.map((s) => ({ ...s, search_query: s.search_query || '' }));
      return result;
    } catch (err) { lastError = err as Error; if (attempt < 5) await new Promise((r) => setTimeout(r, (attempt + 1) * 5000)); }
  }
  const local = generateLocalScript(prompt, sceneCount, 'cinematic', targetLang);
  return { title: local.title, scenes: local.scenes.map((s) => ({ narration: s.narration, image_prompt: s.image_prompt, search_query: '' })) };
}

export function imageUrl(prompt: string, opts?: { width?: number; height?: number; seed?: number }): string {
  const width = opts?.width ?? 1280; const height = opts?.height ?? 720;
  const seed = opts?.seed ?? Math.floor(Math.random() * 1_000_000);
  const encoded = encodeURIComponent(prompt);
  return `${IMAGE_API}/${encoded}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=flux&referrer=${REFERRER}`;
}

export function regenerateImageUrl(prompt: string, aspect: '16:9' | '9:16' | '1:1', resolution: '720p' | '1080p'): string {
  const base = resolution === '1080p' ? 1080 : 720;
  const dims = aspect === '16:9' ? { width: Math.round((base * 16) / 9), height: base } : aspect === '9:16' ? { width: base, height: Math.round((base * 16) / 9) } : { width: base, height: base };
  return imageUrl(prompt, { width: dims.width, height: dims.height, seed: Math.floor(Math.random() * 1_000_000) });
}

export function preloadImage(url: string, timeoutMs: number = 15000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    let settled = false;
    const timer = setTimeout(() => { if (!settled) { settled = true; img.src = ''; reject(new Error(`Image load timeout: ${url.slice(0, 80)}...`)); } }, timeoutMs);
    img.onload = () => { if (!settled) { settled = true; clearTimeout(timer); resolve(img); } };
    img.onerror = () => { if (!settled) { settled = true; clearTimeout(timer); reject(new Error(`Failed to load image: ${url.slice(0, 80)}...`)); } };
    img.src = url;
  });
}

const VIDEO_API = 'https://gen.pollinations.ai/video';
const VIDEO_MODELS = ['wan', 'wan-fast', 'seedance', 'veo'];

export async function generateVideo(prompt: string, opts?: { duration?: number; resolution?: string; seed?: number; aspect?: string }): Promise<Blob> {
  const duration = Math.min(8, Math.max(2, opts?.duration ?? 5));
  const seed = opts?.seed ?? Math.floor(Math.random() * 2_147_483_647);
  const aspectRatio = opts?.aspect === '9:16' ? '9:16' : '16:9';
  const encoded = encodeURIComponent(prompt);
  const params = new URLSearchParams({ model: 'wan', duration: String(duration), seed: String(seed), aspectRatio, referrer: REFERRER });
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < VIDEO_MODELS.length; attempt++) {
    const model = VIDEO_MODELS[attempt];
    params.set('model', model);
    const url = `${VIDEO_API}/${encoded}?${params.toString()}`;
    try {
      const res = await fetch(url);
      if (res.status === 402 || res.status === 429) { lastError = new Error(`Video API rate limited (${res.status}) with model ${model}`); await new Promise((r) => setTimeout(r, (attempt + 1) * 3000)); continue; }
      if (!res.ok) { lastError = new Error(`Video generation failed (${res.status}) with model ${model}`); continue; }
      const blob = await res.blob();
      if (blob.size > 0 && blob.type.startsWith('video/')) return blob;
      lastError = new Error(`Empty/invalid video blob with model ${model}`);
    } catch (err) { lastError = err as Error; await new Promise((r) => setTimeout(r, (attempt + 1) * 2000)); }
  }
  throw lastError ?? new Error('Video generation failed after all models');
}

const voicePitchMap: Record<string, number> = {
  nova: 1.0, shimmer: 1.12, coral: 0.94, sage: 0.88, echo: 0.82, onyx: 0.75, ash: 0.85, fable: 0.80, verse: 0.78, alloy: 1.0,
};

const pollyVoiceMap: Record<string, { en: string; tr: string; gender: string; desc: string }> = {
  nova: { en: 'Joanna', tr: 'Filiz', gender: 'Kadın', desc: 'Sıcak' },
  shimmer: { en: 'Kimberly', tr: 'Filiz', gender: 'Kadın', desc: 'Enerjik' },
  coral: { en: 'Amy', tr: 'Filiz', gender: 'Kadın', desc: 'Yumuşak' },
  sage: { en: 'Joanna', tr: 'Filiz', gender: 'Kadın', desc: 'Sakin' },
  echo: { en: 'Matthew', tr: 'Filiz', gender: 'Erkek', desc: 'Net' },
  onyx: { en: 'Brian', tr: 'Filiz', gender: 'Erkek', desc: 'Derin' },
  ash: { en: 'Justin', tr: 'Filiz', gender: 'Erkek', desc: 'Genç' },
  fable: { en: 'Matthew', tr: 'Filiz', gender: 'Erkek', desc: 'Anlatıcı' },
  verse: { en: 'Brian', tr: 'Filiz', gender: 'Erkek', desc: 'Edebi' },
  alloy: { en: 'Joanna', tr: 'Filiz', gender: 'Nötr', desc: 'Dengeli' },
};

export async function generateSpeech(text: string, voice: string, audioCtx: AudioContext | OfflineAudioContext): Promise<AudioBuffer> {
  if (!text.trim()) return audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
  try { const pollyBuffer = await pollyTTS(text, voice, audioCtx); const ratio = voicePitchMap[voice] ?? 1.0; if (ratio === 1.0) return pollyBuffer; return await pitchShift(pollyBuffer, ratio, audioCtx); } catch { /* continue */ }
  try { return await pollinationsTTS(text, voice, audioCtx); } catch { /* continue */ }
  const raw = await googleTTS(text, audioCtx);
  const ratio = voicePitchMap[voice] ?? 1.0;
  if (ratio === 1.0) return raw;
  return await pitchShift(raw, ratio, audioCtx);
}

async function pitchShift(buffer: AudioBuffer, ratio: number, audioCtx: AudioContext | OfflineAudioContext): Promise<AudioBuffer> {
  const targetLength = Math.round(buffer.length / ratio);
  const offline = new OfflineAudioContext(1, targetLength, audioCtx.sampleRate);
  const source = offline.createBufferSource(); source.buffer = buffer; source.playbackRate.value = ratio;
  source.connect(offline.destination); source.start();
  return await offline.startRendering();
}

async function pollyTTS(text: string, voice: string, audioCtx: AudioContext | OfflineAudioContext): Promise<AudioBuffer> {
  const isTurkish = /[çğıöşüÇĞİÖŞÜ]/.test(text);
  const voiceEntry = pollyVoiceMap[voice] ?? pollyVoiceMap.alloy;
  const pollyVoice = isTurkish ? voiceEntry.tr : voiceEntry.en;
  const chunks = chunkText(text, 500);
  const audioBuffers: AudioBuffer[] = [];
  for (const chunk of chunks) {
    const encoded = encodeURIComponent(chunk);
    const url = `https://api.streamelements.com/kappa/v2/speech?voice=${pollyVoice}&text=${encoded}`;
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Polly TTS failed (${res.status})`);
        const blob = await res.blob();
        if (!blob.type.startsWith('audio/') && !blob.type.startsWith('application/')) throw new Error('Not audio response');
        const arrayBuf = await blob.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuf);
        audioBuffers.push(audioBuffer); lastError = null; break;
      } catch (err) { lastError = err as Error; if (attempt < 1) await new Promise((r) => setTimeout(r, 1000)); }
    }
    if (lastError) throw lastError;
  }
  if (audioBuffers.length === 1) return audioBuffers[0];
  const totalLength = audioBuffers.reduce((sum, b) => sum + b.length, 0);
  const combined = audioCtx.createBuffer(audioBuffers[0].numberOfChannels, totalLength, audioCtx.sampleRate);
  for (let ch = 0; ch < combined.numberOfChannels; ch++) {
    const channelData = combined.getChannelData(ch); let offset = 0;
    for (const buf of audioBuffers) { channelData.set(buf.getChannelData(ch), offset); offset += buf.length; }
  }
  return combined;
}

async function pollinationsTTS(text: string, voice: string, audioCtx: AudioContext | OfflineAudioContext): Promise<AudioBuffer> {
  const encoded = encodeURIComponent(text.slice(0, 1000));
  const url = `https://gen.pollinations.ai/audio/${encoded}?voice=${voice}&referrer=${REFERRER}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pollinations TTS failed (${res.status})`);
  const blob = await res.blob();
  if (!blob.type.startsWith('audio/')) throw new Error('Not audio response');
  const arrayBuf = await blob.arrayBuffer();
  return await audioCtx.decodeAudioData(arrayBuf);
}

function chunkText(text: string, maxLen = 190): string[] {
  const clean = text.trim();
  if (clean.length <= maxLen) return [clean];
  const chunks: string[] = [];
  const sentences = clean.split(/(?<=[.!?])\s+/);
  let current = '';
  for (const sentence of sentences) {
    if (sentence.length > maxLen) {
      if (current) { chunks.push(current); current = ''; }
      const parts = sentence.split(/(?<=,)\s+/);
      let part = '';
      for (const p of parts) {
        if ((part + ' ' + p).trim().length > maxLen) { if (part) chunks.push(part.trim()); part = p; }
        else part = (part + ' ' + p).trim();
      }
      if (part) { if (current && (current + ' ' + part).length <= maxLen) current = current + ' ' + part; else { if (current) chunks.push(current); current = part; } }
    } else if ((current + ' ' + sentence).trim().length > maxLen) { if (current) chunks.push(current); current = sentence; }
    else current = (current + ' ' + sentence).trim();
  }
  if (current) chunks.push(current);
  return chunks;
}

async function googleTTS(text: string, audioCtx: AudioContext | OfflineAudioContext): Promise<AudioBuffer> {
  const lang = /[çğıöşüÇĞİÖŞÜ]/.test(text) ? 'tr' : 'en';
  const chunks = chunkText(text);
  const audioBuffers: AudioBuffer[] = [];
  for (const chunk of chunks) {
    const encoded = encodeURIComponent(chunk);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${lang}&client=tw-ob`;
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Referer': 'https://translate.google.com/' } });
        if (!res.ok) throw new Error(`TTS failed (${res.status})`);
        const blob = await res.blob();
        if (!blob.type.startsWith('audio/') && !blob.type.startsWith('application/')) throw new Error('Not audio response');
        const arrayBuf = await blob.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuf);
        audioBuffers.push(audioBuffer); lastError = null; break;
      } catch (err) { lastError = err as Error; if (attempt < 2) await new Promise((r) => setTimeout(r, (attempt + 1) * 1500)); }
    }
    if (lastError) throw lastError;
  }
  if (audioBuffers.length === 1) return audioBuffers[0];
  const totalLength = audioBuffers.reduce((sum, b) => sum + b.length, 0);
  const combined = audioCtx.createBuffer(1, totalLength, audioCtx.sampleRate);
  const channelData = combined.getChannelData(0); let offset = 0;
  for (const buf of audioBuffers) { channelData.set(buf.getChannelData(0), offset); offset += buf.length; }
  return combined;
}
