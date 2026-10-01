# n8n Bootstrap (Local)

This guide is for local setup only and avoids storing secrets in git.

## 1) Configure env file

```bash
cp .env.n8n.example .env.n8n
```

Then edit `.env.n8n` and replace placeholder secrets.

## 2) Start n8n

```bash
docker compose -f docker-compose.n8n.yml up -d
```

## 3) Validate runtime

```bash
docker compose -f docker-compose.n8n.yml ps
```

Expect `athena-n8n` to be `Up`.

Open `http://localhost:5678` and confirm the editor loads.

## 4) Stop n8n

```bash
docker compose -f docker-compose.n8n.yml down
```

## 5) Safety checks

- Do not commit `.env.n8n`.
- Keep credentials inside n8n credential manager.
- Rotate any key that was pasted into chat.
