import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const postsDir = path.join(root, "content", "posts");
const outputDir = path.join(root, "public", "data");

function parseScalar(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function parseFrontmatter(source) {
  if (!source.startsWith("---")) return { data: {}, body: source };
  const end = source.indexOf("\n---", 3);
  if (end === -1) return { data: {}, body: source };

  const frontmatter = source.slice(4, end).trim();
  const body = source.slice(end + 4).replace(/^\r?\n/, "");
  const data = {};

  for (const line of frontmatter.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    data[key] = parseScalar(value);
  }

  return { data, body };
}

function stripExtension(name) {
  return name.replace(/\.(md|mdx)$/i, "");
}

async function readCollection(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && /\.(md|mdx)$/i.test(entry.name))
      .map((entry) => entry.name)
      .sort();

    const items = [];
    for (const file of files) {
      const source = await readFile(path.join(dir, file), "utf8");
      const { data, body } = parseFrontmatter(source);
      items.push({
        slug: stripExtension(file),
        ...data,
        body,
      });
    }
    return items;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

const posts = await readCollection(postsDir);
await mkdir(outputDir, { recursive: true });

const payload = {
  generatedAt: new Date().toISOString(),
  posts,
};

await writeFile(path.join(outputDir, "posts.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Built ${posts.length} newsroom post(s) into public/data/posts.json`);
