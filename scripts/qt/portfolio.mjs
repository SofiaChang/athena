// Portfolio loading and concentration metrics. Portfolio source: portfolio.json.

import fs from "node:fs/promises";

const DEFAULT_PORTFOLIO_PATH = "portfolio.json";

function portfolioPath() {
  return process.env.QT_PORTFOLIO_PATH?.trim() || DEFAULT_PORTFOLIO_PATH;
}

async function loadPortfolio() {
  let raw;
  try {
    raw = await fs.readFile(portfolioPath(), "utf8");
  } catch (error) {
    // ENOENT: no file. EISDIR: docker-compose created a directory for a
    // missing bind-mounted portfolio.json — treat both as "no portfolio".
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      return null;
    }
    throw error;
  }
  const parsed = JSON.parse(raw);
  const holdings = (parsed.holdings || []).map((holding) => ({
    ticker: String(holding.ticker || "").toUpperCase(),
    weight: Number(holding.weight) || 0,
    sector: holding.sector || null,
    note: holding.note || null,
  }));
  const totalWeight = holdings.reduce((sum, holding) => sum + holding.weight, 0);
  return {
    cashWeight:
      parsed.cash === null || parsed.cash === undefined
        ? Math.max(0, 1 - totalWeight)
        : Number(parsed.cash),
    holdings,
    totalWeight,
  };
}

function sectorBreakdown(portfolio) {
  const sectors = {};
  for (const holding of portfolio.holdings) {
    const sector = holding.sector || "Unknown";
    sectors[sector] = (sectors[sector] || 0) + holding.weight;
  }
  return Object.entries(sectors)
    .map(([sector, weight]) => ({ sector, weight }))
    .sort((a, b) => b.weight - a.weight);
}

function concentrationMetrics(portfolio) {
  const weights = portfolio.holdings
    .map((holding) => holding.weight)
    .sort((a, b) => b - a);
  const top3 = weights.slice(0, 3).reduce((sum, weight) => sum + weight, 0);
  // Herfindahl-Hirschman index: 1/N (perfectly diversified) .. 1 (single holding).
  const hhi = weights.reduce((sum, weight) => sum + weight ** 2, 0);
  return {
    holdingCount: weights.length,
    topHolding: weights[0] || 0,
    top3Weight: top3,
    hhi,
    sectors: sectorBreakdown(portfolio),
  };
}

function applySectorData(portfolio, overviewsByTicker) {
  for (const holding of portfolio.holdings) {
    const overview = overviewsByTicker[holding.ticker];
    if (!holding.sector && overview && overview.sector) {
      holding.sector = overview.sector;
    }
  }
  return portfolio;
}

export { loadPortfolio, concentrationMetrics, sectorBreakdown, applySectorData };
