import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "index.html",
  "newsroom.html",
  "admin/dashboard.html",
  "admin/index.html",
  "data/posts.json",
  "public/data/posts.json",
  "tina/config.ts",
];

for (const file of requiredFiles) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) throw new Error(`Missing required file: ${file}`);
}

const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const newsroom = fs.readFileSync(path.join(root, "newsroom.html"), "utf8");
const posts = JSON.parse(fs.readFileSync(path.join(root, "data/posts.json"), "utf8"));
const publicPosts = JSON.parse(fs.readFileSync(path.join(root, "public/data/posts.json"), "utf8"));

if (!Array.isArray(posts.posts)) throw new Error("data/posts.json: posts must be an array");
if (JSON.stringify(posts) !== JSON.stringify(publicPosts)) {
  throw new Error("Generated newsroom indexes are not identical");
}

for (const post of posts.posts) {
  if (!post.slug || !post.title || !post.status) {
    throw new Error("Every post needs slug, title and status");
  }
}

if (!/published/.test(newsroom) || !/filter\s*\(/.test(newsroom)) {
  throw new Error("newsroom.html must contain a publication-status filter for the public reader");
}

const misleadingSecurityClaims = [
  "تشفير الاتصال وآلية حماية المصادر مفعلة",
  "تم استلام معلوماتك وتشفيرها بنجاح",
  "صندوق التسريبات الآمن",
  "إرسال تسريب آمن",
];

for (const phrase of misleadingSecurityClaims) {
  if (index.includes(phrase)) {
    throw new Error(`Unsafe/unverified security claim remains in index.html: ${phrase}`);
  }
}

console.log(`Site validation passed: ${posts.posts.length} content item(s), required files present, public index consistent.`);
