// Obsidian note rendering and writing. Output target: vault/Abyss/Quantum Trader/.

import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_VAULT_DIR = "vault/Abyss/Quantum Trader";

function vaultDir() {
  return process.env.QT_VAULT_DIR?.trim() || DEFAULT_VAULT_DIR;
}

function pct(value, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "n/a";
  }
  return `${(value * 100).toFixed(digits)}%`;
}

function num(value, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "n/a";
  }
  return value.toFixed(digits);
}

function escapeCell(text) {
  return String(text ?? "").replace(/\|/g, "\\|").replace(/\n+/g, " ");
}

function sanitizeTitle(text) {
  // LLM-generated titles can contain newlines, which corrupt YAML frontmatter.
  return String(text ?? "").replace(/[\r\n]+/g, " ").trim();
}

function slugify(text) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "analysis"
  );
}

function convictionCallout(conviction) {
  const normalized = String(conviction || "").toLowerCase();
  if (normalized === "high") {
    return "success";
  }
  if (normalized === "low") {
    return "warning";
  }
  return "note";
}

function renderCompanySection(company) {
  const lines = [];
  const ticker = String(company.ticker || "").toUpperCase();
  lines.push(`### [[${ticker}]] — ${company.name || ticker}`);
  lines.push("");
  lines.push(`> [!${convictionCallout(company.conviction)}] So What — conviction: ${company.conviction || "n/a"}${company.horizon ? ` · horizon: ${company.horizon}` : ""}`);
  lines.push(`> ${company.so_what || "n/a"}`);
  lines.push("");
  if (company.role) {
    lines.push(`**Role:** ${company.role}`);
    lines.push("");
  }
  if (company.chain_path) {
    lines.push(`**Ripple:** \`${company.chain_path}\``);
    lines.push("");
  }
  if (company.phase) {
    lines.push(`**Phase:** ${company.phase}`);
    lines.push("");
  }
  const reasoning = company.reasoning || {};
  lines.push("| Lens | Reasoning |");
  lines.push("| --- | --- |");
  lines.push(`| Economic | ${escapeCell(reasoning.economic)} |`);
  lines.push(`| Political / regulatory | ${escapeCell(reasoning.political)} |`);
  lines.push(`| Consumer behavior | ${escapeCell(reasoning.consumer_behavior)} |`);
  lines.push(`| Company history | ${escapeCell(reasoning.company_history)} |`);
  lines.push("");
  if (Array.isArray(company.risks) && company.risks.length > 0) {
    lines.push("> [!warning] Risks");
    for (const risk of company.risks) {
      lines.push(`> - ${risk}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function renderSignalsTable(signalsByTicker) {
  const tickers = Object.keys(signalsByTicker).filter((ticker) => signalsByTicker[ticker]);
  if (tickers.length === 0) {
    return "";
  }
  const lines = [];
  lines.push("## Quant Signals");
  lines.push("");
  lines.push("| Ticker | Last | 1M | 3M | 6M | 12M | RSI-14 | Vol | Max DD | Beta | Trend |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const ticker of tickers) {
    const signals = signalsByTicker[ticker];
    const trend = [
      signals.aboveSma50 === null ? "?" : signals.aboveSma50 ? "▲50" : "▼50",
      signals.aboveSma200 === null ? "?" : signals.aboveSma200 ? "▲200" : "▼200",
    ].join(" ");
    lines.push(
      `| [[${ticker}]] | ${num(signals.lastClose)} | ${pct(signals.momentum1m)} | ` +
        `${pct(signals.momentum3m)} | ${pct(signals.momentum6m)} | ${pct(signals.momentum12m)} | ` +
        `${num(signals.rsi14, 1)} | ${pct(signals.annualizedVolatility)} | ` +
        `${pct(signals.maxDrawdown)} | ${num(signals.beta)} | ${trend} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function renderFundamentalsTable(overviewsByTicker) {
  const tickers = Object.keys(overviewsByTicker).filter(
    (ticker) => overviewsByTicker[ticker],
  );
  if (tickers.length === 0) {
    return "";
  }
  const lines = [];
  lines.push("## Fundamentals");
  lines.push("");
  lines.push("| Ticker | Sector | Industry | P/E | Fwd P/E | Rev growth YoY | Profit margin | Div yield |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const ticker of tickers) {
    const overview = overviewsByTicker[ticker];
    lines.push(
      `| [[${ticker}]] | ${escapeCell(overview.sector)} | ${escapeCell(overview.industry)} | ` +
        `${num(overview.peRatio)} | ${num(overview.forwardPe)} | ` +
        `${pct(overview.revenueGrowthYoy)} | ${pct(overview.profitMargin)} | ` +
        `${pct(overview.dividendYield)} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function renderPortfolioSection(portfolio, metrics, implications) {
  if (!portfolio) {
    return "";
  }
  const lines = [];
  lines.push("## Portfolio");
  lines.push("");
  lines.push(
    `Holdings: ${metrics.holdingCount} · top position ${pct(metrics.topHolding)} · ` +
      `top 3 = ${pct(metrics.top3Weight)} · HHI ${num(metrics.hhi, 3)} · ` +
      `cash ${pct(portfolio.cashWeight)}`,
  );
  lines.push("");
  lines.push("| Sector | Weight |");
  lines.push("| --- | --- |");
  for (const sector of metrics.sectors) {
    lines.push(`| ${escapeCell(sector.sector)} | ${pct(sector.weight)} |`);
  }
  lines.push("");
  if (implications) {
    if (implications.observations) {
      lines.push(`> [!info] Portfolio implications`);
      lines.push(`> ${implications.observations}`);
      lines.push("");
    }
    const moves = implications.suggested_moves || [];
    if (moves.length > 0) {
      lines.push("| Action | Ticker | Rationale |");
      lines.push("| --- | --- | --- |");
      for (const move of moves) {
        const ticker = String(move.ticker || "").toUpperCase();
        lines.push(
          `| ${move.action || ""} | [[${ticker}]] | ${escapeCell(move.rationale)} |`,
        );
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

function renderNote({
  title,
  inputKind,
  inputText,
  analysis,
  signalsByTicker,
  overviewsByTicker,
  portfolio,
  portfolioMetrics,
  dataErrors,
  mode,
}) {
  const allTickers = [
    ...new Set([
      ...Object.keys(signalsByTicker || {}),
      ...(analysis?.directCompanies || []).map((company) =>
        String(company.ticker || "").toUpperCase(),
      ),
      ...(analysis?.trickleDownCompanies || []).map((company) =>
        String(company.ticker || "").toUpperCase(),
      ),
    ]),
  ].filter(Boolean);

  const lines = [];
  lines.push("---");
  lines.push(`title: "${sanitizeTitle(title).replace(/"/g, "'")}"`);
  lines.push(`date: ${new Date().toISOString().slice(0, 10)}`);
  lines.push("tags:");
  lines.push("  - quantum-trader");
  lines.push(`  - source/${inputKind}`);
  if (allTickers.length > 0) {
    lines.push("tickers:");
    for (const ticker of allTickers) {
      lines.push(`  - ${ticker}`);
    }
  }
  lines.push("---");
  lines.push("");
  lines.push(`# ${title}`);
  lines.push("");

  if (analysis?.thesis) {
    lines.push("> [!abstract] Thesis");
    lines.push(`> ${analysis.thesis}`);
    lines.push("");
  }
  if (analysis?.macroContext) {
    lines.push("> [!quote] Macro context");
    lines.push(`> ${analysis.macroContext}`);
    lines.push("");
  }

  if (analysis) {
    if (analysis.directCompanies.length > 0) {
      lines.push("## Direct plays");
      lines.push("");
      for (const company of analysis.directCompanies) {
        lines.push(renderCompanySection(company));
      }
    }
    if (analysis.trickleDownCompanies.length > 0) {
      lines.push("## Trickle-down plays");
      lines.push("");
      lines.push("> [!tip] Why these matter");
      lines.push(
        "> Non-obvious second-order beneficiaries the headline does not name —",
      );
      lines.push("> this is where mispricing tends to live.");
      lines.push("");
      for (const company of analysis.trickleDownCompanies) {
        lines.push(renderCompanySection(company));
      }
    }
  }

  lines.push(renderSignalsTable(signalsByTicker));
  lines.push(renderFundamentalsTable(overviewsByTicker));
  lines.push(renderPortfolioSection(portfolio, portfolioMetrics, analysis?.portfolioImplications));

  if (Object.keys(dataErrors).length > 0) {
    lines.push("## Data gaps");
    lines.push("");
    for (const [key, message] of Object.entries(dataErrors)) {
      lines.push(`- \`${key}\`: ${message}`);
    }
    lines.push("");
  }

  if (inputKind === "article" && inputText) {
    lines.push("## Source article");
    lines.push("");
    lines.push("> [!example]- Original text (collapsed)");
    for (const line of inputText.slice(0, 8000).split("\n")) {
      lines.push(`> ${line}`);
    }
    lines.push("");
  }

  lines.push("%%");
  lines.push(`Generated by scripts/quantum-trader.mjs (${mode}). Not financial advice;`);
  lines.push("final decision stays with the human.");
  lines.push("%%");
  lines.push("");
  return lines.join("\n");
}

async function writeNote(content, title) {
  const date = new Date().toISOString().slice(0, 10);
  const slug = slugify(title);
  const dir = vaultDir();
  await fs.mkdir(dir, { recursive: true });
  // Never clobber a same-day, same-title note (concurrent runs): suffix on EEXIST.
  for (let suffix = 0; ; suffix += 1) {
    const fileName = `${date} - ${slug}${suffix === 0 ? "" : `-${suffix}`}.md`;
    const filePath = path.join(dir, fileName);
    try {
      await fs.writeFile(filePath, content, { encoding: "utf8", flag: "wx" });
      return filePath;
    } catch (error) {
      if (error.code !== "EEXIST") {
        throw error;
      }
    }
  }
}

export { renderNote, writeNote };
