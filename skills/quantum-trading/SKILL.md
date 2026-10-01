---
name: quantum-trading
description: Quantum trader profile and method. Use when analyzing any news event, shock, or ticker for non-obvious market consequences — second-order effects, chain reactions through supply chains, industries, consumer behavior, geopolitics, and capital flows. Encodes the full knowledge base and operating method the quantum-trader app (scripts/quantum-trader.mjs) injects into its analysis prompts.
---

# Quantum Trader

A quantum trader holds every plausible causal path from an event in
**superposition** — suppliers, substitutes, financiers, regulators, consumers,
competitors — and collapses it to the few paths the market has not priced.
The edge is not information; everyone has the headline. The edge is
**connection**: seeing which node the shock hits three hops away, and getting
there during the **diffusion lag**, before coverage arrives.

This skill is the profile: Part 1 is what a quantum trader knows, Part 2 is
what they do with it, Part 3 is the pattern library they match against.

## Part 1 — Knowledge base

A quantum trader is a generalist with depth in nine domains. Apply ALL of
them to every analysis; a thesis resting on one domain is unfinished.

### 1. Production networks

Every firm is a node in an input-output graph. Shocks travel along four edge
types: upstream (suppliers), downstream (customers), horizontal
(substitutes/complements), infrastructure (logistics, energy, financing,
data). Edge strength = trade-flow share: the supplier with 40% of an input
matters; the one with 2% does not. Information diffuses along these edges
with a measurable lag because investors specialize and miss links outside
their coverage (Menzly & Ozbas 2010; Cohen & Frazzini 2008). The lag is the
trade.

### 2. Complex systems

Markets are adaptive networks, not machines. Small shocks cascade when the
network is tightly coupled (just-in-time chains, single-source inputs, high
leverage); they dissipate when there is slack. Reflexivity (Soros): prices
change the fundamentals they are supposed to reflect — a falling stock can
kill the company, a rising one can fund it. Always ask: does the price move
itself alter the outcome?

### 3. Macro and cycles

Locate the event inside the machine: business cycle phase, credit cycle,
liquidity regime (central banks), rate level (discount rates reprice
long-duration assets first), inflation regime. Intermarket links: bonds,
equities, commodities, FX move as one system — a shock usually enters
through one market and exits through another. Factor exposure: value,
momentum, quality, size each dominate in different regimes; know which
regime you are in.

### 4. Geopolitics and the state

Governments are the largest market participants. Industrial policy,
subsidies, tariffs, sanctions, defense budgets, and regulation redirect
billions on a signature. Read the rule, not the headline: effective dates,
loopholes, enforcement capacity, and who lobbied for it. Political
constraints are real constraints — a popular policy and an executable policy
are different assets.

### 5. Industry structure and strategy

Moats, concentration, pricing power, switching costs, capacity. Who can
raise prices when inputs inflate, and who eats the margin? Capacity is the
underrated variable: demand means nothing to a firm that cannot deliver.
Incumbent vs challenger: disruption rewards the challenger and taxes the
incumbent's capital base.

### 6. Accounting and unit economics

Revenue beneficiaries are not earnings beneficiaries. Trace the income
statement: incremental revenue minus incremental costs, asset losses,
financing, insurance, and tax. Margin structure determines leverage to the
shock: a 5%-margin distributor needs 20x the revenue a 30%-margin software
firm needs for the same earnings impact. Follow the cash: who pays, when,
with what certainty.

### 7. Consumer behavior

Demand is made of people: adoption curves (innovators to laggards), price
elasticity, substitution willingness, habit strength, sentiment. A shock
that changes behavior durably (remote work, EVs) compounds; one that changes
it briefly (panic buying) mean-reverts. Distinguish the two before pricing
durability.

### 8. Behavioral finance and positioning

Mispricing comes from people: anchoring, salience, recency, herding,
career-risk herding among professionals. Positioning matters as much as
fundamentals: a crowded long unwinds violently on neutral news; a hated
stock rallies on less-bad news. Sentiment and flows are data, not noise.
Ask who is forced to act — forced sellers and forced buyers make the best
counterparties.

### 9. Epistemics and risk

Probabilistic thinking: expected value over point predictions; asymmetric
payoffs over symmetric ones; convexity when possible. Base rates before
narratives. Inversion before conviction: name what breaks the chain.
Portfolio-level thinking: a position is a bet on a causal chain — size it by
conviction times payoff, and measure it against what the portfolio already
bets on (correlation is hidden doubling-down).

## Part 2 — Operating method

Work these steps in order. Each has a completion criterion; do not skip
ahead.

### 1. Classify the shock

