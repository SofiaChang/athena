// File pipeline for the content system: inbox.md -> ideas/ -> drafts/<format>/
// -> published/<format>/. All paths are confined to the content root.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_CONTENT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../content-manager/content",
);

function contentRoot() {
  return process.env.CONTENT_ROOT?.trim() || DEFAULT_CONTENT_ROOT;
}

function resolveInside(relativePath) {
  const root = contentRoot();
  const resolved = path.resolve(root, relativePath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`Path escapes content root: ${relativePath}`);
  }
  return resolved;
}

async function readText(relativePath) {
  return fs.readFile(resolveInside(relativePath), "utf8");
}

async function writeText(relativePath, content) {
  const resolved = resolveInside(relativePath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, content, "utf8");
  return relativePath;
}

function slugify(text) {
  return (
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "untitled"
  );
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }
  const frontmatter = {};
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator > 0) {
      frontmatter[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
    }
  }
  return { frontmatter, body: content.slice(match[0].length) };
}

function serializeFrontmatter(frontmatter, body) {
  // Newlines in values would inject extra frontmatter keys.
  const lines = Object.entries(frontmatter).map(
    ([key, value]) => `${key}: ${String(value).replace(/[\r\n]+/g, " ")}`,
  );
  return `---\n${lines.join("\n")}\n---\n\n${body.replace(/^\n+/, "")}`;
}

async function readInbox() {
  let raw = "";
  try {
    raw = await readText("inbox.md");
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
  // Entries are dated lines anywhere, plus anything below the template's
  // example comment block. Undated lines above the comment are template
  // instructions; ~~struck~~ lines were already used.
  const lines = raw.split("\n");
  const entries = [];
  let pastComment = false;
  let inComment = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (inComment) {
      if (trimmed.includes("-->")) {
        inComment = false;
        pastComment = true;
      }
      continue;
    }
    if (trimmed.startsWith("<!--")) {
      if (trimmed.includes("-->")) {
        pastComment = true;
      } else {
        inComment = true;
      }
      continue;
    }
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("~~")) {
      continue;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed) || pastComment) {
      entries.push(trimmed);
    }
  }
  return entries;
}

async function appendInbox(line) {
  const dated = `${new Date().toISOString().slice(0, 10)} | ${line.trim()}`;
  const current = await readText("inbox.md").catch(() => "# Inbox\n");
  const trimmed = current.replace(/\s+$/, "");
  await writeText("inbox.md", `${trimmed}\n\n${dated}\n`);
  return dated;
}

async function strikeInboxLine(line) {
  const current = await readText("inbox.md");
  const lines = current.split("\n");
  // Exact-line match only: a substring replace can strike the wrong entry
  // when one line is a prefix of another.
  const index = lines.findIndex((candidate) => candidate.trim() === line.trim());
  if (index === -1) {
    return false;
  }
  lines[index] = `~~${lines[index]}~~`;
  await writeText("inbox.md", lines.join("\n"));
  return true;
}

function titleFrom(body, fallback) {
  const heading = body.match(/^#\s+(.+)$/m);
  if (heading) {
    return heading[1].trim();
  }
  const firstLine = body.split("\n").find((line) => line.trim());
  return firstLine ? firstLine.trim().slice(0, 80) : fallback;
}

async function listMarkdown(relativeDir) {
  let names = [];
  try {
    names = await fs.readdir(resolveInside(relativeDir));
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
  const entries = [];
  for (const name of names) {
    if (!name.endsWith(".md")) {
      continue;
    }
    const relativePath = `${relativeDir}/${name}`;
    const content = await readText(relativePath);
    const { frontmatter, body } = parseFrontmatter(content);
    const stats = await fs.stat(resolveInside(relativePath));
    entries.push({
      path: relativePath,
      name,
      format: frontmatter.format || null,
      status: frontmatter.status || null,
      date: frontmatter.date || null,
      url: frontmatter.url || null,
      title: titleFrom(body, name),
      modifiedAt: stats.mtimeMs,
    });
  }
  return entries.sort((a, b) => b.modifiedAt - a.modifiedAt);
}

async function listAll() {
  const formats = await listFormats();
  const drafts = [];
  const published = [];
  for (const format of formats) {
    drafts.push(...(await listMarkdown(`drafts/${format}`)));
    published.push(...(await listMarkdown(`published/${format}`)));
  }
  drafts.sort((a, b) => b.modifiedAt - a.modifiedAt);
  published.sort((a, b) => b.modifiedAt - a.modifiedAt);
  return {
    inbox: await readInbox(),
    ideas: await listMarkdown("ideas"),
    drafts,
    published,
    formats,
  };
}

async function listFormats() {
  let names = [];
  try {
    names = await fs.readdir(resolveInside("formats"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
  return names.filter((name) => name.endsWith(".md")).map((name) => name.replace(/\.md$/, ""));
}

async function publishDraft(relativePath, url) {
  if (!relativePath.startsWith("drafts/")) {
    throw new Error(`Only drafts can be published: ${relativePath}`);
  }
  const content = await readText(relativePath);
  const { frontmatter, body } = parseFrontmatter(content);
  if (!frontmatter.format) {
    throw new Error(`Draft has no format in its header: ${relativePath}`);
  }
  frontmatter.status = "published";
  frontmatter.date = new Date().toISOString().slice(0, 10);
  frontmatter.url = url || frontmatter.url || "";
  const fileName = path.basename(relativePath);
  const target = `published/${frontmatter.format}/${fileName}`;
  await writeText(target, serializeFrontmatter(frontmatter, body));
  await fs.rm(resolveInside(relativePath));
  return target;
}

export {
  contentRoot,
  readText,
  writeText,
  slugify,
  parseFrontmatter,
  serializeFrontmatter,
  readInbox,
  appendInbox,
  strikeInboxLine,
  listMarkdown,
  listAll,
  listFormats,
  publishDraft,
};
