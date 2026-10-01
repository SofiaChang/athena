# Personal AI Agent Infrastructure — Project Brief

## Owner
Sofia — Founder of Raava Solutions, Accenture consultant, based in Vancouver.

## Vision
Build a hybrid local/cloud personal AI assistant system (codename TBD — candidates: Athena, Seshat, Metis, Durga) that manages email, calendar, content, meetings, shopping, and life logistics. The system runs on a MacBook Pro now (manual triggers) and migrates to an always-on M5 Mac Mini (~June 2026) for continuous autonomous operation. Accessible from laptop and phone.

## Architecture

```
Phone / Laptop
    │
[Tailscale VPN] (added when Mac Mini arrives)
    │
Mac Mini M5 Pro (always-on, ~June 2026)
├── Ollama (local LLM inference — privacy-sensitive tasks)
├── n8n (workflow orchestration — connects all services)
├── Obsidian vault (shared memory / knowledge base)
└── Claude API (cloud inference — high-quality reasoning tasks)
```

### Hybrid Model Strategy

**Local (Ollama on Apple Silicon):**
- Models: Qwen 2.5 32B, Llama 3.3 70B (Q4 quantized), DeepSeek-R1 32B
- Use for: email classification, calendar conflict detection, note summarization, data processing
- Why: privacy (personal email, calendar, finances stay on-device), zero latency for simple tasks, no API cost

**Cloud (Claude API):**
- Model: claude-sonnet-4-20250514 or claude-opus-4-6 depending on task
- Use for: email drafting, content creation, research synthesis, meeting debriefs, complex reasoning
- Why: superior quality for nuanced tasks, web search capability, voice/tone matching

**Routing logic:** Local model handles high-volume, structured, privacy-sensitive tasks. Cloud model handles low-volume, high-stakes, creative, or ambiguous tasks. n8n workflows route automatically based on task type.

## Tech Stack

| Component | Tool | Role |
|-----------|------|------|
| Local LLM | Ollama | Privacy-first inference on Apple Silicon |
| Cloud LLM | Claude API (Anthropic) | High-quality reasoning, drafting, research |
| Orchestration | n8n (self-hosted, Docker) | Workflow automation, service connections |
| Knowledge Base | Obsidian (markdown vault) | Shared memory layer for all agents |
| Remote Access | Tailscale | Secure VPN to Mac Mini from any device |
| Sync | Obsidian Sync or iCloud | Mobile access to knowledge base |
| Containerization | Docker Desktop | Runs n8n and supporting services |

## Obsidian Vault Structure

```
vault/
├── inbox/              # Daily email triage summaries
├── contacts/           # Personal CRM (name, org, history, follow-ups)
├── projects/           # Active project notes (Raava, Accenture, Medical AI)
├── meetings/
│   ├── prep/           # Auto-generated meeting prep briefs
│   ├── raw/            # Quick-capture raw notes / transcripts
│   └── processed/      # Structured summaries with action items
├── drafts/
│   ├── email/          # AI-drafted email replies for review
│   └── linkedin/       # Content pipeline drafts
├── research/           # Research briefs and synthesis
├── weekly-reviews/     # Sunday evening weekly synthesis
├── daily/              # Morning briefing notes
├── calendar/           # Unified multi-calendar weekly views
├── follow-ups/         # Commitment tracker with deadlines
├── shopping/
│   ├── wishlist.md     # Price-tracked items
│   └── wardrobe/       # Cataloged clothing inventory
└── config/
    ├── scheduling-rules.md   # Personal calendar preferences
    ├── brand-voice.md        # Raava tone/style guidelines
    └── agent-prompts.md      # Reusable system prompts for agents
```

## Epics & Stories

---

### Epic 1: Foundation & Infrastructure (Phase 1 — Week 1)

**Goal:** Core tooling, accounts, and local environment setup on MacBook Pro.

#### Story 1.1: Cloud API Access
- Create Anthropic account at console.anthropic.com
- Add billing and generate Claude API key
- Store API key securely (macOS Keychain or .env file outside repos)
- Test API with a simple curl call to verify connectivity

