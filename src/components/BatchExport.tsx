import { useState, useRef, useEffect } from 'react';
import { Film, Loader2, Download, CheckCircle2, AlertCircle, Play, Square, Trash2, RotateCcw } from 'lucide-react';
import type { VideoProject, RenderProgress } from '@/lib/types';
import { renderVideo, getExtension } from '@/lib/videoRenderer';
import { transcodeToMP4 } from '@/lib/mp4Transcoder';
import { downloadSRT } from '@/lib/subtitles';
import { errorHandler } from '@/lib/errorHandler';
import { saveBatchQueue, loadBatchQueue, clearBatchQueue, type BatchQueueEntry } from '@/lib/mediaStore';

type Props = {
  projects: VideoProject[];
  onProjectUpdate: (id: string, updates: Partial<VideoProject>) => void;
};

type QueueItem = {
  project: VideoProject;
  status: 'pending' | 'rendering' | 'done' | 'error';
  progress?: string;
  progressPercent?: number;
  videoUrl?: string;
  videoBlob?: Blob;
  error?: string;
};

function itemToEntry(item: QueueItem): BatchQueueEntry {
  return {
    id: item.project.id,
    title: item.project.title,
    status: item.status,
    progress: item.progress,
    error: item.error,
    videoBlob: item.videoBlob,
    projectJson: JSON.stringify(item.project),
  };
}

function entryToItem(entry: BatchQueueEntry): QueueItem {
  const project = JSON.parse(entry.projectJson) as VideoProject;
  return {
    project,
    status: entry.status === 'rendering' ? 'pending' : (entry.status as QueueItem['status']),
    progress: entry.progress,
    error: entry.error,
    videoBlob: entry.videoBlob,
  };
}

