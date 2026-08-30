// supabase/functions/groq-rerank/index.ts
import { serve } from 'std/server';

serve(async (req) => {
  try {
    const body = await req.json();
    const scene = body.sceneDescription || '';
    const candidates = body.candidates || [];

    const candidateSummary = candidates.map((c: any) => `ID:${c.id} | title:${c.title || ''} | tags:${(c.tags||[]).join(',')} | duration:${c.duration}`).join('\n');

    const prompt = `You are a clip evaluator. Given a scene description and a list of candidate video metadata, rate each candidate 0..1 for semantic relevance (1 perfect). For each candidate return {id, score, reason}. Output JSON: { \"scores\": [ { \"id\":.., \"score\":.., \"reason\":.. } ] }\n\nScene: ${scene}\nCandidates:\n${candidateSummary}`;

    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
    if (!GROQ_API_KEY) return new Response(JSON.stringify({ error: 'GROQ_API_KEY not configured' }), { status: 500 });

    const res = await fetch('https://api.groq.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 500 }),
    });

    if (!res.ok) {
      const txt = await res.text();
      return new Response(JSON.stringify({ error: 'groq failed', detail: txt }), { status: 502 });
    }
    const json = await res.json();
    const out = json.choices?.[0]?.message?.content || json.choices?.[0]?.text || '';

    try {
      const parsed = JSON.parse(out);
      return new Response(JSON.stringify(parsed), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      // Fallback: attempt to parse lines like id:score:reason
      const lines = out.split(/\n+/).map(l => l.trim()).filter(Boolean);
      const scores = lines.map(line => {
        const parts = line.split(/\s*[:\-]\s*/);
        return { id: parts[0] || '', score: Number(parts[1] || 0), reason: parts.slice(2).join(' ') };
      });
      return new Response(JSON.stringify({ scores }), { headers: { 'Content-Type': 'application/json' } });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
