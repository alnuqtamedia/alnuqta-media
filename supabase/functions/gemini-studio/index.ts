import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizeStudioOrigin, enforceStudioRateLimit } from "../_shared/studio-security.ts";

const SYSTEM = `أنت مساعد الإنتاج الصحفي في استوديو النقطة Media. نفّذ أمر المستخدم على المحتوى الحالي فقط ولا تخترع حقائق أو أرقاماً أو مصادر. أرجع JSON صالح فقط بلا markdown بالمفاتيح action, outputType, title, subtitle, slides.
للـ carousel/post/report/youtube_thumbnail استخدم slides المناسبة.
إذا كان outputType واحداً من video,reel,tiktok,story فابنِ Storyboard صحفياً حقيقياً لا سلايدات عامة: 5 إلى 8 مشاهد عند الإمكان، وكل مشهد يجب أن يحتوي type,title,header,subtitle,points,duration,voiceover,visualType,visualQuery,motion,transition,cta. اجعل أول مشهد Hook قصيراً وقوياً، المشاهد الوسطى توزع المعلومة دون تكرار، ويجب ألا يتكرر عنوان أو فكرة جوهرية بين مشهدين. استخدم visualType مختلفاً عندما يخدم المادة، ولا تستخدم document/data/map إلا إذا كان المحتوى نفسه يدعم ذلك، والأخير خاتمة/CTA. duration بالثواني ويجب أن تتناسب مع المدة التي طلبها المستخدم إن ذكرها. voiceover نص تعليق صوتي طبيعي ومختصر. إذا طلب المستخدم مدة محددة، التزم بميزانية كلام تقريبية 2.0 إلى 2.3 كلمة عربية في الثانية (مثلاً 30 ثانية = نحو 60 إلى 69 كلمة لكل التعليق كاملاً)، واختصر قبل الإرجاع إذا تجاوزت الميزانية. اجعل النص الظاهر أقصر بكثير من voiceover ولا تكرر الجملة نفسها بصرياً وصوتياً. visualType يصف نوع المادة البصرية مثل broll/document/data/map/portrait/text-only، وvisualQuery وصف بحث بصري فقط ولا تدّعِ وجود صورة أو وثيقة غير متاحة. motion أحد zoom-in,zoom-out,pan-left,pan-right,static وtransition أحد fade,cut,slide. لا تضع توقيتات مكتوبة مثل 00:05 داخل title أو subtitle أو points.`;

function extractText(data: any): string {
  const chunks: string[] = [];
  for (const step of data?.steps || []) if (step?.type === "model_output") {
    for (const part of step?.content || []) if (typeof part?.text === "string") chunks.push(part.text);
  }
  if (typeof data?.output === "string") chunks.push(data.output);
  if (typeof data?.text === "string") chunks.push(data.text);
  return chunks.join("").trim();
}

Deno.serve(async (req: Request) => {
  const security = authorizeStudioOrigin(req);
  if (security instanceof Response) return security;
  const { cors } = security;
  const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: cors });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const blocked = await enforceStudioRateLimit(req, "gemini-studio", cors);
  if (blocked) return blocked;

  try {
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return reply({ error: "GEMINI_API_KEY غير مفعّل." }, 503);
    const body = await req.json();
    const command = String(body?.command || "").trim();
    if (!command) return reply({ error: "اكتب الأمر أولاً." }, 400);
    const models = [Deno.env.get("GEMINI_MODEL") || "gemini-3.6-flash", Deno.env.get("GEMINI_FALLBACK_MODEL") || "gemini-3.5-flash-lite"].filter((model, index, all) => model && all.indexOf(model) === index);
    const input = `${SYSTEM}\nالمحتوى:\n${JSON.stringify(body?.currentContent || {})}\nالأمر:\n${command}`;
    let data: any = {};
    let raw = "";
    let lastError = "";
    for (const model of models) {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ model, input }),
      });
      raw = await response.text();
      try { data = raw ? JSON.parse(raw) : {}; } catch { return reply({ error: "Gemini أعاد استجابة غير قابلة للقراءة." }, 502); }
      if (response.ok) break;
      lastError = data?.error?.message || `Gemini HTTP ${response.status}`;
      const limited = response.status === 429 || /quota|rate.?limit|high demand/i.test(lastError);
      if (!limited) return reply({ error: lastError, details: raw.slice(0, 300) }, 502);
      data = {};
    }
    if (!Object.keys(data).length || data?.error) return reply({ error: lastError || "جميع نماذج Gemini مشغولة حالياً.", details: raw.slice(0, 300) }, 429);
    const output = extractText(data).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    if (!output) return reply({ error: "Gemini لم يُرجع محتوى. أعد المحاولة." }, 502);
    try { return reply(JSON.parse(output)); } catch { return reply({ error: "Gemini أعاد JSON غير مكتمل. أعد المحاولة.", details: output.slice(0, 250) }, 502); }
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
