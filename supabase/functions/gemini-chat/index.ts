import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { resolveApiKey } from "../_shared/keyResolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userToken = authHeader.replace("Bearer ", "") || undefined;

    const body = await req.json();
    const { messages, model } = body as {
      messages: { role: string; content: string }[];
      model?: string;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { key } = await resolveApiKey("gemini", userToken);

    if (!key) {
      return new Response(
        JSON.stringify({ error: "Bu servis için API key eklenmemiş. Ayarlar'dan Gemini API key ekleyebilirsiniz. (https://aistudio.google.com/apikey)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const modelName = model || "gemini-2.0-flash";

    const systemInstruction = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n");

    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const geminiBody: Record<string, unknown> = {
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
    };

    if (systemInstruction) {
      geminiBody.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const res = await fetch(
      `${GEMINI_URL}/${modelName}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiBody),
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      return new Response(
        JSON.stringify({ error: `Gemini API error (${res.status}): ${errText}` }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await res.json();
    const content = data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text || "")
      .join("");

    if (!content) {
      return new Response(
        JSON.stringify({ error: "Empty response from Gemini" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
