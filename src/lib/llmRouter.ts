// LLM Fallback Chain — tries Pollinations, then Groq, then Gemini, then local.
// Reduces user wait time by switching providers after 2 failed attempts
// instead of exhausting all 6 Pollinations retries.

import { buildScriptMessages, type AIScene } from './pollinations';
import { generateLocalScript } from './scriptGenerator';

const TEXT_API = 'https://text.pollinations.ai';
const REFERRER = 'montaj.app';

function parseScriptResponse(content: string): { title: string; scenes: AIScene[] } {
  if (!content) throw new Error('Empty response from LLM');

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Could not parse script response');
    parsed = JSON.parse(match[0]);
  }

  const result = parsed as { title: string; scenes: AIScene[] };
  if (!result.title || !Array.isArray(result.scenes) || result.scenes.length === 0) {
    throw new Error('Invalid script structure');
  }
  result.scenes = result.scenes.map((s) => ({
    ...s,
    search_query: s.search_query || '',
  }));
  return result;
}

async function callPollinations(
  messages: { role: string; content: string }[],
  maxRetries: number = 2,
): Promise<{ title: string; scenes: AIScene[] }> {
  const body = { model: 'openai', messages, referrer: REFERRER };

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(`${TEXT_API}/openai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 402 || res.status === 429) {
        if (attempt < maxRetries - 1) {
          const wait = Math.min(10000 * Math.pow(1.5, attempt), 30000);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        throw new Error(`Rate limited (${res.status})`);
      }

      if (!res.ok) throw new Error(`Pollinations failed (${res.status})`);

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      return parseScriptResponse(content);
    } catch (err) {
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 3000));
      } else {
        throw err;
      }
    }
  }
  throw new Error('Pollinations failed after max retries');
}

async function callGroq(
  messages: { role: string; content: string }[],
): Promise<{ title: string; scenes: AIScene[] }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
  const res = await fetch(`${supabaseUrl}/functions/v1/groq-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model: 'llama-3.3-70b-versatile' }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Groq failed (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  return parseScriptResponse(data.content);
}

async function callGemini(
  messages: { role: string; content: string }[],
): Promise<{ title: string; scenes: AIScene[] }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
  const res = await fetch(`${supabaseUrl}/functions/v1/gemini-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model: 'gemini-2.0-flash' }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini failed (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  return parseScriptResponse(data.content);
}

function localFallback(
  prompt: string,
  sceneCount: number,
  targetLang: 'tr-TR' | 'en-US' | undefined,
): { title: string; scenes: AIScene[] } {
  const local = generateLocalScript(prompt, sceneCount, 'cinematic', targetLang);
  return {
    title: local.title,
    scenes: local.scenes.map((s) => ({
      narration: s.narration,
      image_prompt: s.image_prompt,
      search_query: '',
    })),
  };
}

export async function generateScriptWithFallback(
  prompt: string,
  sceneCount: number,
  targetLang: 'tr-TR' | 'en-US' | undefined,
  onProgress?: (provider: string, status: string) => void,
): Promise<{ title: string; scenes: AIScene[] }> {
  const { system, user } = buildScriptMessages(prompt, sceneCount, targetLang);
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];

  // Provider 1: Pollinations (2 retries)
  onProgress?.('pollinations', 'deneniyor...');
  try {
    const result = await callPollinations(messages, 2);
    onProgress?.('pollinations', 'başarılı');
    return result;
  } catch (e) {
    console.warn('Pollinations failed, trying Groq', e);
    onProgress?.('pollinations', 'başarısız');
  }

  // Provider 2: Groq
  onProgress?.('groq', 'deneniyor...');
  try {
    const result = await callGroq(messages);
    onProgress?.('groq', 'başarılı');
    return result;
  } catch (e) {
    console.warn('Groq failed, trying Gemini', e);
    onProgress?.('groq', 'başarısız');
  }

  // Provider 3: Gemini
  onProgress?.('gemini', 'deneniyor...');
  try {
    const result = await callGemini(messages);
    onProgress?.('gemini', 'başarılı');
    return result;
  } catch (e) {
    console.warn('Gemini failed, trying local fallback', e);
    onProgress?.('gemini', 'başarısız');
  }

  // Provider 4: Local fallback
  onProgress?.('local', 'yerel üretim kullanılıyor...');
  return localFallback(prompt, sceneCount, targetLang);
}
