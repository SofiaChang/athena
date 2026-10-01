# Quantum Trader

News articles or stock tickers in -> LLM reasoning + quantitative signals ->
a structured analysis note in the Obsidian vault (`vault/Abyss/Quantum Trader/`).

"Quantum" here = quant signals (momentum, RSI, volatility, drawdown, beta vs SPY)
combined with LLM **ripple analysis**: chain-reaction reasoning that maps how a
shock propagates through supply chains, logistics networks, and markets to find
non-obvious winners before the market prices them. It does not run on quantum
hardware.

The methodology lives in `skills/quantum-trading/SKILL.md` and is injected into
every analysis prompt (override with `QT_SKILL_PATH`). It is the full profile of
a quantum trader: nine knowledge domains (production networks, complex systems,
macro and cycles, geopolitics and the state, industry structure, accounting and
unit economics, consumer behavior, behavioral finance and positioning,
epistemics and risk), a five-step operating method (classify -> map the
superposition -> time the phases -> earnings screen -> falsify and size), and a
pattern library of recurring ripple shapes (rerouting, input-cost pass-through,
demand cascade, capacity constraint, substitution, regulatory redistribution,
sentiment contagion, reflexive loops, forced flows, slow policy money).
Grounded in Menzly & Ozbas (2010), Cohen & Frazzini (2008), Soros reflexivity,
and Leontief input-output economics.

## What it does

1. **Input**: a news article (file or URL) or a list of tickers.
2. **Extraction** (article mode): an LLM pass identifies the companies named.
3. **Market data**: Alpha Vantage daily prices + fundamentals, cached per day in
   `.quantum-trader-cache/` to respect the free tier (~25 requests/day).
4. **Quant signals**: 1/3/6/12-month momentum, RSI-14, annualized volatility,
   max drawdown, beta and correlation vs SPY, SMA-50/200 trend.
5. **Analysis**: an LLM pass acts as the quantum trader. For each company it
   reasons across four lenses — economic, political/regulatory, consumer
   behavior, and company history — and produces a "so what", conviction,
   horizon, and risks. It also identifies **trickle-down plays**: non-obvious
   second-order beneficiaries (suppliers, infrastructure, materials, logistics)
   the headline does not name.
6. **Portfolio**: reads `portfolio.json`, computes concentration (top-3 weight,
   HHI, sector spread), and the LLM relates findings to your allocation with
   suggested moves.
7. **Output**: an Obsidian note with frontmatter, callouts, wikilinked tickers,
   and signal/fundamental tables. You make the final decision.

## Setup

Required for full runs:

- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` — the analysis engine.
  Optional overrides: `QT_LLM_PROVIDER` (`anthropic`|`openai`), `QT_LLM_MODEL`.

Recommended:

- `ALPHAVANTAGE_API_KEY` — free at <https://www.alphavantage.co/support/#api-key>.
  Without it the client uses the `demo` key, which only serves IBM data.

Optional:

- `QT_PORTFOLIO_PATH` — default `portfolio.json`.
- `QT_VAULT_DIR` — default `vault/Abyss/Quantum Trader`.
- `QT_CACHE_DIR` — default `.quantum-trader-cache`.

## Usage

```bash
# Ticker scan (LLM analysis + signals + portfolio impact)
node scripts/quantum-trader.mjs --ticker NVDA,TSM

# News article from a file
node scripts/quantum-trader.mjs --article notes/article.txt

# News article from a URL
node scripts/quantum-trader.mjs --article-url "https://example.com/story"

# Signals only — no LLM key needed
node scripts/quantum-trader.mjs --ticker AAPL --signals-only

# LLM only — skip market data
node scripts/quantum-trader.mjs --ticker AAPL --no-market-data
```

The command prints the path of the note it wrote.

## portfolio.json

Weights are fractions of total portfolio; `cash` is inferred if omitted.

```json
{
  "cash": 0.1,
  "holdings": [
    { "ticker": "AAPL", "weight": 0.2, "sector": "Technology" },
    { "ticker": "VOO", "weight": 0.4 }
  ]
}
```

`sector` is optional; when missing it is filled from Alpha Vantage fundamentals.

## Validation

```bash
node --check scripts/quantum-trader.mjs
for f in scripts/qt/*.mjs; do node --check "$f"; done

# Smoke test with the demo market-data key (IBM only), no LLM needed:
node scripts/quantum-trader.mjs --ticker IBM --signals-only
```

## Notes and limits

- Alpha Vantage free tier: ~25 requests/day. The daily cache makes repeat runs
  cheap; spread new tickers across days or lower the request count with
  `--no-market-data` on repeat analysis.
- LLM output is reasoning, not fact-checking: verify tickers and claims before
  acting. The note says so; the final decision stays with you.
- Not financial advice.
