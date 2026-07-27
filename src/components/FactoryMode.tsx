import { useState } from 'react';
import { Factory, Loader2, CheckCircle2, AlertCircle, PenLine, Eye, Film, TrendingUp } from 'lucide-react';
import { runFactoryMode, type FactoryProgress } from '@/lib/agents';
import { imageUrl } from '@/lib/pollinations';
import type { Scene, ProjectSettings } from '@/lib/types';

type Props = { onGenerated: (title: string, scenes: Scene[], settings: ProjectSettings, seo: { youtube_title: string; youtube_description: string; youtube_tags: string[] }) => void; settings: ProjectSettings; };

const SCENE_SECONDS = 5;
const durationOptions: { v: number; label: string; desc: string }[] = [{ v: 30, label: '30 sn', desc: '~6 sahne' }, { v: 60, label: '1 dk', desc: '~12 sahne' }, { v: 180, label: '3 dk', desc: '~36 sahne' }, { v: 600, label: '10 dk', desc: '~120 sahne' }];
const agentConfig = [{ name: 'Senarist', icon: PenLine, color: 'from-blue-500 to-cyan-500', desc: 'Senaryo yazıyor' }, { name: 'Görsel Yönetmen', icon: Eye, color: 'from-emerald-500 to-teal-500', desc: 'Görsel planlıyor' }, { name: 'Video Küratör', icon: Film, color: 'from-amber-500 to-orange-500', desc: 'Video seçiyor' }, { name: 'SEO Uzmanı', icon: TrendingUp, color: 'from-pink-500 to-rose-500', desc: 'SEO optimize ediyor' }];

export function FactoryMode({ onGenerated, settings }: Props) {
  const [prompt, setPrompt] = useState('');
  const [targetDuration, setTargetDuration] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<FactoryProgress | null>(null);
  const [completedAgents, setCompletedAgents] = useState<string[]>([]);

  const run = async () => {
    if (!prompt.trim()) return;
    setLoading(true); setError(null); setProgress(null); setCompletedAgents([]);
    try {
      const sceneCount = Math.max(3, Math.round(targetDuration / SCENE_SECONDS));
      const result = await runFactoryMode(prompt, sceneCount, settings, undefined, (p) => {
        setProgress(p);
        if (p.message.includes('hazır') || p.message.includes('tamam') || p.message.includes('bulundu') || p.message.includes('metadata')) {
          setCompletedAgents((prev) => prev.includes(p.agent) ? prev : [...prev, p.agent]);
        }
      });
      const sessionSeed = Math.floor(Math.random() * 1_000_000);
      const finalScenes = result.scenes.map((s, i) => ({ ...s, image_url: imageUrl(s.image_prompt, { seed: sessionSeed + i, width: 1280, height: 720 }) }));
      onGenerated(result.title, finalScenes, result.settings, { youtube_title: result.seo.title, youtube_description: result.seo.description, youtube_tags: result.seo.tags });
    } catch (err) { setError((err as Error).message); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-gradient-to-br from-blue-600/10 to-cyan-600/10 border border-blue-500/20 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center"><Factory size={22} className="text-white" /></div>
          <div><h3 className="text-base font-bold">Fabrika Modu</h3><p className="text-xs text-slate-400">4 yapay zeka ajanı sırayla çalışır: senaryo, görsel, video, SEO</p></div>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">Fikrinizi yazın, gerisini ajanlar halletsin. Senarist senaryoyu yazar, Görsel Yönetmen her sahneyi planlar, Video Küratör Pexels ve Pixabay'den en uygun klipleri seçer, SEO Uzmanı YouTube için optimize eder. Tamamen ücretsiz, tamamen tarayıcıda.</p>
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Video Fikri</label>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} className="w-full rounded-xl bg-slate-950 border border-slate-800 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-blue-500 resize-none transition" placeholder="Örn: Mars'ta bir astronotun günü boyunca yaşadıkları..." disabled={loading} />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Hedef Süre</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {durationOptions.map((s) => (<button key={s.v} onClick={() => setTargetDuration(s.v)} disabled={loading} className={`rounded-lg p-3 text-center transition disabled:opacity-40 ${targetDuration === s.v ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}><div className="text-sm font-medium">{s.label}</div><div className="text-xs opacity-60 mt-0.5">{s.desc}</div></button>))}
        </div>
      </div>
      {loading && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
          {agentConfig.map((agent) => {
            const isCompleted = completedAgents.includes(agent.name);
            const isActive = progress?.agent === agent.name && !isCompleted;
            const Icon = agent.icon;
            return (
              <div key={agent.name} className={`flex items-center gap-3 p-3 rounded-lg transition ${isCompleted ? 'bg-emerald-500/10 border border-emerald-500/20' : isActive ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-slate-800/50 border border-slate-800 opacity-50'}`}>
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${agent.color} flex items-center justify-center shrink-0`}>{isCompleted ? <CheckCircle2 size={18} className="text-white" /> : isActive ? <Loader2 size={18} className="text-white animate-spin" /> : <Icon size={18} className="text-white" />}</div>
                <div className="flex-1 min-w-0"><div className="text-sm font-medium text-slate-200">{agent.name}</div><div className="text-xs text-slate-500 truncate">{isCompleted ? 'Tamamlandı' : isActive ? progress?.message : agent.desc}</div></div>
                {isCompleted && <span className="text-xs text-emerald-400 font-medium">Hazır</span>}
              </div>
            );
          })}
        </div>
      )}
      {loading && progress && (<div className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-4 py-3 text-xs text-blue-300 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /><span><strong>{progress.agent}:</strong> {progress.message} ({progress.step}/{progress.totalSteps})</span></div>)}
      {error && (<div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400 flex items-start gap-2"><AlertCircle size={16} className="mt-0.5 shrink-0" /><div>{error}</div></div>)}
      <button onClick={run} disabled={loading || !prompt.trim()} className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-semibold transition disabled:opacity-40 shadow-lg shadow-blue-600/20">{loading ? <><Loader2 size={18} className="animate-spin" />Fabrika çalışıyor...</> : <><Factory size={18} />Fabrikayı Başlat</>}</button>
    </div>
  );
}
