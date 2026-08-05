import { useEffect, useState, useRef } from 'react';
import { Volume2, VolumeX, ExternalLink, Play, Loader2 } from 'lucide-react';
import { loadVoices, generateSpeech } from '@/lib/tts';
import { playPreviewMusic, stopPreviewMusic } from '@/lib/music';
import { ApiKeysSettings } from '@/components/ApiKeysSettings';
import type { ProjectSettings, MusicStyle, TransitionType, TTSVoice, TTSMode, MediaSource, SubtitleStyle, SubtitleColor, BrandConfig } from '@/lib/types';

type Props = {
  settings: ProjectSettings;
  onChange: (s: ProjectSettings) => void;
};

const musicOptions: { v: MusicStyle; label: string }[] = [
  { v: 'none', label: 'Müzik yok' },
  { v: 'ambient', label: 'Ambient' },
  { v: 'cinematic', label: 'Sinematik' },
  { v: 'uplifting', label: 'Yükseliyor' },
  { v: 'lofi', label: 'Lo-Fi' },
  { v: 'dramatic', label: 'Dramatik' },
];

const transitionOptions: { v: TransitionType; label: string }[] = [
  { v: 'fade', label: 'Fade' },
  { v: 'crossfade', label: 'Çapraz Geçiş' },
  { v: 'slide', label: 'Kaydırma' },
  { v: 'zoom', label: 'Zoom' },
  { v: 'cut', label: 'Kesme' },
];

const ttsVoiceOptions: { v: TTSVoice; label: string }[] = [
  { v: 'nova', label: 'Nova — Kadın, Sıcak' },
  { v: 'shimmer', label: 'Shimmer — Kadın, Enerjik' },
  { v: 'coral', label: 'Coral — Kadın, Yumuşak' },
  { v: 'sage', label: 'Sage — Kadın, Sakin' },
  { v: 'echo', label: 'Echo — Erkek, Net' },
  { v: 'onyx', label: 'Onyx — Erkek, Derin' },
  { v: 'ash', label: 'Ash — Erkek, Genç' },
  { v: 'fable', label: 'Fable — Erkek, Anlatıcı' },
  { v: 'verse', label: 'Verse — Erkek, Edebi' },
  { v: 'alloy', label: 'Alloy — Nötr' },
];

const styleOptions = [
  { v: 'photorealistic', label: 'Fotogerçekçi' },
  { v: 'cinematic', label: 'Sinematik' },
  { v: 'anime', label: 'Anime' },
  { v: 'digital-art', label: 'Dijital Sanat' },
  { v: 'watercolor', label: 'Suluboya' },
  { v: '3d-render', label: '3D Render' },
  { v: 'minimalist', label: 'Minimalist' },
  { v: 'oil-painting', label: 'Yağlı Boya' },
  { v: 'cyberpunk', label: 'Cyberpunk' },
  { v: 'fantasy', label: 'Fantezi' },
  { v: 'documentary', label: 'Belgesel' },
  { v: 'vintage-film', label: 'Vintage Film' },
  { v: 'neon-noir', label: 'Neon Noir' },
  { v: 'pencil-sketch', label: 'Karakalem' },
  { v: 'low-poly', label: 'Low Poly' },
  { v: 'pixel-art', label: 'Pixel Art' },
];

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * numChannels * 2 + 44;
  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);
  const channels: Float32Array[] = [];
  let pos = 0;

  for (let i = 0; i < numChannels; i++) channels.push(buffer.getChannelData(i));

  const setUint16 = (data: number) => { view.setUint16(pos, data, true); pos += 2; };
  const setUint32 = (data: number) => { view.setUint32(pos, data, true); pos += 4; };

  setUint32(0x52494646);
  setUint32(length - 8);
  setUint32(0x57415645);
  setUint32(0x666d7420);
  setUint32(16);
  setUint16(1);
  setUint16(numChannels);
  setUint32(sampleRate);
  setUint32(sampleRate * 2 * numChannels);
  setUint16(numChannels * 2);
  setUint16(16);
  setUint32(0x64617461);
  setUint32(length - pos - 4);

  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = Math.max(-1, Math.min(1, channels[ch][i]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
  }
  return arrayBuffer;
}

