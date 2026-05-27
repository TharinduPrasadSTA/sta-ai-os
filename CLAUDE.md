# CLAUDE.md — AI OS Blueprint

This file is automatically loaded at the start of every Claude Code session. It is the foundation of your AI Operating System.

---

## What This Is

This is an **AI Operating System** — a structured Claude Code project that progressively automates your business operations. It is not a chatbot. It is not a web app. It is the infrastructure layer that sits at the centre of your business, connects to every data source, and builds toward autonomous decision-making.

The goal: **maximise revenue, minimise your personal time investment.** Every system, tool, and decision within this project is evaluated against that filter.

This project is built on **Claude Code** — the most capable AI coding agent available. Combined with the right architecture, it becomes an entirely different beast: a system that understands your business, analyses your data, and progressively earns the autonomy to act on your behalf.

---

## The Architecture — 4 Layers

Your AI OS is built in layers. Each layer depends on the one below it. **You cannot skip layers.**

```
        +-------------------------+
        |       FUNCTION          |  Systems that act
        +-------------------------+
        |         DATA            |  Where you actually are
        +-------------------------+
        |       CONTEXT           |  Who you are / what you do / where you're going
        +-------------------------+
        |        AI OS            |  The foundation (this project)
        +-------------------------+
```

### Layer 1: AI OS (Foundation)
This project. The CLAUDE.md, the commands, the workspace structure. The engine everything else runs on. **You are here.**

### Layer 2: Context
The brain of the system. A set of documents in `context/` that tell the AI everything about your business — your role, your companies, your team, your strategy, your metrics. **This is the most important layer. It is also the one most people skip.**

The founder must build the Context layer themselves. You cannot hand this to a developer or a VA. The system needs to think like you. Your motivations, your decision-making logic, your way of evaluating trade-offs. If you delegate this, you build a system that thinks like someone else.

### Layer 3: Data
Once the system knows who you are and where you're going, you feed it everything. Call transcripts, Slack messages, emails, CRM data, financial data, community posts. All flowing into a searchable database. The AI doesn't just store this data — it understands it. It can search across everything simultaneously, by meaning, not just keywords.

### Layer 4: Function
Systems that do things. A Daily Brief that lands on your phone every morning. A content pipeline. Automated outreach. A decision engine that learns how you think. These are built on top of Context and Data. Without those foundations, functions are just party tricks.

You don't have to build every function from scratch. External tools can plug into your AI OS as specialised brains, and their outputs feed back as data. See `reference/architecture.md` for examples, including how to connect tools via MCP.

**Critical rule: build from the ground up.** Most people jump straight to Function ("I want to automate this task"). But without Context, the system doesn't know why. Without Data, it can't measure if it worked.

---

## The Build Path

Follow this order. Do not skip ahead.

### Phase 1: Context (Start here)
1. Run `/build-context` to populate your context files with Claude's help
2. Or manually fill in each file in `context/` — see guidance in each file
3. **Minimum viable context:** `personal-info.md` and `companies.md` filled in
4. **Full context:** All 6 files populated with real, specific information

### Phase 2: Data
1. Confirm every tool your business uses is listed in `context/integrations.md` (populated via `/build-context`). Each service carries a `Data Pattern` classification (Append-only / Ever-changing / Both).
2. Run `/connect-data`. One resumable command, three phases:
   - **Phase 1:** Provisions Supabase + pgvector + pg_net. Creates the `search()` Postgres function (hybrid RRF + Voyage rerank-2 via pg_net; text-table UNION grows as services come online).
   - **Phase 2:** Reads `integrations.md`, picks method per service (Sync for append-only, Live via MCP or API wrapper for ever-changing, Both for services holding both patterns). For long-form text services, picks between Pattern A (summary-only, default) or Pattern B (Contextual Retrieval chunking, opt-in). 17 pre-designed service templates ship; unknown services fall back to `/create-plan`.
   - **Phase 3:** Schedules all sync scripts via ONE consolidated nightly GitHub Actions workflow (cloud-hosted; no machine needed).
