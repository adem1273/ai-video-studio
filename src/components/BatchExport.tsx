import { useState, useRef, useEffect } from 'react';
import { Film, Loader2, Download, CheckCircle2, AlertCircle, Play, Square, Trash2, RotateCcw } from 'lucide-react';
import type { VideoProject } from '@/lib/types';
import { renderVideo } from '@/lib/videoRenderer';
import { transcodeToMP4 } from '@/lib/mp4Transcoder';
import { downloadSRT } from '@/lib/subtitles';
import { saveBatchQueue, loadBatchQueue, clearBatchQueue, type BatchQueueEntry } from '@/lib/mediaStore';

type Props = { projects: VideoProject[]; onProjectUpdate: (id: string, updates: Partial<VideoProject>) => void; };

type QueueItem = { project: VideoProject; status: 'pending' | 'rendering' | 'done' | 'error'; progress?: string; videoUrl?: string; videoBlob?: Blob; error?: string; };

function itemToEntry(item: QueueItem): BatchQueueEntry { return { id: item.project.id, title: item.project.title, status: item.status, progress: item.progress, error: item.error, videoBlob: item.videoBlob, projectJson: JSON.stringify(item.project), updatedAt: Date.now() }; }
function entryToItem(entry: BatchQueueEntry): QueueItem { const project = JSON.parse(entry.projectJson) as VideoProject; return { project, status: entry.status === 'rendering' ? 'pending' : entry.status, progress: entry.progress, error: entry.error, videoBlob: entry.videoBlob, videoUrl: entry.videoBlob ? URL.createObjectURL(entry.videoBlob) : undefined }; }

