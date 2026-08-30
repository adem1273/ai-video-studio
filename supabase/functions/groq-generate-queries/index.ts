// supabase/functions/groq-generate-queries/index.ts
// Deno edge function stub: proxies to Groq/Gemini via secret GROQ_API_KEY
import { serve } from 'std/server';

serve(async (req) => {
  try {
    const body = await req.json();
    const scene = body.sceneDescription || '';
    const duration = body.desiredDuration || 10;

    const prompt = `You are a search query generator. Given the scene description below, produce 5 short search queries (3-6 words each) that would best find video clips matching the scene. Output JSON: { \"queries\": [..] }\n\nScene: "${scene}"\nDuration: ~${duration}s`;

    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
    if (!GROQ_API_KEY) return new Response(JSON.stringify({ error: 'GROQ_API_KEY not configured' }), { status: 500 });

    const res = await fetch('https://api.groq.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 200 }),
    });

    if (!res.ok) {
      const txt = await res.text();
      return new Response(JSON.stringify({ error: 'groq failed', detail: txt }), { status: 502 });
    }
    const json = await res.json();
    const out = json.choices?.[0]?.message?.content || json.choices?.[0]?.text || '';

    // try parse JSON from model, fallback to simple newline split
    let queries = [];
    try {
      const parsed = JSON.parse(out);
      queries = parsed.queries || [];
    } catch (e) {
      queries = out.split(/\n+/).map(s => s.trim()).filter(Boolean).slice(0,5);
    }

    return new Response(JSON.stringify({ queries }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
