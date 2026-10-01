# YouTube script

Status: NOT ACTIVE. The first videos wait until there is footage from real
Meridian work. Until then, `/draft` for youtube produces an outline only and
lists the footage needed.

## Rules

- Default target: 6 to 10 minutes. State the target in the script header.
- Cold open first (under 30 seconds), then sections.
- Rough timestamps on every section.
- Written to be spoken: contractions, short clauses. No visual-only phrasing
  ("as you can see below", "in this chart").
- Mark screen recordings and demos with `[SCREEN: what is shown]`. Narration
  inside a SCREEN block is only what is said over it.

## Template

```
---
format: youtube
idea: ideas/<slug>.md
target: 8 min
status: draft | published
date:
url:
footage: <list of recordings this needs>
---

[0:00] COLD OPEN
...

[0:30] SECTION 1: <name>
...

[SCREEN: <what is shown>]
...
[/SCREEN]

[7:30] CLOSE
...
```
