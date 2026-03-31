# Keryx Memory Contract

This file defines what Keryx should remember across runs.

## Purpose

Memory improves continuity, relevance ranking, and follow-up quality.

## Memory layers

1. Session memory (ephemeral)
   - raw ingest cache
   - temporary scoring artifacts
2. Operational memory (persistent, runtime store)
   - dedupe fingerprints
   - watchlist topics
   - recurring entities
   - follow-up thread context
3. Vault memory (human-readable)
   - daily markdown briefings in `vault/Abyss/daily/`

## Persisted objects

- Story fingerprint:
  - `story_id`
  - `canonical_url`
  - `title_hash`
  - `embedding_hash` (if semantic dedupe enabled)
  - `first_seen_at`
  - `last_seen_at`
- Topic watch item:
  - `topic`
  - `created_at`
  - `priority`
  - `status` (active|paused)
- Follow-up thread:
  - `thread_id`
  - `story_ids`
  - `latest_summary`
  - `updated_at`

## Allowed memory content

- source URLs and normalized metadata
- ranking decisions and rationale summaries
- user watch topics and relevance preferences

## Disallowed memory content

- secrets/tokens/credentials
- speculative claims represented as facts
- sensitive personal data unrelated to briefing quality

## Memory retention

- Dedupe fingerprints: 30 days
- Follow-up thread summaries: 60 days
- Watchlist topics: until removed

## Optional Supermemory integration

If `SUPERMEMORY_API_KEY` is configured:

- store embeddings for semantic dedupe
- retrieve related past stories for follow-up context

If unavailable:

- continue with exact dedupe + title similarity only
