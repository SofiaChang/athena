// Vault file tools for the Custodian agent. The Obsidian vault is the
// database: every read/write is a markdown file confined to the vault root.
// No delete or overwrite: creates refuse existing files, edits are exact
// replacements, so the agent cannot silently clobber a note.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_VAULT = path.join(REPO_ROOT, "vault/Abyss");
const SKIP_DIRS = new Set([".obsidian", ".trash", "attachments", ".git"]);
const MAX_SEARCH_HITS = 60;

function vaultRoot() {
  return path.resolve(process.env.OBSIDIAN_VAULT?.trim() || DEFAULT_VAULT);
}

function resolveNote(relativePath) {
  const cleaned = String(relativePath || "").trim();
  if (!cleaned) {
    throw new Error("path is required.");
  }
  if (!cleaned.endsWith(".md")) {
    throw new Error(`Only .md notes are allowed: ${cleaned}`);
  }
  const root = vaultRoot();
  const resolved = path.resolve(root, cleaned);
  if (!resolved.startsWith(root + path.sep)) {
    throw new Error(`Path escapes the vault: ${cleaned}`);
  }
  return resolved;
}

async function walk(dir, root, out) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.isDirectory()) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        await walk(full, root, out);
      }
    } else if (entry.name.endsWith(".md")) {
      const stat = await fs.stat(full);
      out.push({ path: path.relative(root, full), modified: stat.mtime.toISOString().slice(0, 10) });
    }
  }
  return out;
}

async function listNotes({ folder = "" } = {}) {
  const root = vaultRoot();
  const start = path.resolve(root, folder);
  if (start !== root && !start.startsWith(root + path.sep)) {
    throw new Error(`Folder escapes the vault: ${folder}`);
  }
  const notes = await walk(start, root, []);
  return notes.sort((a, b) => a.path.localeCompare(b.path));
}

async function readNote({ path: notePath }) {
  return fs.readFile(resolveNote(notePath), "utf8");
}

async function searchNotes({ query }) {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) {
    throw new Error("query is required.");
  }
  const hits = [];
  for (const note of await listNotes()) {
    const lines = (await readNote({ path: note.path })).split("\n");
    lines.forEach((line, index) => {
      if (hits.length < MAX_SEARCH_HITS && (line.toLowerCase().includes(needle)
        || note.path.toLowerCase().includes(needle) && index === 0)) {
        hits.push(`${note.path}:${index + 1}: ${line.slice(0, 200)}`);
      }
    });
  }
  return hits.length ? hits.join("\n") : "(no matches)";
}

async function createNote({ path: notePath, content }) {
  const resolved = resolveNote(notePath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  try {
    // "wx" fails if the file exists: creating never overwrites a note.
    await fs.writeFile(resolved, String(content ?? ""), { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error(`${notePath} already exists. Use append_to_note or edit_note.`);
    }
    throw error;
  }
  return `created ${notePath}`;
}

// Insert text at the end of the section under `heading` (before the next
// heading of the same or higher level), or at the end of the note.
function insertUnderHeading(content, heading, text) {
  const block = text.endsWith("\n") ? text : `${text}\n`;
  if (!heading) {
    return `${content}${content.endsWith("\n") || content === "" ? "" : "\n"}${block}`;
  }
  const lines = content.split("\n");
  const wanted = heading.replace(/^#+\s*/, "").trim().toLowerCase();
  const start = lines.findIndex((line) => /^#{1,6}\s/.test(line)
    && line.replace(/^#+\s*/, "").trim().toLowerCase() === wanted);
  if (start === -1) {
    throw new Error(`Heading not found: ${heading}`);
  }
  const level = lines[start].match(/^#+/)[0].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const match = lines[i].match(/^(#{1,6})\s/);
    if (match && match[1].length <= level) {
      end = i;
      break;
    }
  }
  // Back up over trailing blank lines so the new text sits with the section.
  while (end > start + 1 && lines[end - 1].trim() === "") {
    end -= 1;
  }
  lines.splice(end, 0, ...block.replace(/\n$/, "").split("\n"));
  return lines.join("\n");
}

async function appendToNote({ path: notePath, text, heading }) {
  const resolved = resolveNote(notePath);
  const content = await fs.readFile(resolved, "utf8");
  await fs.writeFile(resolved, insertUnderHeading(content, heading, String(text || "")), "utf8");
  return `appended to ${notePath}${heading ? ` under "${heading}"` : ""}`;
}

async function editNote({ path: notePath, old_text: oldText, new_text: newText }) {
  const resolved = resolveNote(notePath);
  const content = await fs.readFile(resolved, "utf8");
  const count = oldText ? content.split(oldText).length - 1 : 0;
  if (count !== 1) {
    throw new Error(`old_text must match exactly once in ${notePath} (matched ${count}). Read the note and copy the text verbatim.`);
  }
  await fs.writeFile(resolved, content.replace(oldText, () => String(newText ?? "")), "utf8");
  return `edited ${notePath}`;
}

export {
  appendToNote,
  createNote,
  editNote,
  insertUnderHeading,
  listNotes,
  readNote,
  resolveNote,
  searchNotes,
  vaultRoot,
};