export function BatchExport({ projects, onProjectUpdate }: Props) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [persisted, setPersisted] = useState(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    (async () => {
      try { const entries = await loadBatchQueue(); if (entries.length > 0) { setShowResumePrompt(true); setQueue(entries.map(entryToItem)); } else initFromProjects(); }
      catch { initFromProjects(); }
      setPersisted(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (!persisted || queue.length === 0) return; saveBatchQueue(queue.map(itemToEntry)).catch((err) => console.error('Failed to persist batch queue:', err)); }, [queue, persisted]);

  function initFromProjects() { setQueue(projects.filter((p) => p.status === 'ready' || p.status === 'draft').filter((p) => p.script && p.script.length > 0).map((p) => ({ project: p, status: 'pending' as const }))); }
  const resumeQueue = () => { setShowResumePrompt(false); setQueue((prev) => prev.map((q) => (q.status === 'done' ? q : { ...q, status: 'pending' as const, error: undefined, progress: undefined }))); };
  const discardQueue = async () => { await clearBatchQueue(); setShowResumePrompt(false); initFromProjects(); };
  const resetQueue = async () => { await clearBatchQueue(); initFromProjects(); };

  const processAll = async () => {
    if (processing) { cancelRef.current = true; setProcessing(false); return; }
    cancelRef.current = false; setProcessing(true);
    for (let i = 0; i < queue.length; i++) {
      if (cancelRef.current) break;
      const item = queue[i];
      if (item.status === 'done') continue;
      setQueue((q) => q.map((x, idx) => (idx === i ? { ...x, status: 'rendering', progress: 'Başlıyor...' } : x)));
      try {
        const settings = item.project.settings!; const scenes = item.project.script!;
        let blob = await renderVideo(scenes, settings, item.project.title, (p) => {
          const msg = p.phase === 'preparing' ? p.message || 'Hazırlanıyor...' : p.phase === 'rendering' ? `Sahne ${p.scene}/${p.total}` : p.phase === 'encoding' ? 'Kodlanıyor...' : p.phase === 'transcoding' ? 'MP4 dönüştürülüyor...' : 'Bitti';
          setQueue((q) => q.map((x, idx) => (idx === i ? { ...x, progress: msg } : x)));
        });
        let ext = 'webm';
        if (settings.exportFormat === 'mp4') { setQueue((q) => q.map((x, idx) => (idx === i ? { ...x, progress: 'MP4 dönüştürülüyor...' } : x)))); try { blob = await transcodeToMP4(blob); ext = 'mp4'; } catch (err) { console.error('MP4 transcode failed:', err); } }
        const url = URL.createObjectURL(blob);
        setQueue((q) => q.map((x, idx) => (idx === i ? { ...x, status: 'done', videoUrl: url, videoBlob: blob, progress: 'Tamamlandı' } : x)));
        onProjectUpdate(item.project.id, { status: 'ready' });
        const a = document.createElement('a'); a.href = url; a.download = `${item.project.title || 'video'}.${ext}`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
      } catch (err) { setQueue((q) => q.map((x, idx) => (idx === i ? { ...x, status: 'error', error: (err as Error).message } : x))); }
    }
    setProcessing(false);
  };

  const downloadAll = () => { queue.filter((q) => q.videoUrl).forEach((item) => { const ext = item.project.settings?.exportFormat === 'mp4' ? 'mp4' : 'webm'; const a = document.createElement('a'); a.href = item.videoUrl!; a.download = `${item.project.title || 'video'}.${ext}`; document.body.appendChild(a); a.click(); document.body.removeChild(a); }); };
  const doneCount = queue.filter((q) => q.status === 'done').length;
  const errorCount = queue.filter((q) => q.status === 'error').length;

  if (queue.length === 0) return (
    <div className="space-y-4"><div><h2 className="text-lg font-bold mb-1">Toplu Dışa Aktarım</h2><p className="text-sm text-slate-400">Birden fazla projeyi sırayla render edin</p></div>
      <div className="text-center py-16 rounded-xl border border-slate-800 bg-slate-900/50"><Film size={48} strokeWidth={1} className="mx-auto text-slate-600 mb-3" /><p className="text-slate-500 text-sm">Render edilecek proje yok.</p><p className="text-slate-600 text-xs mt-1">Önce en az bir proje oluşturun ve sahneli kaydedin.</p></div>
    </div>
  );

  return (
    <div className="space-y-4">
      {showResumePrompt && (<div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3"><div className="flex items-start gap-2"><RotateCcw size={16} className="text-amber-400 mt-0.5 shrink-0" /><div><p className="text-sm text-amber-200 font-medium">Yarım kalan bir toplu render bulundu</p><p className="text-xs text-amber-400/70 mt-0.5">{doneCount} proje tamamlandı, {queue.length - doneCount} proje bekliyor. Devam etmek ister misiniz?</p></div></div><div className="flex gap-2 pl-6"><button onClick={resumeQueue} className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition">Devam Et</button><button onClick={discardQueue} className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition">Sıfırdan Başla</button></div></div>)}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h2 className="text-lg font-bold mb-1">Toplu Dışa Aktarım</h2><p className="text-sm text-slate-400">{queue.length} proje sıraya alındı · {doneCount} tamamlandı · {errorCount} hata</p></div><div className="flex gap-2 flex-wrap"><button onClick={processAll} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition">{processing ? <><Square size={16} />Durdur</> : <><Play size={16} />Tümünü Render Et</>}</button>{doneCount > 0 && <button onClick={downloadAll} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition"><Download size={16} />Tümünü İndir</button>}<button onClick={resetQueue} className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-sm font-medium transition" title="Kuyruğu Sıfırla"><Trash2 size={16} /></button></div></div>
      {processing && <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-4 py-3 text-xs text-blue-300">Toplu render devam ediyor. Bu işlem uzun sürebilir. Lütfen bu sekme açık kalsın.</div>}
      <div className="space-y-2">{queue.map((item) => (
        <div key={item.project.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
          <div className="w-16 h-10 rounded-lg overflow-hidden bg-slate-950 shrink-0">{item.project.thumbnail_url ? <img src={item.project.thumbnail_url} alt="" className="w-full h-full object-cover" /> : item.project.script?.[0]?.image_url ? <img src={item.project.script[0].image_url} alt="" className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full"><Film size={14} className="text-slate-700" /></div>}</div>
          <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-200 truncate">{item.project.title}</p><div className="flex items-center gap-2 mt-0.5">{item.status === 'pending' && <span className="text-xs text-slate-500">Sırada bekliyor</span>}{item.status === 'rendering' && <span className="text-xs text-amber-400 flex items-center gap-1"><Loader2 size={10} className="animate-spin" />{item.progress || 'Render ediliyor...'}</span>}{item.status === 'done' && <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 size={10} />Tamamlandı</span>}{item.status === 'error' && <span className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={10} />{item.error}</span>}{item.project.script && <span className="text-xs text-slate-600">· {item.project.script.length} sahne</span>}</div></div>
          <div className="flex items-center gap-2 shrink-0">{item.videoUrl && <a href={item.videoUrl} download={`${item.project.title || 'video'}.${item.project.settings?.exportFormat === 'mp4' ? 'mp4' : 'webm'}`} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition" title="İndir"><Download size={14} /></a>}{item.project.script && <button onClick={() => downloadSRT(item.project.script!, item.project.title, item.project.settings?.showTitleCard ? 4 : 0)} className="px-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition" title="SRT indir">SRT</button>}</div>
        </div>
      ))}</div>
    </div>
  );
}