3. Resumable. Run once for end-to-end, or jump to a phase:
   - `/connect-data set up supabase` (Phase 1)
   - `/connect-data connect my services` (Phase 2)
   - `/connect-data connect [SERVICE]` (Phase 2 for one service)
   - `/connect-data connect [SERVICE] --deep` (upgrade long-form service from Pattern A to B)
   - `/connect-data schedule syncs` (Phase 3)
   - `/connect-data status` (report, no changes)
4. The system handles MCP Registry lookups, `.mcp.json` configuration, sync-script authoring, token management, and workflow scheduling. Every synced row carries `source_id` (idempotent UPSERT), `_synced_at` (freshness), and `embedding_model` (migration hygiene).
5. See `reference/data-classification.md` for the service classification map, `reference/mcp-guide.md` for Live vs MCP, and `scripts/README.md` for what the generated sync scripts look like.

### Phase 3: Function
1. Build systems that act on your Context + Data
2. Start with a Daily Brief — the single most valuable function
3. **Use GitHub Actions workflows** to automate functions (daily briefs, weekly reviews) on a cron schedule. No server needed. See `reference/scheduling.md`.
4. **Use Channels** to access your AI OS from Telegram or Discord — talk to your system from your phone. See `reference/channels.md`.
5. Add more functions as your data layer matures
6. See `reference/architecture.md` for the full framework

