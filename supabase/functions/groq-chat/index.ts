import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { resolveApiKey } from "../_shared/keyResolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userToken = authHeader.replace("Bearer ", "") || undefined;

    const body = await req.json();
    const { messages, model, tools, tool_choice, temperature, max_tokens } = body as {
      messages: { role: string; content: string | null }[];
      model?: string;
      tools?: unknown[];
      tool_choice?: string | { type: string; function: { name: string } };
      temperature?: number;
      max_tokens?: number;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { key } = await resolveApiKey("groq", userToken);

    if (!key) {
      return new Response(
        JSON.stringify({ error: "Bu servis için API key eklenmemiş. Ayarlar'dan Groq API key ekleyebilirsiniz. (https://console.groq.com)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const groqBody: Record<string, unknown> = {
      model: model || "llama-3.3-70b-versatile",
      messages,
      temperature: temperature ?? 0.7,
      max_tokens: max_tokens ?? 4096,
    };

    if (tools) groqBody.tools = tools;
    if (tool_choice) groqBody.tool_choice = tool_choice;

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify(groqBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(
        JSON.stringify({ error: `Groq API error (${res.status}): ${errText}` }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await res.json();
    const message = data?.choices?.[0]?.message;

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Empty response from Groq" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        content: message.content ?? null,
        tool_calls: message.tool_calls ?? null,
        finish_reason: data?.choices?.[0]?.finish_reason ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
