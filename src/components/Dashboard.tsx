import { useMemo } from 'react';
import { Film, Clock, CheckCircle2, Loader2, FileText, TrendingUp, Calendar } from 'lucide-react';
import type { VideoProject } from '@/lib/types';

type Props = { projects: VideoProject[]; onNewProject: () => void; onSelectProject: (id: string) => void; };

export function Dashboard({ projects, onNewProject, onSelectProject }: Props) {
  const stats = useMemo(() => {
    const total = projects.length;
    const ready = projects.filter((p) => p.status === 'ready').length;
    const drafts = projects.filter((p) => p.status === 'draft').length;
    const generating = projects.filter((p) => p.status === 'generating').length;
    const published = projects.filter((p) => p.is_published).length;
    const withThumbnails = projects.filter((p) => p.thumbnail_url).length;
    const withMeta = projects.filter((p) => p.youtube_title).length;
    const totalScenes = projects.reduce((sum, p) => sum + (p.script?.length ?? 0), 0);
    const totalDuration = projects.reduce((sum, p) => sum + (p.script?.reduce((s, sc) => s + sc.duration, 0) ?? 0), 0);
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const thisWeek = projects.filter((p) => new Date(p.created_at).getTime() > weekAgo).length;
    return { total, ready, drafts, generating, published, withThumbnails, withMeta, totalScenes, totalDuration, thisWeek };
  }, [projects]);

  const recent = [...projects].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h2 className="text-xl sm:text-2xl font-bold">Kontrol Paneli</h2><p className="text-sm text-slate-400 mt-1">İçerik üretim hattınızın genel görünümü</p></div>
        <button onClick={onNewProject} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition w-full sm:w-auto"><Film size={16} />Yeni Video</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        <StatCard icon={<Film size={20} />} label="Toplam Proje" value={stats.total} accent="from-blue-500 to-cyan-500" />
        <StatCard icon={<CheckCircle2 size={20} />} label="Hazır" value={stats.ready} accent="from-emerald-500 to-green-500" />
        <StatCard icon={<Loader2 size={20} />} label="Taslak / Üretiliyor" value={stats.drafts + stats.generating} accent="from-amber-500 to-orange-500" />
        <StatCard icon={<TrendingUp size={20} />} label="Bu Hafta" value={stats.thisWeek} accent="from-purple-500 to-pink-500" />
        <StatCard icon={<Clock size={20} />} label="Toplam Süre" value={`${Math.floor(stats.totalDuration / 60)}dk`} accent="from-slate-500 to-slate-600" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        <PipelineCard icon={<FileText size={18} />} label="YouTube Meta Verisi" value={stats.withMeta} total={stats.total} />
        <PipelineCard icon={<Film size={18} />} label="Thumbnail Oluşturuldu" value={stats.withThumbnails} total={stats.total} />
        <PipelineCard icon={<CheckCircle2 size={18} />} label="Yayınlandı" value={stats.published} total={stats.total} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Son Projeler</h3>
        {recent.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-slate-800 bg-slate-900/50">
            <Film size={40} strokeWidth={1} className="mx-auto text-slate-600 mb-3" />
            <p className="text-slate-500 text-sm">Henüz proje yok. İlk videonuzu oluşturun!</p>
            <button onClick={onNewProject} className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition">Yeni Video Oluştur</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
            {recent.map((p) => (
              <div key={p.id} onClick={() => onSelectProject(p.id)} className="group cursor-pointer rounded-xl border border-slate-800 bg-slate-900/50 hover:border-slate-700 overflow-hidden transition">
                <div className="relative aspect-video bg-slate-950">
                  {p.thumbnail_url ? <img src={p.thumbnail_url} alt="" className="w-full h-full object-cover" /> : p.script?.[0]?.image_url ? <img src={p.script[0].image_url} alt="" className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full"><Film size={32} strokeWidth={1} className="text-slate-700" /></div>}
                  <div className="absolute top-2 right-2"><StatusBadge status={p.status} /></div>
                  {p.is_published && <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-emerald-600 text-white text-xs font-medium">Yayında</div>}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-slate-200 truncate">{p.title}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500"><Calendar size={10} />{new Date(p.created_at).toLocaleDateString('tr-TR')}{p.script && <span>· {p.script.length} sahne</span>}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string | number; accent: string; }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 sm:p-4">
      <div className={`inline-flex p-2 rounded-lg bg-gradient-to-br ${accent} text-white mb-2 sm:mb-3`}>{icon}</div>
      <p className="text-xl sm:text-2xl font-bold">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

function PipelineCard({ icon, label, value, total }: { icon: React.ReactNode; label: string; value: number; total: number; }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex items-center gap-2 mb-2"><span className="text-slate-400">{icon}</span><span className="text-sm text-slate-300">{label}</span></div>
      <div className="flex items-center justify-between mb-2"><span className="text-lg font-bold">{value}/{total}</span><span className="text-xs text-slate-500">%{pct}</span></div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function StatusBadge({ status }: { status: VideoProject['status'] }) {
  const config: Record<string, { color: string; label: string }> = { draft: { color: 'bg-slate-600', label: 'Taslak' }, generating: { color: 'bg-amber-500', label: 'Üretiliyor' }, ready: { color: 'bg-emerald-500', label: 'Hazır' }, failed: { color: 'bg-red-500', label: 'Hata' } };
  const c = config[status] ?? config.draft;
  return <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${c.color}`}>{c.label}</span>;
}
