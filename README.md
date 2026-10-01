# Athena

Athena is a personal AI agent infrastructure project with a hybrid local/cloud architecture.

- Local inference (privacy-sensitive, high-volume): Ollama
- Cloud reasoning and drafting (high-stakes, nuanced): Claude API
- Workflow orchestration: n8n
- Shared memory layer: Obsidian vault

This repo currently includes:

- `agent-plan.jsx`: interactive execution plan UI with Linear sync support.
- `personal-ai-agent-project-brief.md`: source project brief with vision, architecture, and phased roadmap.
- `docs/architecture.md`: condensed system architecture and operating model.
- `docs/roadmap.md`: implementation phases, epics, and execution order.
- `docs/week1-execution-checklist.md`: Week 1 completion checklist with verification criteria.
- `docs/n8n-bootstrap.md`: local n8n startup guide.
- `docker-compose.n8n.yml` and `.env.n8n.example`: local n8n runtime bootstrap.

## Linear Sync

There are two supported paths:

1. UI flow in `agent-plan.jsx` (manual trigger).
2. CLI flow in `scripts/sync-linear.mjs` (repeatable script-based sync).

### CLI quick start

```bash
LINEAR_API_KEY="<token>" LINEAR_TEAM_KEY="JUR" node scripts/sync-linear.mjs
```

Optional:

- `LINEAR_PROJECT_NAME` (default: `Personal AI Agent Infrastructure`)
- `LINEAR_PROJECT_ID` (reuse existing project instead of creating one)
- `LINEAR_DRY_RUN=true` (preview only, no writes)

The CLI parser reads `personal-ai-agent-project-brief.md` and creates:

- one Linear project,
- one parent issue per Epic,
- one child issue per Story/Feature,
- one child issue per task bullet.

## Current objective

Get fully operational with project/features/tasks visible in Linear while keeping Athena as the canonical planning source.

## Week 1 Focus

For Week 1 closure, use:

- `docs/week1-execution-checklist.md`
- `docs/n8n-bootstrap.md`
- `vault/Abyss/README.md`
- `vault/Abyss/MIGRATION-TO-KEPANO.md`
- `vault/Abyss/templates/`
- `vault/Abyss/references/`
