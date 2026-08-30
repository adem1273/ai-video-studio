// supabase/functions/pexels-search/index.ts
import { serve } from 'std/server';

serve(async (req) => {
  try {
    const body = await req.json();
    const query = body.query || '';
    const min_duration_seconds = body.min_duration_seconds || 1;
    const orientation = body.orientation || 'landscape';

    const PEXELS_API_KEY = Deno.env.get('PEXELS_API_KEY');
    if (!PEXELS_API_KEY) return new Response(JSON.stringify({ error: 'PEXELS_API_KEY not configured' }), { status: 500 });

    // call Pexels videos search
    const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=${encodeURIComponent(orientation)}&per_page=20`;
    const res = await fetch(url, { headers: { Authorization: PEXELS_API_KEY } });
    if (!res.ok) {
      const txt = await res.text();
      return new Response(JSON.stringify({ error: 'pexels failed', detail: txt }), { status: 502 });
    }
    const json = await res.json();
    const results = (json.videos || []).map((v: any) => ({
      id: String(v.id),
      title: v.user?.name || v.url || '',
      duration: v.duration || 0,
      width: v.video_files?.[0]?.width,
      height: v.video_files?.[0]?.height,
      resolution: v.video_files?.[0] ? `${v.video_files[0].width}x${v.video_files[0].height}` : undefined,
      tags: v.tags ? v.tags.map((t:any)=>t.title) : [],
      thumbnail_url: v.image,
      preview_url: v.video_files?.[0]?.link,
    }));

    return new Response(JSON.stringify({ results }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
