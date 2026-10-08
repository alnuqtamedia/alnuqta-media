import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import {issue,subject,content} from "./issue.js";
const origin="https://alnuqtamedia.com";
const headers={"Content-Type":"application/json; charset=utf-8","Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"content-type, authorization, apikey","Access-Control-Allow-Methods":"POST, OPTIONS","Cache-Control":"no-store","Vary":"Origin"};
const json=(status,data)=>new Response(JSON.stringify(data),{status,headers});
async function tokenFor(secret,row){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('newsletter-unsubscribe:v1:'+row.id+':'+row.consent_at)));return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
async function hash(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('');}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return json(405,{error:'method_not_allowed'});
 if(req.headers.get('origin')!==origin)return json(403,{error:'origin_not_allowed'});
 try{
  const authorization=req.headers.get('authorization')||'';
  if(!authorization.startsWith('Bearer '))return json(401,{error:'unauthorized'});
  const url=Deno.env.get('SUPABASE_URL'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const userClient=createClient(url,Deno.env.get('SUPABASE_ANON_KEY'),{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
  const {data:user,error:authError}=await userClient.auth.getUser();
  if(authError||!user.user)return json(401,{error:'unauthorized'});
  const {data:role,error:roleError}=await userClient.rpc('current_user_role');
  if(roleError||role!=='owner')return json(403,{error:'owner_required'});
  const client=createClient(url,secret,{auth:{persistSession:false}}),body=await req.json();
  if(body.mode==='preview'){
   const a=await client.from('newsletter_subscribers').select('id',{count:'exact',head:true}).eq('status','active').not('confirmed_at','is',null);
   const d=await client.from('newsletter_deliveries').select('subscriber_id',{count:'exact',head:true}).eq('issue',issue).eq('state','sent');
   if(a.error||d.error)return json(500,{error:'preview_failed'});
   return json(200,{active:a.count,sent:d.count,subject,issue});
  }
  if(body.mode!=='send'||body.issue!==issue||body.approval!==true)return json(400,{error:'approval_required'});
  const claims=JSON.parse(atob(authorization.slice(7).split('.')[1].replaceAll('-','+').replaceAll('_','/')));
  if(claims.aal!=='aal2')return json(403,{error:'aal2_required'});
  const key=Deno.env.get('RESEND_API_KEY'),from=Deno.env.get('NEWSLETTER_FROM');
  if(!key||!from)return json(503,{error:'mail_not_configured'});
  // Select only recipients not previously claimed. Claims remain after uncertain results.
  const delivered=await client.from('newsletter_deliveries').select('subscriber_id').eq('issue',issue);
  if(delivered.error)return json(500,{error:'delivery_lookup_failed'});
  const prior=new Set((delivered.data||[]).map(x=>x.subscriber_id));
  const rows=await client.from('newsletter_subscribers').select('id,email,consent_at').eq('status','active').not('confirmed_at','is',null).order('id').limit(1000);
  if(rows.error)return json(500,{error:'recipient_lookup_failed'});
  let sent=0,failed=0,skipped=0;
  for(const row of (rows.data||[]).filter(x=>!prior.has(x.id)).slice(0,5)){
   const claim=await client.from('newsletter_deliveries').insert({issue,subscriber_id:row.id,state:'processing'});
   if(claim.error){if(claim.error.code==='23505'){skipped++;continue;}return json(500,{error:'delivery_claim_failed',sent,failed,skipped});}
   const token=await tokenFor(secret,row),tokenHash=await hash(token);
   const current=await client.from('newsletter_subscribers').update({unsubscribe_token_hash:tokenHash}).eq('id',row.id).eq('status','active').eq('consent_at',row.consent_at).select('id');
   if(current.error||!current.data?.length){await client.from('newsletter_deliveries').update({state:'skipped'}).eq('issue',issue).eq('subscriber_id',row.id);skipped++;continue;}
   const link=url+'/functions/v1/newsletter-unsubscribe?token='+encodeURIComponent(token);
   try{
    const mail=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(12000),headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':issue+'/'+row.id},body:JSON.stringify({from,to:[row.email],subject,html:content+'<hr><p><a href="'+link+'">إلغاء الاشتراك في النشرة</a></p></div>'})});
    const state=mail.ok?'sent':'failed';await client.from('newsletter_deliveries').update({state}).eq('issue',issue).eq('subscriber_id',row.id);
    if(mail.ok)sent++;else failed++;
   }catch{failed++;/* Unknown delivery remains processing; never retry automatically. */}
   await new Promise(resolve=>setTimeout(resolve,600));
  }
  return json(200,{sent,failed,skipped});
 }catch{return json(500,{error:'dispatch_failed'});}
});