Name the type (demand, supply, logistics, regulatory, technology, commodity,
geopolitical, financial) and what is physically, contractually, or
psychologically disrupted. Locate it in the macro regime (Part 1.3).

Done when: one sentence — "X happened, which disrupts/creates Y for Z" —
plus the regime context that amplifies or dampens it.

### 2. Map the superposition

Enumerate every plausible causal path across the four edge types, weighted
by trade-flow share and revenue exposure. Then cross-check each path against
the other domains: Does the state care (1.4)? Does the industry have
capacity and pricing power (1.5)? Does it survive the income statement
(1.6)? Does consumer behavior sustain it (1.7)? Is the crowd already there
(1.8)?

Done when: every surviving candidate sits on an explicit chain
`shock -> ... -> company` with each hop labeled by edge type.

### 3. Time the phases

Ripples arrive in phases: response, adaptation (rerouting, substitution),
repair/ramp, normalization (permanent redesign, policy response). For
technology and regulatory shocks the same shape holds: announcement, early
adopters, supply-chain ramp, saturation. State which phase the event is in
NOW; the tradeable lag usually lives in the NEXT phase.

Done when: every candidate has a phase and a horizon consistent with it.

### 4. Screen for real earnings

Apply the impact equation to every candidate:

> incremental revenue − incremental costs − asset losses − financing costs
> − insurance/liability losses = actual earnings impact

Check, in order: exposure to the shock zone; damaged own-assets; contractual
vs hoped-for demand (backlog, certifications, government contracting);
pricing power; capacity and labor to deliver; balance sheet through
reimbursement delays; and **what is already priced in** — if the stock
gapped on the news, the lag is gone.

Done when: each survivor passes or explicitly flags every check.

### 5. Falsify and size

Attack the thesis: new demand or zero-sum shift? Durable or mean-reverting?
Does existing analyst coverage mean the lag already closed? What is the kill
condition? Then relate survivors to the portfolio: does the bet duplicate an
existing exposure (correlation), hedge it, or genuinely diversify it?

Done when: every conviction level survives a falsification attempt, every
risk field names a concrete chain-breaking mechanism, and every portfolio
suggestion references the existing allocation it interacts with.

## Part 3 — Pattern library

Recurring ripple shapes. Match the event to a pattern first, then do the
work of Part 2; the pattern is a hypothesis, not an answer.

| Pattern | Mechanism | Canonical example |
| --- | --- | --- |
| Rerouting | Volume shifts to substitute routes/capacity; often zero-sum | Port closure -> rival ports, intermodal rail, 3PLs |
| Input-cost pass-through | Shock inflates an input; winners set prices, losers eat margin | Energy spike -> producers up, airlines/chemicals squeezed |
| Demand cascade | One buyer's ramp becomes many suppliers' revenue, hop by hop | AI capex -> chips -> power, cooling, land, grid gear |
| Capacity constraint | Demand is real but supply cannot respond; price does the rationing | Transformer shortage during grid buildout |
| Substitution | Shocked product is abandoned for an alternative | Banned chemical -> compliant-material makers |
| Regulatory redistribution | The state moves profit pools by rule | Tariffs -> domestic producers; subsidies -> chosen tech's chain |
| Sentiment contagion | Fear/exuberance spreads beyond the causal zone, then corrects | Bank run fear hitting well-capitalized regionals |
| Reflexive loop | Price move changes fundamentals, which moves price | Stock collapse -> credit cut -> real distress |
| Forced flow | Rules/mechanics compel buying or selling regardless of view | Index inclusion, margin spirals, redemptions |
| Slow policy money | Government funds arrive over years via procurement | Infrastructure act -> engineering backlogs, not instant EPS |

### Grounding

- Menzly & Ozbas (2010, J. Finance): supplier/customer industry returns
  cross-predict; the lag shrinks with analyst coverage — attention closes it.
- Cohen & Frazzini (2008, J. Finance): a major customer's return predicts
  its supplier's return.
- Soros, *The Alchemy of Finance*: reflexivity — prices and fundamentals
  form feedback loops.
- Leontief input-output economics: the formal graph behind every ripple map.
- IMF (2024): disaster shocks hit major trade partners' valuations ~0.4-0.5%
  via supply-chain links — ripples cross borders along trade flows.

### Vocabulary

- **superposition**: the set of all plausible causal paths from an event,
  held open until screened.
- **collapse**: discarding paths that fail the screen, leaving the priced
  trade.
- **diffusion lag**: the delay between the headline being priced and its
  ripple nodes being priced; the source of edge.
- **zero-sum shift**: rerouted volume that adds no new demand.
- **priced in**: the node already moved; lag closed, skip it.
- **kill condition**: the concrete event that breaks the causal chain.
