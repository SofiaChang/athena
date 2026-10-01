// Alpha Vantage market data client with on-disk cache (free tier: ~25 req/day).

import fs from "node:fs/promises";
import path from "node:path";

const ALPHAVANTAGE_API_URL = "https://www.alphavantage.co/query";
const DEFAULT_CACHE_DIR = ".quantum-trader-cache";
const MARKET_BENCHMARK_TICKER = "SPY";
const REQUEST_SPACING_MS = 1300;

let lastRequestAt = 0;
let throttleQueue = Promise.resolve();

function apiKey() {
  return process.env.ALPHAVANTAGE_API_KEY?.trim() || "demo";
}

function cacheDir() {
  return process.env.QT_CACHE_DIR?.trim() || DEFAULT_CACHE_DIR;
}

function cachePath(kind, symbol) {
  const today = new Date().toISOString().slice(0, 10);
  return path.join(cacheDir(), `${today}-${kind}-${symbol}.json`);
}

async function readCache(kind, symbol) {
  try {
    const raw = await fs.readFile(cachePath(kind, symbol), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeCache(kind, symbol, value) {
  try {
    await fs.mkdir(cacheDir(), { recursive: true });
    await fs.writeFile(cachePath(kind, symbol), `${JSON.stringify(value)}\n`, "utf8");
  } catch {
    // Cache failures must never break a run.
  }
}

function throttle() {
  // Serialize across concurrent runs: each caller queues behind the previous,
  // so REQUEST_SPACING_MS holds globally, not per caller.
  throttleQueue = throttleQueue.then(async () => {
    const waitMs = REQUEST_SPACING_MS - (Date.now() - lastRequestAt);
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    lastRequestAt = Date.now();
  });
  return throttleQueue;
}

async function alphaVantageRequest(params) {
  await throttle();
  const url = new URL(ALPHAVANTAGE_API_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("apikey", apiKey());

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Alpha Vantage request failed: HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (payload.Note || payload.Information) {
    throw new Error(
      `Alpha Vantage rate limit reached: ${payload.Note || payload.Information}`,
    );
  }
  if (payload["Error Message"]) {
    throw new Error(`Alpha Vantage error: ${payload["Error Message"]}`);
  }
  return payload;
}

async function fetchDailyBars(symbol, outputSize = "full") {
  const cached = await readCache("daily", symbol);
  if (cached) {
    return cached;
  }
  const payload = await alphaVantageRequest({
    function: "TIME_SERIES_DAILY",
    symbol,
    outputsize: outputSize,
  });
  const series = payload["Time Series (Daily)"];
  if (!series) {
    throw new Error(`No daily time series returned for ${symbol}.`);
  }
  const bars = Object.entries(series)
    .map(([date, values]) => ({
      date,
      close: Number.parseFloat(values["4. close"]),
    }))
    .filter((bar) => Number.isFinite(bar.close))
    .sort((a, b) => a.date.localeCompare(b.date));
  await writeCache("daily", symbol, bars);
  return bars;
}

async function fetchOverview(symbol) {
  const cached = await readCache("overview", symbol);
  if (cached) {
    return cached;
  }
  const payload = await alphaVantageRequest({ function: "OVERVIEW", symbol });
  if (!payload || !payload.Symbol) {
    return null;
  }
  const overview = {
    symbol: payload.Symbol,
    name: payload.Name || symbol,
    sector: payload.Sector || "Unknown",
    industry: payload.Industry || "Unknown",
    description: payload.Description || "",
    marketCap: Number(payload.MarketCapitalization) || null,
    peRatio: Number(payload.PERatio) || null,
    forwardPe: Number(payload.ForwardPE) || null,
    pegRatio: Number(payload.PEGRatio) || null,
    priceToBook: Number(payload.PriceToBookRatio) || null,
    dividendYield: Number(payload.DividendYield) || null,
    profitMargin: Number(payload.ProfitMargin) || null,
    revenueGrowthYoy: Number(payload.QuarterlyRevenueGrowthYOY) || null,
    earningsGrowthYoy: Number(payload.QuarterlyEarningsGrowthYOY) || null,
    week52High: Number(payload["52WeekHigh"]) || null,
    week52Low: Number(payload["52WeekLow"]) || null,
  };
  await writeCache("overview", symbol, overview);
  return overview;
}

async function fetchMarketBundle(symbols, { withBenchmark = true } = {}) {
  const uniqueSymbols = [...new Set(symbols.map((symbol) => symbol.toUpperCase()))];
  const benchmarkSymbols =
    withBenchmark && !uniqueSymbols.includes(MARKET_BENCHMARK_TICKER)
      ? [MARKET_BENCHMARK_TICKER]
      : [];

  const result = { quotes: {}, benchmarkBars: null, errors: {} };

  for (const symbol of [...benchmarkSymbols, ...uniqueSymbols]) {
    try {
      const bars = await fetchDailyBars(symbol);
      if (symbol === MARKET_BENCHMARK_TICKER && benchmarkSymbols.includes(symbol)) {
        result.benchmarkBars = bars;
      } else {
        result.quotes[symbol] = { bars, overview: null };
      }
    } catch (error) {
      result.errors[symbol] = error.message;
    }
  }

  for (const symbol of uniqueSymbols) {
    if (!result.quotes[symbol]) {
      continue;
    }
    try {
      result.quotes[symbol].overview = await fetchOverview(symbol);
    } catch (error) {
      result.errors[`${symbol}:overview`] = error.message;
    }
  }

  return result;
}

export { fetchDailyBars, fetchOverview, fetchMarketBundle, MARKET_BENCHMARK_TICKER };
