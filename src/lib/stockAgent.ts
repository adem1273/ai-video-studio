// Autonomous Stock Video Agent — uses Groq tool-calling to search,
// evaluate, and select stock clips, or fall back to AI video generation.

import type { StockVideo } from './pexels';
import type { AgentLogEntry } from './types';

export type { AgentLogEntry };

export type StockAgentResult = {
  video: StockVideo | null;
  fallbackVideo: boolean;
  fallbackPrompt: string;
  logs: AgentLogEntry[];
};

type GroqToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

type GroqResponse = {
  content: string | null;
  tool_calls: GroqToolCall[] | null;
  finish_reason: string | null;
};

const MAX_ITERATIONS = 4;

const BLOCKED_WORDS = [
  'porn', 'nsfw', 'nude', 'xxx', 'sex', 'explicit', 'gore', 'violence',
  'kill', 'murder', 'terror', 'weapon', 'drug', 'gamble',
];

function sanitizeQuery(query: string): { safe: boolean; cleaned: string } {
  const lower = query.toLowerCase();
  for (const w of BLOCKED_WORDS) {
    if (lower.includes(w)) {
      return { safe: false, cleaned: 'nature landscape' };
    }
  }
  return { safe: true, cleaned: query.trim() };
}

const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'search_pexels',
      description: 'Search Pexels stock video library. Returns list of clips with tags, duration, resolution, thumbnail.',
      parameters: {
        type: 'object' as const,
        properties: {
          query: { type: 'string', description: 'English search keywords, 2-5 words' },
          orientation: { type: 'string', enum: ['landscape', 'portrait'], description: 'Video orientation' },
          min_duration_seconds: { type: 'number', description: 'Minimum clip duration in seconds' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_pixabay',
      description: 'Search Pixabay stock video library. Returns list of clips with tags, duration, resolution, thumbnail.',
      parameters: {
        type: 'object' as const,
        properties: {
          query: { type: 'string', description: 'English search keywords, 2-5 words' },
          orientation: { type: 'string', enum: ['landscape', 'portrait'], description: 'Video orientation' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'select_clip',
      description: 'Select a clip as the final choice for this scene. Call this when you have found a suitable clip.',
      parameters: {
        type: 'object' as const,
        properties: {
          clip_id: { type: 'string', description: 'The id of the selected clip (e.g. "pexels-12345" or "pixabay-67890")' },
          source: { type: 'string', enum: ['pexels', 'pixabay'], description: 'Which library the clip is from' },
          reason: { type: 'string', description: 'Why this clip was selected — relevance to scene, duration, quality' },
        },
        required: ['clip_id', 'source', 'reason'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'generate_fallback_video',
      description: 'Generate an AI video clip using Pollinations when no suitable stock video is found. Use as last resort after multiple searches.',
      parameters: {
        type: 'object' as const,
        properties: {
          prompt: { type: 'string', description: 'Detailed visual prompt for AI video generation, in English' },
          reason: { type: 'string', description: 'Why stock video was insufficient' },
        },
        required: ['prompt', 'reason'],
      },
    },
  },
];

const SYSTEM_PROMPT = `You are a video production assistant. Your task is to find the best stock video clip for a given scene.

Workflow:
1. Analyze the scene narration and image description to identify the key visual subject.
2. Generate English search keywords (2-5 words) that describe the MAIN SUBJECT — concrete nouns a stock video library would have.
3. Use search_pexels or search_pixabay to find clips.
4. Evaluate results: check if tags match the scene topic, duration is sufficient, and resolution is adequate.
5. If results are poor, try different keywords (e.g. broader terms, synonyms, single key noun).
6. When satisfied, call select_clip with the chosen clip id, source, and your reasoning.
7. After 3-4 failed search attempts, call generate_fallback_video with a detailed prompt.

Rules:
- Search queries MUST be in English even if narration is in Turkish.
- Use CONCRETE VISUAL NOUNS: "astronaut moon surface" not "space exploration".
- Do NOT use abstract concepts, empire names, or historical periods as search terms. Instead use concrete objects: "istanbul mosque" not "ottoman empire".
- You have maximum 4 iterations. Be efficient.
- Always call select_clip or generate_fallback_video to end the search.`;

function getGroqUrl(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
  return `${supabaseUrl}/functions/v1/groq-chat`;
}

function getStockAgentUrl(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
  return `${supabaseUrl}/functions/v1/stock-agent`;
}

async function callGroq(
  messages: { role: string; content: string | null }[],
  tools?: unknown[],
  toolChoice?: string,
): Promise<GroqResponse> {
  const reqBody: Record<string, unknown> = {
    messages,
    model: 'llama-3.3-70b-versatile',
    temperature: 0.3,
    max_tokens: 2048,
  };
  if (tools) reqBody.tools = tools;
  if (toolChoice) reqBody.tool_choice = toolChoice;

  const res = await fetch(getGroqUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reqBody),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Groq failed (${res.status}): ${errText.slice(0, 200)}`);
  }

  return await res.json() as GroqResponse;
}

interface ClipResult {
  id: string;
  source: 'pexels' | 'pixabay';
  tags: string;
  duration: number;
  width: number;
  height: number;
  thumbnail_url: string;
  preview_url: string;
}

async function searchStock(
  query: string,
  source: 'pexels' | 'pixabay',
  orientation: string,
  minDuration: number,
): Promise<ClipResult[]> {
  const res = await fetch(getStockAgentUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'search',
      query,
      source,
      orientation,
      min_duration: minDuration,
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.results ?? [];
}

function clipToStockVideo(clip: ClipResult): StockVideo {
  const numericId = parseInt(clip.id.split('-')[1] ?? '0', 10);
  return {
    id: numericId,
    url: '',
    video_url: clip.preview_url,
    image_url: clip.thumbnail_url,
    width: clip.width,
    height: clip.height,
    duration: clip.duration,
  };
}

export async function runStockAgent(
  sceneNarration: string,
  sceneImagePrompt: string,
  sceneSearchQuery: string,
  orientation: 'landscape' | 'portrait' | 'square',
  minDuration: number,
  onProgress?: (msg: string) => void,
): Promise<StockAgentResult> {
  const logs: AgentLogEntry[] = [];
  const ori = orientation === 'portrait' ? 'portrait' : 'landscape';

  const addLog = (iteration: number, action: string, detail: string) => {
    logs.push({ iteration, action, detail, timestamp: Date.now() });
  };

  const userPrompt = `Scene narration: "${sceneNarration}"
Visual description: "${sceneImagePrompt}"
Suggested search query: "${sceneSearchQuery}"
Required orientation: ${ori}
Minimum duration: ${minDuration}s

Find the best stock video clip for this scene.`;

  const messages: { role: string; content: string | null }[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];

  const clipRegistry = new Map<string, ClipResult>();

  try {
    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      const isLastIteration = iter === MAX_ITERATIONS - 1;
      const toolChoice = isLastIteration ? 'required' : 'auto';

      onProgress?.(`İterasyon ${iter + 1}/${MAX_ITERATIONS}: Ajan düşünüyor...`);
      addLog(iter + 1, 'thinking', 'Ajan sahne analiz ediyor');

      const response = await callGroq(messages, TOOL_DEFINITIONS, toolChoice);

      if (response.content) {
        messages.push({ role: 'assistant', content: response.content });
      }

      if (!response.tool_calls || response.tool_calls.length === 0) {
        if (isLastIteration) {
          addLog(iter + 1, 'force_fallback', 'Ajan karar vermedi, fallback\'e zorlanıyor');
          return {
            video: null,
            fallbackVideo: true,
            fallbackPrompt: sceneImagePrompt || sceneSearchQuery || sceneNarration,
            logs,
          };
        }
        continue;
      }

      for (const toolCall of response.tool_calls) {
        const fnName = toolCall.function.name;
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          args = {};
        }

        messages.push({
          role: 'assistant',
          content: null,
        });

        if (fnName === 'search_pexels' || fnName === 'search_pixabay') {
          const rawQuery = (args.query as string) ?? sceneSearchQuery ?? '';
          const { safe, cleaned } = sanitizeQuery(rawQuery);

          if (!safe) {
            addLog(iter + 1, 'blocked', `Uygunsuz sorgu engellendi: "${rawQuery}"`);
            messages.push({
              role: 'tool',
              content: JSON.stringify({ error: 'Query blocked by content filter', results: [] }),
            });
            onProgress?.(`İterasyon ${iter + 1}: Sorgu engellendi, nötr fallback kullanılıyor`);
            continue;
          }

          onProgress?.(`İterasyon ${iter + 1}: ${fnName === 'search_pexels' ? 'Pexels' : 'Pixabay'} aranıyor: "${cleaned}"`);
          addLog(iter + 1, 'search', `${fnName}: "${cleaned}"`);

          const results = await searchStock(
            cleaned,
            fnName === 'search_pexels' ? 'pexels' : 'pixabay',
            ori,
            minDuration,
          );

          for (const clip of results) {
            clipRegistry.set(clip.id, clip);
          }

          onProgress?.(`İterasyon ${iter + 1}: ${results.length} sonuç bulundu, değerlendiriliyor...`);
          addLog(iter + 1, 'results', `${results.length} klip bulundu`);

          messages.push({
            role: 'tool',
            content: JSON.stringify({
              query: cleaned,
              source: fnName === 'search_pexels' ? 'pexels' : 'pixabay',
              results: results.slice(0, 8).map((c) => ({
                id: c.id,
                tags: c.tags,
                duration: c.duration,
                resolution: `${c.width}x${c.height}`,
                thumbnail: c.thumbnail_url,
              })),
            }),
          });
        } else if (fnName === 'select_clip') {
          const clipId = args.clip_id as string;
          const source = args.source as 'pexels' | 'pixabay';
          const reason = args.reason as string;

          const clip = clipRegistry.get(clipId);
          if (clip) {
            onProgress?.(`Seçildi: ${clip.tags.slice(0, 40)}`);
            addLog(iter + 1, 'selected', `"${clip.tags.slice(0, 50)}" — ${reason}`);
            return {
              video: clipToStockVideo(clip),
              fallbackVideo: false,
              fallbackPrompt: '',
              logs,
            };
          }
          addLog(iter + 1, 'select_failed', `Klip bulunamadı: ${clipId}`);
          messages.push({
            role: 'tool',
            content: JSON.stringify({ error: 'Clip not found in results. Search again.' }),
          });
        } else if (fnName === 'generate_fallback_video') {
          const prompt = args.prompt as string;
          const reason = args.reason as string;

          onProgress?.('Uygun klip yok, AI video üretiliyor...');
          addLog(iter + 1, 'fallback', `"${prompt.slice(0, 60)}" — ${reason}`);
          return {
            video: null,
            fallbackVideo: true,
            fallbackPrompt: prompt || sceneImagePrompt,
            logs,
          };
        }
      }
    }
  } catch (err) {
    console.warn('Stock agent failed, falling back to heuristic', err);
    addLog(0, 'error', `Ajan hatası: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  return {
    video: null,
    fallbackVideo: false,
    fallbackPrompt: '',
    logs,
  };
}
