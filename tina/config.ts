import { defineConfig } from "tinacms";

const statusOptions = [
  { label: "مسودة", value: "draft" },
  { label: "قيد المراجعة", value: "review" },
  { label: "جاهز للنشر", value: "ready" },
  { label: "منشور", value: "published" },
];

const sectionOptions = [
  { label: "تحقيق استقصائي", value: "investigation" },
  { label: "تقرير", value: "report" },
  { label: "خبر", value: "news" },
  { label: "تحليل", value: "analysis" },
  { label: "مقابلة", value: "interview" },
  { label: "قصة إنسانية", value: "human-story" },
  { label: "فيديو", value: "video" },
  { label: "معرض صور", value: "gallery" },
];

const roleOptions = [
  { label: "مالك المنصة", value: "owner" },
  { label: "محرر", value: "editor" },
  { label: "كاتب", value: "writer" },
];

export default defineConfig({
  branch: "main",
  clientId: "cc09f18c-8a8e-4305-a776-2534e9ebb90d",
  token: "",
  build: { outputFolder: "admin", publicFolder: "public" },
  media: { tina: { mediaRoot: "images", publicFolder: "public" } },
  schema: {
    collections: [
      {
        name: "post",
        label: "غرفة الأخبار",
        path: "content/posts",
        format: "mdx",
        ui: {
          filename: {
            slugify: (values) =>
              `${new Date().toISOString().slice(0, 10)}-${String(values?.title || "story")
                .toLowerCase()
                .replace(/[^\u0600-\u06FF\u0030-\u0039a-z0-9]+/gi, "-")
                .replace(/^-|-$/g, "")}`,
          },
        },
        fields: [
          { type: "string", name: "title", label: "العنوان", isTitle: true, required: true },
          { type: "string", name: "subtitle", label: "العنوان الفرعي" },
          { type: "select", name: "section", label: "نوع المادة", options: sectionOptions, required: true },
          { type: "select", name: "status", label: "الحالة التحريرية", options: statusOptions, required: true },
          { type: "datetime", name: "date", label: "تاريخ النشر", required: true },
          { type: "string", name: "author", label: "الكاتب" },
          { type: "string", name: "editor", label: "المحرر" },
          { type: "select", name: "author_role", label: "دور صاحب المادة", options: roleOptions },
          { type: "string", name: "excerpt", label: "الملخص", ui: { component: "textarea" } },
          { type: "image", name: "image", label: "الصورة البارزة" },
          { type: "number", name: "reading_time", label: "وقت القراءة بالدقائق", description: "رقم صحيح من 1 فما فوق" },
          { type: "string", name: "sources", label: "المصادر", list: true },
          { type: "string", name: "documents", label: "الوثائق المرتبطة", list: true },
          { type: "string", name: "methodology", label: "ملاحظات المنهجية", ui: { component: "textarea" } },
          { type: "string", name: "right_of_reply", label: "حق الرد", ui: { component: "textarea" } },
          { type: "rich-text", name: "body", label: "محتوى المادة", isBody: true },
        ],
      },
      {
        name: "page",
        label: "صفحات المنصة",
        path: "content/pages",
        fields: [
          { type: "string", name: "title", label: "العنوان", isTitle: true, required: true },
          { type: "string", name: "description", label: "الوصف", ui: { component: "textarea" } },
          { type: "rich-text", name: "body", label: "المحتوى", isBody: true },
        ],
      },
    ],
  },
});
