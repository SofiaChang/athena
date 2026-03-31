# Keryx

Keryx is Athena's news messenger subagent.

## Purpose

Produce a daily "newspaper" briefing covering:

- Tech
- Startups
- Economy
- Politics

Deliverables per run:

1. Obsidian note in `vault/Abyss/daily/news-YYYY-MM-DD.md`
2. Discord notification that the briefing is ready
3. Optional follow-up replies in Discord for deeper analysis

## Runtime model

- Git repo (this project): source-of-truth prompts/config/spec
- Hermes VPS: execution runtime, scheduler, secrets

## Files

- `keryx/spec.md`: behavior and pipeline contract
- `keryx/prompt.md`: base system prompt
- `keryx/soul.md`: editorial identity and quality doctrine
- `keryx/memory.md`: memory policy and persistence contract
- `keryx/sources.yaml`: source config placeholders (X, TechCrunch, Ground News)
- `keryx/schedule.cron`: 7:45 AM America/Vancouver schedule
- `keryx/discord-commands.md`: follow-up command contract
- `keryx/output-template.md`: markdown note structure
