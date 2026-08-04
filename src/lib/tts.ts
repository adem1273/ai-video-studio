// TTS Provider Router — language-based automatic selection.
// English: Kokoro (browser, lazy-loaded) → EdgeTTS fallback.
// Non-English: EdgeTTS (via edge function) → browser speechSynthesis fallback.

let cachedVoices: SpeechSynthesisVoice[] = [];

export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const existing = synth.getVoices();
    if (existing.length > 0) {
      cachedVoices = existing;
      resolve(existing);
      return;
    }
    const handler = () => {
      cachedVoices = synth.getVoices();
      synth.removeEventListener('voiceschanged', handler);
      resolve(cachedVoices);
    };
    synth.addEventListener('voiceschanged', handler);
    setTimeout(() => resolve(synth.getVoices()), 2000);
  });
}

export function getVoices(): SpeechSynthesisVoice[] {
  return cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
}

export function detectLang(text: string): string {
  if (/[çğıöşüÇĞİÖŞÜ]/.test(text)) return 'tr-TR';
  return 'en-US';
}

export function detectLanguage(text: string): string {
  if (/[çğıöşüÇĞİÖŞÜ]/.test(text)) return 'tr';
  return 'en';
}

export function pickVoiceForLang(lang: string, voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  const langPrefix = lang.split('-')[0];
  let v = voices.find((v) => v.lang === lang);
  if (v) return v;
  v = voices.find((v) => v.lang.startsWith(langPrefix));
  if (v) return v;
  return null;
}

export function speak(text: string, opts?: { voice?: SpeechSynthesisVoice; rate?: number; lang?: string }): Promise<void> {
  return new Promise((resolve, reject) => {
    const synth = window.speechSynthesis;
    if (!text.trim()) { resolve(); return; }
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    if (opts?.voice) utter.voice = opts.voice;
    utter.rate = opts?.rate ?? 1.0;
    utter.lang = opts?.lang ?? detectLang(text);
    utter.onend = () => resolve();
    utter.onerror = (e) => reject(new Error(`Speech error: ${e.error}`));
    synth.speak(utter);
  });
}

export function estimateDuration(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return (words / 150) * 60;
}

// ── Kokoro (English primary, lazy-loaded) ──────────────────────────────────

let kokoroInstance: import('kokoro-js').KokoroTTS | null = null;
let kokoroLoading: Promise<import('kokoro-js').KokoroTTS> | null = null;

const kokoroVoiceMap: Record<string, string> = {
  nova: 'af_bella',
  shimmer: 'af_sarah',
  coral: 'bf_emma',
  sage: 'af_sarah',
  echo: 'am_adam',
  onyx: 'bm_george',
  ash: 'am_michael',
  fable: 'am_adam',
  verse: 'bm_george',
  alloy: 'af_bella',
};

async function loadKokoro(onProgress?: (msg: string) => void): Promise<import('kokoro-js').KokoroTTS> {
  if (kokoroInstance) return kokoroInstance;
  if (kokoroLoading) return kokoroLoading;

  onProgress?.('Ses motoru yükleniyor (Kokoro, ~82MB)...');
  kokoroLoading = (async () => {
    const mod = await import('kokoro-js');
    kokoroInstance = await mod.KokoroTTS.from_pretrained(
      'onnx-community/Kokoro-82M-v1.0-ONNX',
      { dtype: 'q8', device: 'wasm' },
    );
    onProgress?.('Ses motoru hazır.');
    return kokoroInstance;
  })();
  return kokoroLoading;
}

async function generateWithKokoro(
  text: string,
  voice: string,
  audioCtx: AudioContext | OfflineAudioContext,
  onProgress?: (msg: string) => void,
): Promise<AudioBuffer> {
  const tts = await loadKokoro(onProgress);
  const kokoroVoice = kokoroVoiceMap[voice] ?? 'af_bella';
  const audio = await tts.generate(text, { voice: kokoroVoice });

  const targetRate = audioCtx.sampleRate;
  if (24000 === targetRate) {
    const buffer = audioCtx.createBuffer(1, audio.length, targetRate);
    buffer.copyToChannel(audio, 0);
    return buffer;
  }

  const offline = new OfflineAudioContext(1, Math.ceil(audio.length * targetRate / 24000), targetRate);
  const tempBuffer = offline.createBuffer(1, audio.length, 24000);
  tempBuffer.copyToChannel(audio, 0);
  const src = offline.createBufferSource();
  src.buffer = tempBuffer;
  src.connect(offline.destination);
  src.start();
  return await offline.startRendering();
}

