import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "ai-agent-plan-v1";
const LINEAR_SYNC_MAP_KEY = "ai-agent-plan-linear-sync-map-v1";
const LINEAR_API_URL = "https://api.linear.app/graphql";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function linearRequest(apiKey, query, variables = {}, options = {}) {
  const retries = options.retries ?? 2;
  const authCandidates = apiKey.startsWith("Bearer ")
    ? [apiKey]
    : [`Bearer ${apiKey}`, apiKey];

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const authHeader = authCandidates[Math.min(attempt, authCandidates.length - 1)];
    const response = await fetch(LINEAR_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const body = await response.text();
      if (
        attempt < authCandidates.length - 1 &&
        (
          response.status === 401 ||
          response.status === 403 ||
          /api key as a Bearer token/i.test(body)
        )
      ) {
        continue;
      }
      if (attempt < retries && (response.status === 429 || response.status >= 500)) {
        await sleep(300 * 2 ** attempt);
        continue;
      }
      throw new Error(`Linear request failed (${response.status}): ${body.slice(0, 280)}`);
    }

    const payload = await response.json();
    if (payload.errors && payload.errors.length > 0) {
      const message = payload.errors.map((e) => e.message).join("; ");
      if (attempt < retries && /rate limit|temporar|timeout|unavailable/i.test(message)) {
        await sleep(300 * 2 ** attempt);
        continue;
      }
      throw new Error(message);
    }

    return payload.data;
  }

  throw new Error("Linear request failed after retries.");
}

