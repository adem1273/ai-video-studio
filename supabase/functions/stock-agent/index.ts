import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { resolveApiKey } from "../_shared/keyResolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PEXELS_BASE = "https://api.pexels.com/v1/videos";
const PIXABAY_BASE = "https://pixabay.com/api/videos";

interface NormalizedClip {
  id: string;
  source: "pexels" | "pixabay";
  tags: string;
  duration: number;
  width: number;
  height: number;
  thumbnail_url: string;
  preview_url: string;
}

async function searchPexels(query: string, orientation: string, minDuration: number, apiKey: string): Promise<NormalizedClip[]> {
  if (!apiKey) return [];
  const params = new URLSearchParams({ query, per_page: "10", orientation });
  try {
    const res = await fetch(`${PEXELS_BASE}/search?${params}`, {
      headers: { Authorization: apiKey },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.videos ?? [])
      .filter((v: any) => {
        const files = (v.video_files ?? []).filter((f: any) => f.file_type === "video/mp4");
        return files.length > 0 && v.duration >= minDuration;
      })
      .map((v: any) => {
        const files = v.video_files.filter((f: any) => f.file_type === "video/mp4");
        const best = files.sort((a: any, b: any) => (b.height ?? 0) - (a.height ?? 0))[0];
        return {
          id: `pexels-${v.id}`,
          source: "pexels" as const,
          tags: (v.tags ?? []).join(", "),
          duration: v.duration,
          width: best?.width ?? 0,
          height: best?.height ?? 0,
          thumbnail_url: v.image ?? "",
          preview_url: best?.link ?? "",
        };
      });
  } catch {
    return [];
  }
}

async function searchPixabay(query: string, orientation: string, minDuration: number, apiKey: string): Promise<NormalizedClip[]> {
  if (!apiKey) return [];
  const pixabayOri = orientation === "portrait" ? "vertical" : orientation === "square" ? "all" : "horizontal";
  const params = new URLSearchParams({
    key: apiKey,
    q: query,
    per_page: "10",
    video_type: "all",
    orientation: pixabayOri,
  });
  try {
    const res = await fetch(`${PIXABAY_BASE}/?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.hits ?? [])
      .filter((v: any) => v.duration >= minDuration)
      .map((v: any) => {
        const files = v.videos ?? {};
        const mp4 = files.medium ?? files.small ?? files.large ?? files.tiny;
        return {
          id: `pixabay-${v.id}`,
          source: "pixabay" as const,
          tags: v.tags ?? "",
          duration: v.duration,
          width: mp4?.width ?? 0,
          height: mp4?.height ?? 0,
          thumbnail_url: v.userImageURL ?? v.previewURL ?? "",
          preview_url: mp4?.url ?? "",
        };
      });
  } catch {
    return [];
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userToken = authHeader.replace("Bearer ", "") || undefined;

    const body = await req.json();
    const { action, query, source, orientation, min_duration } = body as {
      action: "search";
      query: string;
      source?: "pexels" | "pixabay";
      orientation?: string;
      min_duration?: number;
    };

    if (action === "search") {
      if (!query || !query.trim()) {
        return new Response(
          JSON.stringify({ error: "query is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const ori = orientation ?? "landscape";
      const minDur = min_duration ?? 3;

      let results: NormalizedClip[] = [];

      if (!source || source === "pexels") {
        const { key } = await resolveApiKey("pexels", userToken);
        if (key) {
          const pexelsResults = await searchPexels(query, ori, minDur, key);
          results.push(...pexelsResults);
        }
      }
      if (!source || source === "pixabay") {
        const { key } = await resolveApiKey("pixabay", userToken);
        if (key) {
          const pixabayResults = await searchPixabay(query, ori, minDur, key);
          results.push(...pixabayResults);
        }
      }

      return new Response(
        JSON.stringify({ results, total: results.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
