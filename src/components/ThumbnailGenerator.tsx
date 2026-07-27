import { useEffect, useState } from 'react';
import { Image as ImageIcon, Download, RefreshCw, Copy, Check } from 'lucide-react';
import type { Scene, ThumbnailStyle } from '@/lib/types';
import { generateThumbnail, downloadThumbnail, type ThumbnailOptions } from '@/lib/thumbnail';

type Props = { scenes: Scene[]; title: string; thumbnailUrl: string | null; thumbnailStyle: ThumbnailStyle; onThumbnailReady: (url: string, style: ThumbnailStyle) => void; };

const styles: { v: ThumbnailStyle; label: string }[] = [{ v: 'bold', label: 'Kalın' }, { v: 'minimal', label: 'Minimal' }, { v: 'vintage', label: 'Vintage' }, { v: 'neon', label: 'Neon' }, { v: 'documentary', label: 'Belgesel' }];

export function ThumbnailGenerator({ scenes, title, thumbnailUrl, thumbnailStyle, onThumbnailReady }: Props) {
  const [preview, setPreview] = useState<string | null>(thumbnailUrl);
  const [selectedStyle, setSelectedStyle] = useState<ThumbnailStyle>(thumbnailStyle ?? 'bold');
  const [selectedScene, setSelectedScene] = useState(0);
  const [subtitle, setSubtitle] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { setPreview(thumbnailUrl); setSelectedStyle(thumbnailStyle ?? 'bold'); }, [thumbnailUrl, thumbnailStyle]);

  const generate = async () => {
    if (scenes.length === 0) return;
    setGenerating(true);
    try {
      const scene = scenes[selectedScene] ?? scenes[0];
      const opts: ThumbnailOptions = { style: selectedStyle, title: title || 'Video', subtitle: subtitle || undefined, sceneImage: scene?.image_url };
      const url = await generateThumbnail(opts);
      setPreview(url); onThumbnailReady(url, selectedStyle);
    } catch (err) { alert('Thumbnail oluşturulurken hata: ' + (err as Error).message); } finally { setGenerating(false); }
  };

  const download = () => { if (!preview) return; downloadThumbnail(preview, `${title || 'thumbnail'}`); };
  const copyUrl = async () => { if (!preview) return; try { await navigator.clipboard.writeText(preview); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ } };

  return (
    <div className="space-y-5">
      <div><h2 className="text-lg font-bold mb-1">Küçük Resim (Thumbnail)</h2><p className="text-sm text-slate-400">YouTube için dikkat çekici bir küçük resim oluşturun</p></div>
      <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 aspect-video">
        {preview ? <img src={preview} alt="Thumbnail" className="w-full h-full object-contain" /> : <div className="flex flex-col items-center justify-center h-full text-slate-600"><ImageIcon size={48} strokeWidth={1} /><p className="text-sm mt-2">Henüz thumbnail oluşturulmadı</p></div>}
      </div>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Arka Plan Görseli</label>
          <select value={selectedScene} onChange={(e) => setSelectedScene(parseInt(e.target.value))} className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-slate-600">
            {scenes.map((s, i) => (<option key={s.id} value={i}>Sahne {i + 1}: {s.narration.slice(0, 50) || 'Boş'}</option>))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Alt Başlık (opsiyonel)</label>
          <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Örn: 2026'da en iyi yöntem" className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-slate-600" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Tasarım Stili</label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
            {styles.map((s) => (<button key={s.v} onClick={() => setSelectedStyle(s.v)} className={`py-2 px-1 rounded-lg text-xs font-medium transition ${selectedStyle === s.v ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{s.label}</button>))}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={generate} disabled={scenes.length === 0 || generating} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition disabled:opacity-40">{generating ? <RefreshCw size={16} className="animate-spin" /> : <ImageIcon size={16} />}{generating ? 'Oluşturuluyor...' : 'Thumbnail Oluştur'}</button>
          {preview && (<><button onClick={download} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition"><Download size={16} />İndir</button><button onClick={copyUrl} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-medium transition">{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Kopyalandı' : 'Kopyala'}</button></>)}
        </div>
      </div>
    </div>
  );
}
