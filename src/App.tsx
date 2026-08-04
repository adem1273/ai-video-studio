import { useEffect, useState, useCallback, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  Clapperboard, Plus, Settings2, FileText, Library, Sparkles,
  LayoutDashboard, Film, Image as ImageIcon, Youtube, Package,
  Menu, X, Factory, FolderOpen, Save, Check, Loader2, LogOut,
  Cloud, CloudOff, AlertTriangle, Gauge,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { VideoProject, Scene, ProjectSettings, ThumbnailStyle } from '@/lib/types';
import {
  type SavedProject, type SyncStatus, type ConflictInfo,
  saveProjectLocal, saveProjectRemote, syncProjects, getLatestProject, emptyProject,
} from '@/lib/projectStore';
import { AuthForm } from '@/components/AuthForm';
import { PromptInput } from '@/components/PromptInput';
import { ScriptEditor } from '@/components/ScriptEditor';
import { SettingsPanel } from '@/components/SettingsPanel';
import { VideoPreview } from '@/components/VideoPreview';
import { ProjectLibrary } from '@/components/ProjectLibrary';
import { Dashboard } from '@/components/Dashboard';
import { ThumbnailGenerator } from '@/components/ThumbnailGenerator';
import { YouTubeMetaPanel } from '@/components/YouTubeMetaPanel';
import { BatchExport } from '@/components/BatchExport';
import { FactoryMode } from '@/components/FactoryMode';
import { SceneTimeline } from '@/components/SceneTimeline';
import { MediaManager } from '@/components/MediaManager';
import { RenderBenchmark } from '@/components/RenderBenchmark';

const defaultSettings: ProjectSettings = {
  voice: '',
  ttsVoice: 'alloy',
  ttsMode: 'pollinations',
  rate: 1,
  style: 'cinematic',
  aspect: '16:9',
  resolution: '720p',
  music: 'cinematic',
  mediaSource: 'auto',
  musicVolume: 0.5,
  transition: 'fade',
  showTitleCard: true,
  exportFormat: 'webm',
  subtitleStyle: 'standard',
  subtitleColor: 'white',
  endCard: {
    enabled: false,
    text: '',
    duration: 3,
    fontColor: 'gold',
  },
  brand: {
    enabled: false,
    primaryColor: '#3b82f6',
    fontFamily: 'sans-serif',
  },
};

type Tab = 'dashboard' | 'create' | 'factory' | 'script' | 'preview' | 'thumbnail' | 'youtube' | 'batch' | 'media' | 'benchmark';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [settings, setSettings] = useState<ProjectSettings>(defaultSettings);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [ytMeta, setYtMeta] = useState<{
    youtube_title: string | null;
    youtube_description: string | null;
    youtube_tags: string[] | null;
  }>({ youtube_title: null, youtube_description: null, youtube_tags: null });
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailStyle, setThumbnailStyle] = useState<ThumbnailStyle>('bold');
  const [isPublished, setIsPublished] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncConflicts, setSyncConflicts] = useState<string[]>([]);
  const [conflictDetails, setConflictDetails] = useState<ConflictInfo[]>([]);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const localProjectRef = useRef<SavedProject | null>(null);
  const restoredRef = useRef(false);

  // Auth: load session and subscribe to changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const doSync = useCallback(async () => {
    setSyncStatus('syncing');
    setLoadingProjects(true);
    try {
      const { projects: synced, conflicts, conflictDetails: details } = await syncProjects();
      setProjects(synced as unknown as VideoProject[]);
      setSyncConflicts(conflicts);
      setConflictDetails(details);
      setSyncStatus(conflicts.length > 0 ? 'conflict' : (details.length > 0 ? 'synced' : 'synced'));
    } catch (err) {
      console.error('Sync failed, operating in local-only mode:', err);
      setSyncStatus('local-only');
      setTimeout(() => doSync(), 15000);
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  // Restore the latest locally-saved project on first mount
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    (async () => {
      const latest = await getLatestProject();
      if (latest && (latest.title || latest.prompt || (latest.scenes && latest.scenes.length > 0))) {
        localProjectRef.current = latest;
        setActiveId(latest.id);
        setTitle(latest.title);
        setPrompt(latest.prompt);
        setScenes(latest.scenes);
        setSettings(latest.settings);
        setYtMeta({
          youtube_title: latest.youtube_title,
          youtube_description: latest.youtube_description,
          youtube_tags: latest.youtube_tags,
        });
        setThumbnailUrl(latest.thumbnail_url);
        setThumbnailStyle(latest.thumbnail_style);
        setIsPublished(latest.is_published);
        setVideoBlobUrl(latest.video_blob_url);
        setSaveStatus('saved');
      } else {
        localProjectRef.current = emptyProject();
      }
    })();
  }, []);

  // Autosave every 5 seconds when there is meaningful project data
  useEffect(() => {
    if (!title && !prompt && scenes.length === 0) return;
    const interval = setInterval(async () => {
      if (!localProjectRef.current) localProjectRef.current = emptyProject();
      const p: SavedProject = {
        ...localProjectRef.current,
        title: title || 'Adsız Proje',
        prompt,
        status: 'draft',
        scenes,
        settings,
        youtube_title: ytMeta.youtube_title,
        youtube_description: ytMeta.youtube_description,
        youtube_tags: ytMeta.youtube_tags,
        thumbnail_url: thumbnailUrl,
        thumbnail_style: thumbnailStyle,
        is_published: isPublished,
        video_blob_url: videoBlobUrl,
      };
      setSaveStatus('saving');
      await saveProjectLocal(p);
      localProjectRef.current = p;
      setSaveStatus('saved');
      saveProjectRemote(p).catch((err) => {
        console.error('Remote save failed, will retry on next sync:', err);
        setSyncStatus('local-only');
      });
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, prompt, scenes, settings, ytMeta, thumbnailUrl, thumbnailStyle, isPublished, videoBlobUrl]);

  useEffect(() => {
    if (session) doSync();
  }, [session, doSync]);

  const newProject = () => {
    setActiveId(null);
    setTab('create');
    setScenes([]);
    setTitle('');
    setPrompt('');
    setSettings(defaultSettings);
    setYtMeta({ youtube_title: null, youtube_description: null, youtube_tags: null });
    setThumbnailUrl(null);
    setThumbnailStyle('bold');
    setIsPublished(false);
    setSidebarOpen(false);
  };

  const selectProject = (id: string) => {
    const p = projects.find((x) => x.id === id);
    if (!p) return;
    setActiveId(id);
    setTitle(p.title);
    setPrompt(p.prompt);
    setScenes(p.script ?? []);
    setSettings(p.settings ?? defaultSettings);
    setYtMeta({
      youtube_title: p.youtube_title,
      youtube_description: p.youtube_description,
      youtube_tags: p.youtube_tags,
    });
    setThumbnailUrl(p.thumbnail_url);
    setThumbnailStyle((p.thumbnail_style as ThumbnailStyle) ?? 'bold');
    setIsPublished(p.is_published);
    setTab('script');
    setSidebarOpen(false);
  };

  const deleteProject = async (id: string) => {
    const { error } = await supabase.from('video_projects').delete().eq('id', id);
    if (error) {
      alert('Silme hatası: ' + error.message);
      return;
    }
    if (activeId === id) newProject();
    doSync();
  };

  const duplicateProject = async (id: string) => {
    const p = projects.find((x) => x.id === id);
    if (!p) return;
    const payload = {
      title: `${p.title} (kopya)`,
      prompt: p.prompt,
      status: 'draft' as const,
      script: p.script,
      settings: p.settings,
      youtube_title: p.youtube_title,
      youtube_description: p.youtube_description,
      youtube_tags: p.youtube_tags,
      thumbnail_url: p.thumbnail_url,
      thumbnail_style: p.thumbnail_style,
      category: p.category,
    };
    const { error } = await supabase.from('video_projects').insert(payload);
    if (error) {
      alert('Kopyalama hatası: ' + error.message);
      return;
    }
    doSync();
  };

  const saveProject = useCallback(
    async (status: VideoProject['status']) => {
      if (!title && !prompt && scenes.length === 0) return;
      const payload = {
        title: title || 'Adsız Proje',
        prompt,
        status,
        script: scenes,
        settings,
        youtube_title: ytMeta.youtube_title,
        youtube_description: ytMeta.youtube_description,
        youtube_tags: ytMeta.youtube_tags,
        thumbnail_url: thumbnailUrl,
        thumbnail_style: thumbnailStyle,
      };
      if (activeId) {
        const { error } = await supabase
          .from('video_projects')
          .update(payload)
          .eq('id', activeId);
        if (error) console.error('Update failed:', error);
      } else {
        const { data, error } = await supabase
          .from('video_projects')
          .insert(payload)
          .select()
          .single();
        if (error) {
          console.error('Insert failed:', error);
        } else if (data) {
          setActiveId((data as VideoProject).id);
        }
      }
      doSync();
    },
    [title, prompt, scenes, settings, activeId, doSync, ytMeta, thumbnailUrl, thumbnailStyle],
  );

  useEffect(() => {
    if (!title && !prompt && scenes.length === 0) return;
    const t = setTimeout(() => saveProject('draft'), 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes, settings, title, prompt, ytMeta, thumbnailUrl, thumbnailStyle]);

  const handleGenerated = (newTitle: string, newScenes: Scene[], s: ProjectSettings) => {
    setTitle(newTitle);
    setScenes(newScenes);
    setSelectedSceneIndex(0);
    setSettings(s);
    setTab('script');
  };

  const handleFactoryGenerated = (
    newTitle: string,
    newScenes: Scene[],
    s: ProjectSettings,
    seo: { youtube_title: string; youtube_description: string; youtube_tags: string[] },
  ) => {
    setTitle(newTitle);
    setScenes(newScenes);
    setSettings(s);
    setYtMeta({
      youtube_title: seo.youtube_title,
      youtube_description: seo.youtube_description,
      youtube_tags: seo.youtube_tags,
    });
    setTab('script');
  };

  const handleVideoReady = (url: string) => {
    setVideoBlobUrl(url);
    saveProject('ready');
  };

  const reorderScenes = (reordered: Scene[]) => {
    setScenes(reordered);
  };

  const duplicateScene = (index: number) => {
    const scene = scenes[index];
    if (!scene) return;
    const copy: Scene = { ...scene, id: crypto.randomUUID(), name: `${scene.name ?? `Sahne ${index + 1}`} (kopya)` };
    const next = [...scenes];
    next.splice(index + 1, 0, copy);
    setScenes(next);
  };

  const deleteScene = (index: number) => {
    const next = scenes.filter((_, i) => i !== index);
    setScenes(next);
    if (selectedSceneIndex >= next.length) setSelectedSceneIndex(Math.max(0, next.length - 1));
  };

  const renameScene = (index: number, name: string) => {
    setScenes(scenes.map((s, i) => (i === index ? { ...s, name } : s)));
  };

  const changeSceneDuration = (index: number, duration: number) => {
    setScenes(scenes.map((s, i) => (i === index ? { ...s, duration } : s)));
  };

  const handleThumbnailReady = (url: string, style: ThumbnailStyle) => {
    setThumbnailUrl(url);
    setThumbnailStyle(style);
  };

  const handleYtMetaReady = (meta: { youtube_title: string; youtube_description: string; youtube_tags: string[] }) => {
    setYtMeta(meta);
  };

  const togglePublish = async () => {
    const newPublished = !isPublished;
    setIsPublished(newPublished);
    if (activeId) {
      await supabase
        .from('video_projects')
        .update({
          is_published: newPublished,
          published_at: newPublished ? new Date().toISOString() : null,
        })
        .eq('id', activeId);
      doSync();
    }
  };

  const updateProject = (id: string, updates: Partial<VideoProject>) => {
    setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    if (activeId === id) {
      supabase.from('video_projects').update(updates).eq('id', id).then(({ error }) => {
        if (error) console.error('Update failed:', error);
      });
    }
  };

  const tabs: { id: Tab; label: string; icon: typeof FileText }[] = [
    { id: 'dashboard', label: 'Panel', icon: LayoutDashboard },
    { id: 'create', label: 'Oluştur', icon: Sparkles },
    { id: 'factory', label: 'Fabrika', icon: Factory },
    { id: 'script', label: 'Senaryo', icon: FileText },
    { id: 'preview', label: 'Video', icon: Film },
    { id: 'thumbnail', label: 'Thumbnail', icon: ImageIcon },
    { id: 'youtube', label: 'YouTube', icon: Youtube },
    { id: 'batch', label: 'Toplu', icon: Package },
    { id: 'media', label: 'Medya', icon: FolderOpen },
    { id: 'benchmark', label: 'Benchmark', icon: Gauge },
  ];

  const showSidebarTabs = ['create', 'factory', 'script', 'preview', 'thumbnail', 'youtube'].includes(tab);

  const sidebarTabs = tabs.filter((t) => ['create', 'factory', 'script', 'preview', 'thumbnail', 'youtube'].includes(t.id));

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-slate-600" />
      </div>
    );
  }

  if (!session) {
    return <AuthForm />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-72 border-r border-slate-800 bg-slate-900 flex flex-col shrink-0 transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Clapperboard size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">Montaj</h1>
              <p className="text-xs text-slate-500">İçerik Fabrikası</p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="ml-auto lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-3 space-y-1">
          <button
            onClick={() => { setTab('dashboard'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
              tab === 'dashboard' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <LayoutDashboard size={15} />
            Kontrol Paneli
          </button>
          <button
            onClick={() => { setTab('batch'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
              tab === 'batch' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Package size={15} />
            Toplu Dışa Aktarım
          </button>
          <button
            onClick={() => { setTab('media'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
              tab === 'media' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FolderOpen size={15} />
            Medya Yöneticisi
          </button>
        </div>

        <div className="px-3">
          <button
            onClick={newProject}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition"
          >
            <Plus size={16} />
            Yeni Proje
          </button>
        </div>

        <div className="px-3 pb-2 pt-3 flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <Library size={12} />
          Projelerim
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {loadingProjects ? (
            <div className="text-center py-8 text-slate-600 text-sm">Yükleniyor...</div>
          ) : (
            <ProjectLibrary
              projects={projects}
              activeId={activeId}
              onSelect={selectProject}
              onDelete={deleteProject}
              onDuplicate={duplicateProject}
            />
          )}
        </div>

        <div className="p-3 border-t border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Settings2 size={12} />
            <span>Tarayıcıda çalışır · API anahtarı gerekmez</span>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition"
          >
            <LogOut size={12} />
            Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Clapperboard size={16} className="text-white" />
            </div>
            <span className="text-sm font-bold">Montaj</span>
          </div>
        </div>

        {/* Header */}
        <header className="border-b border-slate-800 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            {tab !== 'dashboard' && tab !== 'batch' && tab !== 'media' ? (
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Adsız Proje"
                className="text-base sm:text-lg font-semibold bg-transparent focus:outline-none text-slate-100 placeholder:text-slate-600 max-w-full sm:max-w-md w-full"
              />
            ) : (
              <h2 className="text-base sm:text-lg font-semibold">
                {tab === 'dashboard' ? 'Kontrol Paneli' : tab === 'media' ? 'Medya Yöneticisi' : 'Toplu Dışa Aktarım'}
              </h2>
            )}
            {prompt && showSidebarTabs && (
              <p className="text-xs text-slate-500 truncate mt-0.5">{prompt}</p>
            )}
          </div>

          {/* Save + sync status indicators */}
          {showSidebarTabs && saveStatus !== 'idle' && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 mr-1">
              {saveStatus === 'saving' ? (
                <><Loader2 size={12} className="animate-spin text-amber-400" /><span className="text-amber-400">Kaydediliyor...</span></>
              ) : (
                <><Check size={12} className="text-emerald-400" /><span className="text-emerald-400">Kaydedildi</span></>
              )}
            </div>
          )}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 mr-2">
            {syncStatus === 'syncing' && <><Loader2 size={12} className="animate-spin text-blue-400" /><span className="text-blue-400">Senkronize ediliyor...</span></>}
            {syncStatus === 'synced' && <><Cloud size={12} className="text-emerald-400" /><span className="text-emerald-400">Senkronize</span></>}
            {syncStatus === 'local-only' && <><CloudOff size={12} className="text-amber-400" /><span className="text-amber-400">Yalnızca yerel</span></>}
            {syncStatus === 'conflict' && (() => {
              const detail = conflictDetails[0];
              const time = detail ? new Date(detail.updatedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '';
              const tip = detail
                ? detail.winner === 'remote'
                  ? `Bulut versiyonu kullanıldı (${time}) — yerel değişiklikleriniz üzerine yazıldı`
                  : `Yerel versiyon kullanıldı (${time}) — bulut versiyonu üzerine yazıldı`
                : `${syncConflicts.length} çakışan proje`;
              return (
                <>
                  <AlertTriangle size={12} className="text-red-400" />
                  <span className="text-red-400" title={tip}>
                    Çakışma{conflictDetails.length > 1 ? ` (${conflictDetails.length})` : ''}
                  </span>
                </>
              );
            })()}
          </div>

          {/* Project tabs */}
          {showSidebarTabs && (
            <nav className="flex gap-1 bg-slate-900 rounded-xl p-1 border border-slate-800 overflow-x-auto -mx-1 px-1 scrollbar-hide">
              {sidebarTabs.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition whitespace-nowrap ${
                      tab === t.id
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon size={14} />
                    <span className="hidden sm:inline">{t.label}</span>
                  </button>
                );
              })}
            </nav>
          )}
        </header>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'dashboard' && (
            <div className="max-w-5xl mx-auto p-4 sm:p-8">
              <Dashboard
                projects={projects}
                onNewProject={newProject}
                onSelectProject={selectProject}
              />
            </div>
          )}

          {tab === 'create' && (
            <div className="max-w-2xl mx-auto p-4 sm:p-8">
              <div className="mb-6">
                <h2 className="text-xl sm:text-2xl font-bold mb-1">Yeni Video Oluştur</h2>
                <p className="text-sm text-slate-400">
                  Fikrinizi yazın, yapay zeka senaryo, görsel ve seslendirme üretsin. Tamamen ücretsiz.
                </p>
              </div>
              <PromptInput onGenerated={handleGenerated} settings={settings} />
            </div>
          )}

          {tab === 'factory' && (
            <div className="max-w-2xl mx-auto p-4 sm:p-8">
              <div className="mb-6">
                <h2 className="text-xl sm:text-2xl font-bold mb-1">Video Fabrikası</h2>
                <p className="text-sm text-slate-400">
                  4 yapay zeka ajanı sırayla çalışır: senaryo, görsel, video, SEO. Tek tıkla tam video.
                </p>
              </div>
              <FactoryMode onGenerated={handleFactoryGenerated} settings={settings} />
            </div>
          )}

          {tab === 'script' && (
            <div className="max-w-5xl mx-auto p-4 sm:p-6">
              <div className="mb-6">
                <h2 className="text-lg font-bold mb-3">Sahne Zaman Çizelgesi</h2>
                <SceneTimeline
                  scenes={scenes}
                  selectedIndex={selectedSceneIndex}
                  onSelect={setSelectedSceneIndex}
                  onReorder={reorderScenes}
                  onDuplicate={duplicateScene}
                  onDelete={deleteScene}
                  onRename={renameScene}
                  onDurationChange={changeSceneDuration}
                />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 sm:gap-6">
                <div>
                  <h2 className="text-lg font-bold mb-4">Senaryo Düzenle</h2>
                  <ScriptEditor
                    scenes={scenes}
                    onScenesChange={setScenes}
                    settings={settings}
                    activeIndex={selectedSceneIndex}
                    onActiveIndexChange={setSelectedSceneIndex}
                  />
                </div>
                <div>
                  <h2 className="text-lg font-bold mb-4">Ayarlar</h2>
                  <SettingsPanel settings={settings} onChange={setSettings} />
                </div>
              </div>
            </div>
          )}

          {tab === 'preview' && (
            <div className="max-w-3xl mx-auto p-4 sm:p-6">
              <VideoPreview
                scenes={scenes}
                settings={settings}
                title={title}
                onSettingsChange={setSettings}
                onVideoReady={handleVideoReady}
                selectedIndex={selectedSceneIndex}
                onSelectIndex={setSelectedSceneIndex}
              />
            </div>
          )}

          {tab === 'thumbnail' && (
            <div className="max-w-3xl mx-auto p-4 sm:p-6">
              <ThumbnailGenerator
                scenes={scenes}
                title={title}
                thumbnailUrl={thumbnailUrl}
                thumbnailStyle={thumbnailStyle}
                onThumbnailReady={handleThumbnailReady}
              />
            </div>
          )}

          {tab === 'youtube' && (
            <div className="max-w-3xl mx-auto p-4 sm:p-6">
              <YouTubeMetaPanel
                scenes={scenes}
                title={title}
                prompt={prompt}
                meta={ytMeta}
                onMetaReady={handleYtMetaReady}
                isPublished={isPublished}
                onPublishToggle={togglePublish}
                videoUrl={videoBlobUrl}
              />
            </div>
          )}

          {tab === 'batch' && (
            <div className="max-w-3xl mx-auto p-4 sm:p-6">
              <BatchExport
                projects={projects}
                onProjectUpdate={updateProject}
              />
            </div>
          )}

          {tab === 'media' && (
            <MediaManager />
          )}

          {tab === 'benchmark' && (
            <div className="max-w-4xl mx-auto p-4 sm:p-8">
              <RenderBenchmark />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
