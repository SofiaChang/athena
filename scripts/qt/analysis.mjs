// Quantum-trader analysis layer: prompt construction and structured-output
// parsing. Provider clients live in scripts/shared/llm.mjs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { extractJson, llmChat, resolveProvider } from "../shared/llm.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_SKILL_PATH = "skills/quantum-trading/SKILL.md";

function loadMethodology() {
  const skillPath = process.env.QT_SKILL_PATH?.trim() || DEFAULT_SKILL_PATH;
  const resolved = path.isAbsolute(skillPath) ? skillPath : path.join(REPO_ROOT, skillPath);
  try {
    // Strip frontmatter; the prompt needs the body only.
    return fs.readFileSync(resolved, "utf8").replace(/^---\n[\s\S]*?\n---\n/, "");
  } catch {
    throw new Error(`Quantum-trading methodology not found at ${resolved}.`);
  }
}

const ANALYSIS_SCHEMA_DESCRIPTION = `{
  "thesis": "2-4 sentence core thesis of what the input means for markets",
  "macro_context": "economic, political, and consumer-behavior backdrop",
  "direct_companies": [
    {
      "ticker": "EXCHANGE-LISTED TICKER, uppercase",
      "name": "company name",
      "role": "why this company is directly implicated",
      "chain_path": "shock -> ... -> this company, each hop labeled (upstream|downstream|horizontal|infrastructure)",
      "phase": "response | reroute-cleanup | repair | rebuild-normalize",
      "reasoning": {
        "economic": "...",
        "political": "...",
        "consumer_behavior": "...",
        "company_history": "..."
      },
      "so_what": "the actionable 'so what' for an investor",
      "conviction": "high | medium | low",
      "horizon": "e.g. 6-12 months",
      "risks": ["..."]
    }
  ],
  "trickle_down_companies": [
    {
      "ticker": "...",
      "name": "...",
      "role": "the non-obvious second-order link (supplier, infrastructure, logistics, materials, tooling, financing, distribution...)",
      "chain_path": "shock -> ... -> this company, each hop labeled (upstream|downstream|horizontal|infrastructure)",
      "phase": "response | reroute-cleanup | repair | rebuild-normalize",
      "reasoning": {
        "economic": "...",
        "political": "...",
        "consumer_behavior": "...",
        "company_history": "..."
      },
      "so_what": "...",
      "conviction": "high | medium | low",
      "horizon": "...",
      "risks": ["..."]
    }
  ],
  "portfolio_implications": {
    "observations": "how this interacts with the given portfolio: concentration, overlap, diversification gaps",
    "suggested_moves": [
      { "action": "increase | decrease | initiate | avoid", "ticker": "...", "rationale": "..." }
    ]
  }
}`;

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "n/a";
  }
  return value.toFixed(digits);
}

function asPercent(value) {
  // null * 100 === 0 would silently report "0.00%" for missing history.
  return value === null || value === undefined ? null : value * 100;
}

function formatSignalsBlock(signalsByTicker) {
  const blocks = [];
  for (const [ticker, signals] of Object.entries(signalsByTicker)) {
    if (!signals) {
      continue;
    }
    blocks.push(
      [
        `${ticker}: last close ${formatNumber(signals.lastClose)}; ` +
          `1m momentum ${formatNumber(asPercent(signals.momentum1m))}%; ` +
          `3m ${formatNumber(asPercent(signals.momentum3m))}%; ` +
          `6m ${formatNumber(asPercent(signals.momentum6m))}%; ` +
          `12m ${formatNumber(asPercent(signals.momentum12m))}%; ` +
          `RSI-14 ${formatNumber(signals.rsi14, 1)}; ` +
          `annualized vol ${formatNumber(asPercent(signals.annualizedVolatility))}%; ` +
          `max drawdown ${formatNumber(asPercent(signals.maxDrawdown))}%; ` +
          `beta vs SPY ${formatNumber(signals.beta)}; ` +
          (signals.aboveSma50 === null ? "" : `above SMA50: ${signals.aboveSma50}; `) +
          (signals.aboveSma200 === null ? "" : `above SMA200: ${signals.aboveSma200}`),
      ].join("\n"),
    );
  }
  return blocks.join("\n");
}