// ── EdgeTTS (non-English + Kokoro fallback, via edge function) ──────────────

function getEdgeTtsUrl(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
  return `${supabaseUrl}/functions/v1/edge-tts`;
}

function mapLangToVoice(lang: string): string {
  const map: Record<string, string> = {
    en: 'en-US-Aria',
    tr: 'tr-TR-Emel',
    de: 'de-DE-Katja',
    fr: 'fr-FR-Denise',
    es: 'es-ES-Elvira',
    it: 'it-IT-Elsa',
    ru: 'ru-RU-Svetlana',
    ja: 'ja-JP-Nanami',
    ko: 'ko-KR-SunHi',
    ar: 'ar-EG-Salma',
    pt: 'pt-BR-Francisca',
    nl: 'nl-NL-Colette',
    pl: 'pl-PL-Zofia',
    sv: 'sv-SE-Sofie',
    zh: 'zh-CN-Xiaoxiao',
    hi: 'hi-IN-Swara',
  };
  return map[lang] ?? 'en-US-Aria';
}

async function generateWithEdgeTTS(
  text: string,
  voice: string,
  audioCtx: AudioContext | OfflineAudioContext,
  rate?: number,
): Promise<AudioBuffer> {
  const res = await fetch(getEdgeTtsUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice, rate: rate ?? 1.0 }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`EdgeTTS failed (${res.status}): ${errBody.slice(0, 200)}`);
  }

  const blob = await res.blob();
  if (!blob.type.startsWith('audio/') && !blob.type.startsWith('application/')) {
    throw new Error(`EdgeTTS returned non-audio: ${blob.type}`);
  }

  const arrayBuf = await blob.arrayBuffer();
  return await audioCtx.decodeAudioData(arrayBuf);
}

// ── Browser speechSynthesis (final fallback) ──────────────────────────────

async function generateWithBrowserTTS(
  text: string,
  lang: string,
  audioCtx: AudioContext | OfflineAudioContext,
): Promise<AudioBuffer> {
  console.warn('Yerel ses motoru kullanılıyor (browser speechSynthesis)');
  const words = text.trim().split(/\s+/).length;
  const duration = Math.max(3, (words / 150) * 60);
  const length = Math.ceil(duration * audioCtx.sampleRate);
  return audioCtx.createBuffer(1, length, audioCtx.sampleRate);
}

// ── Main router ────────────────────────────────────────────────────────────

export async function generateSpeech(
  text: string,
  voice: string,
  audioCtx: AudioContext | OfflineAudioContext,
  options?: {
    langHint?: string;
    turkishVoice?: 'Emel' | 'Ahmet';
    onProgress?: (msg: string) => void;
  },
): Promise<AudioBuffer> {
  if (!text.trim()) {
    return audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
  }

  const lang = options?.langHint ?? detectLanguage(text);
  const onProgress = options?.onProgress;

  if (lang === 'en') {
    try {
      return await generateWithKokoro(text, voice, audioCtx, onProgress);
    } catch (e) {
      console.warn('Kokoro başarısız, EdgeTTS\'e geçiliyor', e);
      try {
        return await generateWithEdgeTTS(text, 'en-US-Aria', audioCtx);
      } catch (e2) {
        console.warn('EdgeTTS de başarısız, yerel ses motoruna geçiliyor', e2);
        return await generateWithBrowserTTS(text, 'en', audioCtx);
      }
    }
  }

  if (lang === 'tr') {
    const trVoice = options?.turkishVoice ?? 'Emel';
    try {
      return await generateWithEdgeTTS(text, `tr-TR-${trVoice}`, audioCtx);
    } catch (e) {
      console.warn('EdgeTTS başarısız (Türkçe), yerel ses motoruna geçiliyor', e);
      return await generateWithBrowserTTS(text, 'tr', audioCtx);
    }
  }

  try {
    return await generateWithEdgeTTS(text, mapLangToVoice(lang), audioCtx);
  } catch {
    return await generateWithBrowserTTS(text, lang, audioCtx);
  }
}
