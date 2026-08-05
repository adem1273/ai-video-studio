import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { storeUserApiKey, deleteUserApiKey, getUserKeySuffix } from "../_shared/keyResolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SERVICES = ["groq", "gemini", "pexels", "pixabay"] as const;
type ServiceName = (typeof SERVICES)[number];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userToken = authHeader.replace("Bearer ", "");

    if (!userToken) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const url = new URL(req.url);
    const method = req.method;

    if (method === "GET") {
      const suffixes: Record<string, string | null> = {};
      for (const svc of SERVICES) {
        suffixes[svc] = await getUserKeySuffix(svc as ServiceName, userToken);
      }
      return new Response(
        JSON.stringify({ keys: suffixes }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (method === "POST") {
      const body = await req.json();
      const { service, apiKey } = body as { service: string; apiKey: string };

      if (!service || !SERVICES.includes(service as ServiceName)) {
        return new Response(
          JSON.stringify({ error: "Invalid service name" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (!apiKey || apiKey.trim().length < 8) {
        return new Response(
          JSON.stringify({ error: "API key too short" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const success = await storeUserApiKey(service as ServiceName, apiKey.trim(), userToken);
      if (!success) {
        return new Response(
          JSON.stringify({ error: "Failed to save API key. Encryption may not be configured." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const suffix = apiKey.trim().slice(-4);
      return new Response(
        JSON.stringify({ success: true, suffix }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (method === "DELETE") {
      const service = url.searchParams.get("service");
      if (!service || !SERVICES.includes(service as ServiceName)) {
        return new Response(
          JSON.stringify({ error: "Invalid service name" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const success = await deleteUserApiKey(service as ServiceName, userToken);
      return new Response(
        JSON.stringify({ success }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
