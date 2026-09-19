import { createClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_STUDIO_ORIGIN = "https://alnuqtamedia.github.io";
const FUNCTION_NAMES = new Set([
  "gemini-studio",
  "gemini-image",
  "pexels-search",
  "gemini-tts",
]);

export type StudioSecurity = {
  origin: string;
  cors: Record<string, string>;
};

function allowedOrigins(): Set<string> {
  const configured = (Deno.env.get("STUDIO_ALLOWED_ORIGINS") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set([DEFAULT_STUDIO_ORIGIN, ...configured]);
}

export function authorizeStudioOrigin(req: Request): StudioSecurity | Response {
  const origin = req.headers.get("origin") || "";
  if (!allowedOrigins().has(origin)) {
    return new Response(JSON.stringify({ error: "origin_not_allowed" }), {
      status: 403,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Vary": "Origin",
      },
    });
  }

  return {
    origin,
    cors: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Content-Type": "application/json; charset=utf-8",
      "Vary": "Origin",
    },
  };
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function enforceStudioRateLimit(
  req: Request,
  functionName: string,
  cors: Record<string, string>,
  limit = 20,
): Promise<Response | null> {
  if (!FUNCTION_NAMES.has(functionName)) {
    return new Response(JSON.stringify({ error: "invalid_function_name" }), {
      status: 500,
      headers: cors,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "rate_limit_unavailable" }), {
      status: 503,
      headers: cors,
    });
  }

  const forwarded =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const salt = Deno.env.get("RATE_LIMIT_SALT") || serviceRoleKey.slice(-32);
  const ipHash = await sha256(`${salt}:${forwarded}`);
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.rpc("check_studio_function_rate_limit", {
    p_function_name: functionName,
    p_ip_hash: ipHash,
    p_limit: limit,
    p_window_seconds: 3600,
  });

  if (error) {
    console.error("studio rate limit failed", error.message);
    return new Response(JSON.stringify({ error: "rate_limit_unavailable" }), {
      status: 503,
      headers: cors,
    });
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.allowed) {
    const retryAfter = Math.max(1, Number(result?.retry_after_seconds) || 3600);
    return new Response(JSON.stringify({ error: "rate_limit_exceeded" }), {
      status: 429,
      headers: { ...cors, "Retry-After": String(retryAfter) },
    });
  }

  return null;
}
