// src/lib/stockAgent.ts
// LLM-enhanced autonomous stock clip selection agent

export type Orientation = 'landscape' | 'portrait' | 'any';

export interface Clip {
  id: string;
  source: 'pexels' | 'pixabay';
  duration: number; // seconds
  width?: number;
  height?: number;
  resolution?: string; // "1920x1080"
  tags?: string[];
  thumbnail_url?: string;
  preview_url?: string;
  title?: string;
  extras?: Record<string, any>;
}

export interface AgentOptions {
  minDuration?: number;
  orientation?: Orientation;
  maxIterations?: number;
  requiredOverlapScore?: number; // heuristic-only threshold
  autoSelectThreshold?: number; // final score threshold for automatic selection (0..1)
  onProgress?: (msg: string) => void;
  fetchImpl?: typeof fetch;
}

export interface AgentResult {
  action: 'select_clip' | 'generate_fallback_video';
  reason: string;
  clip?: Clip;
  fallback?: { prompt: string; jobId?: string; details?: any };
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9ğüşiöçÂâÄäÀàÉéÍíÓóÖöÚúÇçŞş\s]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function scoreClipHeuristic(sceneText: string, desiredDuration: number, orientation: Orientation | undefined, clip: Clip): number {
  const sceneTokens = new Set(tokenize(sceneText));
  const tags = (clip.tags || []).map(t => t.toLowerCase());
  let overlap = 0;
  if (tags.length > 0) {
    const matches = tags.filter(t => sceneTokens.has(t) || sceneText.toLowerCase().includes(t)).length;
    overlap = matches / tags.length;
  }

  const durationScore = Math.min(1, clip.duration / Math.max(1, desiredDuration));

  let orientationBonus = 0;
  if (orientation && clip.width && clip.height && orientation !== 'any') {
    const clipOrientation: Orientation = clip.width >= clip.height ? 'landscape' : 'portrait';
    orientationBonus = clipOrientation === orientation ? 0.08 : 0;
  }

  let resBonus = 0;
  if (clip.width) {
    if (clip.width >= 1280) resBonus = 0.04;
    else if (clip.width >= 854) resBonus = 0.01;
  }

  const score = Math.min(1, overlap * 0.6 + durationScore * 0.28 + orientationBonus + resBonus);
  return score;
}

