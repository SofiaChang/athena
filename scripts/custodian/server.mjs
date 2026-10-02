// Custodian: chat with a Kimi agent that manages the Obsidian vault for you
// (new entries, goals, todos) so you never have to open Obsidian.
// Entry: node scripts/custodian/server.mjs
//
// Env: CUSTODIAN_PORT (default 8791; 0 = ephemeral for the Athena hub), plus
// agent env (see agent.mjs). Secrets load from the repo-root .env file so the
// hub (a GUI app with no shell env) can launch it.
//
// Hub contract: the listening line goes to STDOUT as
// "listening on http://0.0.0.0:<port>". Do not move it to stderr.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { converse } from "./agent.mjs";
import { readNote, vaultRoot } from "./vault.mjs";

const DEFAULT_PORT = 8791;
const ENV_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.env");

if (fs.existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

const APP_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Custodian</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    background: #0d1117; color: #e6edf3; line-height: 1.55; }
  main { max-width: 1180px; margin: 0 auto; padding: 1.5rem 1.25rem 2rem; }
  h1 { font-size: 1.3rem; letter-spacing: 0.04em; margin: 0 0 0.25rem; }
  h1 .accent { color: #d2a8ff; }
  h2 { font-size: 0.8rem; color: #9da7b3; text-transform: uppercase;
    letter-spacing: 0.08em; margin: 0 0 0.5rem; }
  .layout { display: grid; grid-template-columns: 1fr 380px; gap: 1.25rem; margin-top: 1rem; }
  @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
  .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 1rem; }
  #log { height: 60vh; overflow-y: auto; display: flex; flex-direction: column; gap: 0.6rem; }
  .msg { padding: 0.6rem 0.8rem; border-radius: 8px; white-space: pre-wrap;
    word-break: break-word; font-size: 0.85rem; max-width: 92%; }
  .msg.user { background: #1f2a3a; align-self: flex-end; }
  .msg.assistant { background: #0d1117; border: 1px solid #30363d; }
  .msg.error { border-left: 3px solid #f85149; background: #2d1518; }
  .change { font-size: 0.72rem; color: #7ee787; display: block; }
  textarea { width: 100%; background: #0d1117; color: #e6edf3; border: 1px solid #30363d;
    border-radius: 6px; padding: 0.6rem; font: inherit; font-size: 0.85rem;
    min-height: 70px; resize: vertical; }
  textarea:focus-visible, button:focus-visible { outline: 2px solid #d2a8ff; outline-offset: 2px; }
  button { background: #8957e5; color: #fff; border: 0; border-radius: 6px;
    padding: 0.45rem 1rem; font: inherit; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
  button:hover { background: #a371f7; }
  button:disabled { background: #3c2a63; color: #9da7b3; cursor: wait; }
  button.chip { background: #21262d; border: 1px solid #30363d; font-weight: 400; }
  button.chip:hover { border-color: #d2a8ff; }
  .row { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; margin-top: 0.6rem; }
  pre.note { background: #0d1117; border: 1px solid #30363d; border-radius: 8px;
    padding: 0.8rem; font-size: 0.75rem; white-space: pre-wrap; word-break: break-word;
    max-height: 62vh; overflow: auto; margin: 0.6rem 0 0; }
  .meta { color: #9da7b3; font-size: 0.72rem; }
</style>
</head>
<body><main>
<h1><span class="accent">&#9672;</span> Custodian</h1>
<p class="meta">Tell it what to log, add, check off, or plan. It reads and writes your vault: <span id="vault"></span></p>

<div class="layout">
  <section class="card" aria-label="Chat">
    <div id="log" aria-live="polite"></div>
    <div class="row">
      <button class="chip" data-prompt="What are my open todos? Group them by note.">Open todos</button>
      <button class="chip" data-prompt="Summarize my 2026 goals and where I stand on each.">Goals check-in</button>
      <button class="chip" data-prompt="Plan my day: pick the 3 most important open todos aligned with my primary goals, and add them to today's daily note under Follow-ups.">Plan my day</button>
      <button class="chip" id="new-chat">New chat</button>
    </div>
    <label class="meta" for="input" style="display:block;margin-top:0.6rem">Message (Cmd+Enter to send)</label>
    <textarea id="input" placeholder="e.g. add 'email Jacob about EstateBuddy' to my todos, or: journal: had a great Spanish lesson today"></textarea>
    <div class="row"><button id="send">Send</button></div>
  </section>
  <aside class="card" aria-label="Note viewer">
    <h2>Peek at a note</h2>
    <div class="row" style="margin-top:0">
      <button class="chip" data-note="Goals - 2026.md">Goals</button>
      <button class="chip" data-note="todoist-tasks.md">Tasks</button>
      <button class="chip" data-note="Inbox.md">Inbox</button>
      <button class="chip" id="today-note">Today</button>
    </div>
    <div class="meta" id="note-label" style="margin-top:0.6rem"></div>
    <pre class="note" id="note">Pick a note. Files the agent changes show up in the chat; click one to view it.</pre>
  </aside>
</div>

<script>
const $ = (id) => document.getElementById(id);
const STORE_KEY = 'custodian.messages';
let messages = [];
try { messages = JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch { messages = []; }

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(messages)); } catch {}
}
function bubble(role, text, changes) {
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  div.textContent = text;
  for (const change of changes || []) {
    const link = document.createElement('a');
    link.className = 'change';
    link.href = '#';
    link.textContent = '\\u2713 ' + change.summary;
    const notePath = change.summary.replace(/^(created|appended to|edited) /, '').replace(/ under ".*"$/, '');
    link.addEventListener('click', (event) => { event.preventDefault(); showNote(notePath); });
    div.appendChild(link);
  }
  $('log').appendChild(div);
  $('log').scrollTop = $('log').scrollHeight;
}
function renderHistory() {
  $('log').innerHTML = '';
  for (const m of messages) {
    if (m.role === 'user') bubble('user', m.content);
    else if (m.role === 'assistant' && m.content) bubble('assistant', m.content);
  }
}
async function showNote(notePath) {
  $('note-label').textContent = notePath;
  try {
    const response = await fetch('/api/note?path=' + encodeURIComponent(notePath));
    const payload = await response.json();
    $('note').textContent = response.ok ? payload.content : payload.error;
  } catch (error) { $('note').textContent = error.message; }
}
async function send(text) {
  if (!text.trim()) return;
  bubble('user', text);
  $('input').value = '';
  $('send').disabled = true;
  $('send').textContent = 'working...';
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages, text }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'HTTP ' + response.status);
    messages = payload.messages;
    save();
    bubble('assistant', payload.reply || '(done)', payload.changes);
  } catch (error) {
    bubble('error', error.message);
  } finally {
    $('send').disabled = false;
    $('send').textContent = 'Send';
  }
}

$('send').addEventListener('click', () => send($('input').value));
$('input').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) send($('input').value);
});
document.querySelectorAll('[data-prompt]').forEach((b) => b.addEventListener('click', () => send(b.dataset.prompt)));
document.querySelectorAll('[data-note]').forEach((b) => b.addEventListener('click', () => showNote(b.dataset.note)));
$('today-note').addEventListener('click', () => showNote('daily/' + new Date().toLocaleDateString('en-CA') + '.md'));
$('new-chat').addEventListener('click', () => { messages = []; save(); renderHistory(); });
fetch('/healthz').then((r) => r.json()).then((p) => { $('vault').textContent = p.vault; });
renderHistory();
</script>
</main></body></html>`;

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 5_000_000) {
        reject(new Error("Request body too large. Start a new chat."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

function log(message) {
  process.stderr.write(`[custodian] ${message}\n`);
}

async function handle(url, request, response) {
  if (request.method === "GET" && url.pathname === "/") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(APP_HTML);
    return;
  }
  if (request.method === "GET" && url.pathname === "/healthz") {
    sendJson(response, 200, { ok: true, vault: vaultRoot() });
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/note") {
    sendJson(response, 200, { content: await readNote({ path: url.searchParams.get("path") }) });
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/chat") {
    const body = JSON.parse((await readBody(request)) || "{}");
    const text = String(body.text || "").trim();
    if (!text) {
      throw new Error("text is required.");
    }
    // Only conversation roles from the client; the system prompt is ours.
    const history = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m) => ["user", "assistant", "tool"].includes(m?.role));
    const result = await converse(history, text);
    for (const change of result.changes) {
      log(change.summary);
    }
    sendJson(response, 200, result);
    return;
  }
  sendJson(response, 404, { error: "not found" });
}

function resolvePort() {
  const raw = process.env.CUSTODIAN_PORT;
  if (raw === undefined || raw.trim() === "") {
    return DEFAULT_PORT;
  }
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid CUSTODIAN_PORT: ${raw}`);
  }
  return port;
}

const server = http.createServer(async (request, response) => {
  try {
    await handle(new URL(request.url, `http://${request.headers.host || "localhost"}`), request, response);
  } catch (error) {
    log(`error: ${error.message}`);
    sendJson(response, 400, { error: error.message });
  }
});

// Bind to loopback only: this server can write to the vault.
server.listen(resolvePort(), "127.0.0.1", () => {
  // With CUSTODIAN_PORT=0 the OS assigns an ephemeral port. The Athena hub
  // parses this line from STDOUT — do not move it to stderr.
  process.stdout.write(`listening on http://0.0.0.0:${server.address().port}\n`);
});
