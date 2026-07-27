import { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Search, Film, Image as ImageIcon, Music, Trash2, Pencil, Check, X, FileVideo, FileImage, FileAudio, Filter, Download } from 'lucide-react';
import { type MediaAsset, type MediaType, getAllAssets, addAsset, updateAsset, deleteAsset, classifyFile, formatBytes } from '@/lib/mediaStore';

type FilterType = MediaType | 'all';
const typeMeta: Record<MediaType, { label: string; icon: typeof Film; color: string }> = { video: { label: 'Video', icon: FileVideo, color: 'text-blue-400' }, image: { label: 'Görsel', icon: FileImage, color: 'text-emerald-400' }, audio: { label: 'Ses', icon: FileAudio, color: 'text-amber-400' } };

export function MediaManager() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<MediaAsset | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [objectUrls, setObjectUrls] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAssets = useCallback(async () => { const items = await getAllAssets(); setAssets(items); }, []);
  useEffect(() => { loadAssets(); }, [loadAssets]);
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const a of assets) next[a.id] = URL.createObjectURL(a.blob);
    setObjectUrls((prev) => { Object.values(prev).forEach((u) => URL.revokeObjectURL(u)); return next; });
    return () => { Object.values(next).forEach((u) => URL.revokeObjectURL(u)); };
  }, [assets]);

  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files); if (arr.length === 0) return; setUploading(true);
    try { for (const file of arr) { const type = classifyFile(file); if (!type) continue; const asset: MediaAsset = { id: crypto.randomUUID(), name: file.name.replace(/\.[^.]+$/, ''), type, size: file.size, mime: file.type || 'application/octet-stream', createdAt: Date.now(), blob: file }; await addAsset(asset); } await loadAssets(); } finally { setUploading(false); }
  };
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); };
  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; };
  const handleRename = async (id: string) => { const name = nameDraft.trim(); if (!name) { setEditingId(null); return; } const asset = assets.find((a) => a.id === id); if (asset) { await updateAsset({ ...asset, name }); await loadAssets(); } setEditingId(null); };
  const startRename = (asset: MediaAsset) => { setEditingId(asset.id); setNameDraft(asset.name); };
  const handleDelete = async (id: string) => { await deleteAsset(id); if (previewAsset?.id === id) setPreviewAsset(null); await loadAssets(); };
  const handleDownload = (asset: MediaAsset) => { const url = objectUrls[asset.id]; if (!url) return; const a = document.createElement('a'); a.href = url; a.download = asset.name; a.click(); };

  const filtered = assets.filter((a) => { if (filter !== 'all' && a.type !== filter) return false; if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false; return true; });
  const counts: Record<FilterType, number> = { all: assets.length, video: assets.filter((a) => a.type === 'video').length, image: assets.filter((a) => a.type === 'image').length, audio: assets.filter((a) => a.type === 'audio').length };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <div className="mb-6"><h2 className="text-xl sm:text-2xl font-bold mb-1">Medya Yöneticisi</h2><p className="text-sm text-slate-400">Video, görsel ve ses dosyalarını yükleyin. Tüm dosyalar tarayıcınızda yerel olarak saklanır.</p></div>
      <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop} onClick={() => fileInputRef.current?.click()} className={`relative rounded-2xl border-2 border-dashed p-8 sm:p-10 text-center cursor-pointer transition mb-6 ${dragOver ? 'border-blue-500 bg-blue-500/10 scale-[1.01]' : 'border-slate-700 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-900'}`}>
        <input ref={fileInputRef} type="file" multiple accept="video/*,image/*,audio/*" onChange={onInputChange} className="hidden" />
        <div className="flex flex-col items-center gap-3"><div className={`w-14 h-14 rounded-full flex items-center justify-center transition ${dragOver ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-400'}`}><Upload size={24} /></div><div><p className="text-sm font-medium text-slate-200">{uploading ? 'Yükleniyor...' : 'Dosyaları sürükleyip bırakın veya tıklayın'}</p><p className="text-xs text-slate-500 mt-1">Video, görsel ve ses dosyaları desteklenir</p></div></div>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4"><div className="relative flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" /><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Medya ara..." className="w-full rounded-lg bg-slate-950 border border-slate-800 pl-9 pr-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-slate-600 placeholder:text-slate-600" /></div><div className="flex items-center gap-1 bg-slate-900 rounded-lg border border-slate-800 p-1 overflow-x-auto scrollbar-hide"><Filter size={14} className="text-slate-600 ml-1.5 mr-0.5 shrink-0" />{(['all', 'video', 'image', 'audio'] as FilterType[]).map((f) => (<button key={f} onClick={() => setFilter(f)} className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition whitespace-nowrap ${filter === f ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>{f === 'all' ? 'Tümü' : typeMeta[f].label}<span className="ml-1 text-slate-500">{counts[f]}</span></button>))}</div></div>
      {filtered.length === 0 ? (<div className="text-center py-12 text-slate-600 text-sm">{assets.length === 0 ? 'Henüz medya yok. Yukarıdan dosya yükleyin.' : 'Aramanızla eşleşen medya bulunamadı.'}</div>) : (<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">{filtered.map((asset) => { const Icon = typeMeta[asset.type].icon; const url = objectUrls[asset.id]; return (<div key={asset.id} className="group rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden hover:border-slate-700 transition flex flex-col"><div className="relative h-28 bg-slate-950 cursor-pointer flex items-center justify-center overflow-hidden" onClick={() => setPreviewAsset(asset)}>{asset.type === 'image' && url && <img src={url} alt="" className="w-full h-full object-cover" />}{asset.type === 'video' && url && <video src={url} muted className="w-full h-full object-cover" />}{asset.type === 'audio' && <div className="flex flex-col items-center gap-1"><Music size={28} className="text-amber-400/70" /><span className="text-[10px] text-slate-600">Ses dosyası</span></div>}<div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-medium flex items-center gap-1"><Icon size={9} /> {typeMeta[asset.type].label}</div></div><div className="p-2.5 flex flex-col gap-1.5 flex-1">{editingId === asset.id ? (<div className="flex items-center gap-1"><input autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleRename(asset.id); if (e.key === 'Escape') setEditingId(null); }} className="flex-1 min-w-0 rounded bg-slate-950 border border-slate-700 px-1.5 py-0.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500" /><button onClick={() => handleRename(asset.id)} className="p-0.5 rounded text-emerald-400 hover:bg-emerald-500/10"><Check size={12} /></button><button onClick={() => setEditingId(null)} className="p-0.5 rounded text-slate-400 hover:bg-slate-800"><X size={12} /></button></div>) : (<div className="flex items-center justify-between gap-1"><p className="text-xs text-slate-200 truncate flex-1" title={asset.name}>{asset.name}</p><button onClick={() => startRename(asset)} className="p-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition shrink-0" title="Yeniden adlandır"><Pencil size={11} /></button></div>)}<p className="text-[10px] text-slate-600">{formatBytes(asset.size)}</p><div className="flex items-center gap-1 mt-auto pt-1"><button onClick={() => setPreviewAsset(asset)} className="flex-1 px-2 py-1 rounded-md text-[11px] font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition">Önizle</button><button onClick={() => handleDownload(asset)} className="p-1.5 rounded-md text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition" title="İndir"><Download size={12} /></button><button onClick={() => handleDelete(asset.id)} className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition" title="Sil"><Trash2 size={12} /></button></div></div></div>); })}</div>)}
      {previewAsset && objectUrls[previewAsset.id] && (<div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPreviewAsset(null)}><div className="bg-slate-900 rounded-2xl border border-slate-800 max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}><div className="flex items-center justify-between p-3 border-b border-slate-800"><div className="min-w-0"><p className="text-sm font-medium text-slate-100 truncate">{previewAsset.name}</p><p className="text-xs text-slate-500">{typeMeta[previewAsset.type].label} · {formatBytes(previewAsset.size)} · {new Date(previewAsset.createdAt).toLocaleDateString('tr-TR')}</p></div><button onClick={() => setPreviewAsset(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"><X size={18} /></button></div><div className="flex-1 overflow-auto flex items-center justify-center bg-black p-4 min-h-[200px]">{previewAsset.type === 'image' && <img src={objectUrls[previewAsset.id]} alt={previewAsset.name} className="max-w-full max-h-[60vh] object-contain rounded-lg" />}{previewAsset.type === 'video' && <video src={objectUrls[previewAsset.id]} controls autoPlay className="max-w-full max-h-[60vh] rounded-lg" />}{previewAsset.type === 'audio' && <div className="flex flex-col items-center gap-4 w-full max-w-md"><div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center"><Music size={36} className="text-amber-400" /></div><audio src={objectUrls[previewAsset.id]} controls autoPlay className="w-full" /></div>}</div></div></div>)}
    </div>
  );
}
