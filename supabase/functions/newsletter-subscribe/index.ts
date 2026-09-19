import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set(["https://alnuqtamedia.github.io", "http://localhost:8000", "http://127.0.0.1:8000"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function json(origin: string, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: {
    "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin",
  }});
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (!allowedOrigins.has(origin)) return json("https://alnuqtamedia.github.io", 403, { error: "origin_not_allowed" });
  if (req.method === "OPTIONS") return json(origin, 204, {});
  if (req.method !== "POST") return json(origin, 405, { error: "method_not_allowed" });

  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const source = ["homepage", "newsroom"].includes(body.source) ? body.source : "website";
    if (String(body.website || "").trim()) return json(origin, 200, { ok: true, confirmation_sent: false });
    if (!emailPattern.test(email) || email.length > 320 || body.consent !== true) return json(origin, 400, { error: "invalid_subscription" });

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client = createClient(url, serviceRole, { auth: { persistSession: false } });
    const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ipHash = await sha256(`${serviceRole.slice(-32)}:${forwarded}`);
    const { data: allowed, error: rateError } = await client.rpc("check_newsletter_rate", { p_ip_hash: ipHash });
    if (rateError) throw rateError;
    if (!allowed) return json(origin, 429, { error: "rate_limited" });

    const token = randomToken(), tokenHash = await sha256(token), expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await client.from("newsletter_subscribers").select("id,status").eq("email_normalized", email).maybeSingle();
    if (existing?.status === "active") return json(origin, 200, { ok: true, already_active: true });

    const payload = { email, source, status: "pending", consent_at: new Date().toISOString(), confirmation_token_hash: tokenHash, confirmation_expires_at: expires, unsubscribed_at: null, updated_at: new Date().toISOString() };
    const result = existing
      ? await client.from("newsletter_subscribers").update(payload).eq("id", existing.id)
      : await client.from("newsletter_subscribers").insert(payload);
    if (result.error) throw result.error;

    const resendKey = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("NEWSLETTER_FROM");
    let confirmationSent = false;
    if (resendKey && from) {
      const confirmUrl = `${url}/functions/v1/newsletter-preferences?action=confirm&token=${encodeURIComponent(token)}`;
      const mail = await fetch("https://api.resend.com/emails", { method: "POST", headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" }, body: JSON.stringify({
        from, to: [email], subject: "تأكيد الاشتراك في نشرة النقطة",
        html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8"><h2>تأكيد الاشتراك</h2><p>اضغط الرابط التالي لتأكيد اشتراكك في نشرة النقطة:</p><p><a href="${confirmUrl}">تأكيد البريد الإلكتروني</a></p><p>ينتهي الرابط خلال 24 ساعة.</p></div>`,
      }) });
      confirmationSent = mail.ok;
      if (!mail.ok) console.error("resend confirmation failed", mail.status);
    }

    return json(origin, 201, { ok: true, confirmation_sent: confirmationSent, pending_provider: !resendKey || !from });
  } catch (error) {
    console.error("newsletter-subscribe", error);
    return json(origin, 500, { error: "subscription_failed" });
  }
});

