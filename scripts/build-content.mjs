import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const postsDir = path.join(root, "content", "posts");
const outputDirs = [path.join(root, "public", "data"), path.join(root, "data")];

const allowedStatuses = new Set(["draft", "review", "ready", "published"]);
const allowedSections = new Set(["investigation", "report", "news", "analysis", "interview", "human-story", "video", "gallery"]);

function parseScalar(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) return trimmed.slice(1, -1);
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function parseFrontmatter(source) {
  if (!source.startsWith("---")) return { data: {}, body: source };
  const end = source.indexOf("\n---", 3);
  if (end === -1) return { data: {}, body: source };
  const lines = source.slice(4, end).split(/\r?\n/);
  const body = source.slice(end + 4).replace(/^\r?\n/, "");
  const data = {};
  let key = null;
  let list = null;
  let multiline = null;
  const finish = () => {
    if (list && key) data[key] = list;
    list = null;
    if (multiline && key) data[key] = multiline.join("\n").trim();
    multiline = null;
  };
  for (const line of lines) {
    if (multiline) {
      if (/^\s+/.test(line) || !line.trim()) { multiline.push(line.replace(/^\s{2}/, "")); continue; }
      finish();
    }
    const item = line.match(/^\s*-\s+(.*)$/);
    if (item && key && list) { list.push(parseScalar(item[1])); continue; }
    const match = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!match) continue;
    finish(); key = match[1]; const value = match[2];
    if (value === "|") { multiline = []; continue; }
    if (!value) { list = []; continue; }
    data[key] = parseScalar(value);
  }
  finish();
  return { data, body };
}

function stripExtension(name) { return name.replace(/\.(md|mdx)$/i, ""); }

function isContentFile(name) {
  if (!/\.(md|mdx)$/i.test(name)) return false;
  const base = stripExtension(name).toLowerCase();
  return !name.startsWith(".") && !name.startsWith("_") && !["readme", "schema", "changelog"].includes(base);
}

function validatePost(post, file) {
  if (!post.title) throw new Error(`${file}: title is required`);
  if (!allowedStatuses.has(post.status)) throw new Error(`${file}: invalid status "${post.status}"`);
  if (!allowedSections.has(post.section)) throw new Error(`${file}: invalid section "${post.section}"`);
  if (!post.date || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(String(post.date))) throw new Error(`${file}: date must be YYYY-MM-DD or an ISO datetime`);
  if (post.reading_time !== undefined && (!Number.isInteger(post.reading_time) || post.reading_time < 1)) throw new Error(`${file}: reading_time must be an integer >= 1`);
  if (post.sources !== undefined && !Array.isArray(post.sources)) throw new Error(`${file}: sources must be a list`);
  if (post.documents !== undefined && !Array.isArray(post.documents)) throw new Error(`${file}: documents must be a list`);
}

async function readCollection(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile() && isContentFile(entry.name)).map((entry) => entry.name).sort();
    const items = [];
    for (const file of files) {
      const source = await readFile(path.join(dir, file), "utf8");
      const { data, body } = parseFrontmatter(source);
      if (!data.title || !data.status) continue;
      const post = { slug: stripExtension(file), ...data, body };
      validatePost(post, file);
      items.push(post);
    }
    return items;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

const posts = await readCollection(postsDir);
// Keep committed build output deterministic so CI can verify it without a timestamp diff.
const payload = `${JSON.stringify({ generatedAt: null, posts }, null, 2)}\n`;
for (const outputDir of outputDirs) {
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "posts.json"), payload, "utf8");
}
console.log(`Built ${posts.length} newsroom post(s) into data/posts.json and public/data/posts.json`);
