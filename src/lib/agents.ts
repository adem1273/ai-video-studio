// AI Agents for the Video Factory.
// Senarist uses Pollinations text API with local fallback.
// Visual Director and SEO use local heuristics (no external API needed).

import type { Scene, ProjectSettings } from './types';
import { type AIScene } from './pollinations';
import { generateScriptWithFallback } from './llmRouter';
import { searchVideos, type StockVideo } from './pexels';
import { buildSearchQueryFromNarration, extractVisualKeywords } from './visualContext';
import { estimateDuration } from './tts';
import { runStockAgent, type StockAgentResult } from './stockAgent';
import type { AgentLogEntry } from './types';

// ── Agent 1: Senarist (Scriptwriter) ───────────────────────────────────────

export type ScriptResult = {
  title: string;
  scenes: AIScene[];
};

export async function agentScriptwriter(
  prompt: string,
  sceneCount: number,
  targetLang?: 'tr-TR' | 'en-US',
  onProgress?: (provider: string, status: string) => void,
): Promise<ScriptResult> {
  return generateScriptWithFallback(prompt, sceneCount, targetLang, onProgress);
}

// ── Agent 2: Görsel Yönetmen (Visual Director) ────────────────────────────

export type VisualDirection = {
  image_prompt: string;
  search_query: string;
  composition: string;
  mood: string;
};

// YENI: Narration'dan mood belirle (sahne icerigine Gore, index'e degil)
function determineMoodFromNarration(narration: string): string {
  const lower = narration.toLowerCase();
  if (lower.includes('korku') || lower.includes('korkak') || lower.includes('kutsal') || lower.includes('mysterious') || lower.includes('sihir') || lower.includes('magical') || lower.includes('enigmatic')) return 'mysterious';
  if (lower.includes('savas') || lower.includes('dovus') || lower.includes('dramatik') || lower.includes('kavg') || lower.includes('tensions') || lower.includes('conflict') || lower.includes('battle') || lower.includes('fight')) return 'tense';
  if (lower.includes('mutlu') || lower.includes('bahay') || lower.includes('sevinç') || lower.includes('party') || lower.includes('fun') || lower.includes('joy') || lower.includes('happy') || lower.includes(' celebrations')) return 'happy';
  if (lower.includes('oyun') || lower.includes('oyun') || lower.includes('cache') || lower.includes('dynamic') || lower.includes('hareketli') || lower.includes('action') || lower.includes('energetic')) return 'tense';
  return 'neutral';
}

// YENI: Narration'dan composition belirle (sahne icerigine Gore, index'e degil)
function determineCompositionFromNarration(narration: string): string {
  const lower = narration.toLowerCase();
  // Kahraman/ protagonisti odaklı sahne
  if (lower.includes('kahraman') || lower.includes('helden') || lower.includes('hero') || lower.includes('davala') || lower.includes('protagonist') || lower.includes('main character')) {
    return 'close-up portrait';
  }
  // Eylem/ fight sahnesi
  if (lower.includes('fight') || lower.includes('battle') || lower.includes('dovus') || lower.includes('conflict') || lower.includes('action') || lower.includes('savas') || lower.includes('dramatik')) {
    return 'dynamic close-up';
  }
  // Ogretici/ nasil yapilir
  if (lower.includes('nas?l') || lower.includes('how-to') || lower.includes('ad?mr') || lower.includes('learn') || lower.includes('guide') || lower.includes('tutorial')) {
    return 'medium shot';
  }
  // ?ehir/ urban ortam
  if (lower.includes('ehir') || lower.includes('kota') || lower.includes('urban') || lower.includes('city') || lower.includes('sokak') || lower.includes('street') || lower.includes('urban')) {
    return 'wide aerial shot';
  }
  // Doğah/ natur sahnesi
  if (lower.includes('orman') || lower.includes('doga') || lower.includes('natural') || lower.includes('gun do?umu') || lower.includes('güne') || lower.includes('forest') || lower.includes('nature') || lower.includes('outside')) {
    return 'establishing wide';
  }
  return 'medium shot';
}

export async function agentVisualDirector(
  scenes: AIScene[],
  style: string,
): Promise<VisualDirection[]> {
  return scenes.map((s, i) => {
    // Önce visual keywords'leri çıkar (arama için)
    const keywords = extractVisualKeywords(s.narration);
    const searchQuery = keywords.slice(0, 3).join(' ');
    // İçeriğe göre mood ve composition belirle (index'e bağlı DEĞİL)
    const mood = determineMoodFromNarration(s.narration);
    const composition = determineCompositionFromNarration(s.narration);
    const imagePrompt = `${s.image_prompt}, ${composition}, ${style} style`;
    return {
      image_prompt: imagePrompt,
      search_query: searchQuery || s.search_query || '',
      composition,
      mood,
    };
  });
}
