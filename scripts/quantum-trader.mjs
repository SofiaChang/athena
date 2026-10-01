#!/usr/bin/env node
// Quantum Trader: news/tickers -> LLM reasoning + quant signals -> Obsidian note.
//
// Usage:
//   node scripts/quantum-trader.mjs --ticker NVDA,TSM
//   node scripts/quantum-trader.mjs --article path/to/article.txt
//   node scripts/quantum-trader.mjs --article-url https://example.com/news
//   node scripts/quantum-trader.mjs --ticker AAPL --signals-only
//
// Env: ANTHROPIC_API_KEY or OPENAI_API_KEY (LLM), ALPHAVANTAGE_API_KEY (market
// data; defaults to the free "demo" key), QT_PORTFOLIO_PATH, QT_VAULT_DIR,
// QT_CACHE_DIR, QT_LLM_PROVIDER, QT_LLM_MODEL.

import fs from "node:fs/promises";

import { runQuantumTrader } from "./qt/run.mjs";

const HELP_TEXT = `Quantum Trader — news/tickers -> analysis note in your Obsidian vault.

Options:
  --ticker AAPL,MSFT     One or more tickers (repeatable, comma-separated)
  --article <path>       News article from a local file (.txt/.md)
  --article-url <url>    News article fetched from a URL
  --title "..."          Override the note title
  --signals-only         Skip the LLM; emit quant signals + portfolio only
  --no-market-data       Skip Alpha Vantage calls entirely
  --help                 Show this help
`;

function parseArgs(argv) {
  const options = {
    tickers: [],
    articlePath: null,
    articleUrl: null,
    title: null,
    signalsOnly: false,
    noMarketData: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--ticker") {
      const value = argv[++index];
      if (!value) {
        throw new Error("--ticker requires a value");
      }
      options.tickers.push(
        ...value
          .split(",")
          .map((ticker) => ticker.trim().toUpperCase())
          .filter((ticker) => /^[A-Z][A-Z.\-]{0,5}$/.test(ticker)),
      );
    } else if (arg === "--article") {
      options.articlePath = argv[++index];
      if (!options.articlePath) {
        throw new Error("--article requires a file path");
      }
    } else if (arg === "--article-url") {
      options.articleUrl = argv[++index];
      if (!options.articleUrl) {
        throw new Error("--article-url requires a URL");
      }
    } else if (arg === "--title") {
      options.title = argv[++index];
    } else if (arg === "--signals-only") {
      options.signalsOnly = true;
    } else if (arg === "--no-market-data") {
      options.noMarketData = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  options.tickers = [...new Set(options.tickers)];
  return options;
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

async function readArticleInput(options) {
  if (options.articlePath) {
    return fs.readFile(options.articlePath, "utf8");
  }
  if (options.articleUrl) {
    const response = await fetch(options.articleUrl);
    if (!response.ok) {
      throw new Error(`Article fetch failed: HTTP ${response.status} for ${options.articleUrl}`);
    }
    const body = await response.text();
    if (/^\s*</.test(body)) {
      return stripHtml(body);
    }
    return body;
  }
  return null;
}

function log(message) {
  process.stderr.write(`${message}\n`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(HELP_TEXT);
    return;
  }
  const articleText = await readArticleInput(options);
  const result = await runQuantumTrader(
    {
      articleText,
      tickers: options.tickers,
      title: options.title,
      signalsOnly: options.signalsOnly,
      noMarketData: options.noMarketData,
    },
    log,
  );
  process.stdout.write(`${result.filePath}\n`);
}

main().catch((error) => {
  process.stderr.write(`quantum-trader failed: ${error.message}\n`);
  process.exit(1);
});
