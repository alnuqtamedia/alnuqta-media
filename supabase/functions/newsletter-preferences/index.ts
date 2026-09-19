import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
const page = (title: string, text: string, ok = true) => new Response(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title><body style="font-family:Arial;background:#071426;color:white;display:grid;place-items:center;min-height:100vh;margin:0"><main style="max-width:560px;padding:32px;border:1px solid #28415e;border-radius:18px;background:#0d2038"><h1 style="color:${ok ? "#59d39a" : "#ef3340"}">${title}</h1><p style="line-height:1.9">${text}</p><a href="https://alnuqtamedia.github.io/alnuqta-media/" style="color:#fff">العودة إلى النقطة</a></main></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });

Deno.serve(async (req: Request) => {
  const params = new URL(req.url).searchParams, action = params.get("action"), token = params.get("token") || "";
  if (action !== "confirm" || token.length < 32) return page("رابط غير صالح", "الرابط غير مكتمل أو انتهت صلاحيته.", false);
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const tokenHash = await sha256(token);
  const { data, error } = await client.from("newsletter_subscribers").select("id,status,confirmation_expires_at").eq("confirmation_token_hash", tokenHash).maybeSingle();
  if (error || !data || !data.confirmation_expires_at || new Date(data.confirmation_expires_at) < new Date()) return page("الرابط منتهي", "اطلب اشتراكاً جديداً للحصول على رابط تأكيد جديد.", false);
  if (data.status === "active") return page("الاشتراك مؤكد", "بريدك مشترك بالفعل في نشرة النقطة.");
  const { error: updateError } = await client.from("newsletter_subscribers").update({ status: "active", confirmed_at: new Date().toISOString(), confirmation_token_hash: null, confirmation_expires_at: null, updated_at: new Date().toISOString() }).eq("id", data.id);
  return updateError ? page("تعذر التأكيد", "حاول مرة أخرى لاحقاً.", false) : page("تم تأكيد الاشتراك", "ستصلك أحدث تحقيقات وتقارير النقطة بعد إطلاق النشرة.");
});