#### Story 1.2: Local LLM Runtime
- Install Ollama via `brew install ollama`
- Pull primary model: `ollama pull qwen2.5:32b`
- Pull fallback model: `ollama pull llama3.3:latest`
- Test local API at localhost:11434 with sample prompts
- Benchmark response times and quality on MacBook Pro — note RAM usage

#### Story 1.3: Automation Engine (n8n)
- Install Docker Desktop for Mac
- Run n8n container: `docker run -p 5678:5678 n8nio/n8n`
- Set up persistent volume so workflows survive container restarts
- Connect Gmail account via OAuth in n8n credentials
- Connect all 3 Google Calendar accounts in n8n
- Add Claude API as HTTP Request credential in n8n
- Add Ollama as HTTP Request credential (localhost:11434)

#### Story 1.4: Knowledge Base (Obsidian)
- Install Obsidian on MacBook Pro + phone
- Create vault structure per the directory layout above
- Set up sync (iCloud or Obsidian Sync) for mobile access
- Create contact template (name, org, last interaction, notes, follow-up)
- Create meeting note template (date, attendees, agenda, decisions, actions)
- Create weekly review template (calendar summary, emails, tasks, priorities)
- Seed vault with 10-15 key contacts (Accenture, Palantir, investors, personal)

---

### Epic 2: Email Intelligence Agent (Phase 2 — Week 2-3)

**Goal:** Automated email triage (local) + smart drafting (cloud) + follow-up tracking.

#### Story 2.1: Email Triage — Local Model
Route: Gmail → Ollama (local) → Obsidian

- Build n8n workflow: manual trigger → Gmail pull last 50 unread
- Write classification prompt: urgent / needs-reply / FYI / spam + project tag (Raava, Accenture, Medical AI, personal)
- Add Ollama HTTP node to classify each email
- Output sorted summary to Obsidian `/inbox/YYYY-MM-DD.md`
- Test with real inbox — tune prompt until classification accuracy is reliable
- Add cron trigger: run at 8am and 6pm daily

**Classification prompt should output structured JSON:**
```json
{
  "sender": "name",
  "subject": "subject line",
  "priority": "urgent|needs-reply|fyi|spam",
  "project": "raava|accenture|medical-ai|personal|unknown",
  "summary": "1-2 sentence summary",
  "suggested_action": "reply|forward|archive|flag"
}
```

#### Story 2.2: Smart Email Drafting — Cloud Model
Route: Flagged emails → Claude API (with Obsidian context) → Draft in Obsidian

- Build n8n sub-workflow: takes email + sender name as input
- Add node to search Obsidian `/contacts` for sender context
- Write drafting prompt with tone guidelines: direct, warm, professional — no fluff, no performative enthusiasm
- Send email + context to Claude API, receive draft reply
- Save drafts to Obsidian `/drafts/email/YYYY-MM-DD-sender.md`
- Test with 5 real emails — validate tone and quality

**System prompt for drafting should include:**
- Sofia's communication style: direct and concise, dislikes padded language
- Context about current projects and priorities
- Relationship context from Obsidian contacts
- Instruction to match formality level to the sender's tone

#### Story 2.3: Follow-Up Tracker
Route: Sent emails → Claude API (extraction) → Obsidian follow-ups

- Build n8n workflow: scan sent emails for commitments (Claude API extraction)
- Store commitments in Obsidian `/follow-ups` with deadline and status
- Daily check: flag overdue items, draft nudge email via Claude

---

### Epic 3: Calendar Consensus Agent (Phase 2 — Week 2-3)

**Goal:** Unified view across all 3 calendars with conflict detection and cross-calendar blocking.

#### Story 3.1: Calendar Sync & Merge
- Build n8n workflow: pull next 7 days from all 3 calendar accounts
- Merge and sort events chronologically, tag by source calendar
- Detect conflicts (overlapping time blocks across calendars)
- Write unified weekly view to Obsidian `/calendar/week-of-YYYY-MM-DD.md`
- Add daily morning trigger (7am) to refresh view

