import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const origin = "https://alnuqtamedia.com";
const cors = { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
const json = (status: number, data: unknown) => new Response(JSON.stringify(data), {status, headers:{...cors,"Content-Type":"application/json; charset=utf-8"}});
const validToken = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, {status:204,headers:cors});
  // Opening a link never changes consent: email scanners may visit links automatically.
  if (req.method === "GET") {
    const token = new URL(req.url).searchParams.get("token") || "";
    const destination = validToken(token) ? `${origin}/newsletter-unsubscribe.html#token=${encodeURIComponent(token)}` : `${origin}/newsletter-result.html?status=invalid`;
    return new Response(null, {status:303,headers:{"Location":destination,"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
  }
  if (req.method !== "POST") return json(405,{error:"method_not_allowed"});
  if (req.headers.get("origin") !== origin) return json(403,{error:"origin_not_allowed"});
  try {
    const {token,confirm} = await req.json();
    if (typeof token !== "string" || !validToken(token) || confirm !== true) return json(400,{error:"invalid_request"});
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token)))).map(b=>b.toString(16).padStart(2,"0")).join("");
    const client = createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
    const {data,error} = await client.from("newsletter_subscribers").select("id,status").eq("unsubscribe_token_hash",hash).maybeSingle();
    if (error) return json(500,{error:"unsubscribe_failed"});
    if (!data) return json(400,{error:"invalid_link"});
    if (data.status !== "unsubscribed") {
      const now = new Date().toISOString();
      const result = await client.from("newsletter_subscribers").update({status:"unsubscribed",unsubscribed_at:now,confirmation_token_hash:null,confirmation_expires_at:null,updated_at:now}).eq("id",data.id).eq("unsubscribe_token_hash",hash).select("id");
      if (result.error) return json(500,{error:"unsubscribe_failed"});
      if (!result.data?.length) return json(400,{error:"invalid_link"});
    }
    return json(200,{ok:true,status:"unsubscribed"});
  } catch {return json(400,{error:"invalid_request"});}
});
