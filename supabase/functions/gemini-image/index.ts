import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizeStudioOrigin, enforceStudioRateLimit } from "../_shared/studio-security.ts";

Deno.serve(async (req) => {
  const security = authorizeStudioOrigin(req);
  if (security instanceof Response) return security;
  const { cors } = security;
  const reply = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), { status, headers: cors });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const blocked = await enforceStudioRateLimit(req, "gemini-image", cors);
  if (blocked) return blocked;

  try {
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return reply({ error: "GEMINI_API_KEY غير مفعّل" }, 503);
    const body = await req.json();
    const prompt = String(body?.prompt || "").trim();
    if (!prompt) return reply({ error: "لا يوجد وصف للصورة" }, 400);
    const safe = "Create a vertical 9:16 editorial illustrative image for a journalistic video. No text, logos or watermarks. Do not fabricate documentary evidence, official documents, or portray an invented event as a real photograph. If the request concerns a real sensitive event/person, make the scene clearly generic and illustrative. Visual brief: " + prompt;
    const models = (Deno.env.get("GEMINI_IMAGE_MODELS") || "gemini-3.1-flash-image,gemini-2.5-flash-image")
      .split(",").map((value) => value.trim()).filter(Boolean).slice(0, 3);
    let data: any = null, usedModel = "", lastError = "فشل توليد الصورة", lastCode: string | number = 502;
    for (const model of models) {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ model, input: [{ type: "text", text: safe }], response_format: { type: "image", mime_type: "image/jpeg", aspect_ratio: "9:16", image_size: "1K" } }),
      });
      const raw = await response.text();
      try { data = JSON.parse(raw); } catch { data = null; }
      if (response.ok) { usedModel = model; break; }
      lastError = data?.error?.message || "فشل توليد الصورة";
      lastCode = data?.error?.code || response.status;
      const canFallback = response.status === 404 || response.status === 429 || /quota|rate.?limit|not found/i.test(lastError);
      if (!canFallback) return reply({ error: lastError, code: lastCode }, 502);
    }
    if (!usedModel) return reply({ error: lastError, code: lastCode, triedModels: models }, 502);
    let image = data?.output_image;
    if (!image?.data) for (const step of data?.steps || []) {
      if (step?.type === "model_output") for (const part of step?.content || []) if (part?.type === "image" && part?.data) { image = part; break; }
      if (image?.data) break;
    }
    if (!image?.data) return reply({ error: "Gemini لم يرجع بيانات صورة", responseTypes: (data?.steps || []).map((item: any) => item?.type).filter(Boolean) }, 502);
    return reply({ image: image.data, mimeType: image.mime_type || image.mimeType || "image/jpeg", label: "صورة مولدة بالذكاء الاصطناعي — توضيحية", model: usedModel });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
