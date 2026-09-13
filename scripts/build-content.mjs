import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const postsDir = path.join(root, "content", "posts");
const outputDirs = [path.join(root, "public", "data"), path.join(root, "data")];

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

async function readCollection(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile() && /\.(md|mdx)$/i.test(entry.name)).map((entry) => entry.name).sort();
    const items = [];
    for (const file of files) {
      const source = await readFile(path.join(dir, file), "utf8");
      const { data, body } = parseFrontmatter(source);
      items.push({ slug: stripExtension(file), ...data, body });
    }
    return items;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

const posts = await readCollection(postsDir);
const payload = `${JSON.stringify({ generatedAt: new Date().toISOString(), posts }, null, 2)}\n`;
for (const outputDir of outputDirs) {
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "posts.json"), payload, "utf8");
}
console.log(`Built ${posts.length} newsroom post(s) into data/posts.json and public/data/posts.json`);
