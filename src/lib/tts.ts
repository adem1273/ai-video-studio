let cachedVoices: SpeechSynthesisVoice[] = [];

export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const existing = synth.getVoices();
    if (existing.length > 0) { cachedVoices = existing; resolve(existing); return; }
    const handler = () => { cachedVoices = synth.getVoices(); synth.removeEventListener('voiceschanged', handler); resolve(cachedVoices); };
    synth.addEventListener('voiceschanged', handler);
    setTimeout(() => { resolve(synth.getVoices()); }, 2000);
  });
}

export function getVoices(): SpeechSynthesisVoice[] {
  return cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
}

export function detectLang(text: string): string {
  if (/[çğıöşüÇĞİÖŞÜ]/.test(text)) return 'tr-TR';
  return 'en-US';
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
