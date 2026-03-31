# Keryx VPS Deploy

Use this to run Keryx from Hermes on your VPS while keeping config in git.

## 1) Repo on VPS

```bash
mkdir -p /opt/athena
cd /opt/athena
git clone <YOUR_ATHENA_REPO_URL> .
```

## 2) Create secrets file on VPS

Create `/opt/athena/.env.keryx` (do not commit):

```env
DISCORD_WEBHOOK_URL=
X_BEARER_TOKEN=
GROUND_NEWS_API_KEY=
SUPERMEMORY_API_KEY=
```

## 3) Configure Hermes job

- Agent name: `keryx-daily`
- Prompt source: `/opt/athena/keryx/prompt.md`
- Soul source: `/opt/athena/keryx/soul.md`
- Memory contract: `/opt/athena/keryx/memory.md`
- Source config: `/opt/athena/keryx/sources.yaml`
- Output template: `/opt/athena/keryx/output-template.md`
- Output path: `/opt/athena/vault/Abyss/daily/news-{{date}}.md`

## 4) Schedule

Install cron entry from `keryx/schedule.cron` or equivalent Hermes scheduler entry:

```bash
crontab -l > /tmp/athena-cron || true
cat /opt/athena/keryx/schedule.cron >> /tmp/athena-cron
crontab /tmp/athena-cron
```

## 5) Smoke test

```bash
/usr/local/bin/hermes run keryx-daily
```

Verify:

1. Note appears in `/opt/athena/vault/Abyss/daily/`
2. Discord receives "briefing ready" message
3. `!keryx story 1` returns deep dive

## 6) Update flow

```bash
cd /opt/athena
git pull
```

Then restart/reload Hermes job if needed.
