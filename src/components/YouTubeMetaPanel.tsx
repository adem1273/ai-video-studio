import { useState } from 'react';
import { Wand2, Loader2, Copy, Check, FileText, Hash, Tag, Eye, EyeOff, Upload, AlertCircle, ExternalLink } from 'lucide-react';
import type { Scene, VideoProject } from '@/lib/types';
import { generateYouTubeMeta, copyToClipboard } from '@/lib/youtube';

type Props = { scenes: Scene[]; title: string; prompt: string; meta: { youtube_title: string | null; youtube_description: string | null; youtube_tags: string[] | null }; onMetaReady: (meta: { youtube_title: string; youtube_description: string; youtube_tags: string[] }) => void; isPublished: boolean; onPublishToggle: () => void; videoBlob?: Blob | null; videoUrl?: string | null; };

export function YouTubeMetaPanel({ scenes, title, prompt, meta, onMetaReady, isPublished, onPublishToggle, videoBlob, videoUrl }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [accessToken, setAccessToken] = useState('');

  const generate = async () => {
    if (scenes.length === 0) return;
    setLoading(true); setError(null);
    try { await new Promise((r) => setTimeout(r, 300)); const result = generateYouTubeMeta(prompt, scenes, title); onMetaReady({ youtube_title: result.title, youtube_description: result.description, youtube_tags: result.tags }); } catch (err) { setError((err as Error).message); } finally { setLoading(false); }
  };

  const copy = async (text: string, field: string) => { const ok = await copyToClipboard(text); if (ok) { setCopiedField(field); setTimeout(() => setCopiedField(null), 2000); } };

  const uploadToYouTube = async () => {
    let blob = videoBlob;
    if (!blob && videoUrl) { try { const res = await fetch(videoUrl); blob = await res.blob(); } catch { setUploadError('Video dosyası alınamadı.'); return; } }
    if (!blob) { setUploadError('Önce videoyu oluşturmanız gerekiyor.'); return; }
    if (!accessToken.trim()) { setUploadError('YouTube erişim anahtarı gerekiyor.'); return; }
    setUploading(true); setUploadError(null); setUploadSuccess(null);
    try {
      const metadata = { snippet: { title: meta.youtube_title || title, description: meta.youtube_description || '', tags: meta.youtube_tags || [], categoryId: '22' }, status: { privacyStatus: 'private' } };
      const boundary = '-------314159265358979323846';
      const body = [`--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(metadata)}\r\n`, `--${boundary}\r\nContent-Type: ${blob.type}\r\n\r\n`, blob, `\r\n--${boundary}--`];
      const multipartBody = new Blob(body);
      const res = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status', { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken.trim()}` }, body: multipartBody });
      if (!res.ok) { const errData = await res.json().catch(() => ({})); const msg = errData?.error?.message || `Yükleme başarısız (${res.status})`; throw new Error(msg); }
      const data = await res.json();
      setUploadSuccess(`Video YouTube'a yüklendi! Video ID: ${data.id}`);
    } catch (err) { setUploadError((err as Error).message); } finally { setUploading(false); }
  };

  const hasMeta = meta.youtube_title || meta.youtube_description || meta.youtube_tags;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h2 className="text-lg font-bold mb-1">YouTube Meta Verisi</h2><p className="text-sm text-slate-400">SEO uyumlu başlık, açıklama ve etiketler</p></div><div className="flex gap-2 w-full sm:w-auto"><button onClick={onPublishToggle} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${isPublished ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{isPublished ? <Check size={14} /> : <Eye size={14} />}{isPublished ? 'Yayında' : 'Yayınla'}</button><button onClick={generate} disabled={loading || scenes.length === 0} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition disabled:opacity-40">{loading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}{loading ? 'Oluşturuluyor...' : hasMeta ? 'Yeniden Oluştur' : 'Oluştur'}</button></div></div>
      {error && <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">{error}</div>}
      {hasMeta ? (
        <div className="space-y-4">
          {meta.youtube_title && (<div><div className="flex items-center justify-between mb-1.5"><label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Hash size={12} /> Başlık</label><button onClick={() => copy(meta.youtube_title!, 'title')} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition">{copiedField === 'title' ? <Check size={12} /> : <Copy size={12} />}{copiedField === 'title' ? 'Kopyalandı' : 'Kopyala'}</button></div><div className="rounded-lg bg-slate-950 border border-slate-800 px-4 py-3 text-sm text-slate-100">{meta.youtube_title}<span className="text-xs text-slate-600 ml-2">({meta.youtube_title.length} karakter)</span></div></div>)}
          {meta.youtube_description && (<div><div className="flex items-center justify-between mb-1.5"><label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><FileText size={12} /> Açıklama</label><div className="flex items-center gap-2"><button onClick={() => setShowFullDesc(!showFullDesc)} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition">{showFullDesc ? <EyeOff size={12} /> : <Eye size={12} />}{showFullDesc ? 'Kısalt' : 'Tamamını göster'}</button><button onClick={() => copy(meta.youtube_description!, 'desc')} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition">{copiedField === 'desc' ? <Check size={12} /> : <Copy size={12} />}{copiedField === 'desc' ? 'Kopyalandı' : 'Kopyala'}</button></div></div><div className={`rounded-lg bg-slate-950 border border-slate-800 px-4 py-3 text-sm text-slate-300 whitespace-pre-wrap ${showFullDesc ? '' : 'max-h-32 overflow-hidden'}`}>{meta.youtube_description}</div></div>)}
          {meta.youtube_tags && meta.youtube_tags.length > 0 && (<div><div className="flex items-center justify-between mb-1.5"><label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Tag size={12} /> Etiketler</label><button onClick={() => copy(meta.youtube_tags!.join(', '), 'tags')} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition">{copiedField === 'tags' ? <Check size={12} /> : <Copy size={12} />}{copiedField === 'tags' ? 'Kopyalandı' : 'Kopyala'}</button></div><div className="flex flex-wrap gap-1.5">{meta.youtube_tags.map((tag, i) => (<span key={i} className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium">{tag}</span>))}</div></div>)}
        </div>
      ) : (!loading && (<div className="text-center py-12 rounded-xl border border-slate-800 bg-slate-900/50"><FileText size={40} strokeWidth={1} className="mx-auto text-slate-600 mb-3" /><p className="text-slate-500 text-sm">Henüz meta verisi oluşturulmadı.</p><p className="text-slate-600 text-xs mt-1">"Oluştur" düğmesine basın, yapay zeka SEO uyumlu başlık, açıklama ve etiketler üretsin.</p></div>))}
      {hasMeta && (<div className="mt-6 pt-6 border-t border-slate-800"><div className="flex items-center gap-2 mb-3"><Upload size={16} className="text-red-500" /><h3 className="text-sm font-semibold text-slate-200">YouTube'a Direkt Yükle</h3></div>{!videoBlob && !videoUrl && (<div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-sm text-amber-400 mb-3"><AlertCircle size={16} className="shrink-0 mt-0.5" /><span>Önce "Video" sekmesinden videoyu oluşturmanız gerekiyor.</span></div>)}{uploadSuccess && (<div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-sm text-emerald-400 mb-3"><Check size={16} className="shrink-0 mt-0.5" /><span>{uploadSuccess}</span></div>)}{uploadError && (<div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400 mb-3"><AlertCircle size={16} className="shrink-0 mt-0.5" /><span>{uploadError}</span></div>)}{!showTokenInput ? (<button onClick={() => setShowTokenInput(true)} disabled={!videoBlob && !videoUrl} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition disabled:opacity-40"><Upload size={16} />YouTube'a Yükle</button>) : (<div className="space-y-3"><div><label className="text-xs text-slate-500 mb-1 block">YouTube erişim anahtarı (OAuth Access Token)</label><input type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="ya29.xxx..." className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-slate-600" /><p className="text-xs text-slate-600 mt-1.5 flex items-center gap-1"><ExternalLink size={11} />Google Cloud Console'da YouTube Data API v3 etkinleştirip OAuth token alın</p></div><div className="flex gap-2"><button onClick={uploadToYouTube} disabled={uploading || (!videoBlob && !videoUrl) || !accessToken.trim()} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition disabled:opacity-40">{uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}{uploading ? 'Yükleniyor...' : 'Yükle'}</button><button onClick={() => { setShowTokenInput(false); setUploadError(null); }} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition">İptal</button></div></div>)}</div>)}
    </div>
  );
}
