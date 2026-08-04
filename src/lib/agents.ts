import type { Scene, ProjectSettings } from './types';
import { type AIScene } from './pollinations';
import { generateScriptWithFallback } from './llmRouter';
import { searchVideos, type StockVideo } from './pexels';
import { buildSearchQueryFromNarration, extractVisualKeywords } from './visualContext';
import { estimateDuration } from './tts';

export type ScriptResult = {
  title: string;
  scenes: AIScene[];
};

export type SceneWithMedia = Scene & {
  stockVideo?: StockVideo | null;
  aiVideoUrl?: string | null;
};

export async function agentScriptwriter(
  prompt: string,
  sceneCount: number,
  targetLang?: 'tr-TR' | 'en-US',
  onProgress?: (provider: string, status: string) => void,
): Promise<ScriptResult> {
  return generateScriptWithFallback(prompt, sceneCount, targetLang, onProgress);
}

export async function agentMediaFinder(
  scenes: Scene[],
  orientation: 'landscape' | 'portrait' | 'square' = 'landscape',
): Promise<SceneWithMedia[]> {
  const enriched: SceneWithMedia[] = [];
  for (const scene of scenes) {
    let video: StockVideo | null = null;
    const queries = [
      scene.search_query,
      buildSearchQueryFromNarration(scene.narration),
      extractVisualKeywords(scene.image_prompt),
    ].filter(Boolean) as string[];
    for (const q of queries) {
      try {
        video = await searchVideos(q, 3, orientation as 'landscape' | 'portrait' | 'square').then((v) => v[0] ?? null);
        if (video) break;
      } catch { /* try next */ }
    }
    enriched.push({ ...scene, stockVideo: video });
  }
  return enriched;
}

export function scenesToScript(scenes: SceneWithMedia[]): ScriptResult {
  return {
    title: '',
    scenes: scenes.map((s) => ({
      narration: s.narration,
      image_prompt: s.image_prompt,
      search_query: s.search_query || '',
    })),
  };
}

export function estimateSceneDuration(text: string): number {
  return estimateDuration(text);
}

export function calculateTotalDuration(scenes: Scene[]): number {
  return scenes.reduce((sum, s) => sum + (s.duration || estimateDuration(s.narration)), 0);
}
