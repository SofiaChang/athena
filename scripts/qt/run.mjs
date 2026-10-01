// Shared pipeline: input -> market data + signals -> LLM analysis -> note.
// Consumed by the CLI (scripts/quantum-trader.mjs) and the web server
// (scripts/qt/web-server.mjs).

import { analyze, extractTickers } from "./analysis.mjs";
import { fetchMarketBundle } from "./market-data.mjs";
import { renderNote, writeNote } from "./note.mjs";
import { applySectorData, concentrationMetrics, loadPortfolio } from "./portfolio.mjs";
import { computeSignals } from "./quant.mjs";

function defaultLog() {
  // Silent by default; callers pass a logger.
}

async function runQuantumTrader(options, log = defaultLog) {
  const { articleText = null, tickers = [], title = null } = options;
  const signalsOnly = Boolean(options.signalsOnly);
  const noMarketData = Boolean(options.noMarketData);
  const inputKind = articleText ? "article" : "ticker";
  const workingTickers = [...new Set(tickers)];

  if (!articleText && workingTickers.length === 0) {
    throw new Error("Provide at least one ticker or an article.");
  }

  const portfolio = await loadPortfolio();
  if (portfolio) {
    log(`Portfolio loaded: ${portfolio.holdings.length} holdings.`);
  }

  // Article mode: LLM pass 1 extracts tickers so market data can be fetched
  // before the main analysis.
  let extractedTitle = "";
  if (articleText && !signalsOnly) {
    log("Extracting tickers from article (LLM pass 1/2)...");
    const extraction = await extractTickers(articleText);
    extractedTitle = extraction.suggestedTitle;
    const newTickers = extraction.tickers.filter((t) => !workingTickers.includes(t));
    workingTickers.push(...newTickers);
    log(`Extracted tickers: ${extraction.tickers.join(", ") || "none"}.`);
  }

  // Market data + quant signals.
  const signalsByTicker = {};
  const overviewsByTicker = {};
  let dataErrors = {};
  if (!noMarketData && workingTickers.length > 0) {
    log(`Fetching market data for: ${workingTickers.join(", ")}...`);
    const bundle = await fetchMarketBundle(workingTickers);
    dataErrors = bundle.errors;
    for (const [ticker, quote] of Object.entries(bundle.quotes)) {
      const signals = computeSignals(quote.bars, bundle.benchmarkBars);
      if (signals) {
        signalsByTicker[ticker] = signals;
      }
      if (quote.overview) {
        overviewsByTicker[ticker] = quote.overview;
      }
    }
  }

  if (portfolio) {
    applySectorData(portfolio, overviewsByTicker);
  }
  const portfolioMetrics = portfolio ? concentrationMetrics(portfolio) : null;

  // LLM analysis (pass 2 for articles, pass 1 for pure ticker mode).
  let analysis = null;
  if (!signalsOnly) {
    log("Running quantum-trader analysis (LLM)...");
    analysis = await analyze({
      inputKind,
      inputText: articleText,
      tickers: workingTickers,
      signalsByTicker,
      portfolio,
    });
    log(
      `Analysis: ${analysis.directCompanies.length} direct, ` +
        `${analysis.trickleDownCompanies.length} trickle-down companies.`,
    );
  }

  const resolvedTitle =
    title ||
    analysis?.thesis?.split(/[.!?]/)[0]?.slice(0, 80) ||
    extractedTitle ||
    (workingTickers.length > 0
      ? `Ticker scan: ${workingTickers.join(", ")}`
      : "Article analysis");

  const note = renderNote({
    title: resolvedTitle,
    inputKind,
    inputText: articleText,
    analysis,
    signalsByTicker,
    overviewsByTicker,
    portfolio,
    portfolioMetrics,
    dataErrors,
    mode: signalsOnly ? "signals-only" : "llm+signals",
  });

  const filePath = await writeNote(note, resolvedTitle);

  return {
    title: resolvedTitle,
    filePath,
    note,
    inputKind,
    tickers: workingTickers,
    analysis,
    signalsByTicker,
    overviewsByTicker,
    portfolio,
    portfolioMetrics,
    dataErrors,
    mode: signalsOnly ? "signals-only" : "llm+signals",
  };
}

export { runQuantumTrader };