export function BatchExport({ projects, onProjectUpdate }: Props) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [persisted, setPersisted] = useState(false);
  const cancelRef = useRef(false);

  // Load persisted queue on mount
  useEffect(() => {
    (async () => {
      try {
        const entries = await loadBatchQueue();
        if (entries.length > 0) {
          setShowResumePrompt(true);
          setQueue(entries.map(entryToItem));
        } else {
          initFromProjects();
        }
      } catch (err) {
        errorHandler.createError('STORAGE_READ_FAILED', 'Batch queue yüklenemedi', 'warning');
        initFromProjects();
      }
      setPersisted(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist queue when it changes
  useEffect(() => {
    if (!persisted || queue.length === 0) return;
    saveBatchQueue(queue.map(itemToEntry)).catch((err) => {
      errorHandler.createError('STORAGE_WRITE_FAILED', 'Batch queue kaydedilemedi', 'warning');
    });
  }, [queue, persisted]);

  function initFromProjects() {
    const readyProjects = projects
      .filter((p) => (p.status === 'ready' || p.status === 'draft') && p.script && p.script.length > 0)
      .map((p) => ({
        project: p,
        status: 'pending' as const,
      }));

    setQueue(readyProjects);
  }

  const resumeQueue = () => {
    setShowResumePrompt(false);
    setQueue((prev) =>
      prev.map((q) =>
        q.status === 'done' ? q : { ...q, status: 'pending' as const, error: undefined, progress: undefined }
      ),
    );
  };

  const discardQueue = async () => {
    try {
      await clearBatchQueue();
      setShowResumePrompt(false);
      initFromProjects();
    } catch (err) {
      errorHandler.createError('STORAGE_WRITE_FAILED', 'Queue sizilemedi', 'warning');
    }
  };

  const resetQueue = async () => {
    try {
      await clearBatchQueue();
      initFromProjects();
    } catch (err) {
      errorHandler.createError('STORAGE_WRITE_FAILED', 'Queue sıfırlanamadı', 'warning');
    }
  };

  const processAll = async () => {
    if (processing) {
      cancelRef.current = true;
      setProcessing(false);
      return;
    }

    cancelRef.current = false;
    setProcessing(true);

    for (let i = 0; i < queue.length; i++) {
      if (cancelRef.current) break;

      const item = queue[i];
      if (!item || item.status === 'done') continue;

      setQueue((q) =>
        q.map((x, idx) =>
          idx === i ? { ...x, status: 'rendering' as const, progress: 'Başlanıyor...', progressPercent: 0 } : x
        ),
      );

      try {
        const settings = item.project.settings;
        const scenes = item.project.script;

        if (!settings || !scenes || scenes.length === 0) {
          throw new Error('Proje ayarları veya sahneler eksik');
        }

        // Validate scenes before rendering
        for (let j = 0; j < scenes.length; j++) {
          const sceneError = errorHandler.validateScene(scenes[j]);
          if (sceneError) {
            throw new Error(`Sahne ${j + 1}: ${sceneError}`);
          }
        }

        // Render video
        let blob = await renderVideo(scenes, settings, item.project.title, (progress: RenderProgress) => {
          let msg = '';
          let percent = 0;

          if (progress.phase === 'preparing') {
            msg = progress.message || 'Hazırlanıyor...';
            percent = (progress.scene / Math.max(progress.total, 1)) * 40;
          } else if (progress.phase === 'rendering') {
            msg = `Sahne ${progress.scene + 1}/${progress.total}`;
            percent = 40 + ((progress.framesRendered || 0) / Math.max(progress.totalFrames || 1, 1)) * 50;
          } else if (progress.phase === 'encoding') {
            msg = 'Video kodlanıyor...';
            percent = 90;
          } else if (progress.phase === 'transcoding') {
            msg = 'MP4 dönüştürülüyor...';
            percent = 95;
          }

          setQueue((q) =>
            q.map((x, idx) =>
              idx === i ? { ...x, progress: msg, progressPercent: Math.round(percent) } : x
            ),
          );
        });

        let ext = getExtension(blob.type);

        // Transcode to MP4 if requested
        if (settings.exportFormat === 'mp4') {
          setQueue((q) =>
            q.map((x, idx) =>
              idx === i ? { ...x, progress: 'MP4 dönüştürülüyor...', progressPercent: 95 } : x
            ),
          );

          try {
            blob = await transcodeToMP4(blob, (ratio) => {
              setQueue((q) =>
                q.map((x, idx) =>
                  idx === i
                    ? {
                        ...x,
                        progress: `MP4 dönüştürülüyor... ${Math.round(ratio * 100)}%`,
                        progressPercent: 95 + ratio * 5,
                      }
                    : x
                ),
              );
            });
            ext = 'mp4';
          } catch (err) {
            const msg = `MP4 dönüşümü başarısız, WebM kullanılıyor: ${err instanceof Error ? err.message : String(err)}`;
            errorHandler.createError('TRANSCODE_FAILED', msg, 'warning');
            ext = 'webm';
          }
        }

        const url = URL.createObjectURL(blob);

        setQueue((q) =>
          q.map((x, idx) =>
            idx === i
              ? {
                  ...x,
                  status: 'done' as const,
                  videoUrl: url,
                  videoBlob: blob,
                  progress: 'Tamamlandı',
                  progressPercent: 100,
                }
              : x
          ),
        );

        onProjectUpdate(item.project.id, { status: 'ready' });

        // Auto-download
        const a = document.createElement('a');
        a.href = url;
        a.download = `${item.project.title || 'video'}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setQueue((q) =>
          q.map((x, idx) =>
            idx === i
              ? {
                  ...x,
                  status: 'error' as const,
                  error: message,
                  progress: undefined,
                  progressPercent: 0,
                }
              : x
          ),
        );

        errorHandler.createError(
          'RENDER_FAILED',
          `Proje "${item.project.title}" render edilemedi`,
          'error',
          message,
        );
      }
    }

    setProcessing(false);
  };

  const downloadAll = () => {
    queue
      .filter((q) => q.videoUrl)
      .forEach((item) => {
        const ext = item.project.settings?.exportFormat === 'mp4' ? 'mp4' : 'webm';
        const a = document.createElement('a');
        a.href = item.videoUrl!;
        a.download = `${item.project.title || 'video'}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });
  };

  const doneCount = queue.filter((q) => q.status === 'done').length;
  const errorCount = queue.filter((q) => q.status === 'error').length;
  const totalProgress =
    queue.length > 0
      ? Math.round(
          (queue.reduce((sum, q) => sum + (q.progressPercent || 0), 0) / queue.length) * 100,
        ) / 100
      : 0;

  if (queue.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold mb-1">Toplu Dışa Aktarım</h2>
          <p className="text-sm text-slate-400">Birden fazla projeyi sırayla render edin</p>
        </div>

        <div className="text-center py-16 rounded-xl border border-slate-800 bg-slate-900/50">
          <Film size={48} strokeWidth={1} className="mx-auto text-slate-600 mb-3" />
          <p className="text-slate-500 text-sm">
            {projects.length === 0
              ? 'Render edilecek proje yok'
              : 'Tüm projeler zaten render edildi'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showResumePrompt && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <RotateCcw size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-amber-200">Kaydedilmiş queue var</p>
              <p className="text-sm text-amber-300/80 mt-1">
                Daha önce başladığınız batch export devam etmek istiyor musunuz?
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={resumeQueue}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition"
            >
              Devam Et
            </button>
            <button
              onClick={discardQueue}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition"
            >
              Kapat
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold mb-1">Toplu Dışa Aktarım</h2>
          <p className="text-sm text-slate-400">
            {doneCount} tamamlandı, {errorCount} hata, {queue.length - doneCount - errorCount} beklemede
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={processAll}
            disabled={queue.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition ${
              processing
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white disabled:bg-slate-700 disabled:text-slate-500'
            }`}
          >
            {processing ? (
              <>
                <Square size={16} />
                İşlemi Durdur
              </>
            ) : (
              <>
                <Play size={16} />
                Tümünü İşle
              </>
            )}
          </button>

          {doneCount > 0 && (
            <button
              onClick={downloadAll}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition"
            >
              <Download size={16} />
              Tümünü İndir
            </button>
          )}

          <button
            onClick={resetQueue}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm transition"
            title="Queue'yi sıfırla"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {processing && (
        <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-4 py-3 text-xs text-blue-300">
          Toplu render devam ediyor. Bu işlem uzun sürebilir. Lütfen bu sekme açık tutun.
        </div>
      )}

      {/* Overall progress bar */}
      {processing && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Genel ilerleme</span>
            <span>{Math.round(totalProgress)}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300"
              style={{ width: `${totalProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Queue items */}
      <div className="space-y-2">
        {queue.map((item) => (
          <div
            key={item.project.id}
            className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 sm:p-4 space-y-2"
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-16 h-10 rounded-lg overflow-hidden bg-slate-950 shrink-0">
                {item.project.thumbnail_url ? (
                  <img src={item.project.thumbnail_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-800">
                    <Film size={16} className="text-slate-600" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{item.project.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {item.status === 'pending' && (
                    <span className="text-xs text-slate-500">Beklemede</span>
                  )}
                  {item.status === 'rendering' && (
                    <span className="flex items-center gap-1 text-xs text-blue-400">
                      <Loader2 size={12} className="animate-spin" />
                      Render ediliyor
                    </span>
                  )}
                  {item.status === 'done' && (
                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                      <CheckCircle2 size={12} />
                      Tamamlandı
                    </span>
                  )}
                  {item.status === 'error' && (
                    <span className="flex items-center gap-1 text-xs text-red-400">
                      <AlertCircle size={12} />
                      Hata
                    </span>
                  )}
                  {item.progress && <span className="text-xs text-slate-400">{item.progress}</span>}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {item.videoUrl && (
                  <a
                    href={item.videoUrl}
                    download={`${item.project.title || 'video'}.${
                      item.project.settings?.exportFormat === 'mp4' ? 'mp4' : 'webm'
                    }`}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 transition"
                    title="Video indir"
                  >
                    <Download size={16} />
                  </a>
                )}
                {item.project.script && item.project.script.length > 0 && (
                  <button
                    onClick={() => downloadSRT(item.project.script!, item.project.title)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 transition"
                    title="SRT indir"
                  >
                    <FileText size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Item progress bar */}
            {item.status === 'rendering' && (
              <div className="space-y-1">
                <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300"
                    style={{ width: `${item.progressPercent || 0}%` }}
                  />
                </div>
              </div>
            )}

            {item.status === 'error' && item.error && (
              <div className="text-xs text-red-300/80 bg-red-500/10 px-2 py-1 rounded">
                {item.error}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="text-xs text-slate-500">
        {doneCount}/{queue.length} proje tamamlandı
      </div>
    </div>
  );
}
