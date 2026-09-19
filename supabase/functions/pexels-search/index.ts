import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizeStudioOrigin, enforceStudioRateLimit } from "../_shared/studio-security.ts";

Deno.serve(async (req) => {
  const security = authorizeStudioOrigin(req);
  if (security instanceof Response) return security;
  const { cors } = security;
  const reply = (value: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(value), { status, headers: { ...cors, ...headers } });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const blocked = await enforceStudioRateLimit(req, "pexels-search", cors);
  if (blocked) return blocked;

  try {
    const key = Deno.env.get("PEXELS_API_KEY");
    if (!key) return reply({ error: "PEXELS_API_KEY غير مفعّل في Supabase Secrets.", needsKey: true }, 503);
    const body = await req.json();
    const query = String(body?.query || "").trim();
    const type = body?.type === "video" ? "video" : "photo";
    if (!query) return reply({ error: "لا يوجد وصف للبحث" }, 400);
    const url = type === "video"
      ? `https://api.pexels.com/v1/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=8`
      : `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=8`;
    const response = await fetch(url, { headers: { Authorization: key } });
    const data = await response.json();
    if (!response.ok) return reply({ error: data?.error || `Pexels HTTP ${response.status}` }, response.status);
    const items = type === "video"
      ? (data.videos || []).map((video: any) => {
          const files = (video.video_files || []).filter((item: any) => item.link);
          const file = files.sort((a: any, b: any) => (Math.abs((a.width || 0) - 1080) + Math.abs((a.height || 0) - 1920)) - (Math.abs((b.width || 0) - 1080) + Math.abs((b.height || 0) - 1920)))[0];
          return { id: video.id, type: "video", preview: video.image, mediaUrl: file?.link || "", pageUrl: video.url, creator: video.user?.name || "Pexels", creatorUrl: video.user?.url || "", duration: video.duration };
        })
      : (data.photos || []).map((photo: any) => ({ id: photo.id, type: "photo", preview: photo.src?.medium || photo.src?.portrait, mediaUrl: photo.src?.large2x || photo.src?.large || photo.src?.portrait, pageUrl: photo.url, creator: photo.photographer || "Pexels", creatorUrl: photo.photographer_url || "" }));
    return reply({ items, provider: "Pexels", remaining: response.headers.get("X-Ratelimit-Remaining"), reset: response.headers.get("X-Ratelimit-Reset") });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