function buildSystemPrompt() {
  return [
    "You are a quantitative trader running ripple (chain-reaction) analysis.",
    "",
    "## Methodology (follow it exactly, step by step)",
    "",
    loadMethodology(),
    "",
    "## Output rules",
    "- Every company MUST have a chain_path showing each hop from the shock,",
    "  a phase, and reasoning across the four lenses: economic,",
    "  political/regulatory, consumer behavior, and company history.",
    "- Only use real, exchange-listed tickers you are confident exist. If unsure,",
    "  omit the company rather than invent a ticker.",
    "- Apply the earnings-impact screen before assigning conviction; say what",
    "  is already priced in.",
    "- Name a concrete chain-breaking mechanism in every risks field.",
    "- You are advising a human who makes the final decision. Frame findings as",
    "  opportunities with reasoning.",
    "- Respond with ONLY a JSON object matching this shape:",
    ANALYSIS_SCHEMA_DESCRIPTION,
  ].join("\n");
}

function buildUserPrompt({ inputKind, inputText, tickers, signalsByTicker, portfolio }) {
  const parts = [];
  if (inputKind === "article") {
    parts.push("## News article\n", inputText.slice(0, 12000));
  } else {
    parts.push("## Requested tickers\n", tickers.join(", "));
  }
  if (tickers.length > 0 && inputKind === "article") {
    parts.push("\n## Tickers already identified for context\n", tickers.join(", "));
  }
  const signalsBlock = formatSignalsBlock(signalsByTicker);
  if (signalsBlock) {
    parts.push("\n## Computed quantitative signals (from daily price history)\n", signalsBlock);
  }
  if (portfolio && portfolio.holdings.length > 0) {
    const lines = portfolio.holdings.map(
      (holding) =>
        `- ${holding.ticker}: ${(holding.weight * 100).toFixed(1)}%` +
        (holding.sector ? ` (${holding.sector})` : ""),
    );
    parts.push("\n## Current portfolio allocation\n", lines.join("\n"));
  }
  parts.push(
    "\n## Task\n",
    "Identify the direct companies and the trickle-down companies, reason across",
    "the economic, political, consumer-behavior, and company-history lenses, give",
    "each a 'so what', and relate the findings to the portfolio if one was given.",
    "Return only the JSON object.",
  );
  return parts.join("\n");
}

async function analyze(context) {
  const raw = await llmChat(buildSystemPrompt(), buildUserPrompt(context));
  const parsed = extractJson(raw);
  return {
    thesis: parsed.thesis || "",
    macroContext: parsed.macro_context || "",
    directCompanies: Array.isArray(parsed.direct_companies) ? parsed.direct_companies : [],
    trickleDownCompanies: Array.isArray(parsed.trickle_down_companies)
      ? parsed.trickle_down_companies
      : [],
    portfolioImplications: parsed.portfolio_implications || null,
  };
}
const EXTRACTION_SYSTEM_PROMPT = [
  "You extract stock tickers from news text.",
  "Return ONLY JSON: { \"tickers\": [\"...\"], \"suggested_title\": \"short note title\" }.",
  "Include tickers of companies directly named in the text.",
  "Only real exchange-listed tickers you are confident in; omit anything unsure.",
].join("\n");

async function extractTickers(articleText) {
  const raw = await llmChat(EXTRACTION_SYSTEM_PROMPT, articleText.slice(0, 12000));
  const parsed = extractJson(raw);
  const tickers = (Array.isArray(parsed.tickers) ? parsed.tickers : [])
    .map((ticker) => String(ticker).toUpperCase().trim())
    .filter((ticker) => /^[A-Z][A-Z.\-]{0,5}$/.test(ticker));
  return {
    tickers: [...new Set(tickers)],
    suggestedTitle: String(parsed.suggested_title || "").trim(),
  };
}

export { analyze, extractTickers, resolveProvider };
