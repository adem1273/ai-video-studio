import { useState } from 'react';
import { Copy, Trash2, Search, Film, Calendar, CheckCircle2 } from 'lucide-react';
import type { VideoProject } from '@/lib/types';

type Props = {
  projects: VideoProject[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
};

const statusColors: Record<string, string> = { draft: 'bg-slate-600', generating: 'bg-amber-500 animate-pulse', ready: 'bg-emerald-500', failed: 'bg-red-500' };
const statusLabels: Record<string, string> = { draft: 'Taslak', generating: 'Üretiliyor', ready: 'Hazır', failed: 'Hata' };

export function ProjectLibrary({ projects, activeId, onSelect, onDelete, onDuplicate }: Props) {
  const [search, setSearch] = useState('');
  const filtered = projects.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()) || p.prompt.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ara..." className="w-full rounded-lg bg-slate-950 border border-slate-800 pl-9 pr-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-slate-600 placeholder:text-slate-600" />
      </div>
      {filtered.length === 0 && <div className="text-center py-8 text-slate-600 text-sm">{search ? 'Sonuç bulunamadı.' : 'Henüz proje yok.'}</div>}
      {filtered.map((p) => (
        <div key={p.id} onClick={() => onSelect(p.id)} className={`group cursor-pointer rounded-xl border p-3 transition ${activeId === p.id ? 'border-blue-500 bg-blue-500/5' : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-950 shrink-0">
                {p.thumbnail_url ? <img src={p.thumbnail_url} alt="" className="w-full h-full object-cover" /> : p.script?.[0]?.image_url ? <img src={p.script[0].image_url} alt="" className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full"><Film size={14} className="text-slate-700" /></div>}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-slate-200 truncate font-medium">{p.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${statusColors[p.status]}`} />
                  <span className="text-xs text-slate-500">{statusLabels[p.status]}</span>
                  {p.is_published && <span className="text-xs text-emerald-500 flex items-center gap-0.5"><CheckCircle2 size={10} /> Yayında</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
              <button onClick={(e) => { e.stopPropagation(); onDuplicate(p.id); }} className="p-1.5 rounded text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition" title="Projeyi kopyala"><Copy size={12} /></button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(p.id); }} className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition" title="Sil"><Trash2 size={12} /></button>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-600">
            <span className="flex items-center gap-1"><Calendar size={10} />{new Date(p.created_at).toLocaleDateString('tr-TR')}</span>
            {p.script && <span>{p.script.length} sahne</span>}
            {p.youtube_title && <span className="text-blue-500">SEO</span>}
            {p.thumbnail_url && <span className="text-purple-500">Thumb</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
