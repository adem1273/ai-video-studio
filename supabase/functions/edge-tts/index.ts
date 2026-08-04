import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TTS_URL =
  "wss://api.edge-tts.com/consume?trustedclienttoken=6A5AA1D4EAFF4E9FB37E23D68482D647";

const VOICE_MAP: Record<string, string> = {
  "tr-TR-Emel": "tr-TR-EmelNeural",
  "tr-TR-Ahmet": "tr-TR-AhmetNeural",
  "en-US-Aria": "en-US-AriaNeural",
  "en-US-Guy": "en-US-GuyNeural",
  "en-GB-Sonia": "en-GB-SoniaNeural",
  "de-DE-Katja": "de-DE-KatjaNeural",
  "fr-FR-Denise": "fr-FR-DeniseNeural",
  "es-ES-Elvira": "es-ES-ElviraNeural",
  "it-IT-Elsa": "it-IT-ElsaNeural",
  "ru-RU-Svetlana": "ru-RU-SvetlanaNeural",
  "ja-JP-Nanami": "ja-JP-NanamiNeural",
  "ko-KR-SunHi": "ko-KR-SunHiNeural",
  "ar-EG-Salma": "ar-EG-SalmaNeural",
  "pt-BR-Francisca": "pt-BR-FranciscaNeural",
  "nl-NL-Colette": "nl-NL-ColetteNeural",
  "pl-PL-Zofia": "pl-PL-ZofiaNeural",
  "sv-SE-Sofie": "sv-SE-SofieNeural",
  "zh-CN-Xiaoxiao": "zh-CN-XiaoxiaoNeural",
  "hi-IN-Swara": "hi-IN-SwaraNeural",
};

function resolveVoice(voice: string): string {
  if (VOICE_MAP[voice]) return VOICE_MAP[voice];
  if (voice.endsWith("Neural")) return voice;
  return "en-US-AriaNeural";
}

function buildSSML(text: string, voice: string, rate: number, pitch: string): string {
  const langCode = voice.split("-").slice(0, 2).join("-");
  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${langCode}'>` +
    `<voice name='${voice}'>` +
    `<prosody rate='${rate}%' pitch='${pitch}'>` +
    escapeXML(text) +
    `</prosody></voice></speak>`;
}

function escapeXML(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { text, voice, rate, pitch } = body as {
      text: string;
      voice?: string;
      rate?: number;
      pitch?: string;
    };

    if (!text || !text.trim()) {
      return new Response(
        JSON.stringify({ error: "text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resolvedVoice = resolveVoice(voice || "en-US-Aria");
    const ratePercent = Math.round((rate ?? 1.0) * 100) - 100;
    const pitchStr = pitch ?? "+0Hz";
    const ssml = buildSSML(text, resolvedVoice, ratePercent, pitchStr);
    const requestId = crypto.randomUUID().replace(/-/g, "");

    const ws = new WebSocket(TTS_URL + `&ConnectionId=${requestId}`);
    const audioChunks: Uint8Array[] = [];
    let wsError: string | null = null;
    let wsClosed = false;

    const messagePromise = new Promise<Uint8Array[]>((resolve, reject) => {
      ws.addEventListener("open", () => {
        ws.send(JSON.stringify({
          context: { synthetic: { conversation: { conversationId: requestId } } },
        }));
        ws.send(JSON.stringify({
          ssml,
          requestId,
          timestamp: new Date().toISOString(),
        }));
      });

      ws.addEventListener("message", async (event: MessageEvent) => {
        if (event.data instanceof ArrayBuffer) {
          const view = new DataView(event.data);
          if (event.data.byteLength >= 6) {
            const msgType = view.getUint16(0, false);
            if (msgType === 2) {
              audioChunks.push(new Uint8Array(event.data, 6));
            }
          }
        } else if (event.data instanceof Blob) {
          const buf = await event.data.arrayBuffer();
          const view = new DataView(buf);
          if (buf.byteLength >= 6) {
            const msgType = view.getUint16(0, false);
            if (msgType === 2) {
              audioChunks.push(new Uint8Array(buf, 6));
            }
          }
        } else if (typeof event.data === "string") {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.path === "turn.end") {
              ws.close();
            }
          } catch { /* ignore */ }
        }
      });

      ws.addEventListener("error", () => {
        wsError = "WebSocket error";
        if (!wsClosed) { wsClosed = true; reject(new Error(wsError)); }
      });

      ws.addEventListener("close", () => {
        wsClosed = true;
        resolve(audioChunks);
      });
    });

    const chunks = await messagePromise;

    if (chunks.length === 0) {
      return new Response(
        JSON.stringify({ error: "No audio data received from Edge TTS" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
    const audioData = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of chunks) {
      audioData.set(chunk, offset);
      offset += chunk.length;
    }

    return new Response(audioData.buffer, {
      headers: { ...corsHeaders, "Content-Type": "audio/mpeg" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
