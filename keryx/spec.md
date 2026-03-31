# Keryx Spec

## Goal

Generate a daily, high-signal briefing that helps prioritize decisions.

## Schedule

- Run time: `07:45`
- Time zone: `America/Vancouver`
- Frequency: daily

## Inputs

Primary source families:

1. X (curated list/accounts)
2. TechCrunch (feed/API)
3. Ground News (feed/API/page ingestion based on your access)

## Pipeline

1. Ingest
   - Pull latest items per source window (default: last 24h)
2. Normalize
   - Convert to common shape:
     - `id`
     - `title`
     - `url`
     - `source`
     - `published_at`
     - `category` (tech|startups|economy|politics)
     - `raw_excerpt`
3. Dedupe
   - Exact URL/title dedupe
   - Semantic dedupe via embedding similarity (optional Supermemory)
4. Relevance scoring
   - Base factors:
     - recency
     - source quality
     - category fit
     - impact language
   - Keep top N overall, then top per category
5. Story synthesis
   - Required fields for each chosen story:
     - What happened
     - Why it matters
     - Who
     - What
     - When
     - Why
     - How
     - Source URL
     - Confidence (High|Medium|Low)
6. Output
   - Write markdown note from `keryx/output-template.md`
   - Post Discord ready message with top highlights
7. Follow-up mode
   - Accept Discord command for deep dives (`!keryx ...`)
   - Return expanded analysis with references

## Output constraints

- Prioritize relevance before breadth
- Avoid duplicate stories
- Avoid clickbait framing
- Keep daily note concise but complete

## Failure behavior

- If a source is unavailable, continue with remaining sources
- Note failed source in "Coverage Notes" section
- Post Discord warning only if all sources fail
