// Pexels stock video integration — proxied through a Supabase edge function
// so the API key stays server-side and is never exposed in the browser.

export type StockVideo = {
  id: number;
  url: string;
  video_url: string;
  image_url: string;
  width: number;
  height: number;
  duration: number;
};

function getFunctionUrl(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
  return `${supabaseUrl}/functions/v1/pexels-videos`;
}

function getPixabayFunctionUrl(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
  return `${supabaseUrl}/functions/v1/pixabay-videos`;
}

async function searchPixabay(
  query: string,
  perPage: number,
  orientation: 'landscape' | 'portrait' | 'square',
): Promise<StockVideo[]> {
  const params = new URLSearchParams({ query, per_page: String(perPage), orientation });
  try {
    const res = await fetch(`${getPixabayFunctionUrl()}?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.videos ?? []) as StockVideo[];
  } catch { return []; }
}

export async function searchVideos(
  query: string,
  perPage: number = 5,
  orientation: 'landscape' | 'portrait' | 'square' = 'landscape',
): Promise<StockVideo[]> {
  if (!query) return [];
  const params = new URLSearchParams({ query, per_page: String(perPage), orientation });
  try {
    const res = await fetch(`${getFunctionUrl()}?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.videos ?? []) as StockVideo[];
  } catch { return []; }
}

export async function findVideo(
  query: string,
  orientation: 'landscape' | 'portrait' | 'square' = 'landscape',
): Promise<StockVideo | null> {
  const results = await searchVideos(query, 3, orientation);
  if (results.length > 0) return results[0];
  const pixabayResults = await searchPixabay(query, 3, orientation);
  return pixabayResults[0] ?? null;
}

export function preloadVideo(url: string, timeoutMs: number = 15000): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.loop = true;
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) { settled = true; video.src = ''; reject(new Error(`Video load timeout: ${url.slice(0, 80)}`)); }
    }, timeoutMs);
    video.onloadeddata = () => {
      if (!settled) { settled = true; clearTimeout(timer); video.currentTime = 0; resolve(video); }
    };
    video.onerror = () => {
      if (!settled) { settled = true; clearTimeout(timer); reject(new Error(`Failed to load video: ${url.slice(0, 80)}`)); }
    };
    video.src = url;
  });
}

export async function preloadVideoWithFallbacks(urls: string[], timeoutMs: number = 12000): Promise<HTMLVideoElement | null> {
  for (const url of urls) {
    try { return await preloadVideo(url, timeoutMs); } catch { /* try next */ }
  }
  return null;
}