async function callSearchAPI(endpoint: string, body: Record<string, any>, fetchImpl: typeof fetch): Promise<Clip[]> {
  const res = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Search API ${endpoint} failed: ${res.status} ${text}`);
  }
  const json = await res.json();
  return json.results || [];
}

function refineQuery(original: string, attempt: number): string {
  const modifiers = ['cinematic', 'aerial', 'close-up', 'timelapse', 'slow motion', 'drone', 'pan', 'wide shot', 'establishing'];
  if (attempt === 0) return original;
  const mod = modifiers[Math.min(attempt - 1, modifiers.length - 1)];
  return `${original} ${mod}`;
}

async function groqGenerateQueries(scene: string, duration: number, fetchImpl: typeof fetch) {
  const res = await fetchImpl('/api/groq-generate-queries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sceneDescription: scene, desiredDuration: duration }),
  });
  if (!res.ok) {
    throw new Error('groq generate queries failed');
  }
  const json = await res.json();
  return json.queries as string[];
}

async function groqRerank(scene: string, candidates: Clip[], fetchImpl: typeof fetch) {
  const payload = { sceneDescription: scene, candidates: candidates.map(c => ({ id: c.id, title: c.title, tags: c.tags, duration: c.duration, source: c.source })) };
  const res = await fetchImpl('/api/groq-rerank', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error('groq rerank failed');
  }
  const json = await res.json();
  return json.scores as { id: string; score: number; reason?: string }[];
}

function uniqueClips(clips: Clip[]) {
  const map = new Map<string, Clip>();
  for (const c of clips) {
    const key = `${c.source}:${c.id}`;
    if (!map.has(key)) map.set(key, c);
  }
  return Array.from(map.values());
}

export async function runStockAgent(
  sceneDescription: string,
  desiredDuration: number,
  orientation: Orientation | undefined,
  opts?: AgentOptions
): Promise<AgentResult> {
  const {
    minDuration = Math.max(1, Math.floor(desiredDuration * 0.6)),
    maxIterations = 4,
    requiredOverlapScore = 0.75,
    autoSelectThreshold = 0.85,
    onProgress,
    fetchImpl = fetch.bind(globalThis) as typeof fetch,
  } = opts || {};

  const endpoints = {
    pexels: '/api/pexels-search',
    pixabay: '/api/pixabay-search',
    pollinationsGenerate: '/api/pollinations-generate',
  };

  onProgress?.(`Agent başlatıldı — hedef süre ${desiredDuration}s, min kabul edilen ${minDuration}s`);

  // Step 1: ask LLM to generate queries
  let queries: string[] = [sceneDescription];
  try {
    onProgress?.('LLM: Arama sorguları üretiliyor...');
    const q = await groqGenerateQueries(sceneDescription, desiredDuration, fetchImpl).catch(e => {
      onProgress?.(`Sorgu üretimi başarısız: ${String(e)} — fallback tek sorguya dönülüyor`);
      return null;
    });
    if (q && Array.isArray(q) && q.length > 0) {
      queries = q;
      onProgress?.(`LLM: ${queries.length} sorgu üretildi`);
    }
  } catch (e) {
    onProgress?.(`Sorgu üretimi sırasında hata: ${String(e)} — devam ediliyor`);
  }

  let bestOverall: { clip: Clip; finalScore: number; reason?: string } | null = null;

  for (let iter = 0; iter < maxIterations; iter++) {
    const query = queries[iter] ?? refineQuery(sceneDescription, iter);
    onProgress?.(`Iterasyon ${iter + 1}: Aranıyor: "${query}"`);

    // Parallel searches
    const [pexelsRes, pixabayRes] = await Promise.allSettled([
      callSearchAPI(endpoints.pexels, { query, orientation, min_duration_seconds: minDuration }, fetchImpl),
      callSearchAPI(endpoints.pixabay, { query, orientation, min_duration_seconds: minDuration }, fetchImpl),
    ]);

    const results: Clip[] = [];
    if (pexelsRes.status === 'fulfilled') {
      pexelsRes.value.forEach(c => results.push({ ...c, source: 'pexels' }));
      onProgress?.(`Pexels: ${pexelsRes.value.length} sonuç bulundu`);
    } else {
      onProgress?.(`Pexels araması başarısız: ${String(pexelsRes.reason)}`);
    }
    if (pixabayRes.status === 'fulfilled') {
      pixabayRes.value.forEach(c => results.push({ ...c, source: 'pixabay' }));
      onProgress?.(`Pixabay: ${pixabayRes.value.length} sonuç bulundu`);
    } else {
      onProgress?.(`Pixabay araması başarısız: ${String(pixabayRes.reason)}`);
    }

    if (results.length === 0) {
      onProgress?.('Hiç sonuç bulunamadı, sonraki sorguya geçiliyor...');
      continue;
    }

    const unique = uniqueClips(results);

    // Heuristic scoring
    const heurScores = unique.map(c => ({ clip: c, heur: scoreClipHeuristic(sceneDescription, desiredDuration, orientation, c) }));
    heurScores.sort((a, b) => b.heur - a.heur);

    // Ask LLM to rerank top candidates (limit to 20)
    const topCandidates = heurScores.slice(0, 20).map(h => h.clip);
    let llmScores: { id: string; score: number; reason?: string }[] = [];
    try {
      onProgress?.('LLM: Adaylar yeniden sıralanıyor...');
      llmScores = await groqRerank(sceneDescription, topCandidates, fetchImpl).catch(e => {
        onProgress?.(`LLM rerank başarısız: ${String(e)} — heuristic kullanılıyor`);
        return [] as any;
      });
    } catch (e) {
      onProgress?.(`LLM rerank sırasında hata: ${String(e)}`);
    }

    // Merge scores
    const merged = topCandidates.map(c => {
      const heur = scoreClipHeuristic(sceneDescription, desiredDuration, orientation, c);
      const l = llmScores.find(s => s.id === c.id);
      const llmS = l ? Math.max(0, Math.min(1, Number(l.score))) : 0;
      const alpha = 0.7; // weight for LLM
      const final = alpha * llmS + (1 - alpha) * heur;
      return { clip: c, heur, llm: llmS, final, reason: l?.reason };
    }).sort((a, b) => b.final - a.final);

    if (merged.length === 0) continue;

    const top = merged[0];
    onProgress?.(`En iyi aday skor: ${top.final.toFixed(2)} (LLM ${top.llm.toFixed(2)}, heur ${top.heur.toFixed(2)}) - id=${top.clip.id}`);

    if (!bestOverall || top.final > bestOverall.finalScore) {
      bestOverall = { clip: top.clip, finalScore: top.final, reason: top.reason };
    }

    if (top.final >= autoSelectThreshold && top.clip.duration >= minDuration) {
      return {
        action: 'select_clip',
        clip: top.clip,
        reason: `Otomatik seçim: yüksek final skor ${top.final.toFixed(2)} ve süre uygun (${top.clip.duration}s)`,
      };
    }

    // Otherwise, continue iterating with refined queries
    onProgress?.(`Otomatik eşik (${autoSelectThreshold}) sağlanamadı, sonraki sorguya geçiliyor...`);
  }

  // After iterations, pick bestOverall if decent
  if (bestOverall && bestOverall.finalScore >= 0.6 && bestOverall.clip.duration >= minDuration) {
    return {
      action: 'select_clip',
      clip: bestOverall.clip,
      reason: `En iyi eşleşme (iterasyon sonunda), final skor ${bestOverall.finalScore.toFixed(2)}. ${bestOverall.reason ?? ''}`,
    };
  }

  // Fallback: generate video
  const fallbackPrompt = `Generate a short video clip for the scene: ${sceneDescription}. Desired duration: approx ${desiredDuration}s. Reason: no suitable stock clip found.`;
  onProgress?.('Uygun stok klip bulunamadı — fallback video üretimi başlatılıyor (Pollinations)...');
  try {
    const res = await fetchImpl(endpoints.pollinationsGenerate, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: fallbackPrompt, reason: 'no_stock_clip_found' }),
    });
    if (!res.ok) {
      const text = await res.text();
      onProgress?.(`Fallback üretim isteği başarısız: ${res.status} ${text}`);
      return { action: 'generate_fallback_video', reason: 'fallback_failed_to_start', fallback: { prompt: fallbackPrompt, details: text } };
    }
    const json = await res.json();
    return { action: 'generate_fallback_video', reason: 'fallback_started', fallback: { prompt: fallbackPrompt, jobId: json.jobId, details: json } };
  } catch (e) {
    onProgress?.(`Fallback üretiminde hata: ${String(e)}`);
    return { action: 'generate_fallback_video', reason: 'fallback_error', fallback: { prompt: fallbackPrompt, details: String(e) } };
  }
}
