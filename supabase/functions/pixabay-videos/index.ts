import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PIXABAY_API_KEY = Deno.env.get("PIXABAY_API_KEY") ?? "56875494-83df8d651c3899cd7be18d320";
const API_BASE = "https://pixabay.com/api/videos";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("query") ?? "";
    const perPage = url.searchParams.get("per_page") ?? "5";
    const orientation = url.searchParams.get("orientation") ?? "landscape";

    if (!query) {
      return new Response(JSON.stringify({ error: "Query is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!PIXABAY_API_KEY) {
      return new Response(JSON.stringify({ videos: [], notice: "PIXABAY_API_KEY not configured" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const pixabayOrientation = orientation === "portrait" ? "vertical" : orientation === "square" ? "all" : "horizontal";
    const params = new URLSearchParams({ key: PIXABAY_API_KEY, q: query, per_page: perPage, video_type: "all", orientation: pixabayOrientation });
    const res = await fetch(`${API_BASE}/?${params}`);

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Pixabay API error: ${res.status}` }), { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await res.json();
    const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);

    const videos = (data.hits ?? []).map((v: any) => {
      const files = v.videos ?? {};
      const mp4 = files.medium ?? files.small ?? files.large ?? files.tiny;
      if (!mp4) return null;
      const tagsText = (v.tags ?? "").toLowerCase();
      let relevance = 0;
      for (const qw of queryWords) { if (tagsText.includes(qw)) relevance += 3; }
      relevance += Math.random() * 0.1;
      return { id: v.id, url: v.pageURL ?? "", video_url: mp4.url, image_url: v.userImageURL ?? v.previewURL ?? "", width: mp4.width, height: mp4.height, duration: v.duration, _relevance: relevance };
    }).filter(Boolean).sort((a: any, b: any) => b._relevance - a._relevance).map((v: any) => { const { _relevance, ...rest } = v; return rest; });

    return new Response(JSON.stringify({ videos }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
