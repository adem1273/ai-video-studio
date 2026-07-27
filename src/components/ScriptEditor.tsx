import { useEffect, useRef, useState } from 'react';
import { Play, Square, RefreshCw, Film, Video, Loader2 } from 'lucide-react';
import { loadVoices, speak, getVoices, estimateDuration } from '@/lib/tts';
import { regenerateImageUrl, generateVideo } from '@/lib/pollinations';
import type { Scene, ProjectSettings, SceneMood } from '@/lib/types';

type Props = { scenes: Scene[]; onScenesChange: (scenes: Scene[]) => void; settings: ProjectSettings; activeIndex?: number; onActiveIndexChange?: (index: number) => void; };

export function ScriptEditor({ scenes, onScenesChange, settings, activeIndex, onActiveIndexChange }: Props) {
  const [speaking, setSpeaking] = useState(false);
  const [regenerating, setRegenerating] = useState<number | null>(null);
  const [generatingVideo, setGeneratingVideo] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => { loadVoices(); }, []);

  const update = (i: number, field: 'narration' | 'image_prompt' | 'mood', value: string | SceneMood) => {
    const next = scenes.map((s, idx) => idx === i ? { ...s, [field]: value, duration: field === 'narration' && typeof value === 'string' ? Math.max(3, estimateDuration(value)) : s.duration } : s);
    onScenesChange(next);
  };

  const regenerateImage = async (i: number) => {
    setRegenerating(i);
    const scene = scenes[i];
    const newUrl = regenerateImageUrl(`${scene.image_prompt}, ${settings.style} style`, settings.aspect, settings.resolution);
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => { const next = scenes.map((s, idx) => (idx === i ? { ...s, image_url: newUrl } : s)); onScenesChange(next); setRegenerating(null); };
    img.onerror = () => { const next = scenes.map((s, idx) => (idx === i ? { ...s, image_url: newUrl } : s)); onScenesChange(next); setRegenerating(null); };
    img.src = newUrl;
  };

  const generateAiVideo = async (i: number) => {
    setGeneratingVideo(i);
    const scene = scenes[i];
    const updated = scenes.map((s, idx) => idx === i ? { ...s, ai_video_status: 'generating' as const } : s);
    onScenesChange(updated);
    try {
      const videoPrompt = `${scene.image_prompt}, ${settings.style} style, cinematic motion`;
      const blob = await generateVideo(videoPrompt, { duration: Math.min(10, Math.max(3, scene.duration)), resolution: settings.resolution });
      if (blob && blob.size > 0) {
        const url = URL.createObjectURL(blob);
        const next = scenes.map((s, idx) => idx === i ? { ...s, ai_video_url: url, ai_video_status: 'ready' as const } : s);
        onScenesChange(next);
      } else { throw new Error('Empty video'); }
    } catch {
      const next = scenes.map((s, idx) => idx === i ? { ...s, ai_video_status: 'failed' as const } : s);
      onScenesChange(next);
    }
    setGeneratingVideo(null);
  };

  const addScene = () => { onScenesChange([...scenes, { id: crypto.randomUUID(), narration: '', image_prompt: '', duration: 5, mood: 'neutral' as SceneMood }]); };
  const removeScene = (i: number) => { onScenesChange(scenes.filter((_, idx) => idx !== i)); };
  const move = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= scenes.length) return; const next = [...scenes]; [next[i], next[j]] = [next[j], next[i]]; onScenesChange(next); };
  const handleDragStart = (i: number) => setDragIndex(i);
  const handleDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setDragOverIndex(i); };
  const handleDrop = (e: React.DragEvent, i: number) => { e.preventDefault(); if (dragIndex === null || dragIndex === i) return; const next = [...scenes]; const [moved] = next.splice(dragIndex, 1); next.splice(i, 0, moved); onScenesChange(next); setDragIndex(null); setDragOverIndex(null); };

  const preview = async (i: number) => {
    if (speaking) { cancelRef.current = true; window.speechSynthesis.cancel(); setSpeaking(false); return; }
    cancelRef.current = false; setSpeaking(true); onActiveIndexChange?.(i);
    const voices = getVoices();
    const voice = voices.find((v) => v.voiceURI === settings.voice);
    await speak(scenes[i].narration, { voice, rate: settings.rate });
    setSpeaking(false); onActiveIndexChange?.(-1);
  };

  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><div className="text-sm text-slate-400">{scenes.length} sahne · toplam ~{Math.ceil(totalDuration)} sn · ~{(totalDuration / 60).toFixed(1)} dk</div><button onClick={addScene} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition">+ Sahne Ekle</button></div>
      <div className="space-y-3">
        {scenes.map((scene, i) => (
          <div key={scene.id} draggable onDragStart={() => handleDragStart(i)} onDragOver={(e) => handleDragOver(e, i)} onDrop={(e) => handleDrop(e, i)} onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }} className={`rounded-xl border p-4 transition cursor-grab active:cursor-grabbing ${dragOverIndex === i && dragIndex !== null ? 'border-blue-500 bg-blue-500/10 scale-[1.01]' : activeIndex === i ? 'border-blue-500 bg-blue-500/5' : 'border-slate-800 bg-slate-900/50'}`}>
            <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2"><span className="text-slate-600 text-xs cursor-grab" title="Sürükle">⠿</span><span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sahne {i + 1}</span></div><div className="flex items-center gap-1"><button onClick={() => preview(i)} className={`p-1.5 rounded-md transition ${speaking && activeIndex === i ? 'bg-red-500/20 text-red-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`} title={speaking && activeIndex === i ? 'Durdur' : 'Sesli önizleme'}>{speaking && activeIndex === i ? <Square size={14} /> : <Play size={14} />}</button><button onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30 transition" title="Yukarı taşı">↑</button><button onClick={() => move(i, 1)} disabled={i === scenes.length - 1} className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30 transition" title="Aşağı taşı">↓</button><button onClick={() => removeScene(i)} className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition" title="Sahneyi sil">✕</button></div></div>
            <div className="grid md:grid-cols-2 gap-3"><div><label className="text-xs text-slate-500 mb-1 block">Anlatım (sesli metin)</label><textarea value={scene.narration} onChange={(e) => update(i, 'narration', e.target.value)} rows={3} className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-slate-600 resize-none" placeholder="Bu sahnede söylenecek metin..." /></div><div><label className="text-xs text-slate-500 mb-1 block">Görsel betimi</label><textarea value={scene.image_prompt} onChange={(e) => update(i, 'image_prompt', e.target.value)} rows={3} className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-slate-600 resize-none" placeholder="Bu sahnede gösterilecek görselin betimi..." /></div></div>
            {(scene.ai_video_url || scene.video_url || scene.image_url) && (<div className="mt-3 relative rounded-lg overflow-hidden border border-slate-800 group">{scene.ai_video_url && scene.ai_video_status === 'ready' ? <video src={scene.ai_video_url} autoPlay muted loop playsInline className="w-full h-32 object-cover" /> : scene.video_url ? <video src={scene.video_url} poster={scene.video_poster} autoPlay muted loop playsInline className="w-full h-32 object-cover" /> : <img src={scene.image_url} alt={`Sahne ${i + 1}`} className={`w-full h-32 object-cover transition ${regenerating === i ? 'opacity-40' : ''}`} />}{scene.ai_video_url && scene.ai_video_status === 'ready' && <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-purple-600/90 text-white text-xs font-medium flex items-center gap-1"><Video size={10} /> AI Video</span>}{scene.video_url && !scene.ai_video_url && <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-emerald-600/90 text-white text-xs font-medium flex items-center gap-1"><Film size={10} /> Stok Video</span>}{!scene.ai_video_url && !scene.video_url && <button onClick={() => regenerateImage(i)} disabled={regenerating === i} className="absolute top-2 right-2 p-2 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-black/80 transition disabled:opacity-30" title="Görseli yeniden üret"><RefreshCw size={14} className={regenerating === i ? 'animate-spin' : ''} /></button>}{scene.ai_video_status === 'generating' && <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-xs gap-2"><Loader2 size={14} className="animate-spin" /> AI video üretiliyor...</div>}{regenerating === i && <div className="absolute inset-0 flex items-center justify-center text-white text-xs">Yeniden üretiliyor...</div>}</div>)}
            <div className="mt-2 flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-xs text-slate-600">~{Math.ceil(scene.duration)} sn</span><button onClick={() => generateAiVideo(i)} disabled={generatingVideo === i || scene.ai_video_status === 'generating'} className="px-2 py-1 rounded-md text-xs font-medium bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 disabled:opacity-40 transition flex items-center gap-1" title="Bu sahne için AI hareketli video üret">{generatingVideo === i || scene.ai_video_status === 'generating' ? <><Loader2 size={11} className="animate-spin" /> Üretiliyor...</> : scene.ai_video_status === 'ready' ? <><Video size={11} /> Yeniden üret</> : <><Video size={11} /> AI Video Üret</>}</button></div><div className="flex items-center gap-1.5"><span className="text-xs text-slate-500">Ruh hali:</span><select value={scene.mood ?? 'neutral'} onChange={(e) => update(i, 'mood', e.target.value as SceneMood)} className="rounded-md bg-slate-950 border border-slate-800 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-slate-600"><option value="neutral">Nötr</option><option value="calm">Sakin</option><option value="dramatic">Dramatik</option><option value="happy">Neşeli</option><option value="tense">Gergin</option><option value="mysterious">Gizemli</option></select></div></div>
          </div>
        ))}
      </div>
      {scenes.length === 0 && <div className="text-center py-12 text-slate-500 text-sm">Henüz sahne yok. Yukarıdan "Sahne Ekle" diyerek başlayın.</div>}
    </div>
  );
}