#### Story 3.2: Blocker Event Sync
- Build n8n workflow: watch for new events on each calendar
- When new event detected, create "Busy" blocker on other 2 calendars
- Handle deletions/reschedules: remove corresponding blockers
- Add safeguard: don't create duplicate blockers

#### Story 3.3: Smart Scheduling Rules
- Define rules in Obsidian config: no meetings before 10am, protect gym blocks, prep time before investor calls
- Build rule engine: flag violations when new events are added
- Send alert (push notification or Obsidian note) when rule is violated

---

### Epic 4: Meeting Intelligence Agent (Phase 3 — Month 2)

**Goal:** Automated meeting prep and post-meeting debriefs with action item extraction.

#### Story 4.1: Meeting Prep Brief
Route: Calendar event (30min before) → Obsidian contacts → Claude API → Prep brief

- Build n8n workflow: triggered 30min before calendar events
- Extract attendee names from calendar event
- Pull contact notes from Obsidian for each attendee
- Send to Claude API: generate prep brief with talking points and context
- Save brief to Obsidian `/meetings/prep/YYYY-MM-DD-meeting-name.md`

#### Story 4.2: Meeting Debrief & Actions
Route: Raw notes in Obsidian → Claude API → Structured summary + action items

- Create Obsidian quick-capture template for raw meeting notes
- Build n8n workflow: watch for new files in `/meetings/raw`
- Send raw notes to Claude API: extract decisions, action items (with owners and deadlines), follow-ups
- Write structured note to `/meetings/processed` with action items
- Auto-update relevant contact notes in Obsidian
- Feed action items into follow-up tracker from Epic 2

---

### Epic 5: Content Pipeline Agent (Phase 3 — Month 2)

**Goal:** Idea → draft → polished LinkedIn post pipeline using Raava brand voice.

#### Story 5.1: Idea Capture & Expansion
Route: Obsidian #draft note → Claude API (with brand guidelines) → Draft variations

