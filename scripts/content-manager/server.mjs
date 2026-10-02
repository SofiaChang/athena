// Content Creator: web surface for Sofia's content pipeline.
// inbox.md -> ideas/ -> drafts/<format>/ -> published/<format>/, with the
// four LLM commands as live actions. Entry: node scripts/content-manager/server.mjs
//
// Env: CONTENT_PORT (default 8790; 0 = ephemeral for the Athena hub),
// CONTENT_ROOT (default content-manager/content), plus the shared LLM env
// vars (see scripts/shared/llm.mjs).
//
// Hub contract: the listening line goes to STDOUT as
// "listening on http://0.0.0.0:<port>". Do not move it to stderr.

import http from "node:http";

import { draft, ideate, repurpose, review } from "./actions.mjs";
import {
  appendInbox,
  listAll,
  listFormats,
  publishDraft,
  readText,
  slugify,
  strikeInboxLine,
  writeText,
} from "./store.mjs";

const DEFAULT_PORT = 8790;

const PAGE_STYLE = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    background: #0d1117; color: #e6edf3; line-height: 1.55; }
  main { max-width: 1080px; margin: 0 auto; padding: 1.5rem 1.25rem 4rem; }
  h1 { font-size: 1.3rem; letter-spacing: 0.04em; }
  h1 .accent { color: #7ee787; }
  h2 { font-size: 0.85rem; color: #9da7b3; text-transform: uppercase;
    letter-spacing: 0.08em; margin: 1.5rem 0 0.5rem; }
  .layout { display: grid; grid-template-columns: 300px 1fr; gap: 1.25rem; }
  @media (max-width: 860px) { .layout { grid-template-columns: 1fr; } }
  .item { display: block; width: 100%; text-align: left; background: #161b22;
    border: 1px solid #30363d; border-radius: 8px; padding: 0.55rem 0.75rem;
    margin-bottom: 0.45rem; color: inherit; font: inherit; font-size: 0.8rem;
    cursor: pointer; }
  .item:hover { border-color: #7ee787; }
  .item .meta { color: #9da7b3; font-size: 0.7rem; display: block; margin-top: 0.15rem; }
  .item.inbox { cursor: default; }
  .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px;
    padding: 1rem 1.1rem; }
  textarea, input[type=text], select { width: 100%; background: #0d1117;
    color: #e6edf3; border: 1px solid #30363d; border-radius: 6px;
    padding: 0.5rem 0.65rem; font: inherit; font-size: 0.82rem; }
  textarea { min-height: 320px; resize: vertical; }
  input[type=text] { min-height: 0; }
  button { background: #238636; color: #fff; border: 0; border-radius: 6px;
    padding: 0.45rem 1rem; font: inherit; font-size: 0.8rem; font-weight: 600;
    cursor: pointer; }
  button:hover { background: #2ea043; }
  button:disabled { background: #1a4d26; color: #9da7b3; cursor: wait; }
  button.secondary { background: #21262d; border: 1px solid #30363d; }
  button.secondary:hover { border-color: #7ee787; background: #21262d; }
  .row { display: flex; gap: 0.6rem; flex-wrap: wrap; align-items: center;
    margin-top: 0.75rem; }
  .row > * { flex: 0 1 auto; }
  .row select { width: auto; }
  .panel { margin-top: 1rem; }
  pre.result { background: #0d1117; border: 1px solid #30363d; border-radius: 8px;
    padding: 0.9rem 1rem; font-size: 0.78rem; white-space: pre-wrap;
    word-break: break-word; max-height: 420px; overflow: auto; }
  .error { border-left: 3px solid #f85149; background: #2d1518; padding: 0.7rem 1rem;
    border-radius: 0 6px 6px 0; font-size: 0.8rem; margin-top: 0.75rem; }
  .ok { color: #7ee787; font-size: 0.78rem; }
  .meta { color: #9da7b3; font-size: 0.72rem; }
  .hidden { display: none; }
`;

function page(body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Content Creator</title>
<style>${PAGE_STYLE}</style>
</head>
<body><main>
<h1><span class="accent">&#9672;</span> Content Creator</h1>
${body}
</main></body></html>`;
}

const APP_HTML = page(`
<p class="meta">Inbox &rarr; ideas &rarr; drafts &rarr; published. LLM actions read
CLAUDE.md, voice.md, and the format files live from disk.</p>

<div class="card">
  <div class="row" style="margin-top:0">
    <input type="text" id="inbox-line" placeholder="Raw idea: what happened, where, why it stuck">
    <button id="add-inbox" class="secondary">Add to inbox</button>
    <button id="run-ideate">/ideate</button>
  </div>
</div>

<div class="layout">
  <div>
    <h2>Inbox</h2><div id="inbox-list"></div>
    <h2>Ideas</h2><div id="ideas-list"></div>
    <h2>Drafts</h2><div id="drafts-list"></div>
    <h2>Published</h2><div id="published-list"></div>
  </div>
  <div>
    <div class="card">
      <div class="meta" id="editor-label">Select a file, or develop an inbox line.</div>
      <div class="panel"><textarea id="editor" placeholder="File content..."></textarea></div>
      <div class="row">
        <button id="save-file" class="secondary">Save</button>
        <select id="format-select"></select>
        <button id="run-draft">/draft from editor</button>
        <button id="run-review" class="secondary">/review</button>
        <button id="run-repurpose" class="secondary">/repurpose &rarr; format</button>
        <button id="run-publish" class="secondary">Mark published</button>
      </div>
      <div class="row">
        <input type="text" id="publish-url" placeholder="URL of the published piece (optional)">
      </div>
      <div id="action-error" class="error hidden"></div>
      <div id="action-ok" class="ok hidden"></div>
    </div>
    <div class="panel"><pre class="result hidden" id="result"></pre></div>
  </div>
</div>

<script>
const state = { currentPath: null, formats: [] };
const $ = (id) => document.getElementById(id);

function showError(message) {
  $('action-error').textContent = message;
  $('action-error').classList.remove('hidden');
  $('action-ok').classList.add('hidden');
}
function showOk(message) {
  $('action-ok').textContent = message;
  $('action-ok').classList.remove('hidden');
  $('action-error').classList.add('hidden');
}
function showResult(text) {
  $('result').textContent = text;
  $('result').classList.remove('hidden');
}
async function api(path, body) {
  const options = body === undefined
    ? {}
    : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
  const response = await fetch(path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || ('HTTP ' + response.status));
  return payload;
}
async function withBusy(button, fn) {
  const label = button.textContent;
  button.disabled = true;
  button.textContent = 'working...';
  try { await fn(); } catch (error) { showError(error.message); }
  finally { button.disabled = false; button.textContent = label; }
}

function itemButton(entry, onclick) {
  const button = document.createElement('button');
  button.className = 'item';
  const title = document.createElement('span');
  title.textContent = entry.title;
  const meta = document.createElement('span');
  meta.className = 'meta';
  meta.textContent = entry.path + (entry.status ? ' · ' + entry.status : '');
  button.append(title, meta);
  button.addEventListener('click', onclick);
  return button;
}

async function openFile(path) {
  const payload = await api('/api/file?path=' + encodeURIComponent(path));
  state.currentPath = path;
  $('editor').value = payload.content;
  $('editor-label').textContent = path;
}

async function refresh() {
  const data = await api('/api/state');
  state.formats = data.formats;
  $('format-select').innerHTML = '';
  for (const format of data.formats) {
    const option = document.createElement('option');
    option.textContent = format;
    $('format-select').appendChild(option);
  }
  const render = (id, entries, onclick) => {
    const list = $(id);
    list.innerHTML = '';
    for (const entry of entries) list.appendChild(itemButton(entry, () => onclick(entry)));
    if (entries.length === 0) list.innerHTML = '<div class="meta">(empty)</div>';
  };
  render('inbox-list', data.inbox.map((line) => ({ title: line, path: 'inbox.md' })), (entry) => {
    $('editor').value = entry.title + '\\n\\n';
    $('editor-label').textContent = 'new idea from inbox line (edit, then /draft or Save as idea)';
    state.currentPath = null;
  });
  render('ideas-list', data.ideas, (entry) => openFile(entry.path).catch((e) => showError(e.message)));
  render('drafts-list', data.drafts, (entry) => openFile(entry.path).catch((e) => showError(e.message)));
  render('published-list', data.published, (entry) => openFile(entry.path).catch((e) => showError(e.message)));
}

$('add-inbox').addEventListener('click', (event) => withBusy(event.target, async () => {
  const line = $('inbox-line').value.trim();
  if (!line) throw new Error('Write an idea first.');
  await api('/api/inbox', { line });
  $('inbox-line').value = '';
  showOk('Added to inbox.');
  await refresh();
}));

$('run-ideate').addEventListener('click', (event) => withBusy(event.target, async () => {
  const payload = await api('/api/action/ideate');
  showResult(payload.result);
}));

$('save-file').addEventListener('click', (event) => withBusy(event.target, async () => {
  if (!state.currentPath) {
    const slug = prompt('Slug for the new idea file (kebab-case):');
    if (!slug) return;
    await api('/api/develop', { slug, content: $('editor').value });
    showOk('Saved to ideas/' + slug + '.md and struck the inbox line if it matched.');
  } else {
    await api('/api/file', { path: state.currentPath, content: $('editor').value });
    showOk('Saved ' + state.currentPath);
  }
  await refresh();
}));

$('run-draft').addEventListener('click', (event) => withBusy(event.target, async () => {
  const idea = state.currentPath && state.currentPath.startsWith('ideas/')
    ? state.currentPath.replace(/^ideas\\//, '').replace(/\\.md$/, '')
    : $('editor').value.slice(0, 2000);
  if (!idea.trim()) throw new Error('Open an idea or paste idea text in the editor.');
  const payload = await api('/api/action/draft', { idea, format: $('format-select').value });
  showOk('Draft written to ' + payload.filePath);
  showResult(payload.report || '(no report)');
  await refresh();
  await openFile(payload.filePath);
}));

$('run-review').addEventListener('click', (event) => withBusy(event.target, async () => {
  if (!state.currentPath) throw new Error('Open a draft first.');
  const payload = await api('/api/action/review', { path: state.currentPath });
  showResult(payload.result);
}));

$('run-repurpose').addEventListener('click', (event) => withBusy(event.target, async () => {
  if (!state.currentPath) throw new Error('Open a published piece first.');
  const payload = await api('/api/action/repurpose', { path: state.currentPath, target: $('format-select').value });
  if (payload.blocked) {
    showResult(payload.report);
    showError('Repurpose blocked: material needed. See the list above.');
  } else {
    showOk('Adapted draft written to ' + payload.filePath);
    showResult(payload.report || '(no report)');
    await refresh();
  }
}));

$('run-publish').addEventListener('click', (event) => withBusy(event.target, async () => {
  if (!state.currentPath || !state.currentPath.startsWith('drafts/')) {
    throw new Error('Open a draft (drafts/...) first.');
  }
  const payload = await api('/api/publish', { path: state.currentPath, url: $('publish-url').value.trim() });
  showOk('Moved to ' + payload.filePath);
  state.currentPath = null;
  $('editor').value = '';
  await refresh();
}));

refresh().catch((error) => showError(error.message));
</script>`);

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error("Request body too large."));
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
  process.stderr.write(`[content-creator] ${message}\n`);
}

async function handleApi(url, request, response) {
  if (request.method === "GET" && url.pathname === "/api/state") {
    sendJson(response, 200, await listAll());
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/file") {
    const filePath = url.searchParams.get("path");
    if (!filePath) {
      sendJson(response, 400, { error: "path is required" });
      return;
    }
    sendJson(response, 200, { path: filePath, content: await readText(filePath) });
    return;
  }
  if (request.method !== "POST") {
    sendJson(response, 404, { error: "not found" });
    return;
  }
  const body = JSON.parse((await readBody(request)) || "{}");

  if (url.pathname === "/api/file") {
    if (!body.path || typeof body.content !== "string") {
      throw new Error("path and content are required.");
    }
    await writeText(body.path, body.content);
    sendJson(response, 200, { ok: true });
    return;
  }
  if (url.pathname === "/api/inbox") {
    const dated = await appendInbox(String(body.line || ""));
    sendJson(response, 200, { ok: true, line: dated });
    return;
  }
  if (url.pathname === "/api/develop") {
    const slug = slugify(body.slug || "");
    const content = String(body.content || "").trim();
    if (!content) {
      throw new Error("content is required.");
    }
    const firstLine = content.split("\n")[0].trim();
    await writeText(`ideas/${slug}.md`, content.startsWith("#") ? content : `# ${slug}\n\n${content}\n`);
    const struck = firstLine ? await strikeInboxLine(firstLine) : false;
    sendJson(response, 200, { ok: true, path: `ideas/${slug}.md`, struck });
    return;
  }
  if (url.pathname === "/api/publish") {
    const filePath = await publishDraft(String(body.path || ""), String(body.url || ""));
    sendJson(response, 200, { ok: true, filePath });
    return;
  }
  if (url.pathname === "/api/action/ideate") {
    sendJson(response, 200, { result: await ideate() });
    return;
  }
  if (url.pathname === "/api/action/draft") {
    sendJson(response, 200, await draft({ idea: String(body.idea || ""), format: String(body.format || "") }));
    return;
  }
  if (url.pathname === "/api/action/review") {
    sendJson(response, 200, { result: await review({ path: String(body.path || "") }) });
    return;
  }
  if (url.pathname === "/api/action/repurpose") {
    sendJson(response, 200, await repurpose({ path: String(body.path || ""), target: String(body.target || "") }));
    return;
  }
  sendJson(response, 404, { error: "not found" });
}

function createServer() {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
      if (request.method === "GET" && url.pathname === "/") {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(APP_HTML);
        return;
      }
      if (request.method === "GET" && url.pathname === "/healthz") {
        sendJson(response, 200, { ok: true });
        return;
      }
      await handleApi(url, request, response);
    } catch (error) {
      log(`error: ${error.message}`);
      sendJson(response, 400, { error: error.message });
    }
  });
}

function resolvePort() {
  const raw = process.env.CONTENT_PORT;
  if (raw === undefined || raw.trim() === "") {
    return DEFAULT_PORT;
  }
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid CONTENT_PORT: ${raw}`);
  }
  return port;
}

const server = createServer();
server.listen(resolvePort(), () => {
  // With CONTENT_PORT=0 the OS assigns an ephemeral port. The Athena hub
  // parses this line from STDOUT — do not move it to stderr.
  process.stdout.write(`listening on http://0.0.0.0:${server.address().port}\n`);
});
