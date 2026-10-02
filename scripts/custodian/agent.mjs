// Custodian agent: Kimi (Moonshot, OpenAI-compatible chat completions) with
// tool calls over the Obsidian vault. The caller owns the conversation and
// passes the full message list each turn; we append to it and hand it back.
//
// Env: KIMI_API_KEY (or MOONSHOT_API_KEY), KIMI_MODEL (default kimi-k3),
// KIMI_BASE_URL (default https://api.moonshot.ai/v1 — any OpenAI-compatible
// endpoint serving Kimi works, e.g. OpenRouter), OBSIDIAN_VAULT.

import { appendToNote, createNote, editNote, listNotes, readNote, searchNotes } from "./vault.mjs";

const KIMI_DEFAULT_BASE_URL = "https://api.moonshot.ai/v1";
const KIMI_DEFAULT_MODEL = "kimi-k3";
const MAX_STEPS = 16;
const MAX_TOOL_RESULT_CHARS = 30_000;

const TOOLS = {
  list_notes: {
    run: async (args) => (await listNotes(args)).map((n) => `${n.path} (modified ${n.modified})`).join("\n"),
    description: "List markdown notes in the vault (or a subfolder) with last-modified dates.",
    parameters: { folder: { type: "string", description: "Optional subfolder, e.g. daily" } },
    required: [],
  },
  read_note: {
    run: readNote,
    description: "Read a note's full markdown.",
    parameters: { path: { type: "string", description: "Vault-relative path, e.g. Goals - 2026.md" } },
    required: ["path"],
  },
  search_notes: {
    run: searchNotes,
    description: "Case-insensitive text search across all notes. Returns path:line: text.",
    parameters: { query: { type: "string" } },
    required: ["query"],
  },
  create_note: {
    run: createNote,
    description: "Create a NEW note. Fails if it already exists (never overwrites).",
    parameters: { path: { type: "string" }, content: { type: "string" } },
    required: ["path", "content"],
  },
  append_to_note: {
    run: appendToNote,
    description: "Append text to an existing note, at the end or at the end of the section under a heading.",
    parameters: {
      path: { type: "string" },
      text: { type: "string" },
      heading: { type: "string", description: "Optional heading text, e.g. Follow-ups" },
    },
    required: ["path", "text"],
  },
  edit_note: {
    run: editNote,
    description: "Replace an exact, unique snippet of a note (e.g. '- [ ] task' -> '- [x] task'). Read the note first.",
    parameters: { path: { type: "string" }, old_text: { type: "string" }, new_text: { type: "string" } },
    required: ["path", "old_text", "new_text"],
  },
};

const WRITE_TOOLS = new Set(["create_note", "append_to_note", "edit_note"]);

const TOOL_SCHEMAS = Object.entries(TOOLS).map(([name, tool]) => ({
  type: "function",
  function: {
    name,
    description: tool.description,
    parameters: { type: "object", properties: tool.parameters, required: tool.required },
  },
}));

function systemPrompt() {
  const today = new Date().toLocaleDateString("en-CA");
  return `You are Custodian, the keeper of Sofia's Obsidian vault "Abyss". The vault is
her database: goals, todos, journal, people, projects, media lists. She never
opens Obsidian; you read and write it for her.

Today is ${today}.

Vault conventions (follow them; read INDEX.md, README.md or STYLE-GUIDE.md if unsure):
- Most notes live at the root. Daily notes: daily/YYYY-MM-DD.md. Templates in templates/.
- Frontmatter properties: categories, created ("YYYY-MM-DD"), topics, tags.
- Daily note shape: frontmatter (categories: [journal], created), "# YYYY-MM-DD",
  "## Notes", "## Links created", "## Follow-ups".
- Todos are Markdown checkboxes "- [ ] ..." / "- [x] ...". Year goals live in "Goals - 2026.md".
  Loose tasks also live in todoist-tasks.md and Inbox.md.
- Use [[wikilinks]] on first mention of people, projects and concepts that have notes.
- Dates are YYYY-MM-DD.

How to work:
1. Look before you write: search or read the relevant note first. Never guess a file's contents.
2. Prefer adding to an existing note over creating a new one. Put todos under a fitting heading.
3. To complete a todo, edit "- [ ]" to "- [x]". Never delete content; if something is obsolete,
   strike it through (~~text~~) or mark it done.
4. When she logs something for today, use today's daily note; create it from the shape above if missing.
5. Keep her words. Tidy formatting, don't rewrite meaning.
6. Reply briefly: what you changed (file + one line each) or the answer she asked for.
   For questions about todos/goals, answer from the files, as a short list.`;
}

function apiKey() {
  const key = process.env.KIMI_API_KEY?.trim() || process.env.MOONSHOT_API_KEY?.trim();
  if (!key) {
    throw new Error("Missing KIMI_API_KEY. Add it to the repo .env file (see .env.custodian.example).");
  }
  return key;
}

async function kimiChat(messages) {
  const baseUrl = (process.env.KIMI_BASE_URL?.trim() || KIMI_DEFAULT_BASE_URL).replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey()}` },
    body: JSON.stringify({
      model: process.env.KIMI_MODEL?.trim() || KIMI_DEFAULT_MODEL,
      messages,
      tools: TOOL_SCHEMAS,
    }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Kimi request failed: HTTP ${response.status} — ${body.slice(0, 300)}`);
  }
  const message = JSON.parse(body).choices?.[0]?.message;
  if (!message) {
    throw new Error("Kimi returned no message.");
  }
  return message;
}

async function runTool(call) {
  const tool = TOOLS[call.function?.name];
  if (!tool) {
    return `error: unknown tool ${call.function?.name}`;
  }
  try {
    const args = JSON.parse(call.function.arguments || "{}");
    const result = String(await tool.run(args));
    return result.length > MAX_TOOL_RESULT_CHARS
      ? `${result.slice(0, MAX_TOOL_RESULT_CHARS)}\n...(truncated)`
      : result;
  } catch (error) {
    // Errors go back to the model so it can correct itself.
    return `error: ${error.message}`;
  }
}

// history: prior user/assistant/tool messages (no system message).
// Returns the extended history, the final reply, and the files changed.
async function converse(history, userText) {
  const messages = [...history, { role: "user", content: userText }];
  const changes = [];
  for (let step = 0; step < MAX_STEPS; step += 1) {
    // Keep the assistant message whole: thinking models need their
    // reasoning_content echoed back on tool-call turns.
    const reply = await kimiChat([{ role: "system", content: systemPrompt() }, ...messages]);
    messages.push(reply);
    if (!reply.tool_calls?.length) {
      return { messages, reply: reply.content || "", changes };
    }
    for (const call of reply.tool_calls) {
      const content = await runTool(call);
      if (WRITE_TOOLS.has(call.function.name) && !content.startsWith("error:")) {
        changes.push({ tool: call.function.name, summary: content });
      }
      messages.push({ role: "tool", tool_call_id: call.id, name: call.function.name, content });
    }
  }
  return { messages, reply: `Stopped after ${MAX_STEPS} tool steps. Ask me to continue.`, changes };
}

export { converse };
