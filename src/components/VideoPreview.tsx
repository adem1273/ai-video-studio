import { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, Download, Loader2, Film, Volume2, VolumeX, FileText, Music, RefreshCw, Clock, Maximize, Minimize, RotateCcw, RotateCw, SkipBack } from 'lucide-react';
import type { Scene, ProjectSettings, ExportFormat } from '@/lib/types';
import { renderVideo, supportsMP4, getExtension, type RenderProgress } from '@/lib/videoRenderer';
import { transcodeToMP4 } from '@/lib/mp4Transcoder';
import { speak, getVoices, detectLang, pickVoiceForLang } from '@/lib/tts';
import { downloadSRT } from '@/lib/subtitles';
import { regenerateImageUrl } from '@/lib/pollinations';
import { playPreviewMusic, stopPreviewMusic } from '@/lib/music';

type Props = { scenes: Scene[]; settings: ProjectSettings; title: string; onSettingsChange?: (s: ProjectSettings) => void; onVideoReady?: (url: string) => void; selectedIndex?: number; onSelectIndex?: (index: number) => void; };

export function VideoPreview({ scenes, settings, title, onSettingsChange, onVideoReady, selectedIndex, onSelectIndex }: Props) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [transcoding, setTranscoding] = useState(false);
  const [transcodeProgress, setTranscodeProgress] = useState(0);
  const [videoExt, setVideoExt] = useState<string>('webm');
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState<RenderProgress | null>(null);
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

  const togglePlay = useCallback(() => { const v = videoRef.current; if (!v) return; if (v.paused) { v.play().catch(() => {}); } else { v.pause(); } }, []);
  const seek = useCallback((delta: number) => { const v = videoRef.current; if (!v) return; v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta)); }, []);
  const seekTo = useCallback((time: number) => { const v = videoRef.current; if (!v) return; v.currentTime = Math.max(0, Math.min(v.duration || 0, time)); setCurrentTime(v.currentTime); }, []);
  const toggleFullscreen = useCallback(() => { const el = containerRef.current; if (!el) return; if (!document.fullscreenElement) { el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {}); } else { document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {}); } }, []);

  useEffect(() => { const onFsChange = () => setIsFullscreen(!!document.fullscreenElement); document.addEventListener('fullscreenchange', onFsChange); return () => document.removeEventListener('fullscreenchange', onFsChange); }, []);

  const onScrub = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => { const v = videoRef.current; const bar = e.currentTarget; if (!v || !videoDuration) return; const rect = bar.getBoundingClientRect(); const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX; const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)); seekTo(ratio * videoDuration); };
  const fmtTime = (t: number) => { if (!isFinite(t) || t < 0) return '0:00'; const m = Math.floor(t / 60); const s = Math.floor(t % 60); return `${m}:${s.toString().padStart(2, '0')}`; };

  const previewIndex = selectedIndex ?? internalIndex;
  const setPreviewIndex = (i: number) => { if (onSelectIndex) onSelectIndex(i); else setInternalIndex(i); };
  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);
  const mp4Supported = supportsMP4();

  const render = async () => {
    if (scenes.length === 0) return;
    setRendering(true); setVideoUrl(null); setTranscoding(false); setTranscodeProgress(0);
    setProgress({ scene: 0, total: scenes.length, phase: 'preparing', message: 'Başlanıyor...' });
    try {
      const blob = await renderVideo(scenes, settings, title, setProgress);
      let finalBlob = blob; let finalExt = getExtension(blob.type);
      if (settings.exportFormat === 'mp4') {
        setTranscoding(true);
        setProgress({ scene: 0, total: scenes.length, phase: 'transcoding', message: 'MP4 kodlanıyor...' });
        try { finalBlob = await transcodeToMP4(blob, (ratio) => setTranscodeProgress(ratio)); finalExt = 'mp4'; } catch (err) { console.error('MP4 transcode failed, falling back to WebM:', err); alert('MP4 dönüşümü başarısız oldu, WebM olarak kaydedilecek.'); finalExt = getExtension(blob.type); }
        setTranscoding(false); setTranscodeProgress(0);
      }
      const url = URL.createObjectURL(finalBlob); setVideoUrl(url); setVideoExt(finalExt); onVideoReady?.(url);
      const a = document.createElement('a'); a.href = url; a.download = `${title || 'video'}.${finalExt}`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (err) { console.error(err); alert('Video oluşturulurken hata: ' + (err as Error).message); } finally { setRendering(false); setTranscoding(false); setProgress(null); }
  };

  useEffect(() => { if (!videoUrl) { setIsPlaying(false); setCurrentTime(0); } }, [previewIndex, videoUrl]);

  const startPreview = async () => {
    if (previewing) { cancelRef.current = true; window.speechSynthesis.cancel(); stopPreviewMusic(); setPreviewing(false); setPreviewIndex(0); if (timerRef.current) window.clearTimeout(timerRef.current); return; }
    cancelRef.current = false; setPreviewing(true); setPreviewIndex(0);
    if (settings.music !== 'none' && !muted) { playPreviewMusic(settings.music, settings.musicVolume).catch(() => {}); }
    const voices = getVoices(); const voice = voices.find((v) => v.voiceURI === settings.voice);
    for (let i = 0; i < scenes.length; i++) {
      if (cancelRef.current) break;
      setPreviewIndex(i);
      const scene = scenes[i]; let speechDone = false;
      if (scene.narration.trim() && !muted) { const lang = detectLang(scene.narration); const v = voice ?? pickVoiceForLang(lang, voices) ?? undefined; speak(scene.narration, { voice: v, rate: settings.rate, lang }).then(() => { speechDone = true; }).catch(() => { speechDone = true; }); } else { speechDone = true; }
      const minDisplay = Math.min(2000, scene.duration * 1000);
      await new Promise<void>((resolve) => { timerRef.current = window.setTimeout(resolve, minDisplay); });
      while (!speechDone && !cancelRef.current) { await new Promise<void>((resolve) => { timerRef.current = window.setTimeout(resolve, 200); }); }
      window.speechSynthesis.cancel();
    }
    stopPreviewMusic(); setPreviewing(false); setPreviewIndex(0);
  };

  useEffect(() => { return () => { cancelRef.current = true; if (timerRef.current) window.clearTimeout(timerRef.current); window.speechSynthesis.cancel(); stopPreviewMusic(); }; }, []);

  const currentScene = scenes[previewIndex];
  const titleOffset = settings.showTitleCard ? 4 : 0;
  const progressPct = progress ? progress.phase === 'preparing' ? `${Math.round((progress.scene / Math.max(progress.total, 1)) * 40)}%` : progress.phase === 'rendering' ? `${40 + Math.round((progress.scene / Math.max(progress.total, 1)) * 45)}%` : progress.phase === 'encoding' ? '90%' : progress.phase === 'transcoding' ? `${90 + Math.round(transcodeProgress * 10)}%` : '100%' : '0%';

  const handleImageError = (i: number) => { setImageErrors((prev) => new Set(prev).add(i)); };
  const regenerateSceneImage = async (i: number) => {
    setRegenerating(i);
    const scene = scenes[i];
    const newUrl = regenerateImageUrl(scene.image_prompt, settings.aspect, settings.resolution);
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => { onSettingsChange?.({ ...settings }); setImageErrors((prev) => { const next = new Set(prev); next.delete(i); return next; }); setRegenerating(null); };
    img.onerror = () => { setRegenerating(null); };
    img.src = newUrl;
    if (onSettingsChange) { onSettingsChange({ ...settings }); }
  };

  return (
    <div className="space-y-4">
      <div ref={containerRef} className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center group">
        {videoUrl ? (
          <video ref={videoRef} src={videoUrl} className="w-full h-full object-contain" onClick={togglePlay} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onTimeUpdate={(e) => { if (!scrubbing) setCurrentTime(e.currentTarget.currentTime); }} onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration)} onEnded={() => setIsPlaying(false)} />
        ) : currentScene?.video_url ? (
          <video src={currentScene.video_url} poster={currentScene.video_poster} autoPlay muted loop playsInline className="w-full h-full object-cover" />
        ) : currentScene?.image_url && !imageErrors.has(previewIndex) ? (
          <img src={currentScene.image_url} alt="" className="w-full h-full object-cover" onError={() => handleImageError(previewIndex)} />
        ) : (
          <div className="flex flex-col items-center gap-3 text-slate-600"><Film size={48} strokeWidth={1} /><p className="text-sm">{scenes.length === 0 ? 'Önce senaryo oluşturun' : 'Görsel yüklenemedi'}</p>{scenes.length > 0 && imageErrors.has(previewIndex) && (<button onClick={() => regenerateSceneImage(previewIndex)} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition flex items-center gap-1.5"><RefreshCw size={12} className={regenerating === previewIndex ? 'animate-spin' : ''} />Görseli Yeniden Üret</button>)}</div>
        )}
        {previewing && currentScene && !videoUrl && (<div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent"><p className="text-white text-sm text-center">{currentScene.narration}</p><div className="mt-2 flex gap-1 justify-center">{scenes.map((_, i) => (<div key={i} className={`h-1 rounded-full transition-all ${i === previewIndex ? 'w-8 bg-blue-500' : 'w-2 bg-white/30'}`} />))}</div></div>)}
        {scenes.length > 0 && !videoUrl && (<div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur text-white text-xs font-medium">{previewIndex + 1} / {scenes.length}</div>)}
        {videoUrl && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-3 pt-8 pb-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <div className="group/scrub relative h-1.5 rounded-full bg-white/20 cursor-pointer mb-2" onMouseDown={(e) => { setScrubbing(true); onScrub(e); }} onMouseMove={(e) => { if (scrubbing) onScrub(e); }} onMouseUp={() => setScrubbing(false)} onMouseLeave={() => setScrubbing(false)} onTouchStart={(e) => { setScrubbing(true); onScrub(e); }} onTouchMove={(e) => { if (scrubbing) onScrub(e); }} onTouchEnd={() => setScrubbing(false)}>
              <div className="absolute inset-y-0 left-0 rounded-full bg-blue-500" style={{ width: `${videoDuration ? (currentTime / videoDuration) * 100 : 0}%` }} />
              <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow opacity-0 group-hover/scrub:opacity-100 transition" style={{ left: `calc(${videoDuration ? (currentTime / videoDuration) * 100 : 0}% - 6px)` }} />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={togglePlay} className="p-1.5 rounded text-white hover:bg-white/10 transition" title={isPlaying ? 'Duraklat' : 'Oynat'}>{isPlaying ? <Pause size={16} /> : <Play size={16} />}</button>
              <button onClick={() => seek(-seekAmount)} className="p-1.5 rounded text-white hover:bg-white/10 transition" title={`${seekAmount} sn geri`}><RotateCcw size={14} /></button>
              <button onClick={() => seek(seekAmount)} className="p-1.5 rounded text-white hover:bg-white/10 transition" title={`${seekAmount} sn ileri`}><RotateCw size={14} /></button>
              <button onClick={() => seekTo(0)} className="p-1.5 rounded text-white hover:bg-white/10 transition" title="Başa sar"><SkipBack size={14} /></button>
              <span className="text-xs text-white tabular-nums ml-1">{fmtTime(currentTime)} / {fmtTime(videoDuration)}</span>
              <div className="flex-1" />
              <button onClick={() => setMuted(!muted)} className="p-1.5 rounded text-white hover:bg-white/10 transition" title={muted ? 'Sesi aç' : 'Sesi kapat'}>{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
              <button onClick={toggleFullscreen} className="p-1.5 rounded text-white hover:bg-white/10 transition" title={isFullscreen ? 'Tam ekrandan çık' : 'Tam ekran'}>{isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}</button>
            </div>
          </div>
        )}
      </div>
      {scenes.length > 0 && !videoUrl && (<div className="flex gap-2 overflow-x-auto pb-2">{scenes.map((scene, i) => (<button key={scene.id} onClick={() => setPreviewIndex(i)} className={`relative shrink-0 w-24 h-14 rounded-lg overflow-hidden border-2 transition ${i === previewIndex ? 'border-blue-500' : 'border-transparent hover:border-slate-600'}`}>{scene.video_poster ? <img src={scene.video_poster} alt="" className="w-full h-full object-cover" /> : scene.image_url && !imageErrors.has(i) ? <img src={scene.image_url} alt="" className="w-full h-full object-cover" onError={() => handleImageError(i)} /> : <div className="w-full h-full bg-slate-800 flex items-center justify-center"><Film size={14} className="text-slate-600" /></div>}<div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-black/60 text-white text-[10px] text-center">{scene.duration}s</div></button>))}</div>)}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3"><span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Format:</span><div className="flex gap-1.5"><button onClick={() => onSettingsChange?.({ ...settings, exportFormat: 'webm' })} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${settings.exportFormat === 'webm' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>WebM</button><button onClick={() => onSettingsChange?.({ ...settings, exportFormat: 'mp4' })} disabled={!mp4Supported} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-30 disabled:cursor-not-allowed ${settings.exportFormat === 'mp4' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`} title={mp4Supported ? 'MP4 formatında dışa aktar' : 'Tarayıcınız MP4 kaydını desteklemiyor'}>MP4 {!mp4Supported && '(desteklenmiyor)'}</button></div>{!mp4Supported && settings.exportFormat === 'mp4' && (<span className="text-xs text-amber-400">Tarayıcınız MP4 desteklemiyor, otomatik WebM olarak kaydedilecek</span>)}</div>
      <div className="flex flex-wrap gap-2 sm:gap-3">
        <button onClick={startPreview} disabled={scenes.length === 0 || rendering} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-medium transition disabled:opacity-40">{previewing ? <Pause size={16} /> : <Play size={16} />}{previewing ? 'Durdur' : 'Sesli Önizleme'}</button>
        <button onClick={() => setMuted(!muted)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-medium transition" title={muted ? 'Sesi aç' : 'Sesi kapat'}>{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
        <button onClick={render} disabled={scenes.length === 0 || rendering || transcoding} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed">{rendering || transcoding ? <Loader2 size={16} className="animate-spin" /> : <Film size={16} />}{transcoding ? 'MP4 kodlanıyor...' : rendering ? 'Oluşturuluyor...' : 'Video Oluştur'}</button>
        {videoUrl && (<a href={videoUrl} download={`${title || 'video'}.${videoExt}`} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition"><Download size={16} />Video İndir</a>)}
        <button onClick={() => downloadSRT(scenes, title, titleOffset)} disabled={scenes.length === 0} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-medium transition disabled:opacity-40" title="Altyazı dosyası indir (SRT)"><FileText size={16} />Altyazı (SRT)</button>
      </div>
      {(rendering || transcoding) && progress && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-400"><span>{progress.phase === 'preparing' && (progress.message || 'Hazırlanıyor...')}{progress.phase === 'rendering' && `Sahne ${progress.scene}/${progress.total} işleniyor...`}{progress.phase === 'encoding' && 'Video kodlanıyor...'}{progress.phase === 'transcoding' && `MP4 dönüştürülüyor... ${Math.round(transcodeProgress * 100)}%`}</span><span>{progressPct}</span></div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300" style={{ width: progressPct }} /></div>
          {progress.message && progress.phase === 'preparing' && (<p className="text-xs text-slate-500">{progress.message}</p>)}
        </div>
      )}
      <div className="flex items-center gap-3 sm:gap-4 text-xs text-slate-500 flex-wrap"><span className="flex items-center gap-1"><Film size={12} /> {scenes.length} sahne</span><span className="flex items-center gap-1"><Clock size={12} /> ~{Math.ceil(totalDuration)} sn</span><span>~{(totalDuration / 60).toFixed(1)} dk</span><span>{settings.resolution}</span><span>{settings.aspect}</span>{settings.music !== 'none' && <span className="flex items-center gap-1"><Music size={12} /> {settings.music}</span>}<span>Format: {settings.exportFormat.toUpperCase()}</span></div>
      {(rendering || transcoding) && (<div className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-4 py-3 text-xs text-blue-300">{transcoding ? 'Video MP4 formatına dönüştürülüyor. Bu işlem birkaç dakika sürebilir.' : 'Video oluşturuluyor. Bu işlem sahne sayısına göre birkaç dakika sürebilir. Lütfen bu sekme açık kalsın ve diğer sekmeye geçmeyin.'}</div>)}
    </div>
  );
}
