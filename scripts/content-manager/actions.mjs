// The four content commands (ideate, draft, review, repurpose) as LLM
// actions. Prompts are assembled from the live spec files under
// content-manager/content/ — editing those files changes app behavior.

import path from "node:path";

import { extractJson, llmChat } from "../shared/llm.mjs";
import {
  listMarkdown,
  parseFrontmatter,
  readInbox,
  readText,
  serializeFrontmatter,
  slugify,
  writeText,
} from "./store.mjs";

async function commandSpec(name) {
  return readText(`.claude/commands/${name}.md`);
}

async function coreContext() {
  return {
    claude: await readText("CLAUDE.md"),
    voice: await readText("voice.md"),
  };
}

function voiceHasSamples(voice) {
  const samples = voice.split("## Samples")[1] || "";
  const notes = samples.split("## Notes")[0] || "";
  return notes.replace(/<!--[\s\S]*?-->/g, "").trim().length > 0;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// /ideate: propose angles from the inbox. Writes nothing.
async function ideate() {
  const inbox = await readInbox();
  if (inbox.length === 0) {
    return "The inbox has no raw material. Add lines to it first; angles are never invented.";
  }
  const ideas = await listMarkdown("ideas");
  const published = [
    ...(await listMarkdown("published/linkedin")),
    ...(await listMarkdown("published/youtube")),
  ]
    .sort((a, b) => b.modifiedAt - a.modifiedAt)
    .slice(0, 10);
  const { claude, voice } = await coreContext();
  const spec = await commandSpec("ideate");

  const system = [
    "You run the /ideate command for Sofia's content system.",
    "Follow the command spec exactly.",
    "",
    "## Command spec",
    spec,
    "",
    "## CLAUDE.md",
    claude,
    "",
    "## voice.md",
    voice,
  ].join("\n");
  const user = [
    "## inbox.md lines",
    inbox.join("\n"),
    "",
    "## Existing ideas/",
    ideas.map((entry) => `- ${entry.path}: ${entry.title}`).join("\n") || "(none)",
    "",
    "## 10 most recent published",
    published.map((entry) => `- ${entry.path}: ${entry.title}`).join("\n") || "(none)",
  ].join("\n");
  return llmChat(system, user);
}

const FORMAT_NAME_PATTERN = /^[a-z0-9-]+$/;

function requireFormatName(format) {
  if (!FORMAT_NAME_PATTERN.test(format)) {
    throw new Error(`Invalid format name: ${format}`);
  }
  return format;
}

// /draft <idea> <format>: LLM writes the draft; the app saves the file.
async function draft({ idea, format }) {
  requireFormatName(format);
  const formatSpec = await readText(`formats/${format}.md`).catch(() => null);
  if (!formatSpec) {
    throw new Error(`Unknown format '${format}'. formats/${format}.md does not exist.`);
  }
  const { claude, voice } = await coreContext();
  if (!voiceHasSamples(voice)) {
    throw new Error("voice.md has no samples. Add writing samples before drafting.");
  }

  let ideaText = idea;
  let ideaPath = null;
  const candidate = `ideas/${idea.replace(/^ideas\//, "").replace(/\.md$/, "")}.md`;
  const existing = await readText(candidate).catch(() => null);
  if (existing) {
    ideaText = existing;
    ideaPath = candidate;
  }

  const spec = await commandSpec("draft");
  const system = [
    "You run the /draft command for Sofia's content system.",
    "Follow the command spec, the format rules, and the writing rules exactly.",
    "The app performs file IO for you. Respond with ONLY JSON:",
    '{ "slug": "kebab-case-slug", "content": "the full draft BODY (markdown, no frontmatter)", ' +
      '"idea_summary": "2-4 lines: the detail, the angle, the audience (used if the idea is new)", ' +
      '"report": "path-independent report: word count or target runtime, plus any claim needing a fact check or confidentiality check" }',
    "",
    "## Command spec",
    spec,
    "",
    "## CLAUDE.md",
    claude,
    "",
    `## formats/${format}.md`,
    formatSpec,
    "",
    "## voice.md",
    voice,
  ].join("\n");
  const user = `## Idea\n${ideaText}\n\n## Format\n${format}`;

  const parsed = extractJson(await llmChat(system, user));
  const slug = slugify(parsed.slug || "draft");
  const frontmatter = { format, idea: ideaPath || `ideas/${slug}.md`, status: "draft", date: "", url: "" };
  const filePath = `drafts/${format}/${today()}-${slug}.md`;
  await writeText(filePath, serializeFrontmatter(frontmatter, parsed.content || ""));
  if (!ideaPath && parsed.idea_summary) {
    await writeText(`ideas/${slug}.md`, `# ${slug}\n\n${parsed.idea_summary}\n`);
    ideaPath = `ideas/${slug}.md`;
  }
  return {
    filePath,
    ideaPath,
    report: parsed.report || "",
  };
}

// /review <draft>: critique against format and voice. Edits, never a rewrite.
async function review({ path: draftPath }) {
  const content = await readText(draftPath);
  const { frontmatter } = parseFrontmatter(content);
  const format = frontmatter.format || path.basename(path.dirname(draftPath));
  const formatSpec = await readText(`formats/${format}.md`).catch(() => "(no format file)");
  const { claude, voice } = await coreContext();
  const spec = await commandSpec("review");

  const system = [
    "You run the /review command for Sofia's content system.",
    "Follow the command spec exactly. Concrete edits, never a rewrite.",
    "",
    "## Command spec",
    spec,
    "",
    "## CLAUDE.md",
    claude,
    "",
    `## formats/${format}.md`,
    formatSpec,
    "",
    "## voice.md",
    voice,
  ].join("\n");
  const user = `## Draft (${draftPath})\n${content}`;
  return llmChat(system, user);
}

// /repurpose <published> <format>: adapt to another medium as a new piece.
async function repurpose({ path: sourcePath, target }) {
  requireFormatName(target);
  const formatSpec = await readText(`formats/${target}.md`).catch(() => null);
  if (!formatSpec) {
    throw new Error(`Unknown format '${target}'. formats/${target}.md does not exist.`);
  }
  const source = await readText(sourcePath);
  const { claude, voice } = await coreContext();
  const spec = await commandSpec("repurpose");

  const system = [
    "You run the /repurpose command for Sofia's content system.",
    "Follow the command spec exactly. The adaptation is a new piece, not a reformat.",
    "If the spec says material is missing, do NOT write the piece: respond with",
    'ONLY JSON { "blocked": true, "report": "the what-changes / what-gets-cut / material-needed lists" }.',
    "Otherwise respond with ONLY JSON:",
    '{ "blocked": false, "slug": "kebab-case-slug", "content": "the full piece BODY (markdown, no frontmatter)", ' +
      '"report": "what changed, what was cut, anything needing fact or confidentiality check" }',
    "",
    "## Command spec",
    spec,
    "",
    "## CLAUDE.md",
    claude,
    "",
    `## formats/${target}.md`,
    formatSpec,
    "",
    "## voice.md",
    voice,
  ].join("\n");
  const user = `## Published piece (${sourcePath})\n${source}\n\n## Target format\n${target}`;

  const parsed = extractJson(await llmChat(system, user));
  if (parsed.blocked) {
    return { blocked: true, report: parsed.report || "" };
  }
  const slug = slugify(parsed.slug || "repurposed");
  const frontmatter = {
    format: target,
    idea: `repurposed from ${sourcePath}`,
    status: "draft",
    date: "",
    url: "",
  };
  const filePath = `drafts/${target}/${today()}-${slug}.md`;
  await writeText(filePath, serializeFrontmatter(frontmatter, parsed.content || ""));
  return { blocked: false, filePath, report: parsed.report || "" };
}

export { ideate, draft, review, repurpose };
