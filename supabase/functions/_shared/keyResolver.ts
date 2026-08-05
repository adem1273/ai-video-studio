// Shared helper for edge functions to resolve user-specific API keys.
// Checks user_api_keys table first (user's own key), then falls back to
// the global Deno.env secret. Uses pgcrypto for decryption.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const KEY_ENCRYPTION_SECRET = Deno.env.get("KEY_ENCRYPTION_SECRET") ?? "";

export async function resolveApiKey(
  service: "groq" | "gemini" | "pexels" | "pixabay",
  userToken?: string,
): Promise<{ key: string | null; source: "user" | "global" | "none" }> {
  if (userToken && KEY_ENCRYPTION_SECRET) {
    try {
      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });

      const { data: userData, error: userErr } = await supabase.auth.getUser(userToken);
      if (userErr || !userData.user) {
        // fall through to global
      } else {
        const userId = userData.user.id;

        const { data, error } = await supabase
          .from("user_api_keys")
          .select("encrypted_key")
          .eq("user_id", userId)
          .eq("service_name", service)
          .maybeSingle();

        if (!error && data?.encrypted_key) {
          const { data: decrypted, error: decErr } = await supabase
            .rpc("decrypt_api_key", {
              encrypted: data.encrypted_key,
              secret: KEY_ENCRYPTION_SECRET,
            });

          if (!decErr && decrypted) {
            return { key: decrypted as string, source: "user" };
          }
        }
      }
    } catch {
      // fall through to global
    }
  }

  const envMap: Record<string, string | undefined> = {
    groq: Deno.env.get("GROQ_API_KEY"),
    gemini: Deno.env.get("GEMINI_API_KEY"),
    pexels: Deno.env.get("PEXELS_API_KEY"),
    pixabay: Deno.env.get("PIXABAY_API_KEY") ?? "56875494-83df8d651c3899cd7be18d320",
  };

  const globalKey = envMap[service];
  if (globalKey) return { key: globalKey, source: "global" };

  return { key: null, source: "none" };
}

export async function storeUserApiKey(
  service: "groq" | "gemini" | "pexels" | "pixabay",
  plainKey: string,
  userToken: string,
): Promise<boolean> {
  if (!KEY_ENCRYPTION_SECRET) return false;

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser(userToken);
    if (userErr || !userData.user) return false;

    const userId = userData.user.id;
    const suffix = plainKey.slice(-4);

    const { data: encrypted, error: encErr } = await supabase
      .rpc("encrypt_api_key", { plain: plainKey, secret: KEY_ENCRYPTION_SECRET });

    if (encErr || !encrypted) return false;

    const { error: upsertErr } = await supabase
      .from("user_api_keys")
      .upsert(
        {
          user_id: userId,
          service_name: service,
          encrypted_key: encrypted,
          key_suffix: suffix,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,service_name" },
      );

    return !upsertErr;
  } catch {
    return false;
  }
}

export async function deleteUserApiKey(
  service: "groq" | "gemini" | "pexels" | "pixabay",
  userToken: string,
): Promise<boolean> {
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser(userToken);
    if (userErr || !userData.user) return false;

    const { error } = await supabase
      .from("user_api_keys")
      .delete()
      .eq("user_id", userData.user.id)
      .eq("service_name", service);

    return !error;
  } catch {
    return false;
  }
}

export async function getUserKeySuffix(
  service: "groq" | "gemini" | "pexels" | "pixabay",
  userToken: string,
): Promise<string | null> {
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser(userToken);
    if (userErr || !userData.user) return null;

    const { data, error } = await supabase
      .from("user_api_keys")
      .select("key_suffix")
      .eq("user_id", userData.user.id)
      .eq("service_name", service)
      .maybeSingle();

    if (error || !data) return null;
    return data.key_suffix || null;
  } catch {
    return null;
  }
}