export function SettingsPanel({ settings, onChange }: Props) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [voicePreviewLoading, setVoicePreviewLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadVoices().then(setVoices);
    return () => stopPreviewMusic();
  }, []);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Media source */}
      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
          Görsel Kaynağı
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {([
            { v: 'auto', label: 'Otomatik' },
            { v: 'stock', label: 'Stok Video' },
            { v: 'ai', label: 'AI Görsel' },
            { v: 'ai-video', label: 'AI Video' },
          ] as const).map((s) => (
            <button
              key={s.v}
              onClick={() => onChange({ ...settings, mediaSource: s.v })}
              className={`py-2 px-1 rounded-lg text-xs font-medium transition ${
                settings.mediaSource === s.v
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-600 mt-1">
          {settings.mediaSource === 'auto' && 'Önce stok video, bulunamazsa AI görsel'}
          {settings.mediaSource === 'stock' && 'Sadece telifsiz stok videolar (Pexels)'}
          {settings.mediaSource === 'ai' && 'Sadece AI ile üretilmiş görseller'}
          {settings.mediaSource === 'ai-video' && 'Her sahne için AI ile hareketli video klipleri üretilir'}
        </p>
        <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Pexels API anahtarı yüklü — stok videolar hazır
        </div>
      </div>

      {/* Content Language */}
      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
          İçerik Dili
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {([
            { v: 'auto', label: 'Otomatik' },
            { v: 'en', label: 'İngilizce' },
            { v: 'tr', label: 'Türkçe' },
          ] as const).map((l) => (
            <button
              key={l.v}
              onClick={() => onChange({ ...settings, contentLanguage: l.v })}
              className={`py-2 px-1 rounded-lg text-xs font-medium transition ${
                (settings.contentLanguage ?? 'auto') === l.v
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-600 mt-1">
          {(settings.contentLanguage ?? 'auto') === 'auto' && 'Metne göre otomatik dil tespiti (İngilizce→Kokoro, Türkçe→EdgeTTS)'}
          {(settings.contentLanguage ?? 'auto') === 'en' && 'İngilizce: Kokoro (tarayıcıda çalışır, ~82MB ilk kullanımda indirilir)'}
          {(settings.contentLanguage ?? 'auto') === 'tr' && 'Türkçe: EdgeTTS (Microsoft sinematik sesler)'}
        </p>
      </div>

      {((settings.contentLanguage ?? 'auto') === 'tr') && (
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
            Türkçe Ses
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {([
              { v: 'Emel', label: 'Emel — Kadın' },
              { v: 'Ahmet', label: 'Ahmet — Erkek' },
            ] as const).map((v) => (
              <button
                key={v.v}
                onClick={() => onChange({ ...settings, ttsTurkishVoice: v.v })}
                className={`py-2 px-2 rounded-lg text-xs font-medium transition ${
                  (settings.ttsTurkishVoice ?? 'Emel') === v.v
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TTS Mode */}
      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
          Seslendirme Modu
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {([
            { v: 'pollinations', label: 'Doğal Ses (İnsan Benzeri)' },
            { v: 'browser', label: 'Tarayıcı Sesi (Hızlı)' },
          ] as const).map((m) => (
            <button
              key={m.v}
              onClick={() => onChange({ ...settings, ttsMode: m.v })}
              className={`py-2 px-2 rounded-lg text-xs font-medium transition ${
                (settings.ttsMode ?? 'browser') === m.v
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-600 mt-1">
          {(settings.ttsMode ?? 'browser') === 'pollinations' && 'Dil bazlı otomatik TTS: İngilizce→Kokoro, Türkçe→EdgeTTS'}
          {(settings.ttsMode ?? 'browser') === 'browser' && 'Tarayıcı dahili sesi — hızlı ama robotik'}
        </p>
      </div>

      {/* TTS Voice */}
      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
          Video Seslendirmesi
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={settings.ttsVoice}
            onChange={(e) => onChange({ ...settings, ttsVoice: e.target.value as TTSVoice })}
            className="flex-1 rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-slate-600"
          >
            {ttsVoiceOptions.map((v) => (
              <option key={v.v} value={v.v}>{v.label}</option>
            ))}
          </select>
          <button
            onClick={async () => {
              if (voicePreviewLoading) return;
              if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; return; }
              setVoicePreviewLoading(true);
              try {
                const sampleText = settings.language?.startsWith('tr')
                  ? 'Merhaba, bu bir seslendirme örneğidir.'
                  : 'Hello, this is a voice sample for your video.';
                const ctx = new AudioContext();
                const langHint = settings.contentLanguage === 'auto' || !settings.contentLanguage
                  ? undefined
                  : settings.contentLanguage;
                const buf = await generateSpeech(sampleText, settings.ttsVoice, ctx, {
                  langHint,
                  turkishVoice: settings.ttsTurkishVoice,
                });
                const wav = audioBufferToWav(buf);
                const blob = new Blob([wav], { type: 'audio/wav' });
                const url = URL.createObjectURL(blob);
                const audio = new Audio(url);
                audioRef.current = audio;
                audio.onended = () => { audioRef.current = null; };
                audio.play();
              } catch (err) {
                console.warn('Voice preview failed', err);
              } finally {
                setVoicePreviewLoading(false);
              }
            }}
            className="px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            {voicePreviewLoading
              ? <><Loader2 size={14} className="animate-spin" /> Hazırlanıyor</>
              : audioRef.current
                ? <><VolumeX size={14} /> Durdur</>
                : <><Play size={14} /> Dinle</>}
          </button>
        </div>
      </div>

      {/* Preview voice */}
      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
          Önizleme Sesi
        </label>
        <select
          value={settings.voice}
          onChange={(e) => onChange({ ...settings, voice: e.target.value })}
          className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-slate-600"
        >
          <option value="">Varsayılan ses</option>
          {voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
          Konuşma Hızı: {settings.rate.toFixed(1)}x
        </label>
        <input
          type="range" min={0.5} max={2} step={0.1} value={settings.rate}
          onChange={(e) => onChange({ ...settings, rate: parseFloat(e.target.value) })}
          className="w-full accent-blue-500"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
          Görsel Stil
        </label>
        <select
          value={settings.style}
          onChange={(e) => onChange({ ...settings, style: e.target.value })}
          className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-slate-600"
        >
          {styleOptions.map((s) => (
            <option key={s.v} value={s.v}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Music */}
      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
          Arka Plan Müziği
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {musicOptions.map((m) => (
            <button
              key={m.v}
              onClick={() => { onChange({ ...settings, music: m.v }); if (m.v === 'none') stopPreviewMusic(); }}
              className={`py-2 px-2 rounded-lg text-xs font-medium transition ${
                settings.music === m.v ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {settings.music !== 'none' && (
          <button
            onClick={() => {
              if (previewing) { stopPreviewMusic(); setPreviewing(false); }
              else { playPreviewMusic(settings.music, settings.musicVolume); setPreviewing(true); }
            }}
            className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
          >
            {previewing ? <><VolumeX size={14} /> Müziği Durdur</> : <><Volume2 size={14} /> Müziği Dinle</>}
          </button>
        )}
      </div>

      {settings.music !== 'none' && (
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
            Müzik Sesi: %{Math.round(settings.musicVolume * 100)}
          </label>
          <input
            type="range" min={0} max={1} step={0.05} value={settings.musicVolume}
            onChange={(e) => onChange({ ...settings, musicVolume: parseFloat(e.target.value) })}
            className="w-full accent-blue-500"
          />
        </div>
      )}

      {settings.music !== 'none' && (
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
            Özel Müzik URL (isteğe bağlı)
          </label>
          <input
            type="url" value={settings.musicUrl ?? ''}
            onChange={(e) => onChange({ ...settings, musicUrl: e.target.value || undefined })}
            placeholder="https://example.com/music.mp3"
            className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-slate-600"
          />
          <a href="https://pixabay.com/music/" target="_blank" rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
            <ExternalLink size={10} /> Pixabay'de telifsiz müzik ara
          </a>
        </div>
      )}

      {/* Transitions */}
      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
          Sahne Geçişleri
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {transitionOptions.map((t) => (
            <button
              key={t.v}
              onClick={() => onChange({ ...settings, transition: t.v })}
              className={`py-2 px-1 rounded-lg text-xs font-medium transition ${
                settings.transition === t.v ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Aspect ratio */}
      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
          En-Boy Oranı
        </label>
        <div className="grid grid-cols-3 gap-2">
          {([
            { v: '16:9', label: 'Yatay' },
            { v: '9:16', label: 'Dikey' },
            { v: '1:1', label: 'Kare' },
          ] as const).map((a) => (
            <button
              key={a.v}
              onClick={() => onChange({ ...settings, aspect: a.v })}
              className={`py-2 rounded-lg text-sm font-medium transition ${
                settings.aspect === a.v ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {a.label}
              <div className="text-xs opacity-60">{a.v}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Resolution */}
      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
          Çözünürlük
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(['720p', '1080p', '1440p'] as const).map((r) => (
            <button
              key={r}
              onClick={() => onChange({ ...settings, resolution: r })}
              className={`py-2 rounded-lg text-sm font-medium transition ${
                settings.resolution === r ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Title card */}
      <div>
        <label className="flex items-center gap-3 cursor-pointer">
          <button
            onClick={() => onChange({ ...settings, showTitleCard: !settings.showTitleCard })}
            className={`relative w-10 h-6 rounded-full transition ${settings.showTitleCard ? 'bg-blue-600' : 'bg-slate-700'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${settings.showTitleCard ? 'translate-x-4' : ''}`} />
          </button>
          <span className="text-sm text-slate-300">Açılış jeneriği</span>
        </label>
      </div>

      {/* Subtitle style */}
      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
          Altyazı Stili
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {([
            { v: 'standard', label: 'Standart' },
            { v: 'kinetic', label: 'Kinetik' },
            { v: 'none', label: 'Kapalı' },
          ] as const).map((s) => (
            <button
              key={s.v}
              onClick={() => onChange({ ...settings, subtitleStyle: s.v })}
              className={`py-2 px-1 rounded-lg text-xs font-medium transition ${
                settings.subtitleStyle === s.v ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {settings.subtitleStyle !== 'none' && (
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
            Altyazı Rengi
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {([
              { v: 'white', label: 'Beyaz' },
              { v: 'gold', label: 'Altın' },
              { v: 'yellow', label: 'Sarı' },
            ] as const).map((c) => (
              <button
                key={c.v}
                onClick={() => onChange({ ...settings, subtitleColor: c.v })}
                className={`py-2 px-1 rounded-lg text-xs font-medium transition ${
                  settings.subtitleColor === c.v ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* End card */}
      <div>
        <label className="flex items-center gap-3 cursor-pointer">
          <button
            onClick={() => onChange({ ...settings, endCard: { ...settings.endCard, enabled: !settings.endCard.enabled } })}
            className={`relative w-10 h-6 rounded-full transition ${settings.endCard.enabled ? 'bg-blue-600' : 'bg-slate-700'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${settings.endCard.enabled ? 'translate-x-4' : ''}`} />
          </button>
          <span className="text-sm text-slate-300">Bitiş kartı</span>
        </label>
        {settings.endCard.enabled && (
          <div className="mt-2 space-y-2">
            <input
              type="text" value={settings.endCard.text}
              onChange={(e) => onChange({ ...settings, endCard: { ...settings.endCard, text: e.target.value } })}
              placeholder="Örn: Game of Company"
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-slate-600"
            />
            <input
              type="range" min={1} max={5} step={0.5} value={settings.endCard.duration}
              onChange={(e) => onChange({ ...settings, endCard: { ...settings.endCard, duration: parseFloat(e.target.value) } })}
              className="w-full accent-blue-500"
            />
          </div>
        )}
      </div>

      {/* Brand */}
      <div>
        <label className="flex items-center gap-3 cursor-pointer">
          <button
            onClick={() => onChange({ ...settings, brand: { ...settings.brand, enabled: !settings.brand?.enabled } })}
            className={`relative w-10 h-6 rounded-full transition ${settings.brand?.enabled ? 'bg-blue-600' : 'bg-slate-700'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${settings.brand?.enabled ? 'translate-x-4' : ''}`} />
          </button>
          <span className="text-sm text-slate-300">Marka Kontrolü</span>
        </label>
        {settings.brand?.enabled && (
          <div className="mt-2 space-y-2">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Marka Rengi</label>
              <div className="flex items-center gap-2">
                <input
                  type="color" value={settings.brand.primaryColor ?? '#3b82f6'}
                  onChange={(e) => onChange({ ...settings, brand: { ...settings.brand, primaryColor: e.target.value } })}
                  className="w-10 h-10 rounded-lg border border-slate-800 bg-slate-950 cursor-pointer"
                />
                <input
                  type="text" value={settings.brand.primaryColor ?? '#3b82f6'}
                  onChange={(e) => onChange({ ...settings, brand: { ...settings.brand, primaryColor: e.target.value } })}
                  className="flex-1 rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-slate-600"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Filigran Metni (isteğe bağlı)</label>
              <input
                type="text" value={(settings.brand as any).watermarkText ?? ''}
                onChange={(e) => onChange({ ...settings, brand: { ...settings.brand, watermarkText: e.target.value || undefined } as any })}
                placeholder="Örn: @kanalim"
                className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-slate-600"
              />
            </div>
          </div>
        )}
      </div>

      {/* API Keys */}
      <ApiKeysSettings />
    </div>
  );
}
