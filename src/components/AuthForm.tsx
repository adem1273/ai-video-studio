import { useState } from 'react';
import { Clapperboard, Mail, Lock, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Mode = 'signin' | 'signup';

export function AuthForm() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata olu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-3">
            <Clapperboard size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">Montaj</h1>
          <p className="text-sm text-slate-500 mt-0.5">İçerik Fabrikası</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <div className="flex gap-1 mb-5 rounded-lg bg-slate-900 p-1 border border-slate-800">
            <button onClick={() => { setMode('signin'); setError(null); }} className={`flex-1 py-2 rounded-md text-sm font-medium transition ${mode === 'signin' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Giriş Yap</button>
            <button onClick={() => { setMode('signup'); setError(null); }} className={`flex-1 py-2 rounded-md text-sm font-medium transition ${mode === 'signup' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Kayıt Ol</button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">E-posta</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@email.com" required className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Şifre</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="•••••••" required minLength={6} className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition" />
              </div>
            </div>
            {error && (<div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"><AlertCircle size={14} className="shrink-0 mt-0.5" /><span>{error}</span></div>)}
            <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition">{loading && <Loader2 size={16} className="animate-spin" />}{mode === 'signin' ? 'Giriş Yap' : 'Hesap Oluştur'}</button>
          </form>
          <p className="text-xs text-slate-600 text-center mt-4">{mode === 'signin' ? 'Hesabınız yok mu? Kayıt ol sekmesine geçin.' : 'Zaten hesabınız var mı? Giriş yap sekmesine geçin.'}</p>
        </div>
      </div>
    </div>
  );
}
