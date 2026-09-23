import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const LIST_ID = "1100310000082618";
const READY_STATUS = "جاهزة لغرفة الأخبار";
const SENT_STATUS = "أُرسلت إلى غرفة الأخبار";
const API_BASE = "https://api.clickup.com/api/v2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

type ClickUpField = {
  name?: string;
  value?: unknown;
  type?: string;
  type_config?: { options?: Array<{ id?: string; name?: string; label?: string; orderindex?: number }> };
};

type ClickUpTask = {
  id?: string;
  name?: string;
  description?: string;
  markdown_description?: string;
  url?: string;
  date_updated?: string;
  status?: { status?: string };
  custom_fields?: ClickUpField[];
};

function fieldValue(field: ClickUpField | undefined): unknown {
  if (!field || field.value === undefined || field.value === null) return "";
  const value = field.value;
  if (field.type === "drop_down") {
    const option = field.type_config?.options?.find((item) =>
      String(item.id ?? item.orderindex ?? "") === String(value)
    );
    return option?.name ?? option?.label ?? String(value);
  }
  if (field.type === "labels" && Array.isArray(value)) {
    return value.map((id) => {
      const option = field.type_config?.options?.find((item) =>
        String(item.id ?? item.orderindex ?? "") === String(id)
      );
      return option?.name ?? option?.label ?? String(id);
    });
  }
  if ((field.type === "users" || field.type === "people") && Array.isArray(value)) {
    return value.map((user: Record<string, unknown>) =>
      String(user.username ?? user.email ?? user.id ?? "")
    ).filter(Boolean);
  }
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
  const map: Record<string, string> = {
    "تحقيق": "investigation", "تحقيقات": "investigation",
    "تقرير": "report", "تقارير": "report",
    "خبر": "news", "أخبار": "news",
    "تحليل": "analysis", "مقابلة": "interview",
    "قصة إنسانية": "human-story", "فيديو": "video",
    "معرض صور": "gallery",
  };
  return map[raw] ?? (["investigation","report","news","analysis","interview","human-story","video","gallery"].includes(raw) ? raw : "news");
}

function categoryValue(value: unknown): string {
  const raw = textValue(value).toLowerCase();
  const map: Record<string, string> = {
    "سياسة": "politics", "السياسة": "politics",
    "اقتصاد": "economy-public-money", "الاقتصاد": "economy-public-money",
    "اقتصاد ومال عام": "economy-public-money",
    "ميداني واجتماعي": "field-social", "مجتمع": "field-social",
    "ثقافة وفنون": "culture-arts", "ثقافة": "culture-arts",
    "سفر وسياحة": "travel-tourism", "سياحة": "travel-tourism",
    "رياضة": "sports",
  };
  return map[raw] ?? (["politics","economy-public-money","field-social","culture-arts","travel-tourism","sports"].includes(raw) ? raw : "");
}

async function markTaskSent(token: string, taskId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/task/${encodeURIComponent(taskId)}`, {
    method: "PUT",
    headers: {
      Authorization: token,
      "content-type": "application/json",
    },
    body: JSON.stringify({ status: SENT_STATUS }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`ClickUp status update ${response.status}: ${detail}`);
  }
}

async function fetchReadyTasks(token: string): Promise<ClickUpTask[]> {
  const all: ClickUpTask[] = [];
  for (let page = 0; page < 20; page++) {
    const url = new URL(`${API_BASE}/list/${LIST_ID}/task`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("include_closed", "true");
    url.searchParams.set("include_markdown_description", "true");
    url.searchParams.append("statuses[]", READY_STATUS);
    const response = await fetch(url, {
      headers: { Authorization: token, "content-type": "application/json" },
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      throw new Error(`ClickUp API ${response.status}: ${detail}`);
    }
    const payload = await response.json() as { tasks?: ClickUpTask[] };
    const tasks = payload.tasks ?? [];
    all.push(...tasks);
    if (tasks.length < 100) break;
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const clickupToken = Deno.env.get("CLICKUP_TOKEN") ?? "";
  if (!clickupToken) return json({ ok: false, error: "clickup_token_not_configured" }, 503);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, error: "database_not_configured" }, 503);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const tasks = await fetchReadyTasks(clickupToken);
    const results: Array<Record<string, unknown>> = [];

    for (const task of tasks) {
      const taskId = textValue(task.id);
      const title = textValue(task.name);
      if (!taskId || !title || textValue(task.status?.status) !== READY_STATUS) continue;

      const fields = customMap(task);
      const payload = {
        task_id: taskId,
        title,
        workflow_status: READY_STATUS,
        task_url: textValue(task.url),
        version: textValue(task.date_updated),
        subtitle: textValue(first(fields, ["العنوان الفرعي"])),
        excerpt: textValue(first(fields, ["الملخص"])),
        body: textValue(first(fields, ["النص الكامل"], task.markdown_description ?? task.description ?? "")),
        section: sectionValue(first(fields, ["النوع الصحفي"], "news")),
        category: categoryValue(first(fields, ["القسم التحريري"])),
        image: textValue(first(fields, ["الصورة البارزة"])),
        cover_image_url: textValue(first(fields, ["الصورة البارزة"])),
        cover_image_caption: textValue(first(fields, ["وصف الصورة"])),
        cover_image_credit: textValue(first(fields, ["حقوق الصورة", "حقوقها"])),
        methodology: textValue(first(fields, ["المنهجية"])),
        right_of_reply: textValue(first(fields, ["حق الرد"])),
        sources: sourcesValue(first(fields, ["المصادر والروابط المرجعية", "المصادر"])),
      };

      const { data, error } = await supabase.rpc("ingest_clickup_article", { p_payload: payload });
      if (error) {
        console.error("poll ingest failed", { taskId, code: error.code, message: error.message });
        results.push({ task_id: taskId, ok: false, error: "sync_failed" });
      } else {
        try {
          await markTaskSent(clickupToken, taskId);
          results.push({ task_id: taskId, ok: true, clickup_status: SENT_STATUS, result: data });
        } catch (statusError) {
          console.error("poll status update failed", { taskId, error: String(statusError) });
          results.push({ task_id: taskId, ok: true, clickup_status: "update_failed", result: data });
        }
      }
    }

    return json({
      ok: true,
      list_id: LIST_ID,
      ready_status: READY_STATUS,
      found: tasks.length,
      processed: results.length,
      failed: results.filter((item) => item.ok === false).length,
      results,
    });
  } catch (error) {
    console.error("clickup polling failed", error);
    return json({ ok: false, error: "poll_failed" }, 502);
  }
});