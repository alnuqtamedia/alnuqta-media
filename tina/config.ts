import { defineConfig } from "tinacms";

export default defineConfig({
  branch: "main",
  clientId: "cc09f18c-8a8e-4305-a776-2534e9ebb90d", // الرمز الخاص بحسابك
  token: "", // اتركه فارغاً حالياً أو أضف الـ Read-only Token من تينا
  build: {
    outputFolder: "admin",
    publicFolder: "public",
  },
  media: {
    tina: {
      mediaRoot: "uploads",
      publicFolder: "public",
    },
  },
  schema: {
    collections: [
      {
        name: "investigations",
        label: "التحقيقات الصحفية",
        path: "content/investigations",
        fields: [
          { type: "string", name: "title", label: "عنوان التحقيق", isTitle: true, required: true },
          { type: "datetime", name: "date", label: "تاريخ النشر" },
          { type: "string", name: "summary", label: "الملخص" },
          { type: "rich-text", name: "body", label: "نص التحقيق", isBody: true },
        ],
      },
    ],
  },
});
