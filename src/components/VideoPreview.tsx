import { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, Download, Loader2, Film, Volume2, VolumeX, FileText, Music, RefreshCw, Clock, Maximize, Minimize, RotateCcw, RotateCw, SkipBack, AlertCircle } from 'lucide-react';
import type { Scene, ProjectSettings, ExportFormat, RenderProgress } from '@/lib/types';
import { renderVideo, supportsMP4, getExtension } from '@/lib/videoRenderer';
import { transcodeToMP4 } from '@/lib/mp4Transcoder';
import { speak, getVoices, detectLang, pickVoiceForLang } from '@/lib/tts';
import { downloadSRT } from '@/lib/subtitles';
import { regenerateImageUrl } from '@/lib/pollinations';
import { playPreviewMusic, stopPreviewMusic } from '@/lib/music';
import { errorHandler } from '@/lib/errorHandler';

type Props = {
  scenes: Scene[];
  settings: ProjectSettings;
  title: string;
  onSettingsChange?: (s: ProjectSettings) => void;
  onVideoReady?: (url: string) => void;
  selectedIndex?: number;
  onSelectIndex?: (index: number) => void;
};

export function VideoPreview({
  scenes,
  settings,
  title,
  onSettingsChange,
  onVideoReady,
  selectedIndex,
  onSelectIndex,
}: Props) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [transcoding, setTranscoding] = useState(false);
  const [transcodeProgress, setTranscodeProgress] = useState(0);
  const [videoExt, setVideoExt] = useState<string>('webm');
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState<RenderProgress | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [internalIndex, setInternalIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());
  const [regenerating, setRegenerating] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);

  const cancelRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const seekAmount = 10;

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, []);

  const seek = useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta));
  }, []);

  const seekTo = useCallback((time: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, time));
    setCurrentTime(v.currentTime);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const onScrub = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    const bar = e.currentTarget;
    if (!v || !videoDuration) return;

    const rect = bar.getBoundingClientRect();
    let clientX = 0;

    if ('touches' in e) {
      clientX = e.touches[0]?.clientX || 0;
    } else {
      clientX = e.clientX;
    }

    const percent = (clientX - rect.left) / rect.width;
    seekTo(percent * videoDuration);
  };

  const fmtTime = (t: number) => {
    if (!isFinite(t) || t < 0) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const previewIndex = selectedIndex ?? internalIndex;
  const setPreviewIndex = (i: number) => {
    if (onSelectIndex) onSelectIndex(i);
    else setInternalIndex(i);
  };

  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);
  const mp4Supported = supportsMP4();

  const render = async () => {
    if (scenes.length === 0) {
      setRenderError('Lütfen en az bir sahne ekleyin.');
      return;
    }

    setRendering(true);
    setVideoUrl(null);
    setTranscoding(false);
    setTranscodeProgress(0);
    setRenderError(null);
    setProgress({
      scene: 0,
      total: scenes.length,
      phase: 'preparing',
      message: 'Video hazırlanıyor...',
    });

    try {
      const blob = await renderVideo(scenes, settings, title, setProgress);
      let finalBlob = blob;
      let finalExt = getExtension(blob.type);

      if (settings.exportFormat === 'mp4' && mp4Supported) {
        setTranscoding(true);
        setProgress({
          scene: 0,
          total: scenes.length,
          phase: 'transcoding',
          message: 'MP4 formatına dönüştürülüyor...',
        });

        try {
          finalBlob = await transcodeToMP4(blob, (ratio) => setTranscodeProgress(ratio));
          finalExt = 'mp4';
        } catch (err) {
          const msg = `MP4 dönüşümü başarısız, WebM formatında indiriliyor: ${err instanceof Error ? err.message : String(err)}`;
          errorHandler.createError('TRANSCODE_FAILED', msg, 'warning');
          finalExt = 'webm';
        }

        setTranscoding(false);
        setTranscodeProgress(0);
      }

      const url = URL.createObjectURL(finalBlob);
      setVideoUrl(url);
      setVideoExt(finalExt);
      onVideoReady?.(url);

      // Auto-download
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'video'}.${finalExt}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const userMsg = errorHandler.getUserMessage(
        err instanceof Error && err.message.includes('[')
          ? err.message.match(/\[([A-Z_]+)\]/)?.[1] || 'UNKNOWN_ERROR'
          : 'RENDER_FAILED',
      );
      setRenderError(userMsg);
      console.error('Render error:', message);
    } finally {
      setRendering(false);
      setTranscoding(false);
      setProgress(null);
    }
  };

  useEffect(() => {
    if (!videoUrl) {
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [previewIndex, videoUrl]);

  const startPreview = async () => {
    if (previewing) {
      cancelRef.current = true;
      window.speechSynthesis.cancel();
      stopPreviewMusic();
      setPreviewing(false);
      setPreviewIndex(0);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      return;
    }

    cancelRef.current = false;
    setPreviewing(true);
    setPreviewIndex(0);

    if (settings.music !== 'none' && !muted) {
      playPreviewMusic(settings.music, settings.musicVolume).catch(() => {});
    }

    const voices = getVoices();
    const voice = voices.find((v) => v.voiceURI === settings.voice);

    for (let i = 0; i < scenes.length; i++) {
      if (cancelRef.current) break;

      setPreviewIndex(i);
      const scene = scenes[i];
      let speechDone = false;

      if (scene.narration.trim() && !muted) {
        const lang = detectLang(scene.narration);
        const v = voice ?? pickVoiceForLang(lang, voices) ?? undefined;

        speak(scene.narration, {
          voice: v,
          rate: settings.rate,
          onEnd: () => {
            speechDone = true;
          },
        }).catch(() => {
          speechDone = true;
        });
      } else {
        speechDone = true;
      }

      const minDisplay = Math.min(2000, scene.duration * 1000);
      await new Promise<void>((resolve) => {
        timerRef.current = window.setTimeout(resolve, minDisplay);
      });

      while (!speechDone && !cancelRef.current) {
        await new Promise<void>((resolve) => {
          timerRef.current = window.setTimeout(resolve, 200);
        });
      }

      window.speechSynthesis.cancel();
    }

    stopPreviewMusic();
    setPreviewing(false);
    setPreviewIndex(0);
  };

  useEffect(() => {
    return () => {
      cancelRef.current = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      window.speechSynthesis.cancel();
      stopPreviewMusic();
    };
  }, []);

  const currentScene = scenes[previewIndex];
  const titleOffset = settings.showTitleCard ? 4 : 0;

  const progressPct = progress
    ? progress.phase === 'preparing'
      ? `${Math.round((progress.scene / Math.max(progress.total, 1)) * 40)}%`
      : progress.phase === 'rendering'
        ? `${40 + Math.round((progress.framesRendered || 0) / Math.max(progress.totalFrames || 1, 1)) * 50)}%`
        : `${90 + Math.round(transcodeProgress * 10)}%`
    : '0%';

  const handleImageError = (i: number) => {
    setImageErrors((prev) => new Set(prev).add(i));
  };

  const regenerateSceneImage = async (i: number) => {
    setRegenerating(i);
    const scene = scenes[i];

    try {
      const newUrl = await regenerateImageUrl(scene.image_prompt, settings.aspect, settings.resolution);
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        setImageErrors((prev) => {
          const next = new Set(prev);
          next.delete(i);
          return next;
        });
        setRegenerating(null);
      };

      img.onerror = () => {
        setRegenerating(null);
      };

      img.src = newUrl;
    } catch (err) {
      errorHandler.createError('IMAGE_GENERATION_FAILED', 'Görsel yeniden üretilemedi', 'warning');
      setRegenerating(null);
    }
  };

  return (
    <div className="space-y-4">
      <div ref={containerRef} className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center group">
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain"
            onClick={togglePlay}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration)}
            controls={false}
          />
        ) : currentScene?.video_url ? (
          <video
            src={currentScene.video_url}
            poster={currentScene.video_poster}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
          />
        ) : currentScene?.image_url && !imageErrors.has(previewIndex) ? (
          <img
            src={currentScene.image_url}
            alt=""
            className="w-full h-full object-cover"
            onError={() => handleImageError(previewIndex)}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-slate-600">
            <Film size={48} strokeWidth={1} />
            <p className="text-sm">
              {scenes.length === 0 ? 'Önce senaryo oluşturun' : 'Görsel yükleniyor...'}
            </p>
          </div>
        )}

        {previewing && currentScene && !videoUrl && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <p className="text-white text-sm text-center">{currentScene.narration.slice(0, 100)}</p>
          </div>
        )}

        {scenes.length > 0 && !videoUrl && (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur text-white text-xs font-medium">
            {previewIndex + 1} / {scenes.length}
          </div>
        )}

        {videoUrl && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-3 pt-8 pb-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300">
            <div
              className="group/scrub relative h-1.5 rounded-full bg-white/20 cursor-pointer mb-2"
              onMouseDown={(e) => {
                setScrubbing(true);
                onScrub(e);
              }}
              onMouseMove={(e) => {
                if (scrubbing) onScrub(e);
              }}
              onMouseUp={() => setScrubbing(false)}
              onMouseLeave={() => setScrubbing(false)}
              onTouchStart={(e) => {
                setScrubbing(true);
                onScrub(e);
              }}
              onTouchMove={(e) => {
                if (scrubbing) onScrub(e);
              }}
              onTouchEnd={() => setScrubbing(false)}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-blue-500"
                style={{ width: `${videoDuration ? (currentTime / videoDuration) * 100 : 0}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow opacity-0 group-hover/scrub:opacity-100 transition"
                style={{
                  left: `calc(${videoDuration ? (currentTime / videoDuration) * 100 : 0}% - 6px)`,
                }}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={togglePlay}
                className="p-1.5 rounded text-white hover:bg-white/10 transition"
                title={isPlaying ? 'Duraklat' : 'Oynat'}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>

              <button
                onClick={() => seek(-seekAmount)}
                className="p-1.5 rounded text-white hover:bg-white/10 transition"
                title={`${seekAmount} sn geri`}
              >
                <RotateCcw size={14} />
              </button>

              <button
                onClick={() => seek(seekAmount)}
                className="p-1.5 rounded text-white hover:bg-white/10 transition"
                title={`${seekAmount} sn ileri`}
              >
                <RotateCw size={14} />
              </button>

              <button
                onClick={() => seekTo(0)}
                className="p-1.5 rounded text-white hover:bg-white/10 transition"
                title="Başa sar"
              >
                <SkipBack size={14} />
              </button>

              <span className="text-xs text-white tabular-nums ml-1">
                {fmtTime(currentTime)} / {fmtTime(videoDuration)}
              </span>

              <div className="flex-1" />

              <button
                onClick={() => setMuted(!muted)}
                className="p-1.5 rounded text-white hover:bg-white/10 transition"
                title={muted ? 'Sesi aç' : 'Sesi kapat'}
              >
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>

              <button
                onClick={toggleFullscreen}
                className="p-1.5 rounded text-white hover:bg-white/10 transition"
                title={isFullscreen ? 'Tam ekrandan çık' : 'Tam ekran'}
              >
                {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
              </button>
            </div>
          </div>
        )}
      </div>

      {scenes.length > 0 && !videoUrl && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {scenes.map((scene, i) => (
            <button
              key={scene.id}
              onClick={() => setPreviewIndex(i)}
              className={`relative shrink-0 rounded-lg overflow-hidden border-2 transition ${
                i === previewIndex ? 'border-blue-500' : 'border-transparent hover:border-slate-600'
              }`}
              style={{ width: '80px', height: '45px' }}
            >
              {scene.image_url && !imageErrors.has(i) ? (
                <img
                  src={scene.image_url}
                  alt={scene.name || `Scene ${i + 1}`}
                  className="w-full h-full object-cover"
                  onError={() => handleImageError(i)}
                />
              ) : (
                <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                  <Film size={16} className="text-slate-500" />
                </div>
              )}
              {imageErrors.has(i) && !regenerating && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    regenerateSceneImage(i);
                  }}
                  className="absolute inset-0 bg-black/60 flex items-center justify-center hover:bg-black/80 transition"
                  title="Görsel yeniden üret"
                >
                  <RefreshCw size={12} className="text-white" />
                </button>
              )}
              {regenerating === i && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Loader2 size={12} className="text-white animate-spin" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Format:</span>
        <div className="flex gap-1.5">
          <button
            onClick={() => onSettingsChange?.({ ...settings, exportFormat: 'webm' })}
            className={`px-3 py-1.5 rounded text-xs font-medium transition ${
              settings.exportFormat === 'webm'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            WebM
          </button>
          <button
            onClick={() => onSettingsChange?.({ ...settings, exportFormat: 'mp4' })}
            disabled={!mp4Supported}
            className={`px-3 py-1.5 rounded text-xs font-medium transition ${
              settings.exportFormat === 'mp4'
                ? 'bg-blue-600 text-white'
                : mp4Supported
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-slate-900 text-slate-600 cursor-not-allowed'
            }`}
            title={!mp4Supported ? 'MP4 tarayıcınızda desteklenmiyor' : ''}
          >
            MP4 {!mp4Supported && '(Desteklenmiyor)'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 sm:gap-3">
        <button
          onClick={startPreview}
          disabled={scenes.length === 0 || rendering}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 text-slate-100 text-sm font-medium transition disabled:text-slate-600"
        >
          <Music size={16} />
          {previewing ? 'Durdur' : 'Önizle'}
        </button>

        <button
          onClick={() => setMuted(!muted)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-medium transition"
          title={muted ? 'Sesi aç' : 'Sesi kapat'}
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          {muted ? 'Sesli' : 'Sessiz'}
        </button>

        <button
          onClick={render}
          disabled={scenes.length === 0 || rendering || transcoding}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 text-white text-sm font-medium transition disabled:text-slate-500"
        >
          {rendering || transcoding ? <Loader2 size={16} className="animate-spin" /> : <Film size={16} />}
          {rendering ? 'Render ediliyor...' : transcoding ? 'Dönüştürülüyor...' : 'Video Render Et'}
        </button>

        {videoUrl && (
          <a
            href={videoUrl}
            download={`${title || 'video'}.${videoExt}`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition"
          >
            <Download size={16} />
            İndir
          </a>
        )}

        <button
          onClick={() => downloadSRT(scenes, title, titleOffset)}
          disabled={scenes.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 text-slate-100 text-sm font-medium transition disabled:text-slate-600"
        >
          <FileText size={16} />
          SRT İndir
        </button>
      </div>

      {renderError && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300 flex gap-3">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Hata</p>
            <p className="text-xs mt-1">{renderError}</p>
          </div>
        </div>
      )}

      {(rendering || transcoding) && progress && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-400">
            <span>
              {progress.phase === 'preparing' && (progress.message || 'Hazırlanıyor...')}
              {progress.phase === 'rendering' && `Sahne ${progress.scene + 1}/${progress.total}`}
              {progress.phase === 'encoding' && 'Kodlanıyor...'}
              {progress.phase === 'transcoding' && 'MP4 dönüştürülüyor...'}
            </span>
            <span>{progressPct}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300"
              style={{ width: progressPct }}
            />
          </div>
          {progress.message && (
            <p className="text-xs text-slate-500">{progress.message}</p>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 sm:gap-4 text-xs text-slate-500 flex-wrap">
        <span className="flex items-center gap-1">
          <Film size={12} /> {scenes.length} sahne
        </span>
        <span className="flex items-center gap-1">
          <Clock size={12} /> {Math.floor(totalDuration)}s
        </span>
      </div>

      {(rendering || transcoding) && (
        <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-4 py-3 text-xs text-blue-300">
          {transcoding
            ? 'Video MP4 formatına dönüştürülüyor. Tamamlanana kadar bekleyin...'
            : 'Video render ediliyor. İşlem sırasında sayfayı kapatmayın.'}
        </div>
      )}
    </div>
  );
}