const initialData = {
  epics: [
    {
      id: "E1",
      title: "Foundation & Infrastructure",
      description: "Core tooling, accounts, and local environment setup on MacBook Pro",
      phase: 1,
      stories: [
        {
          id: "S1.1",
          title: "Cloud API Access",
          description: "Set up API accounts and billing for cloud model access",
          tasks: [
            { id: "T1.1.1", title: "Create Anthropic account at console.anthropic.com", status: "todo", effort: "S", type: "setup" },
            { id: "T1.1.2", title: "Add billing and generate Claude API key", status: "todo", effort: "S", type: "setup" },
            { id: "T1.1.3", title: "Store API key securely (macOS Keychain or .env file outside repos)", status: "todo", effort: "S", type: "setup" },
            { id: "T1.1.4", title: "Test API with a simple curl call to verify connectivity", status: "todo", effort: "S", type: "validation" },
          ],
        },
        {
          id: "S1.2",
          title: "Local LLM Runtime",
          description: "Install Ollama and pull models for local agent inference",
          tasks: [
            { id: "T1.2.1", title: "Install Ollama via brew install ollama", status: "todo", effort: "S", type: "setup" },
            { id: "T1.2.2", title: "Pull primary model: ollama pull qwen2.5:32b", status: "todo", effort: "M", type: "setup" },
            { id: "T1.2.3", title: "Pull fallback model: ollama pull llama3.3:latest", status: "todo", effort: "M", type: "setup" },
            { id: "T1.2.4", title: "Test local API at localhost:11434 with sample prompts", status: "todo", effort: "S", type: "validation" },
            { id: "T1.2.5", title: "Benchmark response times and quality on MacBook Pro — note RAM usage", status: "todo", effort: "M", type: "validation" },
          ],
        },
        {
          id: "S1.3",
          title: "Automation Engine (n8n)",
          description: "Self-hosted n8n instance for workflow orchestration",
          tasks: [
            { id: "T1.3.1", title: "Install Docker Desktop for Mac", status: "todo", effort: "S", type: "setup" },
            { id: "T1.3.2", title: "Run n8n container: docker run -p 5678:5678 n8nio/n8n", status: "todo", effort: "S", type: "setup" },
            { id: "T1.3.3", title: "Set up persistent volume so workflows survive container restarts", status: "todo", effort: "M", type: "setup" },
            { id: "T1.3.4", title: "Connect Gmail account via OAuth in n8n credentials", status: "todo", effort: "M", type: "integration" },
            { id: "T1.3.5", title: "Connect all 3 Google Calendar accounts in n8n", status: "todo", effort: "M", type: "integration" },
            { id: "T1.3.6", title: "Add Claude API as HTTP Request credential in n8n", status: "todo", effort: "S", type: "integration" },
            { id: "T1.3.7", title: "Add Ollama as HTTP Request credential (localhost:11434)", status: "todo", effort: "S", type: "integration" },
          ],
        },
        {
          id: "S1.4",
          title: "Knowledge Base (Obsidian)",
          description: "Set up Obsidian vault as the shared memory layer for all agents",
          tasks: [
            { id: "T1.4.1", title: "Install Obsidian on MacBook Pro + phone", status: "todo", effort: "S", type: "setup" },
            { id: "T1.4.2", title: "Create vault structure: /contacts, /projects, /meetings, /weekly-reviews, /drafts, /research, /inbox", status: "todo", effort: "M", type: "setup" },
            { id: "T1.4.3", title: "Set up sync (iCloud or Obsidian Sync) for mobile access", status: "todo", effort: "S", type: "setup" },
            { id: "T1.4.4", title: "Create contact template (name, org, last interaction, notes, follow-up)", status: "todo", effort: "S", type: "content" },
            { id: "T1.4.5", title: "Create meeting note template (date, attendees, agenda, decisions, actions)", status: "todo", effort: "S", type: "content" },
            { id: "T1.4.6", title: "Create weekly review template (calendar summary, emails, tasks, priorities)", status: "todo", effort: "S", type: "content" },
            { id: "T1.4.7", title: "Seed vault with 10-15 key contacts (Accenture, Palantir, investors, personal)", status: "todo", effort: "L", type: "content" },
          ],
        },
      ],
    },
    {
      id: "E2",
      title: "Email Intelligence Agent",
      description: "Automated email triage (local) + smart drafting (cloud)",
      phase: 2,
      stories: [
        {
          id: "S2.1",
          title: "Email Triage — Local Model",
          description: "Classify and prioritize inbox using Ollama, zero data leaves your machine",
          tasks: [
            { id: "T2.1.1", title: "Build n8n workflow: manual trigger → Gmail pull last 50 unread", status: "todo", effort: "M", type: "build" },
            { id: "T2.1.2", title: "Write classification prompt: urgent / needs-reply / FYI / spam + project tag", status: "todo", effort: "M", type: "prompt" },
            { id: "T2.1.3", title: "Add Ollama HTTP node to classify each email", status: "todo", effort: "M", type: "build" },
            { id: "T2.1.4", title: "Output sorted summary to Obsidian /inbox/YYYY-MM-DD.md", status: "todo", effort: "M", type: "build" },
            { id: "T2.1.5", title: "Test with real inbox — tune prompt for accuracy", status: "todo", effort: "L", type: "validation" },
            { id: "T2.1.6", title: "Add cron trigger: run at 8am and 6pm daily", status: "todo", effort: "S", type: "build" },
          ],
        },
        {
          id: "S2.2",
          title: "Smart Email Drafting — Cloud Model",
          description: "Claude API drafts replies for emails flagged as needs-reply, with relationship context",
          tasks: [
            { id: "T2.2.1", title: "Build n8n sub-workflow: takes email + sender name as input", status: "todo", effort: "M", type: "build" },
            { id: "T2.2.2", title: "Add node to search Obsidian /contacts for sender context", status: "todo", effort: "M", type: "build" },
            { id: "T2.2.3", title: "Write drafting prompt with tone guidelines (direct, warm, professional — no fluff)", status: "todo", effort: "L", type: "prompt" },
            { id: "T2.2.4", title: "Send email + context to Claude API, receive draft reply", status: "todo", effort: "M", type: "build" },
            { id: "T2.2.5", title: "Save drafts to Obsidian /drafts/email/YYYY-MM-DD-sender.md", status: "todo", effort: "M", type: "build" },
            { id: "T2.2.6", title: "Test with 5 real emails — validate tone and quality", status: "todo", effort: "L", type: "validation" },
          ],
        },
        {
          id: "S2.3",
          title: "Follow-Up Tracker",
          description: "Track commitments from sent emails and flag overdue follow-ups",
          tasks: [
            { id: "T2.3.1", title: "Build n8n workflow: scan sent emails for commitments (Claude API extraction)", status: "todo", effort: "L", type: "build" },
            { id: "T2.3.2", title: "Store commitments in Obsidian /follow-ups with deadline and status", status: "todo", effort: "M", type: "build" },
            { id: "T2.3.3", title: "Daily check: flag overdue items, draft nudge email via Claude", status: "todo", effort: "L", type: "build" },
          ],
        },
      ],
    },
    {
      id: "E3",
      title: "Calendar Consensus Agent",
      description: "Unified view across all 3 calendars with conflict detection",
      phase: 2,
      stories: [
        {
          id: "S3.1",
          title: "Calendar Sync & Merge",
          description: "Pull all 3 calendars into a single unified view",
          tasks: [
            { id: "T3.1.1", title: "Build n8n workflow: pull next 7 days from all 3 calendar accounts", status: "todo", effort: "M", type: "build" },
            { id: "T3.1.2", title: "Merge and sort events chronologically, tag by source calendar", status: "todo", effort: "M", type: "build" },
            { id: "T3.1.3", title: "Detect conflicts (overlapping time blocks across calendars)", status: "todo", effort: "L", type: "build" },
            { id: "T3.1.4", title: "Write unified weekly view to Obsidian /calendar/week-of-YYYY-MM-DD.md", status: "todo", effort: "M", type: "build" },
            { id: "T3.1.5", title: "Add daily morning trigger (7am) to refresh view", status: "todo", effort: "S", type: "build" },
          ],
        },
        {
          id: "S3.2",
          title: "Blocker Event Sync",
          description: "When an event is added to one calendar, create blocker on the others",
          tasks: [
            { id: "T3.2.1", title: "Build n8n workflow: watch for new events on each calendar", status: "todo", effort: "L", type: "build" },
            { id: "T3.2.2", title: "When new event detected, create 'Busy' blocker on other 2 calendars", status: "todo", effort: "L", type: "build" },
            { id: "T3.2.3", title: "Handle deletions/reschedules: remove corresponding blockers", status: "todo", effort: "L", type: "build" },
            { id: "T3.2.4", title: "Add safeguard: don't create duplicate blockers", status: "todo", effort: "M", type: "build" },
          ],
        },
        {
          id: "S3.3",
          title: "Smart Scheduling Rules",
          description: "Agent enforces personal scheduling preferences",
          tasks: [
            { id: "T3.3.1", title: "Define rules in Obsidian config: no meetings before 10am, protect gym blocks, prep time before investor calls", status: "todo", effort: "M", type: "content" },
            { id: "T3.3.2", title: "Build rule engine: flag violations when new events are added", status: "todo", effort: "L", type: "build" },
            { id: "T3.3.3", title: "Send alert (push notification or Obsidian note) when rule is violated", status: "todo", effort: "M", type: "build" },
          ],
        },
      ],
    },
    {
      id: "E4",
      title: "Meeting Intelligence Agent",
      description: "Automated meeting prep and post-meeting debriefs",
      phase: 3,
      stories: [
        {
          id: "S4.1",
          title: "Meeting Prep Brief",
          description: "Before each meeting, compile context from Obsidian + web research",
          tasks: [
            { id: "T4.1.1", title: "Build n8n workflow: triggered 30min before calendar events", status: "todo", effort: "M", type: "build" },
            { id: "T4.1.2", title: "Extract attendee names from calendar event", status: "todo", effort: "M", type: "build" },
            { id: "T4.1.3", title: "Pull contact notes from Obsidian for each attendee", status: "todo", effort: "M", type: "build" },
            { id: "T4.1.4", title: "Send to Claude API: generate prep brief with talking points", status: "todo", effort: "M", type: "build" },
            { id: "T4.1.5", title: "Save brief to Obsidian /meetings/prep/YYYY-MM-DD-meeting-name.md", status: "todo", effort: "S", type: "build" },
          ],
        },
        {
          id: "S4.2",
          title: "Meeting Debrief & Actions",
          description: "Process meeting notes/transcripts into structured summaries with action items",
          tasks: [
            { id: "T4.2.1", title: "Create Obsidian quick-capture template for raw meeting notes", status: "todo", effort: "S", type: "content" },
            { id: "T4.2.2", title: "Build n8n workflow: watch for new files in /meetings/raw", status: "todo", effort: "M", type: "build" },
            { id: "T4.2.3", title: "Send raw notes to Claude API: extract decisions, action items, follow-ups", status: "todo", effort: "M", type: "prompt" },
            { id: "T4.2.4", title: "Write structured note to /meetings/processed with action items", status: "todo", effort: "M", type: "build" },
            { id: "T4.2.5", title: "Auto-update relevant contact notes in Obsidian", status: "todo", effort: "L", type: "build" },
            { id: "T4.2.6", title: "Feed action items into follow-up tracker from E2", status: "todo", effort: "M", type: "integration" },
          ],
        },
      ],
    },
    {
      id: "E5",
      title: "Content Pipeline Agent",
      description: "Idea → draft → polished LinkedIn post pipeline",
      phase: 3,
      stories: [
        {
          id: "S5.1",
          title: "Idea Capture & Expansion",
          description: "Capture rough ideas in Obsidian, agent expands into draft posts",
          tasks: [
            { id: "T5.1.1", title: "Create Obsidian template for content ideas (tag: #draft, fields: topic, angle, audience)", status: "todo", effort: "S", type: "content" },
            { id: "T5.1.2", title: "Build n8n workflow: watch for new #draft tagged notes", status: "todo", effort: "M", type: "build" },
            { id: "T5.1.3", title: "Load Raava brand voice guidelines into Claude API system prompt", status: "todo", effort: "M", type: "prompt" },
            { id: "T5.1.4", title: "Generate 2-3 draft variations per idea via Claude API", status: "todo", effort: "M", type: "build" },
            { id: "T5.1.5", title: "Save drafts to /drafts/linkedin with review status", status: "todo", effort: "S", type: "build" },
          ],
        },
        {
          id: "S5.2",
          title: "Publishing Workflow",
          description: "Review queue and scheduled posting via n8n",
          tasks: [
            { id: "T5.2.1", title: "Build review queue: Obsidian note listing all pending drafts with status", status: "todo", effort: "M", type: "build" },
            { id: "T5.2.2", title: "Research LinkedIn API or n8n LinkedIn node for automated posting", status: "todo", effort: "M", type: "research" },
            { id: "T5.2.3", title: "Build scheduled posting workflow (or manual copy-paste queue if API limited)", status: "todo", effort: "L", type: "build" },
          ],
        },
      ],
    },
    {
      id: "E6",
      title: "Weekly Review & Daily Briefing",
      description: "Automated synthesis of your week + daily morning briefing",
      phase: 3,
      stories: [
        {
          id: "S6.1",
          title: "Daily Morning Briefing",
          description: "7am daily digest of calendar, priority emails, and tasks",
          tasks: [
            { id: "T6.1.1", title: "Build n8n workflow: cron at 7am, pull today's calendar from consensus agent", status: "todo", effort: "M", type: "build" },
            { id: "T6.1.2", title: "Pull overnight email triage summary", status: "todo", effort: "S", type: "integration" },
            { id: "T6.1.3", title: "Pull outstanding follow-ups and action items", status: "todo", effort: "S", type: "integration" },
            { id: "T6.1.4", title: "Send to Claude API: synthesize into concise morning brief", status: "todo", effort: "M", type: "build" },
            { id: "T6.1.5", title: "Write to Obsidian /daily/YYYY-MM-DD.md", status: "todo", effort: "S", type: "build" },
          ],
        },
        {
          id: "S6.2",
          title: "Weekly Review Generator",
          description: "Sunday evening synthesis of the full week",
          tasks: [
            { id: "T6.2.1", title: "Build n8n workflow: cron Sunday 7pm", status: "todo", effort: "S", type: "build" },
            { id: "T6.2.2", title: "Aggregate: all meetings attended, emails sent/received, tasks completed", status: "todo", effort: "L", type: "build" },
            { id: "T6.2.3", title: "Aggregate: content published, follow-ups outstanding, commitments made", status: "todo", effort: "L", type: "build" },
            { id: "T6.2.4", title: "Send to Claude API: generate executive summary + recommended priorities for next week", status: "todo", effort: "M", type: "prompt" },
            { id: "T6.2.5", title: "Write to Obsidian /weekly-reviews/week-of-YYYY-MM-DD.md", status: "todo", effort: "S", type: "build" },
          ],
        },
      ],
    },
    {
      id: "E7",
      title: "Personal Shopper Agent",
      description: "Wardrobe management, deal tracking, gift intelligence",
      phase: 4,
      stories: [
        {
          id: "S7.1",
          title: "Wardrobe Inventory",
          description: "Catalog existing wardrobe with photos and metadata",
          tasks: [
            { id: "T7.1.1", title: "Create Obsidian wardrobe database structure: /wardrobe/[category]/item.md", status: "todo", effort: "M", type: "content" },
            { id: "T7.1.2", title: "Define item template: photo, brand, color, season, formality, size, tags", status: "todo", effort: "S", type: "content" },
            { id: "T7.1.3", title: "Photograph and catalog 20 key pieces to seed the database", status: "todo", effort: "L", type: "content" },
            { id: "T7.1.4", title: "Build Claude API workflow: given event context, suggest outfits from inventory", status: "todo", effort: "L", type: "build" },
          ],
        },
        {
          id: "S7.2",
          title: "Deal Monitoring & Wishlist",
          description: "Track prices on wishlist items and alert on drops",
          tasks: [
            { id: "T7.2.1", title: "Create Obsidian wishlist: /shopping/wishlist.md with items and target prices", status: "todo", effort: "S", type: "content" },
            { id: "T7.2.2", title: "Research price tracking APIs or scraping approaches", status: "todo", effort: "L", type: "research" },
            { id: "T7.2.3", title: "Build n8n workflow: periodic price check → alert on drops", status: "todo", effort: "L", type: "build" },
          ],
        },
        {
          id: "S7.3",
          title: "Gift Intelligence",
          description: "Proactive gift suggestions based on contacts and calendar",
          tasks: [
            { id: "T7.3.1", title: "Add birthday/occasion fields to Obsidian contact templates", status: "todo", effort: "S", type: "content" },
            { id: "T7.3.2", title: "Build n8n workflow: scan contacts for upcoming birthdays (next 30 days)", status: "todo", effort: "M", type: "build" },
            { id: "T7.3.3", title: "Send contact notes to Claude API: generate personalized gift suggestions", status: "todo", effort: "M", type: "build" },
          ],
        },
      ],
    },
    {
      id: "E8",
      title: "Mac Mini Migration",
      description: "Migrate everything to always-on M5 Mac Mini when hardware arrives",
      phase: 5,
      stories: [
        {
          id: "S8.1",
          title: "Hardware Setup",
          description: "Configure Mac Mini as always-on server",
          tasks: [
            { id: "T8.1.1", title: "Purchase M5 Mac Mini Pro (48GB+ RAM, 1TB storage) when released", status: "todo", effort: "S", type: "setup" },
            { id: "T8.1.2", title: "Initial macOS setup, enable SSH, disable sleep", status: "todo", effort: "S", type: "setup" },
            { id: "T8.1.3", title: "Install Tailscale on Mac Mini + all personal devices", status: "todo", effort: "S", type: "setup" },
            { id: "T8.1.4", title: "Install Docker, Ollama, n8n on Mac Mini", status: "todo", effort: "M", type: "setup" },
            { id: "T8.1.5", title: "Pull all Ollama models, benchmark on M5 hardware", status: "todo", effort: "M", type: "validation" },
          ],
        },
        {
          id: "S8.2",
          title: "Workflow Migration",
          description: "Move all n8n workflows and Obsidian vault to Mac Mini",
          tasks: [
            { id: "T8.2.1", title: "Export all n8n workflows from MacBook Pro", status: "todo", effort: "S", type: "setup" },
            { id: "T8.2.2", title: "Import workflows into Mac Mini n8n instance", status: "todo", effort: "S", type: "setup" },
            { id: "T8.2.3", title: "Reconfigure credentials (Gmail, Calendar, APIs) for new instance", status: "todo", effort: "M", type: "setup" },
            { id: "T8.2.4", title: "Move Obsidian vault to Mac Mini (keep syncing to phone/laptop via Sync)", status: "todo", effort: "M", type: "setup" },
            { id: "T8.2.5", title: "Switch all cron triggers from manual to automated", status: "todo", effort: "S", type: "setup" },
            { id: "T8.2.6", title: "Test all workflows end-to-end on Mac Mini", status: "todo", effort: "L", type: "validation" },
            { id: "T8.2.7", title: "Set up n8n web UI accessible via Tailscale from phone/laptop", status: "todo", effort: "M", type: "setup" },
          ],
        },
      ],
    },
  ],
};

