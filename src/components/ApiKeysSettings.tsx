import { useState, useEffect, useCallback } from 'react';
import { Key, Save, Trash2, ExternalLink, Loader2, Check, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type ServiceConfig = {
  name: 'groq' | 'gemini' | 'pexels' | 'pixabay';
  label: string;
  helpUrl: string;
  helpText: string;
  placeholder: string;
};

const SERVICES: ServiceConfig[] = [
  { name: 'groq', label: 'Groq', helpUrl: 'https://console.groq.com', helpText: 'console.groq.com', placeholder: 'gsk_...' },
  { name: 'gemini', label: 'Gemini', helpUrl: 'https://aistudio.google.com/apikey', helpText: 'aistudio.google.com/apikey', placeholder: 'AIza...' },
  { name: 'pexels', label: 'Pexels', helpUrl: 'https://www.pexels.com/api/', helpText: 'pexels.com/api', placeholder: '563492...' },
  { name: 'pixabay', label: 'Pixabay', helpUrl: 'https://pixabay.com/api/docs/', helpText: 'pixabay.com/api/docs', placeholder: '568754...' },
];

type KeyState = {
  suffix: string | null;
  editing: boolean;
  draft: string;
  saving: boolean;
  deleting: boolean;
  showPlain: boolean;
  error: string | null;
  saved: boolean;
};

export function ApiKeysSettings() {
  const [states, setStates] = useState<Record<string, KeyState>>({});
  const [loading, setLoading] = useState(true);

  const initState: KeyState = {
    suffix: null,
    editing: false,
    draft: '',
    saving: false,
    deleting: false,
    showPlain: false,
    error: null,
    saved: false,
  };

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-keys`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!res.ok) {
        setLoading(false);
        return;
      }

      const data = await res.json();
      const newStates: Record<string, KeyState> = {};
      for (const svc of SERVICES) {
        newStates[svc.name] = {
          ...initState,
          suffix: data.keys?.[svc.name] ?? null,
        };
      }
      setStates(newStates);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const updateState = (service: string, patch: Partial<KeyState>) => {
    setStates((prev) => ({
      ...prev,
      [service]: { ...prev[service], ...patch },
    }));
  };

  const handleSave = async (service: ServiceConfig) => {
    const state = states[service.name];
    if (!state || !state.draft.trim()) return;

    updateState(service.name, { saving: true, error: null, saved: false });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        updateState(service.name, { saving: false, error: 'Giriş yapmanız gerekli' });
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-keys`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ service: service.name, apiKey: state.draft.trim() }),
        },
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        updateState(service.name, { saving: false, error: errData.error ?? 'Kaydetme başarısız' });
        return;
      }

      const data = await res.json();
      updateState(service.name, {
        saving: false,
        suffix: data.suffix,
        editing: false,
        draft: '',
        showPlain: false,
        saved: true,
        error: null,
      });

      setTimeout(() => updateState(service.name, { saved: false }), 2000);
    } catch {
      updateState(service.name, { saving: false, error: 'Bağlantı hatası' });
    }
  };

  const handleDelete = async (service: ServiceConfig) => {
    updateState(service.name, { deleting: true });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-keys?service=${service.name}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );

      updateState(service.name, { deleting: false, suffix: null, editing: false, draft: '' });
    } catch {
      updateState(service.name, { deleting: false });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={20} className="animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Key size={16} className="text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-300">API Anahtarları</h3>
      </div>
      <p className="text-xs text-slate-600 -mt-2 mb-3">
        Kendi API anahtarlarınızı ekleyin. Anahtarlar şifreli olarak saklanır, sadece son 4 karakteri gösterilir.
        Anahtar eklemezseniz sistem genel (global) anahtarları kullanır.
      </p>

      {SERVICES.map((svc) => {
        const state = states[svc.name] ?? initState;
        const hasKey = state.suffix !== null;

        return (
          <div key={svc.name} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-200">{svc.label}</span>
                {hasKey && !state.editing && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <Check size={11} /> ...{state.suffix}
                  </span>
                )}
                {state.saved && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1 animate-pulse">
                    <Check size={11} /> Kaydedildi
                  </span>
                )}
              </div>
              <a
                href={svc.helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
              >
                <ExternalLink size={10} /> {svc.helpText}
              </a>
            </div>

            {state.editing ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={state.showPlain ? 'text' : 'password'}
                      value={state.draft}
                      onChange={(e) => updateState(svc.name, { draft: e.target.value })}
                      placeholder={svc.placeholder}
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 pr-9"
                    />
                    <button
                      onClick={() => updateState(svc.name, { showPlain: !state.showPlain })}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {state.showPlain ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <button
                    onClick={() => handleSave(svc)}
                    disabled={state.saving || !state.draft.trim()}
                    className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition flex items-center gap-1.5 whitespace-nowrap"
                  >
                    {state.saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Kaydet
                  </button>
                  <button
                    onClick={() => updateState(svc.name, { editing: false, draft: '', error: null })}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition"
                  >
                    İptal
                  </button>
                </div>
                {state.error && (
                  <p className="text-xs text-red-400">{state.error}</p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {hasKey ? (
                  <>
                    <button
                      onClick={() => updateState(svc.name, { editing: true, draft: '', error: null })}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                    >
                      Değiştir
                    </button>
                    <button
                      onClick={() => handleDelete(svc)}
                      disabled={state.deleting}
                      className="px-3 py-1.5 rounded-lg bg-red-900/50 hover:bg-red-800/50 text-red-400 text-xs font-medium transition flex items-center gap-1"
                    >
                      {state.deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      Sil
                    </button>
                    <span className="text-xs text-slate-600">Silinince global anahtara düşülür</span>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => updateState(svc.name, { editing: true, draft: '', error: null })}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition flex items-center gap-1.5"
                    >
                      <Key size={12} /> Anahtar Ekle
                    </button>
                    <span className="text-xs text-slate-600">Global anahtar kullanılıyor</span>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
