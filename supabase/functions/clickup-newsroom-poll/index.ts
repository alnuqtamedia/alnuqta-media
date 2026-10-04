import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const LIST_ID = "1100310000082618";
const READY_STATUS = "جاهزة لغرفة الأخبار";
const SENT_STATUS = "أُرسلت إلى غرفة الأخبار";
const API_BASE = "https://api.clickup.com/api/v2";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

type ClickUpField = { name?: string; value?: unknown; type?: string; type_config?: { options?: Array<{ id?: string; name?: string; label?: string; orderindex?: number }> } };
type ClickUpTask = { id?: string; name?: string; description?: string; markdown_description?: string; url?: string; date_updated?: string; status?: { status?: string }; custom_fields?: ClickUpField[] };

function fieldValue(field: ClickUpField | undefined): unknown {
  if (!field || field.value === undefined || field.value === null) return "";
  const value = field.value;
  if (field.type === "drop_down") {
    const option = field.type_config?.options?.find((item) => String(item.id ?? item.orderindex ?? "") === String(value));
    return option?.name ?? option?.label ?? String(value);
  }
  if (field.type === "labels" && Array.isArray(value)) return value.map((id) => {
    const option = field.type_config?.options?.find((item) => String(item.id ?? item.orderindex ?? "") === String(id));
    return option?.name ?? option?.label ?? String(id);
  });
  if ((field.type === "users" || field.type === "people") && Array.isArray(value)) return value.map((user: Record<string, unknown>) => String(user.username ?? user.email ?? user.id ?? "")).filter(Boolean);
  return value;
}
function customMap(task: ClickUpTask) {
  const map = new Map<string, unknown>();
  for (const field of task.custom_fields ?? []) {
    const name = String(field.name ?? "").trim().toLowerCase();
    if (name) map.set(name, fieldValue(field));
  }
  return map;
}
function first(map: Map<string, unknown>, names: string[], fallback: unknown = ""): unknown {
  for (const name of names) {
    const value = map.get(name.toLowerCase());
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return fallback;
}
function textValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join(", ");
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  return String(value ?? "").trim();
}
function sourcesValue(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  const text = textValue(value);
  if (!text) return [];
  return text.split(/\r?\n|،|,/).map((item) => item.trim()).filter(Boolean);
}
function sectionValue(value: unknown): string {
  const raw = textValue(value).toLowerCase();
  const map: Record<string, string> = { "تحقيق":"investigation","تحقيقات":"investigation","تقرير":"report","تقارير":"report","خبر":"news","أخبار":"news","تحليل":"analysis","مقابلة":"interview","قصة إنسانية":"human-story","فيديو":"video","معرض صور":"gallery","مقال رأي":"opinion","رأي":"opinion" };
  return map[raw] ?? (["investigation","report","news","analysis","interview","human-story","video","gallery","opinion"].includes(raw) ? raw : "news");
}
function categoryValue(value: unknown): string {
  const raw = textValue(value).trim().toLowerCase();
  const map: Record<string,string> = {
    "سياسة":"politics","السياسة":"politics","سياسي":"politics",
    "أخبار العالم":"world","العالم":"world","عالمي":"world",
    "اقتصاد":"economy","الاقتصاد":"economy","اقتصادي":"economy","اقتصاد ومال عام":"economy","economy-public-money":"economy",
    "أخبار العراق":"iraq","العراق":"iraq","عراقي":"iraq",
    "رياضة":"sports","الرياضة":"sports","رياضي":"sports",
    "الفن":"arts","ثقافة وفنون":"arts","ثقافة":"arts","culture-arts":"arts",
    "المنوعات":"misc","منوعات":"misc","field-social":"misc","travel-tourism":"misc","human-stories":"misc"
  };
  return map[raw] ?? (["politics","world","economy","iraq","sports","arts","misc"].includes(raw) ? raw : "misc");
}
function affirmative(value: unknown): boolean {
  const v = textValue(value).toLowerCase();
  return ["نعم","موافق","مكتمل","مدقق","تم","جاهز","yes","true","approved","complete","completed"].includes(v);
}
const INTERNAL_MARKERS = [
  "حالة تدقيق الحقائق", "بانتظار التدقيق", "حالة النشر المطلوبة", "النشر العام", "ممنوع قبل موافقة",
  "موافقة المالك", "بيانات المادة", "مادة عاجلة", "ادعاءات حساسة", "جاهز للنشر", "review /"
];
function bodyHasInternalWorkflow(body: string): boolean {
  const normalized = body.toLowerCase();
  return INTERNAL_MARKERS.some((marker) => normalized.includes(marker.toLowerCase()));
}
function validate(fields: Map<string, unknown>, body: string, section: string, sources: unknown[], image: string, credit: string) {
  const errors: string[] = [];
  const factCheck = first(fields, ["حالة تدقيق الحقائق","تدقيق الحقائق"]);
  if (!body) errors.push("missing_publishable_body");
  if (bodyHasInternalWorkflow(body)) errors.push("internal_workflow_text_in_body");
  if (textValue(factCheck) && !affirmative(factCheck)) errors.push("fact_check_not_complete");
  if (["investigation","report","analysis"].includes(section) && sources.length === 0) errors.push("sources_required");
  if (image && !credit) errors.push("image_credit_required");
  return errors;
}
async function markTaskSent(token: string, taskId: string) {
  const response = await fetch(`${API_BASE}/task/${encodeURIComponent(taskId)}`, { method:"PUT", headers:{ Authorization:token, "content-type":"application/json" }, body:JSON.stringify({status:SENT_STATUS}) });
  if (!response.ok) throw new Error(`ClickUp status update ${response.status}: ${(await response.text()).slice(0,300)}`);
}
async function fetchReadyTasks(token: string): Promise<ClickUpTask[]> {
  const all: ClickUpTask[] = [];
  for (let page=0; page<20; page++) {
    const url = new URL(`${API_BASE}/list/${LIST_ID}/task`);
    url.searchParams.set("page",String(page)); url.searchParams.set("include_closed","true"); url.searchParams.set("include_markdown_description","true"); url.searchParams.append("statuses[]",READY_STATUS);
    const response = await fetch(url,{headers:{Authorization:token,"content-type":"application/json"}});
    if (!response.ok) throw new Error(`ClickUp API ${response.status}: ${(await response.text()).slice(0,300)}`);
    const payload = await response.json() as {tasks?:ClickUpTask[]}; const tasks=payload.tasks??[]; all.push(...tasks); if(tasks.length<100) break;
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ok:false,error:"method_not_allowed"},405);
  const clickupToken=Deno.env.get("CLICKUP_TOKEN")??"";
  const supabaseUrl=Deno.env.get("SUPABASE_URL")??"";
  const serviceRoleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
  if(!clickupToken)return json({ok:false,error:"clickup_token_not_configured"},503);
  if(!supabaseUrl||!serviceRoleKey)return json({ok:false,error:"database_not_configured"},503);
  const supabase=createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});
  try {
    const tasks=await fetchReadyTasks(clickupToken); const results:Array<Record<string,unknown>>=[];
    for(const task of tasks){
      const taskId=textValue(task.id),title=textValue(task.name);
      if(!taskId||!title||textValue(task.status?.status)!==READY_STATUS)continue;
      const fields=customMap(task);
      const body=textValue(first(fields,["النص الكامل للنشر","النص الكامل"],task.markdown_description??task.description??""));
      const section=sectionValue(first(fields,["النوع الصحفي"],"news"));
      const sources=sourcesValue(first(fields,["المصادر والروابط المرجعية","المصادر"]));
      const image=textValue(first(fields,["الصورة البارزة"]));
      const credit=textValue(first(fields,["حقوق الصورة","حقوقها"]));
      const errors=validate(fields,body,section,sources,image,credit);
      if(errors.length){
        console.warn("clickup task rejected by editorial gate",{taskId,errors});
        results.push({task_id:taskId,ok:false,error:"editorial_gate_failed",reasons:errors});
        continue;
      }
      const payload={task_id:taskId,title,workflow_status:READY_STATUS,task_url:textValue(task.url),version:textValue(task.date_updated),subtitle:textValue(first(fields,["العنوان الفرعي"])),excerpt:textValue(first(fields,["الملخص"])),body,section,category:categoryValue(first(fields,["القسم التحريري"])),image,cover_image_url:image,cover_image_caption:textValue(first(fields,["وصف الصورة"])),cover_image_credit:credit,methodology:textValue(first(fields,["المنهجية"])),right_of_reply:textValue(first(fields,["حق الرد"])),sources};
      const {data,error}=await supabase.rpc("ingest_clickup_article",{p_payload:payload});
      if(error){console.error("poll ingest failed",{taskId,code:error.code,message:error.message});results.push({task_id:taskId,ok:false,error:"sync_failed"});}
      else {try{await markTaskSent(clickupToken,taskId);results.push({task_id:taskId,ok:true,clickup_status:SENT_STATUS,result:data});}catch(statusError){console.error("poll status update failed",{taskId,error:String(statusError)});results.push({task_id:taskId,ok:true,clickup_status:"update_failed",result:data});}}
    }
    return json({ok:true,list_id:LIST_ID,ready_status:READY_STATUS,found:tasks.length,processed:results.length,failed:results.filter(i=>i.ok===false).length,results});
  } catch(error){console.error("clickup polling failed",error);return json({ok:false,error:"poll_failed"},502);}
});
