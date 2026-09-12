export function detectLangOverride(prompt: string): 'en' | 'tr' {
  const turkishMarkers = /[çğıöşüÇĞİÖŞÜ]/g;
  return turkishMarkers.test(prompt) ? 'tr' : 'en';
}

export type LangOverride = 'en' | 'tr' | 'auto';

export type AIScene = { narration: string; image_prompt: string; search_query: string };

export function buildScriptMessages(
  prompt: string,
  sceneCount: number,
  targetLang?: 'tr-TR' | 'en-US',
): { system: string; user: string } {
  const isTurkish = targetLang === 'tr-TR' || (!targetLang && detectLangOverride(prompt) === 'tr');

  const system = isTurkish
    ? `Sen bir YouTube video senarisyönü. ${sceneCount} bölümden oluşan, ilgi çekici ve detaylı senaryo yaz.
Çıktı MUTLAKA bu JSON formatında olmalı:
{
  "title": "Video Başlığı",
  "scenes": [
    {
      "narration": "Anlatılan metin",
      "image_prompt": "Görsel prompt Dallı için",
      "search_query": "Stok video arama sorgusu"
    }
  ]
}
Her sahne kendi arama sorgusuna sahip olmalı. search_query boş olmamalı.`
    : `You are a YouTube video scriptwriter. Write a compelling and detailed script with ${sceneCount} parts.
Output MUST be in this JSON format:
{
  "title": "Video Title",
  "scenes": [
    {
      "narration": "Narration text",
      "image_prompt": "Visual prompt for Dall-E",
      "search_query": "Stock video search query"
    }
  ]
}
Each scene must have its own search query. search_query must not be empty.`;

  const user = isTurkish
    ? `Konu: ${prompt}\n\nBu konu hakkında ${sceneCount} bölümde senaryo yaz. Her bölüm net bir arama sorgusuna sahip olmalı.`
    : `Topic: ${prompt}\n\nWrite a script with ${sceneCount} parts about this topic. Each part must have a clear search query.`;

  return { system, user };
}

export async function imageUrl(url: string, timeout: number = 8000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`Image load timeout after ${timeout}ms`));
      }
    }, timeout);
    img.onload = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(img);
      }
    };
    img.onerror = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`Failed to load image: ${url.slice(0, 80)}...`));
      }
    };
    img.src = url;
  });
}

const voicePitchMap: Record<string, number> = {
  nova: 1.1,
  shimmer: 1.05,
  coral: 0.95,
  sage: 0.9,
  echo: 1.0,
  onyx: 0.95,
  ash: 1.05,
  fable: 1.0,
  verse: 1.15,
  alloy: 1.0,
};

async function pollyTTS(text: string, voice: string, audioCtx: AudioContext | OfflineAudioContext): Promise<AudioBuffer> {
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': 'sk_live_placeholder',
      },
      body: JSON.stringify({ text, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    });

    if (!response.ok) throw new Error('TTS API failed');

    const arrayBuffer = await response.arrayBuffer();
    return audioCtx.decodeAudioData(arrayBuffer);
  } catch {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = window.speechSynthesis.getVoices().find((v) => v.name.includes(voice)) || null;
    utterance.rate = 1.0;
    utterance.pitch = voicePitchMap[voice] || 1.0;

    return new Promise((resolve, reject) => {
      const offlineCtx = audioCtx as OfflineAudioContext;
      const mediaStreamDest = (audioCtx as any).createMediaStreamDestination?.();
      if (!mediaStreamDest) {
        reject(new Error('MediaStreamDestination not supported'));
        return;
      }
      const mediaRecorder = new MediaRecorder(mediaStreamDest.stream);
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const arrayBuffer = reader.result as ArrayBuffer;
            resolve(await audioCtx.decodeAudioData(arrayBuffer));
          } catch (e) {
            reject(e);
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(blob);
      };

      mediaRecorder.start();
      utterance.onend = () => mediaRecorder.stop();
      utterance.onerror = (e) => reject(new Error(`Speech error: ${e.error}`));
      window.speechSynthesis.speak(utterance);
    });
  }
}

async function pitchShift(buffer: AudioBuffer, ratio: number, audioCtx: AudioContext | OfflineAudioContext): Promise<AudioBuffer> {
  const length = buffer.length * ratio;
  const shifted = audioCtx.createBuffer(buffer.numberOfChannels, Math.floor(length), buffer.sampleRate * ratio);
  const data = buffer.getChannelData(0);
  const shiftedData = shifted.getChannelData(0);
  for (let i = 0; i < shiftedData.length; i++) {
    shiftedData[i] = data[Math.floor(i / ratio)] || 0;
  }
  return shifted;
}

export async function generateSpeech(text: string, voice: string, audioCtx: AudioContext | OfflineAudioContext): Promise<AudioBuffer> {
  if (!text.trim()) return audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
  try {
    const pollyBuffer = await pollyTTS(text, voice, audioCtx);
    const ratio = voicePitchMap[voice] ?? 1.0;
    if (ratio === 1.0) return pollyBuffer;
    return await pitchShift(pollyBuffer, ratio, audioCtx);
  } catch (error) {
    console.warn('generateSpeech fallback:', error);
    return audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate);
  }
}
