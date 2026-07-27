import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PEXELS_API_KEY = "gtTuwjQ955DFSsk2Zvj8cULZsP7FTZM0xsBJMzEtHObYkblzbfMtg7HD";
const API_BASE = "https://api.pexels.com/v1/videos";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("query") ?? "";
    const perPage = url.searchParams.get("per_page") ?? "15";
    const orientation = url.searchParams.get("orientation") ?? "landscape";

    if (!query) {
      return new Response(
        JSON.stringify({ error: "Query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const params = new URLSearchParams({ query, per_page: perPage, orientation });
    const res = await fetch(`${API_BASE}/search?${params}`, {
      headers: { Authorization: PEXELS_API_KEY },
    });

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `Pexels API error: ${res.status}` }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let data = await res.json();

    if ((data.videos ?? []).length === 0) {
      const words = query.split(/\s+/).filter((w) => w.length > 2);
      for (let len = words.length - 1; len >= 1; len--) {
        const shorter = words.slice(0, len).join(' ');
        const retryParams = new URLSearchParams({ query: shorter, per_page: perPage, orientation });
        const retryRes = await fetch(`${API_BASE}/search?${retryParams}`, { headers: { Authorization: PEXELS_API_KEY } });
        if (retryRes.ok) { data = await retryRes.json(); if ((data.videos ?? []).length > 0) break; }
      }
    }

    if ((data.videos ?? []).length === 0) {
      const words = query.split(/\s+/).filter((w) => w.length > 2);
      for (const word of words) {
        const retryParams = new URLSearchParams({ query: word, per_page: perPage, orientation });
        const retryRes = await fetch(`${API_BASE}/search?${retryParams}`, { headers: { Authorization: PEXELS_API_KEY } });
        if (retryRes.ok) { data = await retryRes.json(); if ((data.videos ?? []).length > 0) break; }
      }
    }

    const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);

    const scored = (data.videos ?? []).map((v: any) => {
      const files = (v.video_files ?? []).filter((f: any) => f.file_type === "video/mp4");
      if (files.length === 0) return null;
      const slugText = [(v.tags ?? []).join(' '), v.url ?? '', v.image ?? ''].join(' ').toLowerCase();
      let relevance = 0;
      for (const qw of queryWords) { if (slugText.includes(qw)) relevance += 3; }
      if (v.duration >= 5 && v.duration <= 15) relevance += 1;
      relevance += Math.random() * 0.1;
      const sorted = files.sort((a: any, b: any) => {
        const score = (f: any) => { if (f.height <= 720 && f.height >= 480) return 0; if (f.height > 720) return 1; return 2; };
        return score(a) - score(b);
      });
      const best = sorted[0];
      return { id: v.id, url: v.url, video_url: best.link, image_url: v.image, width: best.width, height: best.height, duration: v.duration, _relevance: relevance };
    }).filter(Boolean).sort((a: any, b: any) => b._relevance - a._relevance);

    const goodMatches = scored.filter((v: any) => v._relevance >= 3);
    const videos = (goodMatches.length > 0 ? goodMatches : scored).map((v: any) => {
      const { _relevance, ...rest } = v; return rest;
    });

    return new Response(JSON.stringify({ videos, total_results: data.total_results ?? 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
