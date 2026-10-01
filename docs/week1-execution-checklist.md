# Week 1 Execution Checklist (Evidence-Based)

This checklist tracks only work that can be verified from local files or your local runtime.

## Current status snapshot

- S1.1 Cloud API: not yet verified in this repository.
- S1.2 Local models: not yet verified in this repository.
- S1.3 n8n stack: bootstrap files now added, runtime verification pending.
- S1.4 Obsidian setup: folder structure, templates, and contact stubs present.

## S1.1 Cloud API setup and test

### Required user steps

1. Add API credentials to your local environment (do not commit).
2. Run a single known-good request from your machine.
3. Save a redacted success record in `docs/evidence/s1.1-cloud-api.md`.

### Verification criteria

- Request returns 200/OK.
- Response includes expected model metadata.
- No credentials are stored in tracked files.

## S1.2 Local Ollama setup

### Required user steps

1. Install/confirm Ollama on your machine.
2. Pull the baseline local models you chose.
3. Run 3 test prompts (email triage, meeting summary, shopping advice).
4. Save benchmark notes in `docs/evidence/s1.2-local-models.md`.

### Verification criteria

- Each prompt returns a complete response.
- You record latency and quality notes per prompt.
- Preferred model for each prompt type is selected.

## S1.3 n8n Docker setup

### Repo-local assets now provided

- `docker-compose.n8n.yml`
- `.env.n8n.example`
- `docs/n8n-bootstrap.md`

### Required user steps

1. Copy `.env.n8n.example` to `.env.n8n` and fill real values.
2. Start n8n with Docker Compose.
3. Open n8n UI and confirm workflow editor loads.
4. Save a redacted startup record in `docs/evidence/s1.3-n8n.md`.

### Verification criteria

- n8n container is healthy.
- UI is reachable at configured URL.
- Credentials are configured in n8n, not in git-tracked files.

## S1.4 Obsidian templates and references

### Repo-local assets now provided

- Vault usage guide: `vault/Abyss/README.md`
- Migration plan: `vault/Abyss/MIGRATION-TO-KEPANO.md`
- Templates: `vault/Abyss/templates/*.md`
- Property types map: `vault/Abyss/.obsidian/types.json`
- Active reference folders: `vault/Abyss/references/`, `vault/Abyss/clippings/`

### Required user steps

1. Configure Obsidian settings for templates, daily notes, and attachments.
2. Create one weekly note from `templates/weekly.md` and keep a single checklist.
3. Create at least five linked reference notes under `references/`.

### Verification criteria

- Weekly checklist note exists and is active.
- Reference notes use linked frontmatter values.
- New notes follow root/references/clippings split.
