# Athena Architecture

## Goal

Build a personal AI operations system that balances privacy, quality, and execution speed.

## Runtime topology

```text
Phone / Laptop
    |
[Tailscale VPN]
    |
Mac Mini M5 Pro (always-on target runtime)
|- Ollama (local inference)
|- n8n (workflow orchestration)
|- Obsidian vault (state + memory)
`- Claude API (cloud reasoning)
```

## Decision model: local vs cloud

- Local (Ollama): private and structured workloads (email classification, calendar conflict detection, summarization).
- Cloud (Claude): nuanced reasoning and high-stakes generation (drafting, synthesis, strategy).
- n8n routes tasks automatically based on sensitivity and complexity.

## Data and memory

Obsidian vault is the persistent knowledge layer.

Active folder model:

- `vault/Abyss/` root for authored notes
- `vault/Abyss/references/` for external entities and media
- `vault/Abyss/clippings/` for web captures
- `vault/Abyss/templates/` for composable templates
- `vault/Abyss/attachments/` for files
- `vault/Abyss/daily/` for date anchors

## Delivery workflow

1. Capture roadmap in Athena plan artifacts.
2. Mirror execution structure into Linear (project -> epics -> features -> tasks).
3. Execute via n8n + model routing and write outputs back to Obsidian.

## Security baseline

- Keep secrets in secure stores (n8n credentials, keychain), never plaintext in repo.
- Keep private data processing local-first.
- Use Tailscale for remote access; avoid public exposure of internal services.
