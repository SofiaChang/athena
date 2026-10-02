// Zero-dependency web surface for the quantum trader. Serves a form and
// renders pipeline results as HTML. Entry: node scripts/qt/web-server.mjs
// Env: QT_PORT (default 8787) plus the pipeline env vars (see run.mjs imports).

import http from "node:http";

import { runQuantumTrader } from "./run.mjs";

const DEFAULT_PORT = 8787;

const PAGE_STYLE = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    background: #0d1117; color: #e6edf3; line-height: 1.55; }
  main { max-width: 880px; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
  h1 { font-size: 1.4rem; letter-spacing: 0.04em; }
  h1 .accent { color: #7ee787; }
  h2 { font-size: 1.05rem; margin-top: 2rem; border-bottom: 1px solid #30363d;
    padding-bottom: 0.3rem; }
  h3 { font-size: 0.95rem; margin-bottom: 0.25rem; }
  label { display: block; font-size: 0.8rem; color: #9da7b3; margin: 1rem 0 0.25rem; }
  input[type=text], textarea { width: 100%; background: #161b22; color: #e6edf3;
    border: 1px solid #30363d; border-radius: 6px; padding: 0.55rem 0.7rem;
    font: inherit; font-size: 0.85rem; }
  textarea { min-height: 140px; resize: vertical; }
  button { margin-top: 1.25rem; background: #238636; color: #fff; border: 0;
    border-radius: 6px; padding: 0.6rem 1.4rem; font: inherit; font-weight: 600;
    cursor: pointer; }
  button:hover { background: #2ea043; }
  .row { display: flex; gap: 1rem; flex-wrap: wrap; }
  .row > div { flex: 1; min-width: 220px; }
  .checkbox { display: flex; align-items: center; gap: 0.5rem; margin-top: 1rem;
    font-size: 0.8rem; color: #9da7b3; }
  table { border-collapse: collapse; width: 100%; font-size: 0.78rem; margin: 0.75rem 0; }
  th, td { border: 1px solid #30363d; padding: 0.35rem 0.55rem; text-align: left;
    vertical-align: top; }
  th { background: #161b22; color: #9da7b3; }
  .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px;
    padding: 1rem 1.1rem; margin: 1rem 0; }
  .callout { border-left: 3px solid #7ee787; background: #161b22; padding: 0.7rem 1rem;
    margin: 1rem 0; font-size: 0.85rem; }
  .callout.macro { border-left-color: #d2a8ff; }
  .callout.warn { border-left-color: #f0b72f; }
  .ticker { color: #7ee787; font-weight: 700; }
  .chain { color: #79c0ff; font-size: 0.78rem; word-break: break-word; }
  .meta { color: #9da7b3; font-size: 0.75rem; }
  .conviction-high { color: #7ee787; } .conviction-medium { color: #f0b72f; }
  .conviction-low { color: #f85149; }
  .error { border-left: 3px solid #f85149; background: #2d1518; padding: 0.8rem 1rem;
    border-radius: 0 6px 6px 0; margin-top: 0.75rem; }
  .status-panel { background: #161b22; border: 1px solid #30363d; border-radius: 8px;
    padding: 1rem 1.1rem; margin-top: 1.25rem; }
  .status-head { display: flex; align-items: center; gap: 0.6rem; font-weight: 600;
    font-size: 0.9rem; }
  .spinner { width: 14px; height: 14px; border: 2px solid #30363d;
    border-top-color: #7ee787; border-radius: 50%; animation: qt-spin 0.8s linear infinite; }
  @keyframes qt-spin { to { transform: rotate(360deg); } }
  .status-panel.done .spinner { display: none; }
  #qt-steps { list-style: none; padding-left: 0; margin: 0.6rem 0 0; }
  #qt-steps li { padding: 0.15rem 0; }
  button:disabled { background: #1a4d26; color: #9da7b3; cursor: wait; }
  ul { margin: 0.4rem 0; padding-left: 1.2rem; }
  code { background: #161b22; padding: 0.1rem 0.35rem; border-radius: 4px; }
`;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pct(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "n/a";
  }
  return `${(value * 100).toFixed(1)}%`;
}

function num(value, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "n/a";
  }
  return value.toFixed(digits);
}

function page(body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Quantum Trader</title>
<style>${PAGE_STYLE}</style>
</head>
<body><main>
<h1><span class="accent">&#9672;</span> Quantum Trader</h1>
${body}
</main></body></html>`;
}

const FORM_SCRIPT = `
document.getElementById('qt-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  const button = form.querySelector('button[type=submit]');
  const status = document.getElementById('qt-status');
  const steps = document.getElementById('qt-steps');
  const statusText = document.getElementById('qt-status-text');
  button.disabled = true;
  button.textContent = 'Running...';
  status.style.display = 'block';
  status.classList.remove('done');
  steps.innerHTML = '';
  statusText.textContent = 'Run in progress';
  const startedAt = Date.now();
  const addStep = (message) => {
    const li = document.createElement('li');
    li.className = 'meta';
    li.textContent = '[' + Math.round((Date.now() - startedAt) / 1000) + 's] ' + message;
    steps.appendChild(li);
  };
  const fail = (message) => {
    status.classList.add('done');
    statusText.textContent = 'Run failed';
    const div = document.createElement('div');
    div.className = 'error';
    div.textContent = message;
    status.appendChild(div);
    button.disabled = false;
    button.textContent = 'Run analysis';
  };
  try {
    const response = await fetch('/analyze/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(new FormData(form)),
    });
    if (!response.ok || !response.body) {
      throw new Error('HTTP ' + response.status);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      let boundary;
      while ((boundary = buffer.indexOf('\\n\\n')) !== -1) {
        const rawEvent = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const eventLine = rawEvent.split('\\n').find((line) => line.startsWith('event: '));
        const dataLine = rawEvent.split('\\n').find((line) => line.startsWith('data: '));
        if (!dataLine) continue;
        const kind = eventLine ? eventLine.slice(7) : 'step';
        const data = JSON.parse(dataLine.slice(6));
        if (kind === 'step') {
          addStep(data);
        } else if (kind === 'result') {
          document.open();
          document.write(data);
          document.close();
          return;
        } else if (kind === 'error') {
          fail(data);
          return;
        }
      }
    }
    fail('Connection closed before the result arrived.');
  } catch (error) {
    fail(error.message);
  }
});
`;

function formPage(errorMessage = "") {
  return page(`
${errorMessage ? `<div class="error">${escapeHtml(errorMessage)}</div>` : ""}
<form method="POST" action="/analyze" id="qt-form">
  <div class="row">
    <div>
      <label for="tickers">Tickers (comma-separated)</label>
      <input type="text" id="tickers" name="tickers" placeholder="NVDA, TSM, ASML">
    </div>
    <div>
      <label for="title">Note title (optional)</label>
      <input type="text" id="title" name="title" placeholder="Auto-generated if empty">
    </div>
  </div>
  <label for="article">News article (paste full text; overrides ticker-only mode)</label>
  <textarea id="article" name="article" placeholder="Paste the article here. The trader extracts the companies, maps the ripple, and finds the trickle-down plays."></textarea>
  <div class="checkbox">
    <input type="checkbox" id="signals-only" name="signalsOnly" value="1">
    <label for="signals-only" style="margin:0">Signals only (skip LLM — no API key needed)</label>
  </div>
  <button type="submit">Run analysis</button>
  <p class="meta">Full runs take 60-120s: two LLM passes plus market data. Notes are written to the vault volume.</p>
</form>
<div id="qt-status" class="status-panel" style="display:none">
  <div class="status-head"><span class="spinner"></span><span id="qt-status-text">Run in progress</span></div>
  <ul id="qt-steps"></ul>
</div>
<script>${FORM_SCRIPT}</script>`);
}

function renderCompany(company) {
  const conviction = String(company.conviction || "").toLowerCase();
  const reasoning = company.reasoning || {};
  const risks = Array.isArray(company.risks) ? company.risks : [];
  return `<div class="card">
<h3><span class="ticker">${escapeHtml(company.ticker)}</span> — ${escapeHtml(company.name)}</h3>
<p class="meta">
  <span class="conviction-${escapeHtml(conviction)}">conviction: ${escapeHtml(company.conviction || "n/a")}</span>
  ${company.horizon ? ` · horizon: ${escapeHtml(company.horizon)}` : ""}
  ${company.phase ? ` · phase: ${escapeHtml(company.phase)}` : ""}
</p>
${company.chain_path ? `<p class="chain">ripple: ${escapeHtml(company.chain_path)}</p>` : ""}
${company.role ? `<p>${escapeHtml(company.role)}</p>` : ""}
<div class="callout"><strong>So what:</strong> ${escapeHtml(company.so_what)}</div>
<table>
<tr><th>Economic</th><td>${escapeHtml(reasoning.economic)}</td></tr>
<tr><th>Political</th><td>${escapeHtml(reasoning.political)}</td></tr>
<tr><th>Consumer</th><td>${escapeHtml(reasoning.consumer_behavior)}</td></tr>
<tr><th>History</th><td>${escapeHtml(reasoning.company_history)}</td></tr>
</table>
${risks.length > 0 ? `<div class="callout warn"><strong>Risks:</strong><ul>${risks.map((risk) => `<li>${escapeHtml(risk)}</li>`).join("")}</ul></div>` : ""}
</div>`;
}

function renderSignals(signalsByTicker) {
  const tickers = Object.keys(signalsByTicker).filter((ticker) => signalsByTicker[ticker]);
  if (tickers.length === 0) {
    return "";
  }
  const rows = tickers
    .map((ticker) => {
      const s = signalsByTicker[ticker];
      const trend = [
        s.aboveSma50 === null ? "?" : s.aboveSma50 ? "▲50" : "▼50",
        s.aboveSma200 === null ? "?" : s.aboveSma200 ? "▲200" : "▼200",
      ].join(" ");
      return `<tr><td class="ticker">${escapeHtml(ticker)}</td><td>${num(s.lastClose)}</td>
<td>${pct(s.momentum1m)}</td><td>${pct(s.momentum3m)}</td><td>${pct(s.momentum6m)}</td>
<td>${pct(s.momentum12m)}</td><td>${num(s.rsi14, 1)}</td><td>${pct(s.annualizedVolatility)}</td>
<td>${pct(s.maxDrawdown)}</td><td>${num(s.beta)}</td><td>${trend}</td></tr>`;
    })
    .join("");
  return `<h2>Quant signals</h2>
<table><tr><th>Ticker</th><th>Last</th><th>1M</th><th>3M</th><th>6M</th><th>12M</th>
<th>RSI</th><th>Vol</th><th>Max DD</th><th>Beta</th><th>Trend</th></tr>${rows}</table>`;
}

function renderPortfolio(result) {
  if (!result.portfolio) {
    return "";
  }
  const metrics = result.portfolioMetrics;
  const sectorRows = metrics.sectors
    .map(
      (sector) =>
        `<tr><td>${escapeHtml(sector.sector)}</td><td>${pct(sector.weight)}</td></tr>`,
    )
    .join("");
  const implications = result.analysis?.portfolioImplications;
  const moves = implications?.suggested_moves || [];
  const moveRows = moves
    .map(
      (move) =>
        `<tr><td>${escapeHtml(move.action)}</td><td class="ticker">${escapeHtml(move.ticker)}</td><td>${escapeHtml(move.rationale)}</td></tr>`,
    )
    .join("");
  return `<h2>Portfolio</h2>
<p class="meta">holdings: ${metrics.holdingCount} · top position ${pct(metrics.topHolding)} ·
top 3 = ${pct(metrics.top3Weight)} · HHI ${num(metrics.hhi, 3)} · cash ${pct(result.portfolio.cashWeight)}</p>
<table><tr><th>Sector</th><th>Weight</th></tr>${sectorRows}</table>
${implications?.observations ? `<div class="callout macro">${escapeHtml(implications.observations)}</div>` : ""}
${moveRows ? `<table><tr><th>Action</th><th>Ticker</th><th>Rationale</th></tr>${moveRows}</table>` : ""}`;
}

function resultPage(result) {
  const analysis = result.analysis;
  const gaps = Object.entries(result.dataErrors)
    .map(([key, message]) => `<li><code>${escapeHtml(key)}</code>: ${escapeHtml(message)}</li>`)
    .join("");
  return page(`
<p class="meta"><a href="/" style="color:#79c0ff">&larr; new analysis</a> · mode: ${escapeHtml(result.mode)} ·
note written to <code>${escapeHtml(result.filePath)}</code></p>
<h2>${escapeHtml(result.title)}</h2>
${analysis?.thesis ? `<div class="callout"><strong>Thesis.</strong> ${escapeHtml(analysis.thesis)}</div>` : ""}
${analysis?.macroContext ? `<div class="callout macro"><strong>Macro context.</strong> ${escapeHtml(analysis.macroContext)}</div>` : ""}
${analysis && analysis.directCompanies.length > 0 ? `<h2>Direct plays</h2>${analysis.directCompanies.map(renderCompany).join("")}` : ""}
${analysis && analysis.trickleDownCompanies.length > 0 ? `<h2>Trickle-down plays</h2>${analysis.trickleDownCompanies.map(renderCompany).join("")}` : ""}
${renderSignals(result.signalsByTicker)}
${renderPortfolio(result)}
${gaps ? `<h2>Data gaps</h2><ul>${gaps}</ul>` : ""}`);
}

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

function parseForm(body) {
  const params = new URLSearchParams(body);
  const tickers = String(params.get("tickers") || "")
    .split(",")
    .map((ticker) => ticker.trim().toUpperCase())
    .filter((ticker) => /^[A-Z][A-Z.\-]{0,5}$/.test(ticker));
  const article = String(params.get("article") || "").trim();
  return {
    tickers: [...new Set(tickers)],
    articleText: article || null,
    title: String(params.get("title") || "").trim() || null,
    signalsOnly: params.get("signalsOnly") === "1",
  };
}

function log(message) {
  process.stderr.write(`[qt-web] ${message}\n`);
}

function createServer() {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
      if (request.method === "GET" && url.pathname === "/") {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(formPage());
        return;
      }
      if (request.method === "GET" && url.pathname === "/healthz") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ ok: true }));
        return;
      }
      if (request.method === "POST" && url.pathname === "/analyze/stream") {
        const body = await readBody(request);
        const form = parseForm(body);
        log(
          `analyze/stream: tickers=[${form.tickers.join(",")}] article=${form.articleText ? "yes" : "no"} ` +
            `signalsOnly=${form.signalsOnly}`,
        );
        response.writeHead(200, {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache",
          connection: "keep-alive",
        });
        const send = (event, data) => {
          response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        };
        const heartbeat = setInterval(() => response.write(": heartbeat\n\n"), 15000);
        request.on("close", () => clearInterval(heartbeat));
        try {
          send("step", "Run started.");
          const result = await runQuantumTrader(form, (message) => send("step", message));
          send("result", resultPage(result));
        } catch (runError) {
          send("error", runError.message);
        } finally {
          clearInterval(heartbeat);
          response.end();
        }
        return;
      }
      if (request.method === "POST" && url.pathname === "/analyze") {
        const body = await readBody(request);
        const form = parseForm(body);
        log(
          `analyze: tickers=[${form.tickers.join(",")}] article=${form.articleText ? "yes" : "no"} ` +
            `signalsOnly=${form.signalsOnly}`,
        );
        const result = await runQuantumTrader(form, log);
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(resultPage(result));
        return;
      }
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("Not found");
    } catch (error) {
      log(`error: ${error.message}`);
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(formPage(error.message));
    }
  });
}

function resolvePort() {
  const raw = process.env.QT_PORT;
  if (raw === undefined || raw.trim() === "") {
    return DEFAULT_PORT;
  }
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid QT_PORT: ${raw}`);
  }
  return port;
}

const server = createServer();
server.listen(resolvePort(), () => {
  // With QT_PORT=0 the OS assigns an ephemeral port. The Athena hub parses
  // this line from STDOUT to learn the port — do not move it to stderr.
  process.stdout.write(`listening on http://0.0.0.0:${server.address().port}\n`);
});
