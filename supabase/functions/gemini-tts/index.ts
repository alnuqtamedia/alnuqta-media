import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizeStudioOrigin, enforceStudioRateLimit } from "../_shared/studio-security.ts";

Deno.serve(async (req: Request) => {
  const security = authorizeStudioOrigin(req);
  if (security instanceof Response) return security;
  const { cors } = security;
  const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: cors });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const blocked = await enforceStudioRateLimit(req, "gemini-tts", cors);
  if (blocked) return blocked;

  try {
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return reply({ error: "GEMINI_API_KEY غير مفعّل." }, 503);
    const body = await req.json();
    const text = String(body?.text || "").trim();
    if (!text) return reply({ error: "لا يوجد نص للتعليق الصوتي." }, 400);
    const voice = String(body?.voice || "Charon");
    const style = String(body?.style || "صحفي وثائقي هادئ وواضح، بالعربية الفصحى الطبيعية، سرعة متوسطة، بلا مبالغة درامية");
    const prompt = `اقرأ النص التالي كما هو دون إضافة معلومات. الأداء: ${style}. النص:\n${text}`;
    const models = ["gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts"];
    let data: any = {};
    let model = "";
    let lastError = "";
    for (const candidate of models) {
      model = candidate;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } }),
      });
      const raw = await response.text();
      try { data = raw ? JSON.parse(raw) : {}; } catch { return reply({ error: "خدمة الصوت أعادت استجابة غير قابلة للقراءة." }, 502); }
      if (response.ok) break;
      lastError = data?.error?.message || `Gemini TTS HTTP ${response.status}`;
      const limited = response.status === 429 || /quota|rate.?limit|high demand/i.test(lastError);
      if (!limited) return reply({ error: lastError }, 502);
      data = {};
    }
    if (!Object.keys(data).length || data?.error) return reply({ error: lastError || "جميع نماذج الصوت مشغولة حالياً." }, 429);
    const part = data?.candidates?.[0]?.content?.parts?.find((item: any) => item?.inlineData?.data);
    if (!part) return reply({ error: "Gemini لم يُرجع ملفاً صوتياً." }, 502);
    return reply({ audio: part.inlineData.data, mimeType: part.inlineData.mimeType || "audio/L16;rate=24000", voice, model });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
