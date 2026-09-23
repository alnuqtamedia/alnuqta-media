import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const EXPECTED_SECRET_SHA256="3e7ae98292a6c0353f3fdd0111f2d8f86ea1c553f0a6f65cd5ab87ee107fc276";
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const sha256=async(value:string)=>{const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(d)).map(b=>b.toString(16).padStart(2,"0")).join("");};
const safeEqual=(a:string,b:string)=>{if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;};
Deno.serve(async(req)=>{
 if(req.method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
 const supplied=req.headers.get("x-alnuqta-webhook-secret")??"";
 if(!supplied||!safeEqual(await sha256(supplied),EXPECTED_SECRET_SHA256))return json({ok:false,error:"forbidden"},403);
 if(!(req.headers.get("content-type")??"").toLowerCase().includes("application/json"))return json({ok:false,error:"json_required"},415);
 if(Number(req.headers.get("content-length")??"0")>1_000_000)return json({ok:false,error:"payload_too_large"},413);
 let payload:Record<string,unknown>;try{payload=await req.json();}catch{return json({ok:false,error:"invalid_json"},400);}
 const workflowStatus=String(payload.workflow_status??payload.status??"").trim();
 if(workflowStatus!=="جاهزة لغرفة الأخبار")return json({ok:true,action:"ignored",reason:"workflow_status_not_ready"},202);
 const taskId=String(payload.task_id??"").trim(),title=String(payload.title??"").trim();
 if(!taskId||taskId.length>100||!title||title.length>300)return json({ok:false,error:"invalid_required_fields"},422);
 const secretKeysRaw=Deno.env.get("SUPABASE_SECRET_KEYS"),legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 let adminKey=legacy??"";if(secretKeysRaw){try{adminKey=JSON.parse(secretKeysRaw).default??adminKey;}catch{}}
 const url=Deno.env.get("SUPABASE_URL")??"";if(!url||!adminKey)return json({ok:false,error:"database_not_configured"},503);
 const supabase=createClient(url,adminKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const normalized={task_id:taskId,title,workflow_status:workflowStatus,task_url:String(payload.task_url??"").trim(),version:String(payload.version??payload.date_updated??"").trim(),subtitle:String(payload.subtitle??"").trim(),excerpt:String(payload.excerpt??payload.summary??"").trim(),body:String(payload.body??payload.full_text??"").trim(),section:String(payload.section??"news").trim(),category:String(payload.category??"").trim(),image:String(payload.image??payload.cover_image_url??"").trim(),cover_image_url:String(payload.cover_image_url??payload.image??"").trim(),cover_image_caption:String(payload.cover_image_caption??"").trim(),cover_image_credit:String(payload.cover_image_credit??"").trim(),methodology:String(payload.methodology??"").trim(),right_of_reply:String(payload.right_of_reply??"").trim(),sources:Array.isArray(payload.sources)?payload.sources:[]};
 const{data,error}=await supabase.rpc("ingest_clickup_article",{p_payload:normalized});
 if(error){console.error("clickup ingest failed",{code:error.code,message:error.message});return json({ok:false,error:"sync_failed"},500);}
 return json(data,200);
});