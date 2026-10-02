// Stdio MCP server exposing the vault tools to the Kimi Code CLI. Kimi runs
// with ONLY these tools (see custodian.agent.md), so it can read and add to
// the vault but never delete, overwrite, or run shell commands.
// Protocol: newline-delimited JSON-RPC 2.0 (MCP stdio transport). Zero deps.

import readline from "node:readline";

import { appendToNote, createNote, editNote, listNotes, readNote, searchNotes } from "./vault.mjs";

const MAX_RESULT_CHARS = 30_000;

const TOOLS = {
  list_notes: {
    run: async (args) => (await listNotes(args)).map((n) => `${n.path} (modified ${n.modified})`).join("\n"),
    description: "List markdown notes in the vault (or a subfolder) with last-modified dates.",
    properties: { folder: { type: "string", description: "Optional subfolder, e.g. daily" } },
    required: [],
  },
  read_note: {
    run: readNote,
    description: "Read a note's full markdown.",
    properties: { path: { type: "string", description: "Vault-relative path, e.g. Goals - 2026.md" } },
    required: ["path"],
  },
  search_notes: {
    run: searchNotes,
    description: "Case-insensitive text search across all notes. Returns path:line: text.",
    properties: { query: { type: "string" } },
    required: ["query"],
  },
  create_note: {
    run: createNote,
    description: "Create a NEW note. Fails if it already exists (never overwrites).",
    properties: { path: { type: "string" }, content: { type: "string" } },
    required: ["path", "content"],
  },
  append_to_note: {
    run: appendToNote,
    description: "Append text to an existing note, at the end or at the end of the section under a heading.",
    properties: {
      path: { type: "string" },
      text: { type: "string" },
      heading: { type: "string", description: "Optional heading text, e.g. Follow-ups" },
    },
    required: ["path", "text"],
  },
  edit_note: {
    run: editNote,
    description: "Replace an exact, unique snippet of a note (e.g. '- [ ] task' -> '- [x] task'). Read the note first.",
    properties: { path: { type: "string" }, old_text: { type: "string" }, new_text: { type: "string" } },
    required: ["path", "old_text", "new_text"],
  },
};

async function handle(message) {
  const { method, params } = message;
  if (method === "initialize") {
    return {
      protocolVersion: params?.protocolVersion || "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "vault", version: "1.0.0" },
    };
  }
  if (method === "ping") {
    return {};
  }
  if (method === "tools/list") {
    return {
      tools: Object.entries(TOOLS).map(([name, tool]) => ({
        name,
        description: tool.description,
        inputSchema: { type: "object", properties: tool.properties, required: tool.required },
      })),
    };
  }
  if (method === "tools/call") {
    const tool = TOOLS[params?.name];
    if (!tool) {
      return { content: [{ type: "text", text: `unknown tool ${params?.name}` }], isError: true };
    }
    try {
      const result = String(await tool.run(params.arguments || {}));
      const text = result.length > MAX_RESULT_CHARS ? `${result.slice(0, MAX_RESULT_CHARS)}\n...(truncated)` : result;
      return { content: [{ type: "text", text }] };
    } catch (error) {
      // Tool errors go back to the model so it can correct itself.
      return { content: [{ type: "text", text: `error: ${error.message}` }], isError: true };
    }
  }
  throw Object.assign(new Error(`Method not found: ${method}`), { code: -32601 });
}

const input = readline.createInterface({ input: process.stdin });
input.on("line", async (line) => {
  if (!line.trim()) {
    return;
  }
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } })}\n`);
    return;
  }
  if (message.id === undefined) {
    return; // Notification (e.g. notifications/initialized): no reply.
  }
  try {
    const result = await handle(message);
    process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: message.id, result })}\n`);
  } catch (error) {
    const reply = { jsonrpc: "2.0", id: message.id, error: { code: error.code || -32603, message: error.message } };
    process.stdout.write(`${JSON.stringify(reply)}\n`);
  }
});