const phaseLabels = {
  1: "Phase 1 — Foundation",
  2: "Phase 2 — Core Agents",
  3: "Phase 3 — Advanced Agents",
  4: "Phase 4 — Lifestyle",
  5: "Phase 5 — Hardware Migration",
};

const phaseTimelines = {
  1: "Week 1",
  2: "Week 2–3",
  3: "Month 2",
  4: "Month 3+",
  5: "When M5 ships (~June)",
};

const statusConfig = {
  todo: { label: "To Do", color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
  in_progress: { label: "In Progress", color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  done: { label: "Done", color: "#34d399", bg: "rgba(52,211,153,0.12)" },
  blocked: { label: "Blocked", color: "#f87171", bg: "rgba(248,113,113,0.12)" },
};

const effortLabels = { S: "Small", M: "Medium", L: "Large" };
const typeColors = {
  setup: "#8B5CF6",
  build: "#3B82F6",
  integration: "#14B8A6",
  prompt: "#F59E0B",
  validation: "#EC4899",
  content: "#8B5CF6",
  research: "#6366F1",
};

export default function AgentPlan() {
  const [data, setData] = useState(null);
  const [expandedEpics, setExpandedEpics] = useState({});
  const [expandedStories, setExpandedStories] = useState({});
  const [filterPhase, setFilterPhase] = useState(null);
  const [filterStatus, setFilterStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [linearApiKey, setLinearApiKey] = useState("");
  const [linearTeamKey, setLinearTeamKey] = useState("");
  const [linearProjectId, setLinearProjectId] = useState("");
  const [syncingLinear, setSyncingLinear] = useState(false);
  const [linearLog, setLinearLog] = useState([]);
  const [linearResult, setLinearResult] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const result = await window.storage.get(STORAGE_KEY);
        if (result && result.value) {
          setData(JSON.parse(result.value));
        } else {
          setData(initialData);
        }
      } catch {
        setData(initialData);
      }
      setLoading(false);
    }
    load();
  }, []);

  const persist = useCallback(async (newData) => {
    setData(newData);
    try {
      await window.storage.set(STORAGE_KEY, JSON.stringify(newData));
    } catch (e) {
      console.error("Failed to save:", e);
    }
  }, []);

  const toggleTask = useCallback((epicId, storyId, taskId) => {
    const newData = JSON.parse(JSON.stringify(data));
    const epic = newData.epics.find((e) => e.id === epicId);
    const story = epic.stories.find((s) => s.id === storyId);
    const task = story.tasks.find((t) => t.id === taskId);
    const order = ["todo", "in_progress", "done", "blocked"];
    task.status = order[(order.indexOf(task.status) + 1) % order.length];
    persist(newData);
  }, [data, persist]);

  const resetAll = useCallback(() => {
    persist(initialData);
  }, [persist]);

  const syncToLinear = useCallback(async () => {
    if (!data) return;

    const token = linearApiKey.trim();
    const teamKey = linearTeamKey.trim();
    const projectIdOverride = linearProjectId.trim();

    if (!token || !teamKey) {
      setLinearLog(["Enter both Linear API key and Team key before syncing."]);
      return;
    }

    const addLog = (line) => {
      setLinearLog((prev) => [...prev, line]);
    };

    const issueCreateMutation = `
      mutation IssueCreate($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            identifier
            url
            title
          }
        }
      }
    `;

    const projectCreateMutation = `
      mutation ProjectCreate($input: ProjectCreateInput!) {
        projectCreate(input: $input) {
          success
          project {
            id
            name
            url
          }
        }
      }
    `;

    try {
      setSyncingLinear(true);
      setLinearResult(null);
      setLinearLog([]);

      addLog("Resolving team...");
      const teamsData = await linearRequest(
        token,
        `
          query Teams {
            teams {
              nodes {
                id
                key
                name
              }
            }
          }
        `
      );

      const team = teamsData.teams.nodes.find(
        (t) => t.key.toLowerCase() === teamKey.toLowerCase()
      );

      if (!team) {
        throw new Error(`Team key '${teamKey}' was not found in this Linear workspace.`);
      }

      addLog(`Team found: ${team.name} (${team.key})`);

      let syncMap = {};
      try {
        const mapRaw = await window.storage.get(LINEAR_SYNC_MAP_KEY);
        syncMap = mapRaw?.value ? JSON.parse(mapRaw.value) : {};
      } catch {
        syncMap = {};
      }

      const projectName = "Personal AI Agent Infrastructure";
      const projectDescription = [
        "Imported from AgentPlan JSX.",
        `Epics: ${data.epics.length}`,
        `Stories: ${data.epics.reduce((n, epic) => n + epic.stories.length, 0)}`,
        `Tasks: ${data.epics.reduce((n, epic) => n + epic.stories.reduce((s, story) => s + story.tasks.length, 0), 0)}`,
      ].join("\n");

      let project;
      if (projectIdOverride) {
        project = {
          id: projectIdOverride,
          name: "Existing project",
          url: "",
        };
        addLog(`Using existing project ID: ${project.id}`);
      } else {
        addLog("Creating Linear project...");
        let projectData;

        try {
          projectData = await linearRequest(token, projectCreateMutation, {
            input: {
              name: projectName,
              description: projectDescription,
              teamIds: [team.id],
            },
          });
        } catch {
          projectData = await linearRequest(token, projectCreateMutation, {
            input: {
              name: projectName,
              description: projectDescription,
              teamId: team.id,
            },
          });
        }

        project = projectData.projectCreate.project;
        addLog(`Project created: ${project.name}`);
      }

      const mapWorkspaceKey = `${team.id}:${project.id}`;
      const workspaceMap = syncMap[mapWorkspaceKey] || {
        epics: {},
        stories: {},
        tasks: {},
      };

      const created = {
        projectUrl: project.url,
        epics: 0,
        features: 0,
        tasks: 0,
        reused: 0,
        failed: 0,
      };

      for (const epic of data.epics) {
        let epicIssue = null;

        if (workspaceMap.epics[epic.id]?.id) {
          epicIssue = workspaceMap.epics[epic.id];
          created.reused += 1;
          addLog(`Reused epic issue: ${epic.id} -> ${epicIssue.identifier || epicIssue.id}`);
        }

        if (!epicIssue) {
          try {
            const epicIssueData = await linearRequest(token, issueCreateMutation, {
              input: {
                teamId: team.id,
                projectId: project.id,
                title: `${epic.id} ${epic.title}`,
                description: [
                  `Epic: ${epic.id}`,
                  epic.description,
                  `Phase: ${phaseLabels[epic.phase] || epic.phase}`,
                  `Timeline: ${phaseTimelines[epic.phase] || "n/a"}`,
                ].join("\n\n"),
              },
            });

            epicIssue = epicIssueData.issueCreate.issue;
            workspaceMap.epics[epic.id] = epicIssue;
            created.epics += 1;
            addLog(`Created epic issue: ${epicIssue.identifier}`);
          } catch (e) {
            created.failed += 1;
            addLog(`Failed epic ${epic.id}: ${String(e.message || e)}`);
            continue;
          }
        }

        for (const story of epic.stories) {
          let storyIssue = null;
          const storyKey = `${epic.id}:${story.id}`;

          if (workspaceMap.stories[storyKey]?.id) {
            storyIssue = workspaceMap.stories[storyKey];
            created.reused += 1;
            addLog(`Reused feature issue: ${story.id} -> ${storyIssue.identifier || storyIssue.id}`);
          }

          if (!storyIssue) {
            try {
              const storyIssueData = await linearRequest(token, issueCreateMutation, {
                input: {
                  teamId: team.id,
                  projectId: project.id,
                  parentId: epicIssue.id,
                  title: `${story.id} ${story.title}`,
                  description: [
                    `Feature: ${story.id}`,
                    story.description,
                    `Parent Epic: ${epic.id}`,
                  ].join("\n\n"),
                },
              });

              storyIssue = storyIssueData.issueCreate.issue;
              workspaceMap.stories[storyKey] = storyIssue;
              created.features += 1;
              addLog(`Created feature issue: ${storyIssue.identifier}`);
            } catch (e) {
              created.failed += 1;
              addLog(`Failed feature ${story.id}: ${String(e.message || e)}`);
              continue;
            }
          }

          for (const task of story.tasks) {
            const taskKey = `${storyKey}:${task.id}`;
            if (workspaceMap.tasks[taskKey]?.id) {
              created.reused += 1;
              addLog(`Reused task issue: ${task.id} -> ${workspaceMap.tasks[taskKey].identifier || workspaceMap.tasks[taskKey].id}`);
              continue;
            }

            try {
              const taskIssueData = await linearRequest(token, issueCreateMutation, {
                input: {
                  teamId: team.id,
                  projectId: project.id,
                  parentId: storyIssue.id,
                  title: `${task.id} ${task.title}`,
                  description: [
                    `Task: ${task.id}`,
                    `Status: ${task.status}`,
                    `Type: ${task.type}`,
                    `Effort: ${effortLabels[task.effort] || task.effort}`,
                    `Story: ${story.id}`,
                    `Epic: ${epic.id}`,
                  ].join("\n"),
                },
              });

              const taskIssue = taskIssueData.issueCreate.issue;
              workspaceMap.tasks[taskKey] = taskIssue;
              created.tasks += 1;
              addLog(`Created task issue: ${taskIssue.identifier}`);
            } catch (e) {
              created.failed += 1;
              addLog(`Failed task ${task.id}: ${String(e.message || e)}`);
            }
          }
        }
      }

      syncMap[mapWorkspaceKey] = workspaceMap;
      try {
        await window.storage.set(LINEAR_SYNC_MAP_KEY, JSON.stringify(syncMap));
      } catch {
        addLog("Warning: failed to persist sync map, next run may create duplicates.");
      }

      setLinearResult(created);
      addLog("Linear sync complete.");
    } catch (e) {
      setLinearResult(null);
      setLinearLog((prev) => [...prev, `Sync failed: ${String(e.message || e)}`]);
    } finally {
      setSyncingLinear(false);
    }
  }, [data, linearApiKey, linearTeamKey, linearProjectId]);

  const toggleEpic = (id) => setExpandedEpics((p) => ({ ...p, [id]: !p[id] }));
  const toggleStory = (id) => setExpandedStories((p) => ({ ...p, [id]: !p[id] }));

  if (loading || !data) {
    return (
      <div style={{ padding: 40, fontFamily: "'Geist', system-ui, sans-serif", color: "#e2e8f0" }}>
        Loading...
      </div>
    );
  }

  const allTasks = data.epics.flatMap((e) =>
    e.stories.flatMap((s) => s.tasks.map((t) => ({ ...t, epicPhase: e.phase })))
  );
  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter((t) => t.status === "done").length;
  const inProgressTasks = allTasks.filter((t) => t.status === "in_progress").length;
  const blockedTasks = allTasks.filter((t) => t.status === "blocked").length;

  const filteredEpics = data.epics.filter((e) => {
    if (filterPhase && e.phase !== filterPhase) return false;
    if (filterStatus) {
      const hasTasks = e.stories.some((s) => s.tasks.some((t) => t.status === filterStatus));
      if (!hasTasks) return false;
    }
    return true;
  });

  const progressPct = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;

  return (
    <div
      style={{
        minHeight: "100vh",
        fontFamily: "'Geist', system-ui, -apple-system, sans-serif",
        color: "#e2e8f0",
        padding: "20px",
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.25s ease-out; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{
            width: 10, height: 10, borderRadius: "50%",
            background: "linear-gradient(135deg, #8B5CF6, #3B82F6, #14B8A6)",
          }} />
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "#8B5CF6", textTransform: "uppercase" }}>
            Personal AI Agent Infrastructure
          </span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: "4px 0 6px", letterSpacing: "-0.025em", color: "#f1f5f9" }}>
          Execution Plan
        </h1>
        <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>
          {totalTasks} tasks across {data.epics.length} epics — click status to cycle: todo → in progress → done → blocked
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Total", val: totalTasks, color: "#94a3b8" },
          { label: "In Progress", val: inProgressTasks, color: "#a78bfa" },
          { label: "Done", val: doneTasks, color: "#34d399" },
          { label: "Blocked", val: blockedTasks, color: "#f87171" },
        ].map((s) => (
          <div key={s.label} style={{
            padding: "12px 14px", borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.03)",
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Linear sync */}
      <div style={{
        marginBottom: 20,
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.02)",
        padding: 14,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", marginBottom: 8 }}>
          Sync Plan to Linear
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 170px 170px", gap: 8, marginBottom: 8 }}>
          <input
            type="password"
            value={linearApiKey}
            onChange={(e) => setLinearApiKey(e.target.value)}
            placeholder="Linear API key"
            style={{
              background: "rgba(255,255,255,0.03)",
              color: "#e2e8f0",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              padding: "8px 10px",
              fontSize: 12,
              fontFamily: "inherit",
            }}
          />
          <input
            value={linearTeamKey}
            onChange={(e) => setLinearTeamKey(e.target.value)}
            placeholder="Team key"
            style={{
              background: "rgba(255,255,255,0.03)",
              color: "#e2e8f0",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              padding: "8px 10px",
              fontSize: 12,
              fontFamily: "inherit",
            }}
          />
          <input
            value={linearProjectId}
            onChange={(e) => setLinearProjectId(e.target.value)}
            placeholder="Project ID (opt)"
            style={{
              background: "rgba(255,255,255,0.03)",
              color: "#e2e8f0",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              padding: "8px 10px",
              fontSize: 12,
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={syncToLinear}
            disabled={syncingLinear}
            style={{
              border: "1px solid rgba(59,130,246,0.35)",
              background: syncingLinear ? "rgba(59,130,246,0.1)" : "rgba(59,130,246,0.2)",
              color: "#93c5fd",
              borderRadius: 6,
              padding: "8px 10px",
              fontSize: 12,
              fontWeight: 600,
              cursor: syncingLinear ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {syncingLinear ? "Syncing..." : "Sync to Linear"}
          </button>
        </div>

        {linearResult && (
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>
            Synced. New epics: {linearResult.epics}, new features: {linearResult.features}, new tasks: {linearResult.tasks}, reused: {linearResult.reused}, failed: {linearResult.failed}.
            {linearResult.projectUrl && (
              <>
                {" "}
                <a href={linearResult.projectUrl} target="_blank" rel="noreferrer" style={{ color: "#93c5fd" }}>
                  Open project
                </a>
              </>
            )}
          </div>
        )}

        {linearLog.length > 0 && (
          <div style={{
            fontSize: 11,
            color: "#64748b",
            maxHeight: 180,
            overflow: "auto",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            paddingTop: 8,
            display: "grid",
            gap: 4,
          }}>
            {linearLog.map((line, i) => (
              <div key={`${line}-${i}`}>{line}</div>
            ))}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div style={{
        height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", marginBottom: 20, overflow: "hidden",
      }}>
        <div style={{
          height: "100%", borderRadius: 3, width: `${progressPct}%`,
          background: "linear-gradient(90deg, #8B5CF6, #3B82F6, #14B8A6)",
          transition: "width 0.4s ease",
        }} />
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        <button
          onClick={() => { setFilterPhase(null); setFilterStatus(null); }}
          style={{
            padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)",
            background: !filterPhase && !filterStatus ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.03)",
            color: !filterPhase && !filterStatus ? "#a78bfa" : "#94a3b8",
            fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
          }}
        >All</button>
        {Object.entries(phaseLabels).map(([p, label]) => (
          <button
            key={p}
            onClick={() => { setFilterPhase(filterPhase === +p ? null : +p); }}
            style={{
              padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)",
              background: filterPhase === +p ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.03)",
              color: filterPhase === +p ? "#a78bfa" : "#94a3b8",
              fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
            }}
          >{label.replace("Phase ", "P").split("—")[0].trim()}</button>
        ))}
        <div style={{ width: 1, background: "rgba(255,255,255,0.08)", margin: "0 4px" }} />
        {Object.entries(statusConfig).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setFilterStatus(filterStatus === key ? null : key)}
            style={{
              padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)",
              background: filterStatus === key ? cfg.bg : "rgba(255,255,255,0.03)",
              color: filterStatus === key ? cfg.color : "#94a3b8",
              fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
            }}
          >{cfg.label}</button>
        ))}
      </div>

      {/* Epics */}
      {filteredEpics.map((epic) => {
        const epicTasks = epic.stories.flatMap((s) => s.tasks);
        const epicDone = epicTasks.filter((t) => t.status === "done").length;
        const epicPct = epicTasks.length > 0 ? (epicDone / epicTasks.length) * 100 : 0;
        const isOpen = expandedEpics[epic.id];

        return (
          <div key={epic.id} style={{
            marginBottom: 10, borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.02)",
            overflow: "hidden",
          }}>
            {/* Epic header */}
            <div
              onClick={() => toggleEpic(epic.id)}
              style={{
                padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                userSelect: "none",
              }}
            >
              <span style={{ fontSize: 12, color: "#64748b", transform: isOpen ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.2s" }}>▶</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4,
                    background: "rgba(139,92,246,0.15)", color: "#a78bfa", letterSpacing: "0.05em",
                  }}>{epic.id}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 500, padding: "2px 7px", borderRadius: 4,
                    background: "rgba(255,255,255,0.05)", color: "#64748b",
                  }}>{phaseTimelines[epic.phase]}</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#f1f5f9", letterSpacing: "-0.01em" }}>
                  {epic.title}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{epic.description}</div>
              </div>
              <div style={{ textAlign: "right", minWidth: 60 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: epicPct === 100 ? "#34d399" : "#94a3b8" }}>
                  {epicDone}/{epicTasks.length}
                </div>
                <div style={{
                  width: 60, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", marginTop: 4,
                }}>
                  <div style={{
                    height: "100%", borderRadius: 2, width: `${epicPct}%`,
                    background: epicPct === 100 ? "#34d399" : "#8B5CF6",
                    transition: "width 0.3s",
                  }} />
                </div>
              </div>
            </div>

            {/* Stories */}
            {isOpen && (
              <div className="fade-in" style={{ padding: "0 16px 14px" }}>
                {epic.stories.map((story) => {
                  const storyTasks = filterStatus
                    ? story.tasks.filter((t) => t.status === filterStatus)
                    : story.tasks;
                  if (filterStatus && storyTasks.length === 0) return null;
                  const storyDone = story.tasks.filter((t) => t.status === "done").length;
                  const isStoryOpen = expandedStories[story.id];

                  return (
                    <div key={story.id} style={{
                      marginBottom: 6, borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.04)",
                      background: "rgba(255,255,255,0.02)",
                    }}>
                      <div
                        onClick={() => toggleStory(story.id)}
                        style={{
                          padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                          userSelect: "none",
                        }}
                      >
                        <span style={{ fontSize: 10, color: "#4b5563", transform: isStoryOpen ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.2s" }}>▶</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 10, color: "#64748b", fontWeight: 500 }}>{story.id}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1" }}>{story.title}</span>
                          </div>
                          <div style={{ fontSize: 11, color: "#4b5563", marginTop: 1 }}>{story.description}</div>
                        </div>
                        <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>
                          {storyDone}/{story.tasks.length}
                        </span>
                      </div>

                      {isStoryOpen && (
                        <div className="fade-in" style={{ padding: "0 14px 10px" }}>
                          {storyTasks.map((task) => (
                            <div key={task.id} style={{
                              display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 0",
                              borderTop: "1px solid rgba(255,255,255,0.03)",
                            }}>
                              {/* Status button */}
                              <button
                                onClick={() => toggleTask(epic.id, story.id, task.id)}
                                style={{
                                  marginTop: 1, width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${statusConfig[task.status].color}`,
                                  background: task.status === "done" ? statusConfig.done.color : "transparent",
                                  cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: 10, color: "#fff", padding: 0,
                                }}
                              >
                                {task.status === "done" && "✓"}
                                {task.status === "in_progress" && <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusConfig.in_progress.color }} />}
                                {task.status === "blocked" && "!"}
                              </button>
                              <div style={{ flex: 1 }}>
                                <div style={{
                                  fontSize: 12.5, color: task.status === "done" ? "#64748b" : "#cbd5e1",
                                  textDecoration: task.status === "done" ? "line-through" : "none",
                                  lineHeight: 1.4,
                                }}>
                                  <span style={{ color: "#4b5563", fontSize: 10, marginRight: 6 }}>{task.id}</span>
                                  {task.title}
                                </div>
                                <div style={{ display: "flex", gap: 6, marginTop: 3 }}>
                                  <span style={{
                                    fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 3,
                                    background: `${typeColors[task.type]}20`, color: typeColors[task.type],
                                    textTransform: "uppercase", letterSpacing: "0.05em",
                                  }}>{task.type}</span>
                                  <span style={{
                                    fontSize: 9, fontWeight: 500, padding: "1px 5px", borderRadius: 3,
                                    background: "rgba(255,255,255,0.05)", color: "#64748b",
                                  }}>{effortLabels[task.effort]}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Reset */}
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#4b5563" }}>Progress persists across sessions</span>
        <button
          onClick={resetAll}
          style={{
            padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(248,113,113,0.2)",
            background: "transparent", color: "#f87171", fontSize: 11, cursor: "pointer",
            fontFamily: "inherit", fontWeight: 500,
          }}
        >Reset All</button>
      </div>
    </div>
  );
}