### Phase 4: Autonomy
1. Start logging decisions with `/decide` from day one — works in file-based mode during Modules 1-4
2. At **Module 4 Section 5**, run `/activate-decision-engine` to upgrade to the full Supabase-backed engine. See [reference/decision-engine.md](reference/decision-engine.md) for the concepts and [reference/decision-engine-implementation.md](reference/decision-engine-implementation.md) for what Claude builds on activation. Pre-activation MD decisions are preserved and can be imported.
3. Once activated, your morning brief adds a structured Section 7 (Today's Recommendations), Mondays add Section 8 (Weekly Decision Summary), and an 18:00 evening recap closes the daily loop.
4. Progress through the Autonomy Ladder: Inform → Recommend → Confirm → Autonomous. See [reference/autonomy-ladder.md](reference/autonomy-ladder.md) for how the Monday summary surfaces progression data.

---

## Workspace Structure

```
ai-os-blueprint/
├── CLAUDE.md                          # This file — the AI OS brain
├── .claude/
│   ├── commands/                      # Slash commands
│   │   ├── prime.md                   # /prime: session initialisation
│   │   ├── create-plan.md             # /create-plan: plan before building
│   │   ├── implement.md               # /implement: execute a plan
│   │   ├── decide.md                  # /decide: log a decision (file-based pre-activation, full engine post)
│   │   ├── activate-decision-engine.md # /activate-decision-engine: Module 4 Section 5 upgrade
│   │   ├── build-context.md           # /build-context: guided Context layer builder
│   │   ├── connect-data.md            # /connect-data: guided Data layer builder (Supabase + services + GitHub Actions)
│   │   └── audit-system.md            # /audit-system: check your AI OS against current best practice
│   └── skills/                        # Extensible capabilities
│       ├── skill-creator/             # Create custom skills
│       └── mcp-integration/           # Connect external services (advanced plugin dev)
├── context/                           # LAYER 2: Context
│   ├── personal-info.md              # Your role, goals, philosophy
│   ├── companies.md                  # Your business(es)
│   ├── team.md                       # Your people
│   ├── strategy.md                   # Your priorities and decision filters
│   ├── current-data.md              # Your metrics and KPIs
│   └── integrations.md              # Your connected services
├── data/                              # LAYER 3: Data
│   └── decisions/                    # Decision journal (created by /decide)
├── scripts/                           # Data sync and function scripts
│   └── README.md                     # Build-path guide
├── plans/                             # Implementation plans
├── outputs/                           # LAYER 4: Function outputs
│   ├── briefs/                       # Daily briefs
│   ├── analyses/                     # Strategic analyses
│   └── decisions/                    # Decision outcome tracking
└── reference/                         # Framework documentation
    ├── architecture.md                        # The 4-layer pyramid explained
    ├── autonomy-ladder.md                     # Progressive autonomy (4 phases)
    ├── decision-engine.md                     # Decision Engine concepts (5 steps, unified storage)
    ├── decision-engine-implementation.md      # Executable spec Claude reads during activation
    ├── mcp-guide.md                           # Connecting data sources (zero-code)
    ├── scheduling.md                          # Automating functions (GitHub Actions)
    └── channels.md                            # Mobile access (Telegram/Discord)
```

### Key Directories

| Directory | Layer | Purpose |
|-----------|-------|---------|
| `context/` | Context | Who you are, what you do, where you're going. Read by `/prime`. |
| `data/` | Data | Business data and decision journal. Grows over time. |
| `scripts/` | Data + Function | Sync scripts (pull data in) and function scripts (act on it). |
| `outputs/` | Function | Generated deliverables — briefs, analyses, decisions. |
| `plans/` | — | Implementation plans. Created by `/create-plan`, executed by `/implement`. |
| `reference/` | — | Framework documentation. Read when building new layers. |

---

## Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/prime` | Initialise session, check layer completion, recommend next action | Start of every session |
| `/build-context` | Guided wizard to populate your context files | When building Layer 2 |
| `/connect-data` | Guided Data layer builder: Supabase + service connections + sync automation. Resumable. Natural-language hints jump to specific phases. | When building Layer 3 |
| `/decide [question]` | Log a decision, accept/reject AI recs, run 30-day reviews, see patterns | Any significant business decision (works in file-based mode pre-activation, full engine post) |
| `/activate-decision-engine` | Upgrade Decision Engine from file-based to full Supabase-backed engine | Module 4 Section 5 — after your Daily Brief is live |
| `/create-plan [request]` | Create a detailed implementation plan | Before building anything significant |
| `/implement [plan-path]` | Execute a plan step by step | After a plan is approved |

---

## Querying the Data Layer

Your Data layer has two surfaces. Pick the right one automatically based on the question.

**Supabase** holds everything synced from your services — call transcripts, messages, emails, transactions, CRM activity, sales figures, KPIs. Two shapes of data live here:

- **Text content** (transcripts, messages, emails): tables with typed columns plus `embedding` and `search_tsv` columns. Call `search(query_text, query_embedding, limit)` for hybrid semantic + keyword search with Voyage reranking across all text tables in one query. Don't write raw SQL against these unless you genuinely need a specific filter.
- **Structured numeric data** (financials, sales, KPIs, ad performance): tables with typed columns, no embedding. Write direct SQL — `SELECT`, `SUM`, `GROUP BY`, joins. The structure is the answer.

**Live** covers ever-changing reference data that's never synced: SOPs, today's calendar, current pipeline state. Query the service's MCP (when available) or the local API wrapper at `scripts/live/<service>.ts` (when not).

**Quick decision for every question:**
- Is it about content (find calls, find messages, find emails)? → `search()` in Supabase
- Is it about numbers or structured records (what was revenue, how many deals)? → direct SQL in Supabase
- Is it about current state (today's calendar, the latest SOP)? → Live via MCP or wrapper

**Freshness awareness.** Every synced row carries `_synced_at`. When answering a business-data question from Supabase, check `max(_synced_at)` for the tables you're reading. If the newest row is more than 48 hours old (sync may have failed, source API may be down), note the staleness in the answer — don't silently present stale data as current. Example: *"Your latest Xero data was synced 3 days ago, so this may not reflect today. Want me to trigger a fresh sync?"* Live queries via MCP are inherently fresh and need no check.

The founder never sees this distinction. You pick based on the question, surface freshness when it matters.

---

## Accessing Your AI OS

Your AI OS lives in Claude Code on your machine. As it matures, you'll want to access it beyond your desk and have it run automatically. There are three ways to interact:

| Method | What It Is | Always-on? | Setup |
|--------|-----------|-----------|-------|
| **Claude Code (terminal/VS Code)** | The primary interface. Full access to everything. | While your session is open | Already done |
| **Channels (Telegram/Discord)** | Message your AI OS from your phone. Claude responds with full access to your project. | Needs a session running | See `reference/channels.md` |
| **GitHub Actions workflows** | Automated functions (daily briefs, syncs) running on GitHub's runners on a cron schedule. No machine needed. | Yes. GitHub's runners. | See `reference/scheduling.md` |

**The progression:**
1. **Start here:** Claude Code on your machine — build Context, connect Data, create Functions
2. **When you want automation:** Add a GitHub Actions workflow. Your Daily Brief generates automatically every morning.
3. **When you want mobile access:** Add Channels — talk to your AI OS from Telegram on your phone

Each step builds on the last. You don't need all three on day one.

---

## The Decision Engine

From day one, start logging decisions with `/decide`. Every significant business decision — hiring, pricing, strategy shifts, tool choices — gets logged with:

1. **What** the decision was
2. **Why** you chose it (options considered, reasoning)
3. **What you expect** to happen
4. **What actually happened** (reviewed at 30 days)

Over time, patterns emerge. The system learns how you think. This is the foundation for progressive autonomy. See `reference/decision-engine.md` for the full framework.

---

## The Autonomy Ladder

Your AI OS progresses through 4 phases of autonomy:

| Phase | Mode | Description |
|-------|------|-------------|
| 1 | **Inform** | Collect, analyse, present. You read and act. |
| 2 | **Recommend** | Suggest specific actions with rationale. You decide. |
| 3 | **Confirm** | Draft and queue actions. You approve or reject. |
| 4 | **Autonomous** | Execute within guardrails. You oversee. |

**Guardrails (always, even in Phase 4):**
- Financial transactions: ALWAYS require your approval
- External communications to clients/customers: Require approval
- Internal team messages: Can auto-send routine items
- Data queries and analysis: Always autonomous

See `reference/autonomy-ladder.md` for the full framework.

---

## AI Model Selection

Different tasks need different models. Use the right tool for the job:

| Task | Recommended Model | Rationale |
|------|-------------------|-----------|
| Strategic analysis, Daily Brief | Opus | Highest-quality reasoning |
| Meeting summaries, content drafting, communication | Sonnet | Quality/cost balance |
| Message classification, routing, tagging | Haiku | Fast, cheap, simple tasks |

Model IDs: `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`

---

## Working Autonomously

Claude should **always complete tasks itself**. Never tell the user to do something manually that Claude has the tools and access to do. This includes running scripts, querying databases, generating analyses, and executing plans.

If Claude lacks access or credentials for something, ask the user to **grant access** so Claude can do it.

---

## Conventions

- Plans live in `plans/` with dated filenames (`YYYY-MM-DD-descriptive-name.md`)
- Outputs are organised by type in `outputs/`
- Decision logs live in `data/decisions/` with dated filenames
- Keep context files current — stale context limits the system's effectiveness
- Always maintain this file (CLAUDE.md) when making structural changes

---

## Session Workflow

1. **Start**: Run `/prime` to load context and check system status
2. **Build**: Use `/build-context` to populate context files (if incomplete)
3. **Plan**: Use `/create-plan` before significant additions
4. **Execute**: Use `/implement` to execute plans
5. **Decide**: Use `/decide` to log business decisions
6. **Maintain**: Update CLAUDE.md and context files as the workspace evolves

---

## Getting Started

If this is your first session:

1. Run `/prime` — Claude will read everything and tell you where you stand
2. Run `/build-context` — Claude will walk you through populating your context files
3. Read `reference/architecture.md` to understand the full framework
4. Start logging decisions with `/decide` immediately

The Context layer is your foundation. Everything else is built on top of it. Start there.
