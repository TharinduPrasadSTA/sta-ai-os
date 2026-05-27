# Scripts — Building Your Data & Function Layers

> This directory is where your sync scripts, analysis scripts, and automation live. It starts empty because the scripts you need depend on your specific business, tools, and tech stack. Claude will help you build them.

---

## When to Build This

**Not yet — if your Context layer is incomplete.** Go back to `/build-context` first.

The Data and Function layers require a solid Context foundation. Without it, you're building systems that don't understand why they exist.

---

## The Data Layer — What to Build First

> **You don't have to write these yourself.** `/connect-data` handles the full Data layer build: Supabase setup, MCP connections, sync scripts, scheduling. The sections below are what the command does under the hood, useful when you want to understand what's being built or when you're extending the system outside the normal flow.

Your AI OS needs real business data. These scripts pull data from your external services into the project.

### Priority Order (build in this sequence)

| Priority | Data Source | Why It's Valuable | Typical Tools |
|----------|-----------|-------------------|---------------|
| 1 | **Call recordings / transcripts** | Every decision, commitment, and insight from calls | Zoom, Google Meet, Fireflies, Otter.ai, Plaud |
| 2 | **Team communication** | Messages, patterns, client channels | Slack, Discord, WhatsApp (export) |
| 3 | **SOP / Knowledge library** | SOPs, docs, processes, institutional knowledge | Google Drive, Notion, ClickUp |
| 4 | **CRM / Sales data** | Pipeline, deals, close rates, client info | GoHighLevel, HubSpot, Pipedrive, Airtable |
| 5 | **Financial data** | Revenue, expenses, profit, cash flow | Stripe, Xero, QuickBooks, spreadsheets |
| 6 | **Email** | Client communication, follow-ups, gaps | Gmail, Outlook |
| 7 | **Project data** | Tasks, workload, delivery status | ClickUp, Asana, Monday.com |
| 8 | **Marketing data** | Ad performance, traffic, conversions | Meta Ads, Google Ads, GA4, YouTube |

### How to Build a Sync Script

You don't write these manually. Run `/connect-data` (or `/connect-data connect my services` to jump to Phase 2). The command reads your `integrations.md`, classifies each service, and for services that need syncing it ships pre-designed templates for 17 common services or runs `/create-plan` + `/implement` for anything else. You approve each connection.

Every resulting sync script:
- Pulls data from the service's API
- For text-bearing services, embeds via Voyage. For long-form services with Contextual Retrieval opted in, calls Haiku to generate chunk-level context prefixes.
- UPSERTs into the service's per-source Supabase table using `source_id` UNIQUE
- Updates `_synced_at` on every write
- Is incremental (pulls only new records since last run)

### Database Strategy

Supabase is the canonical data layer. Per-source typed tables shaped to each service's real data.

