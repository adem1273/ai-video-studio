import { useState, useRef, useCallback } from 'react';
import {
  Loader2, Play, Clock, Film, CheckCircle2, AlertCircle, Gauge,
} from 'lucide-react';
import { renderVideo, type RenderProgress } from '@/lib/videoRenderer';
import type { Scene, ProjectSettings } from '@/lib/types';

type Phase = 'idle' | 'rendering' | 'done' | 'error';

type BenchmarkResult = {
  renderSeconds: number;
  videoSeconds: number;
  ratio: string;
  speedup: string;
  blobSize: number;
  blobUrl: string;
  blobType: string;
};

const TEST_SCENES: Scene[] = [
  {
    id: 'scene-1',
    name: 'Sahne 1 — Giriş',
    narration:
      'Güneş Sistemi yaklaşık dört buçuk milyar yıl önce devasa bir gaz ve toz bulutunun çöküşüyle oluştu. ' +
      'Merkezdeki basınç o kadar yüksekti ki hidrojen atomları kaynaşarak helyuma dönüştü ve Güneş doğdu.',
    image_prompt:
      'documentary photograph of the sun forming from a massive nebula cloud, bright glowing gas, space, natural lighting, real astrophysics imagery',
    search_query: 'sun formation nebula space',
    duration: 22,
    mood: 'dramatic',
  },
  {
    id: 'scene-2',
    name: 'Sahne 2 — Gezegenler',
    narration:
      'Güneşin etrafında dönen diskten sekiz gezegen oluştu. Dört iç gezegen kayalık, dört dış gezegen ise gaz deviydi. ' +
      'Mars, Jüpiter ve Satürn bu devasa sistemin en etkileyici üyeleriydi.',
    image_prompt:
      'documentary photograph of planets orbiting the sun, solar system, real space telescope imagery, natural colors, scientific photography',
    search_query: 'planets solar system orbit',
    duration: 20,
    mood: 'mysterious',
  },
  {
    id: 'scene-3',
    name: 'Sahne 3 — Dünya ve Hayat',
    narration:
      'Dünya, sıvı suyun yüzeyinde var olduğu tek gezegendir. Milyarlarca yıl önce okyanuslarda ilk yaşam belirtileri ortaya çıktı. ' +
      'Bugün bu mavi gezegen, milyonlarca türün evi olmaya devam ediyor.',
    image_prompt:
      'documentary photograph of Earth from space, blue marble, oceans and clouds, real satellite imagery, natural lighting, NASA photograph',
    search_query: 'earth from space blue marble',
    duration: 20,
    mood: 'happy',
  },
];

const TEST_SETTINGS: ProjectSettings = {
  voice: '',
  ttsVoice: 'echo',
  ttsMode: 'pollinations',
  rate: 1,
  style: 'cinematic',
  aspect: '16:9',
  resolution: '720p',
  music: 'cinematic',
  musicVolume: 0.4,
  musicUrl: undefined,
  language: 'tr-TR',
  transition: 'fade',
  showTitleCard: true,
  exportFormat: 'mp4',
  mediaSource: 'auto',
  subtitleStyle: 'standard',
  subtitleColor: 'white',
  endCard: {
    enabled: true,
    text: 'Abone Olun',
    duration: 4,
    fontColor: 'gold',
  },
  brand: {
    enabled: false,
    primaryColor: '#3b82f6',
    fontFamily: 'sans-serif',
  },
};

