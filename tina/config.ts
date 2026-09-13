import { defineConfig } from "tinacms";

export default defineConfig({
  branch: "main",
  clientId: "cc09f18c-8a8e-4305-a776-2534e9ebb90d",
  token: "",
  build: {
    outputFolder: "admin",
    publicFolder: "public",
  },
  media: {
    tina: {
      mediaRoot: "",
      publicFolder: "public",
    },
  },
  schema: {
    collections: [
      {
        name: "post",
        label: "المقالات والأخبار",
        path: "content/posts",
        fields: [
          {
            type: "string",
            name: "title",
            label: "العنوان",
            isTitle: true,
            required: true,
          },
          {
            type: "rich-text",
            name: "body",
            label: "محتوى المقال",
            isBody: true,
          },
        ],
      },
    ],
  },
});