- Create Obsidian template for content ideas (tag: #draft, fields: topic, angle, audience)
- Build n8n workflow: watch for new #draft tagged notes
- Load Raava brand voice guidelines into Claude API system prompt
- Generate 2-3 draft variations per idea via Claude API
- Save drafts to `/drafts/linkedin` with review status

**Brand voice for LinkedIn content:**
- Direct, honest, technical but accessible
- Lead with the customer's problem
- Specific about outcomes (use numbers, timelines)
- Avoid buzzwords and corporate jargon
- Active voice, concise sentences

#### Story 5.2: Publishing Workflow
- Build review queue: Obsidian note listing all pending drafts with status
- Research LinkedIn API or n8n LinkedIn node for automated posting
- Build scheduled posting workflow (or manual copy-paste queue if API limited)

---

### Epic 6: Weekly Review & Daily Briefing (Phase 3 — Month 2)

**Goal:** Automated daily morning briefing and Sunday evening weekly synthesis.

#### Story 6.1: Daily Morning Briefing
Route: Calendar + Email triage + Follow-ups → Claude API → Obsidian daily note

- Build n8n workflow: cron at 7am, pull today's calendar from consensus agent
- Pull overnight email triage summary
- Pull outstanding follow-ups and action items
- Send to Claude API: synthesize into concise morning brief
- Write to Obsidian `/daily/YYYY-MM-DD.md`

#### Story 6.2: Weekly Review Generator
Route: All weekly data → Claude API → Executive summary + next week priorities

- Build n8n workflow: cron Sunday 7pm
- Aggregate: all meetings attended, emails sent/received, tasks completed
- Aggregate: content published, follow-ups outstanding, commitments made
- Send to Claude API: generate executive summary + recommended priorities for next week
- Write to Obsidian `/weekly-reviews/week-of-YYYY-MM-DD.md`

---

### Epic 7: Personal Shopper Agent (Phase 4 — Month 3+)

**Goal:** Wardrobe management, deal tracking, gift intelligence.

#### Story 7.1: Wardrobe Inventory
- Create Obsidian wardrobe database structure: `/wardrobe/[category]/item.md`
- Define item template: photo, brand, color, season, formality, size, tags
- Photograph and catalog 20 key pieces to seed the database
- Build Claude API workflow: given event context (from calendar), suggest outfits from inventory

#### Story 7.2: Deal Monitoring & Wishlist
- Create Obsidian wishlist: `/shopping/wishlist.md` with items and target prices
- Research price tracking APIs or scraping approaches
- Build n8n workflow: periodic price check → alert on drops

#### Story 7.3: Gift Intelligence
- Add birthday/occasion fields to Obsidian contact templates
- Build n8n workflow: scan contacts for upcoming birthdays (next 30 days)
- Send contact notes to Claude API: generate personalized gift suggestions

---

### Epic 8: Mac Mini Migration (Phase 5 — When M5 Ships, ~June 2026)

**Goal:** Migrate everything to always-on M5 Mac Mini server.

#### Story 8.1: Hardware Setup
- Purchase M5 Mac Mini Pro (48GB+ RAM, 1TB storage) when released
- Initial macOS setup, enable SSH, disable sleep
- Install Tailscale on Mac Mini + all personal devices
- Install Docker, Ollama, n8n on Mac Mini
- Pull all Ollama models, benchmark on M5 hardware

#### Story 8.2: Workflow Migration
- Export all n8n workflows from MacBook Pro
- Import workflows into Mac Mini n8n instance
- Reconfigure credentials (Gmail, Calendar, APIs) for new instance
- Move Obsidian vault to Mac Mini (keep syncing to phone/laptop via Sync)
- Switch all cron triggers from manual to automated (always-on)
- Test all workflows end-to-end on Mac Mini
- Set up n8n web UI accessible via Tailscale from phone/laptop

---

## Implementation Notes

### n8n Workflow Patterns
All workflows follow this pattern:
1. **Trigger** — cron schedule, manual button, or file watcher
2. **Data Pull** — fetch from Gmail, Calendar, Obsidian, or other source
3. **Route** — decide local (Ollama) vs cloud (Claude API) based on task type
4. **Process** — LLM inference with structured prompt
5. **Output** — write results to Obsidian vault in the appropriate directory

### Prompt Engineering Standards
- All prompts stored in Obsidian `/config/agent-prompts.md` for version control
- Prompts should output structured JSON when the result will be parsed by another workflow step
- Include Sofia's communication style context in all drafting prompts
- Include Raava brand guidelines in all content creation prompts

### Error Handling
- All n8n workflows should have error handling nodes that log failures to Obsidian `/config/errors.md`
- Claude API calls should include retry logic (3 attempts with exponential backoff)
- Ollama calls should fall back to a smaller model if the primary model times out

### Security
- API keys stored in macOS Keychain or n8n encrypted credentials, never in plaintext files
- All personal data (email, calendar, contacts, finances) processed by local model only
- Tailscale used for remote access — no ports exposed to public internet
- Obsidian vault excluded from any cloud backup except Obsidian Sync

### Current Hardware
- MacBook Pro M5 (primary dev machine, not always-on)
- Future: Mac Mini M5 Pro 48GB+ (always-on server, ~June 2026)

### Cost Estimates
- Claude API: ~$30-50/month at expected usage volume
- Obsidian Sync: $4/month
- Tailscale: free tier
- n8n: free (self-hosted)
- Mac Mini M5 Pro 48GB: ~$1,800-2,000 (one-time, when released)

---

## Priority Order
1. Foundation (E1) — everything depends on this
2. Email Intelligence (E2) — highest daily ROI
3. Calendar Consensus (E3) — immediate sanity improvement
4. Meeting Intelligence (E4) — especially valuable for investor/Accenture conversations
5. Weekly Review (E6) — compounds over time
6. Content Pipeline (E5) — important for Raava but lower urgency
7. Personal Shopper (E7) — lifestyle enhancement
8. Mac Mini Migration (E8) — when hardware ships