| Data Type | Storage | Query pattern |
|-----------|---------|-----|
| Append-only short-form text (Slack messages, CRM notes, short emails) | **Per-source table** with `embedding` + `search_tsv` columns | Claude calls `search()` — hybrid retrieval with reranking |
| Append-only long-form text — Pattern A default (transcripts, long emails, long docs) | **Single per-source table** with AI-generated `summary` + `topics` + `attendees`, embedding on summary | Claude calls `search()`; surfaces which items touched a topic |
| Append-only long-form text — Pattern B opt-in (Contextual Retrieval) | **Parent table + `_chunks` table** with chunks embedded with context prefixes | Claude calls `search()`; retrieves specific chunks within items |
| Append-only structured numeric (Stripe, Xero, QuickBooks, Meta Ads, YouTube Analytics) | **Per-source table** with typed columns, no embedding | Claude writes direct SQL (SUM, GROUP BY, joins) |
| Ever-changing reference (SOPs, current pipeline, today's calendar) | **Live via MCP or API wrapper** (no storage) | Claude queries at question time |
| Files without an API | **Project folder** (`data/imports/<service>/`) | Manual drop-in; Claude ingests into the appropriate Supabase table |

All wired automatically by `/connect-data`. See `reference/data-classification.md` for the known-service map and `reference/mcp-guide.md` for Live vs MCP specifics.

**Every synced table carries three hygiene columns:**
- `source_id TEXT UNIQUE NOT NULL` — service's native record ID. Paired with `INSERT ... ON CONFLICT (source_id) DO UPDATE SET ...` so re-running syncs never duplicates rows.
- `_synced_at timestamptz default now()` — updated on every UPSERT. Claude uses this at query time to flag stale data in answers (default threshold: 48h).
- `embedding_model TEXT` (text-bearing tables only) — records which Voyage model produced each embedding. When models evolve, migrations can re-embed only the rows that need it.

---

## The Function Layer — What to Build Second

> **Automate without a server:** Once you've built a function, you can schedule it to run automatically on Anthropic's cloud — no VPS or cron jobs needed. See `reference/scheduling.md`.

Once data is flowing, build systems that act on it.

### Recommended Build Order

| Order | Function | What It Does | Depends On |
|-------|----------|-------------|-----------|
| 1 | **Daily Brief** | Morning intelligence report: financial pulse, team health, priorities | Meeting data + CRM data + financial data |
| 2 | **Meeting Intelligence** | Auto-summarise meetings, extract action items, track commitments | Meeting transcript data |
| 3 | **Communication Analysis** | Flag missed replies, communication gaps, team patterns | Email + Slack data |
| 4 | **Task Automation** | Meeting action items → tracked tasks, auto-reminders | Meeting Intelligence + project data |
| 5 | **Content Pipeline** | Generate ideas, outlines, and drafts from your data | All data sources |
| 6 | **Decision Engine** | Full implementation of `/decide` with semantic matching | Decision logs + vector search |

### How to Build a Function

1. Run `/create-plan build [function name]` — Claude will plan the system
2. Run `/implement` on the plan — Claude will build it
3. Each function should:
   - Read from Context (understand the business)
   - Read from Data (use real numbers and content)
   - Output to `outputs/` (briefs to `outputs/briefs/`, analyses to `outputs/analyses/`)
   - Start in "Inform" mode (present information, user acts)

---

## The Daily Brief — Your First Function

The Daily Brief is the single most valuable function in your AI OS. It's a morning intelligence report that covers everything across your business in one document.

### Suggested Sections

1. **Financial Pulse** — Revenue position, cash flow, outstanding invoices
2. **Pipeline & Sales** — New leads, deals in progress, close rate trends
3. **Client Health** — At-risk clients, satisfaction signals, upcoming renewals
4. **Team Pulse** — Communication patterns, workload signals, who needs attention
5. **Meeting Follow-ups** — Action items from recent meetings, undelivered commitments
6. **Strategic Analysis** — Progress against priorities, risks, opportunities
7. **Today's Priorities** — AI-recommended focus areas based on all data

### How to Build It

Run: `/create-plan build a daily brief that covers my key business metrics, team health, and priorities`

Claude will plan and build a brief generation script that pulls from your connected data sources and produces a structured morning report.

---

## Folder Organisation

As you build scripts, organise them by function:

```
scripts/
├── README.md              # This file
├── sync/                  # Data ingestion scripts
│   ├── sync-crm.ts       # CRM data sync
│   ├── sync-meetings.ts  # Meeting transcript sync
│   └── sync-slack.ts     # Slack message sync
├── analysis/              # Intelligence and analysis
│   ├── generate-brief.ts # Daily Brief generator
│   └── meeting-summary.ts # Meeting summariser
└── utils/                 # Shared utilities
    ├── db.ts             # Database helpers
    └── anthropic.ts      # AI model helpers
```

---

## Tech Stack Recommendations

| Need | Recommendation | Why |
|------|---------------|-----|
| Language | **TypeScript** | Best Claude Code support, type safety, great ecosystem |
| Runtime | **tsx** (via `npx tsx script.ts`) | No build step, run TypeScript directly |
| Database | **Supabase** (Postgres + pgvector) | Canonical AI OS data layer. Free tier covers this programme. pgvector for semantic search, tsvector for keyword search, both hybrid-searchable in one query. |
| AI models | **Anthropic SDK** | Direct access to Opus/Sonnet/Haiku |
| HTTP requests | **Built-in fetch** | No extra dependencies for API calls |
| Scheduling | **GitHub Actions** workflows (cron) or local cron for always-on machines | For automated daily/hourly runs. Set up automatically in Phase 3 of `/connect-data`. See `reference/scheduling.md`. |

---

_Don't build everything at once. Start with one data source, one function. Get it working. Then expand. The build path is iterative — each addition compounds the value of everything before it._
