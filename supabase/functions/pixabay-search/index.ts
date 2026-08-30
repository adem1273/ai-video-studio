// supabase/functions/pixabay-search/index.ts
import { serve } from 'std/server';

serve(async (req) => {
  try {
    const body = await req.json();
    const query = body.query || '';
    const min_duration_seconds = body.min_duration_seconds || 1;
    const orientation = body.orientation || 'landscape';

    const PIXABAY_API_KEY = Deno.env.get('PIXABAY_API_KEY');
    if (!PIXABAY_API_KEY) return new Response(JSON.stringify({ error: 'PIXABAY_API_KEY not configured' }), { status: 500 });

    const url = `https://pixabay.com/api/videos/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&per_page=20`; 
    const res = await fetch(url);
    if (!res.ok) {
      const txt = await res.text();
      return new Response(JSON.stringify({ error: 'pixabay failed', detail: txt }), { status: 502 });
    }
    const json = await res.json();
    const results = (json.hits || []).map((v: any) => ({
      id: String(v.id),
      title: v.tags || '',
      duration: v.duration || 0,
      width: v.videos?.medium?.width || v.videos?.large?.width,
      height: v.videos?.medium?.height || v.videos?.large?.height,
      resolution: v.videos?.large ? `${v.videos.large.width}x${v.videos.large.height}` : undefined,
      tags: (v.tags || '').split(',').map((s:string)=>s.trim()),
      thumbnail_url: v.userImageURL || undefined,
      preview_url: v.videos?.medium?.url || v.videos?.large?.url,
    }));

    return new Response(JSON.stringify({ results }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
