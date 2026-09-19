import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://alnuqtamedia.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
]);
const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const maxFileSize = 10 * 1024 * 1024;

function response(origin: string, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    },
  });
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (!allowedOrigins.has(origin)) return response("https://alnuqtamedia.github.io", 403, { error: "origin_not_allowed" });
  if (req.method === "OPTIONS") return response(origin, 204, {});
  if (req.method !== "POST") return response(origin, 405, { error: "method_not_allowed" });

  try {
    const contentLength = Number(req.headers.get("content-length") || "0");
    if (contentLength > maxFileSize + 100_000) return response(origin, 413, { error: "request_too_large" });

    const form = await req.formData();
    const subject = String(form.get("subject") || "").trim();
    const details = String(form.get("details") || "").trim();
    const honeypot = String(form.get("website") || "").trim();
    const consent = String(form.get("consent") || "");
    const attachment = form.get("attachment");

    if (honeypot) return response(origin, 200, { ok: true });
    if (subject.length < 5 || subject.length > 160 || details.length < 50 || details.length > 10000 || consent !== "yes") {
      return response(origin, 400, { error: "invalid_submission" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
    const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ipHash = await sha256(`${serviceRole.slice(-32)}:${forwarded}`);
    const { data: allowed, error: rateError } = await client.rpc("check_source_submission_rate", { p_ip_hash: ipHash });
    if (rateError) throw rateError;
    if (!allowed) return response(origin, 429, { error: "rate_limited" });

    const id = crypto.randomUUID();
    let attachmentPath: string | null = null;
    let attachmentName: string | null = null;
    let attachmentType: string | null = null;
    let attachmentSize: number | null = null;

    if (attachment instanceof File && attachment.size > 0) {
      if (attachment.size > maxFileSize || !allowedTypes.has(attachment.type)) {
        return response(origin, 400, { error: "invalid_attachment" });
      }
      const extension = ({
        "application/pdf": "pdf",
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
      } as Record<string, string>)[attachment.type];
      attachmentPath = `${id}/document.${extension}`;
      const { error: uploadError } = await client.storage.from("source-submissions").upload(attachmentPath, attachment, {
        contentType: attachment.type,
        upsert: false,
      });
      if (uploadError) throw uploadError;
      attachmentName = attachment.name.slice(0, 180);
      attachmentType = attachment.type;
      attachmentSize = attachment.size;
    }

    const { error: insertError } = await client.from("source_submissions").insert({
      id,
      subject,
      details,
      attachment_path: attachmentPath,
      attachment_name: attachmentName,
      attachment_type: attachmentType,
      attachment_size: attachmentSize,
    });
    if (insertError) {
      if (attachmentPath) await client.storage.from("source-submissions").remove([attachmentPath]);
      throw insertError;
    }

    return response(origin, 201, { ok: true, reference: id.slice(0, 8) });
  } catch (error) {
    console.error("source-submit", error);
    return response(origin, 500, { error: "submission_failed" });
  }
});