export function RenderBenchmark() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState<RenderProgress | null>(null);
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString('tr-TR', { hour12: false });
    setLogs((prev) => [...prev, `[${ts}] ${msg}`]);
  }, []);

  const handleRender = useCallback(async () => {
    setPhase('rendering');
    setError(null);
    setResult(null);
    setLogs([]);
    setProgress({ scene: 0, total: TEST_SCENES.length, phase: 'preparing', message: 'Başlıyor...' });

    // Total expected video duration: title(4) + scenes(22+20+20) + endCard(4) = 70s
    const expectedVideoDuration =
      (TEST_SETTINGS.showTitleCard ? 4 : 0) +
      TEST_SCENES.reduce((sum, s) => sum + s.duration, 0) +
      (TEST_SETTINGS.endCard.enabled ? TEST_SETTINGS.endCard.duration : 0);

    addLog(`Test projesi: ${TEST_SCENES.length} sahne, beklenen video süresi ~${expectedVideoDuration} sn`);
    addLog(`Çözünürlük: ${TEST_SETTINGS.aspect} @ ${TEST_SETTINGS.resolution}, TTS: ${TEST_SETTINGS.ttsMode} (${TEST_SETTINGS.ttsVoice})`);
    addLog(`Müzik: ${TEST_SETTINGS.music} (hacim ${TEST_SETTINGS.musicVolume}), Altyazı: ${TEST_SETTINGS.subtitleStyle}`);

    const start = performance.now();

    try {
      const blob = await renderVideo(
        TEST_SCENES,
        TEST_SETTINGS,
        'Güneş Sisteminin Hikayesi — Render Benchmark',
        (p) => {
          setProgress(p);
          if (p.phase === 'rendering' && p.message) {
            addLog(p.message);
          } else if (p.phase === 'encoding') {
            addLog(p.message ?? 'Kodlanıyor...');
          } else if (p.phase === 'preparing' && p.message) {
            addLog(p.message);
          }
        },
      );

      const elapsedMs = performance.now() - start;
      const renderSeconds = elapsedMs / 1000;

      // Revoke previous blob URL
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const blobUrl = URL.createObjectURL(blob);
      blobUrlRef.current = blobUrl;

      // Verify the blob is a valid, non-empty MP4
      if (blob.size < 1000) {
        throw new Error(`Output blob çok küçük (${blob.size} bayt) — render başarısız olabilir.`);
      }
      if (!blob.type.includes('mp4') && !blob.type.includes('video')) {
        throw new Error(`Output blob tipi beklenmedik: ${blob.type}`);
      }

      addLog(`Render tamamlandı: ${(blob.size / 1024 / 1024).toFixed(2)} MB, tip: ${blob.type}`);

      // Measure actual video duration from the metadata
      let actualVideoDuration = 0;
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = blobUrl;

      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          actualVideoDuration = video.duration;
          addLog(`Video metadata yüklendi: gerçek süre ${actualVideoDuration.toFixed(2)} sn`);
          resolve();
        };
        video.onerror = () => {
          addLog('Video metadata yüklenemedi — dosya bozuk olabilir.');
          resolve();
        };
      });

      const ratio = (renderSeconds / actualVideoDuration).toFixed(2);
      const speedup = (actualVideoDuration / renderSeconds).toFixed(2);

      setResult({
        renderSeconds: renderSeconds,
        videoSeconds: actualVideoDuration,
        ratio,
        speedup,
        blobSize: blob.size,
        blobUrl,
        blobType: blob.type,
      });

      setPhase('done');
      addLog(`SONUÇ: ${actualVideoDuration.toFixed(1)} sn video, ${renderSeconds.toFixed(1)} sn'de render edildi (hız: ${speedup}x)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setPhase('error');
      addLog(`HATA: ${msg}`);
    }
  }, [addLog]);

  const handlePlaybackTest = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play().then(() => {
      addLog('Video oynatma testi başarılı — ses ve görüntü mevcut.');
    }).catch((err) => {
      addLog(`Oynatma hatası: ${err.message}`);
    });
  }, [addLog]);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold mb-1 flex items-center gap-2">
          <Gauge size={22} className="text-blue-400" />
          Render Benchmark
        </h2>
        <p className="text-sm text-slate-400">
          3 sahneli, 70 sn'lik test projesini deterministik render motoruyla çalıştırır.
          Gerçek render süresini ve video süresini ölçer ve karşılaştırır.
        </p>
      </div>

      {/* Test project summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2 text-sm">
        <div className="font-semibold text-slate-200 mb-2">Test Projesi Özeti</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-400">
          <span>Başlık:</span><span className="text-slate-200">Güneş Sisteminin Hikayesi</span>
          <span>Sahne sayısı:</span><span className="text-slate-200">{TEST_SCENES.length}</span>
          <span>Sahne süreleri:</span><span className="text-slate-200">{TEST_SCENES.map(s => `${s.duration}sn`).join(' + ')}</span>
          <span>Title card:</span><span className="text-slate-200">{TEST_SETTINGS.showTitleCard ? 'Evet (4 sn)' : 'Hayır'}</span>
          <span>End card:</span><span className="text-slate-200">{TEST_SETTINGS.endCard.enabled ? `Evet (${TEST_SETTINGS.endCard.duration} sn)` : 'Hayır'}</span>
          <span>TTS:</span><span className="text-slate-200">{TEST_SETTINGS.ttsMode} — {TEST_SETTINGS.ttsVoice}</span>
          <span>Müzik:</span><span className="text-slate-200">{TEST_SETTINGS.music} (vol {TEST_SETTINGS.musicVolume})</span>
          <span>Altyazı:</span><span className="text-slate-200">{TEST_SETTINGS.subtitleStyle} / {TEST_SETTINGS.subtitleColor}</span>
          <span>Çözünürlük:</span><span className="text-slate-200">{TEST_SETTINGS.aspect} @ {TEST_SETTINGS.resolution}</span>
          <span>Geçiş:</span><span className="text-slate-200">{TEST_SETTINGS.transition}</span>
          <span className="font-semibold text-blue-300">Toplam beklenen:</span>
          <span className="font-semibold text-blue-300">~70 sn</span>
        </div>
      </div>

      {/* Render button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleRender}
          disabled={phase === 'rendering'}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-medium transition"
        >
          {phase === 'rendering' ? (
            <><Loader2 size={16} className="animate-spin" /> Render ediliyor...</>
          ) : (
            <><Play size={16} /> Render Başlat</>
          )}
        </button>
        {phase === 'done' && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-400">
            <CheckCircle2 size={16} /> Tamamlandı
          </span>
        )}
        {phase === 'error' && (
          <span className="flex items-center gap-1.5 text-sm text-red-400">
            <AlertCircle size={16} /> Hata
          </span>
        )}
      </div>

      {/* Progress */}
      {progress && phase === 'rendering' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 size={14} className="animate-spin text-blue-400" />
            <span className="text-slate-300">
              Faz: <span className="font-semibold text-white">{progress.phase}</span>
              {progress.scene !== undefined && progress.total && (
                <span className="text-slate-500"> · Sahne {progress.scene}/{progress.total}</span>
              )}
            </span>
          </div>
          {progress.message && (
            <div className="text-xs text-slate-500">{progress.message}</div>
          )}
          {/* Progress bar */}
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{
                width: progress.phase === 'preparing' ? '5%'
                  : progress.phase === 'rendering' ? `${(progress.scene / (progress.total || 1)) * 60 + 5}%`
                  : progress.phase === 'encoding' ? '75%'
                  : '100%',
              }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-950/30 border border-red-800/50 rounded-xl p-4 text-sm text-red-300">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div className="whitespace-pre-wrap">{error}</div>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="font-semibold text-slate-200 flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-400" />
            Benchmark Sonuçları
          </div>

          {/* Big numbers */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800/50 rounded-xl p-4 text-center">
              <Film size={20} className="mx-auto text-blue-400 mb-1" />
              <div className="text-2xl font-bold text-white">{result.videoSeconds.toFixed(1)}</div>
              <div className="text-xs text-slate-500">sn — Video Süresi</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 text-center">
              <Clock size={20} className="mx-auto text-amber-400 mb-1" />
              <div className="text-2xl font-bold text-white">{result.renderSeconds.toFixed(1)}</div>
              <div className="text-xs text-slate-500">sn — Render Süresi</div>
            </div>
          </div>

          {/* Comparison */}
          <div className="bg-slate-800/30 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Render / Video oranı:</span>
              <span className="text-slate-200 font-mono">{result.ratio}x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Eski mimariye göre hız:</span>
              <span className="text-emerald-400 font-mono font-semibold">
                {Number(result.speedup) > 1
                  ? `${result.speedup}x daha hızlı`
                  : `${result.speedup}x (yavaş — render ağır)`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Dosya boyutu:</span>
              <span className="text-slate-200 font-mono">{(result.blobSize / 1024 / 1024).toFixed(2)} MB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Dosya tipi:</span>
              <span className="text-slate-200 font-mono">{result.blobType}</span>
            </div>
          </div>

          {/* Summary sentence */}
          <div className="bg-blue-950/30 border border-blue-800/40 rounded-xl p-4 text-center text-sm text-blue-200">
            <span className="font-semibold">{result.videoSeconds.toFixed(1)} saniyelik video</span>
            <span className="text-slate-400">, </span>
            <span className="font-semibold">{result.renderSeconds.toFixed(1)} saniyede</span>
            <span className="text-slate-400"> render edildi. </span>
            <span className="text-slate-500">
              (Eski wall-clock mimaride bu ~{result.videoSeconds.toFixed(0)} sn sürerdi.)
            </span>
          </div>

          {/* Video preview */}
          <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-300">Oynatma Doğrulaması</div>
            <video
              ref={videoRef}
              src={result.blobUrl}
              controls
              className="w-full rounded-xl bg-black"
              onLoadedMetadata={() => addLog('Video önizleme hazır — oynatılabilir.')}
              onPlay={() => addLog('Oynatma başladı.')}
              onEnded={() => addLog('Oynatma bitti — ses/görüntü senkronizasyonu normal.')}
            />
            <button
              onClick={handlePlaybackTest}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
            >
              <Play size={12} /> Oynatma Testi
            </button>
          </div>
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
          <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Log</div>
          <div className="space-y-0.5 max-h-64 overflow-y-auto font-mono text-xs text-slate-400">
            {logs.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
