# The AI OS Architecture — 4 Layers

> This document explains the complete AI Operating System architecture. Read this to understand what you're building, why each layer matters, and how they connect.

---

## The Pyramid

Your AI OS is a 4-layer pyramid. Each layer depends on the one below it. You build from the bottom up.

```
        +-------------------------+
        |       FUNCTION          |  Systems that act on your behalf
        |   (Daily Brief, etc.)   |
        +-------------------------+
        |         DATA            |  Every data point across your business
        |   (CRM, calls, email)   |
        +-------------------------+
        |       CONTEXT           |  Who you are, what you do, where you're going
        |   (The founder's brain) |
        +-------------------------+
        |        AI OS            |  The foundation — Claude Code + this project
        |   (CLAUDE.md + cmds)    |
        +-------------------------+
```

**The golden rule: you cannot skip layers.**

Most people jump straight to Function — "I want to automate this task." But without Context, the system doesn't know *why*. Without Data, it can't measure if it *worked*. Build from the ground up.

---

## Layer 1: AI OS (The Foundation)

**What it is:** This project. The CLAUDE.md file, the slash commands, the workspace structure, and the conventions that make everything work.

**What it does:** Provides the engine and the rules. Claude Code reads CLAUDE.md at the start of every session, understands the architecture, and knows how to help you build.

**When it's complete:** You're reading this — it's already done. The foundation is laid the moment you open this project.

**Key components:**
- `CLAUDE.md` — The brain. Automatically loaded every session.
- `.claude/commands/` — Slash commands that give you structured workflows.
- `.claude/skills/` — Extensible capabilities for custom tools and integrations.
- `reference/` — Framework documentation (this file and others).

---

## Layer 2: Context (The Brain)

**What it is:** A set of documents in `context/` that teach the AI everything about you and your business.

**What it does:** Transforms the AI from a generic assistant into one that thinks like you. It knows your companies, your team, your priorities, your decision-making style, and your metrics.

**When it's complete:** All 6 context files are populated with real, specific information. Not templates — your actual context.

**Key components:**
- `context/personal-info.md` — Your role, north star, decision-making philosophy
- `context/companies.md` — Your business portfolio, products, revenue models
- `context/team.md` — Your people, roles, relationship health rules
- `context/strategy.md` — Priorities, decision filters, success criteria
- `context/current-data.md` — Live metrics and KPIs
- `context/integrations.md` — Connected services and data sources

**Why the founder must build this:**

This is the most important thing in this entire document. The Context layer is your brain, digitised. Your motivations. Your instincts. Your way of evaluating trade-offs. If you hand this to a developer, VA, or team member, you end up with a system that thinks like *them*. That defeats the entire purpose.

Nobody else has your context. Nobody else makes decisions the way you do. This layer is non-delegable.

**How to build it:**
1. Run `/build-context` — Claude will walk you through each file interactively
2. Or fill in each file manually using the guidance and examples provided
3. Be specific. "I run an agency" is useless. "I run a 12-person performance marketing agency specialising in e-commerce brands doing $1M-$10M revenue, with 80% of revenue from retainers and 20% from project work" — that's context.

---

## Layer 3: Data (The Nervous System)

**What it is:** Real business data flowing into your AI OS from every source — CRM, call transcripts, email, Slack, financial systems, analytics.

**What it does:** Gives the AI OS ground truth. It doesn't just know your strategy (Context) — it knows where you actually stand in relation to it. It can search across everything simultaneously, by meaning, not just keywords.

**When it's complete:** Your highest-priority data sources (see `context/integrations.md`) are syncing into the project, and the AI can query across them.

**Key components:**
- Sync scripts in `scripts/` that pull data from external services
- A database (SQLite for local text data, or a cloud database for structured metrics)
- A search capability that lets you query across all data at once

**What this unlocks:**

Without the Data layer, you're working from memory and manual lookups. With it:

- "What are the biggest client frustrations mentioned in the last 30 days?" — searched across call transcripts, emails, and Slack in seconds.
- "How is our close rate trending compared to last quarter?" — pulled from your CRM automatically.
- "Which team member is overloaded right now?" — calculated from project management data.

That used to take a full day of manual work. Now it takes 10 seconds.

**How to build it:**
1. Start with your highest-value data source (usually CRM/sales data or meeting transcripts)
2. Build a sync script with Claude's help (`/create-plan sync [service] data`)
3. Add more sources progressively — see `scripts/README.md` for the recommended order
4. Consider your database strategy: SQLite for text-heavy local data, cloud DB for structured metrics

**Technology recommendations:**
- **SQLite** — Perfect for text-heavy data (transcripts, messages, notes). Local, fast, no setup. Claude can set this up for you.
- **Supabase** — Recommended as your AI OS's storage and search infrastructure. It provides a PostgreSQL database with vector search (pgvector) for semantic queries across all your data. Free tier is generous. Claude can set this up for you.
- **Vector search (pgvector)** — Lets you search by meaning, not just keywords. "Find calls where clients discussed pricing concerns" works even if the word "pricing" was never used. Set up as part of your Supabase project.

### Three Ways to Build the Data Layer

There are three ways to get data into your AI OS. Use whichever fits the service and your skill level — or mix and match.

| | MCP (Zero-Code) | Ask Claude to Build It | Manual Upload |
|---|---|---|---|
| **How it works** | JSON config connects Claude directly to a service | You describe what you want, Claude writes a sync script | Drop files into your project folder |
| **Setup time** | Minutes per service | Claude builds it in one session | Instant |
| **Coding required** | None | None — Claude handles it | None |
| **Data access** | Live queries in real time | Local copy in a database | Files on disk |
| **Best for** | Slack, Google Drive, Notion, Airtable, Google Calendar | Zoom, Stripe, GoHighLevel, Calendly, Fireflies | Spreadsheets, CSV exports, transcript files, reports |

**Recommended approach:** Use MCP where available — it's the fastest. For everything else, tell Claude what you want and it will build the integration. Drop files in manually when that's the simplest path. See `reference/mcp-guide.md` for the MCP setup guide.

---

## Layer 4: Function (The Muscles)

**What it is:** Systems that act on your behalf. These read your Context and Data to produce intelligent outputs and automate operations.

**What it does:** This is where the AI OS starts doing real work — generating briefs, drafting communications, analysing trends, making recommendations, and eventually acting autonomously.

**When it's complete:** Never — you'll always be adding new functions. But you'll know it's working when the system is saving you meaningful time every day.

**Key function categories:**

### Intelligence Functions (build first)
- **Daily Brief** — A morning intelligence report covering everything across your business. Financial position, team health, client status, strategic analysis, recommended priorities for the day. Delivered before you've had your coffee.
- **Meeting Intelligence** — Transcripts synced, summarised, action items extracted. Never lose a decision or commitment from a meeting again.
- **Communication Analysis** — Slack, email, and message patterns. Who needs a response? What's been missed? Where are the communication gaps?

### Action Functions (build second)
- **Task Automation** — Meeting action items automatically becoming tracked tasks. Routine reports generated without asking.
- **Communication Drafting** — AI drafts messages in your tone. You approve before sending.
- **Content Pipeline** — Ideas, outlines, and drafts generated from your data and expertise.

### Autonomy Functions (build when ready)
- **Decision Engine** — Logs every significant decision, learns your patterns, eventually makes routine decisions autonomously. See `reference/decision-engine.md`.
- **Progressive Automation** — Functions that start as "inform" and graduate to "act with confirmation" as trust is earned. See `reference/autonomy-ladder.md`.

**How to build it:**
1. Start with the Daily Brief — it's the single highest-value function
2. Use `/create-plan` to design each function before building it
3. Each function should read from Context and Data — if it doesn't, it's a standalone tool, not part of the AI OS
4. Start every function in "Inform" mode (presents information, you act on it)

### Automating Your Functions

Building a function is step one. Making it run automatically is step two.

**Scheduled workflows** let you run any function on GitHub's runners on a cron. No server, no always-on machine. Your Daily Brief can generate every morning at 7am. Weekly reviews can land every Monday. Data syncs can run every hour. All without your computer being on.

This is what turns your AI OS from a tool you use into a system that works for you. See `reference/scheduling.md` for the complete setup guide.

### Accessing Your AI OS Remotely

**Channels** (Telegram/Discord) let you message your AI OS from your phone. Ask questions, get briefs, search data, log decisions — all through natural language. Claude responds with full access to your project context and data connections. This is the mobile access layer for your Function outputs. See `reference/channels.md` for the full guide and current status.

### Plugging In External Brains

You don't have to build every function from scratch. External tools can act as specialised brains that your AI OS calls on when it needs domain expertise.

**AgencyOSX** (https://app.agencyosx.ai) is one example. It gives you 15 AI employees across 4 teams:

| Team | AI Employees | What They Handle |
|------|-------------|-----------------|
| Foundations | General Assistant, Mindset Coach, Business Strategist, Legal Assistant | Strategic planning, goal setting, compliance |
| Sales & Marketing | Lead Generator, Outreach Specialist, Content Strategist, Sales Coach | Pipeline building, prospecting, content, closing |
| Fulfilment | Marketing Strategist, Creative Strategist, Copywriter, Ad Specialist, Communication Coach | Campaign delivery, creative, client management |
| Operations | Hiring Assistant, Systems Architect | Team building, SOPs, process automation |

Think of it as an external brain your AI OS can tap into. Your AI OS is the central nervous system. AgencyOSX (or any similar tool) provides specialist knowledge on demand.

**How it feeds your AI OS:**
- Your **Context layer** informs the AI employees. When they know your niche, team, and strategy, their outputs are specific to your business.
- Their **outputs become Data**. Strategies, SOPs, scripts, and plans generated by AI employees flow back into your AI OS, making it more intelligent.
- Your **Decision Engine** can log decisions made with AI employee input, building your pattern library over time.

The compounding effect: better context → better AI employee outputs → richer data → smarter AI OS → better context.

#### Connecting AgencyOSX to Your AI OS (MCP)

AgencyOSX has a remote MCP server, so you can use its AI employees directly from Claude Code. No browser needed.

**Setup:**

1. Get your API token from AgencyOSX → Settings → Integrations (starts with `aosx_`)
2. Add `AGENCYOSX_API_TOKEN` to your `.env.local`
3. Add this to your `.mcp.json` (create the file in your project root if it doesn't exist):

```json
{
  "mcpServers": {
    "agencyosx": {
      "url": "https://app.agencyosx.ai/api/mcp",
      "headers": {
        "Authorization": "Bearer ${AGENCYOSX_API_TOKEN}"
      }
    }
  }
}
```

**What this unlocks:**
- `list_agents` - See all 15 AI employees and their specialisms
- `get_agent` - Get full details and available skills for any AI employee
- `chat` - Talk to any AI employee directly from Claude Code
- `generate_file` - Have an AI employee create a CSV, Markdown, or JSON file

**Example:** You're building a marketing strategy in your AI OS. Instead of writing everything from scratch, you ask Claude Code to chat with the AgencyOSX Marketing Strategist, generate a campaign structure, then save it to your outputs. Your context makes the output specific to your business. The generated file becomes data in your system.

---

## How the Layers Interact

```
FUNCTION reads CONTEXT + DATA to produce intelligent outputs
    |
    DATA provides ground truth — real numbers, real conversations
    |
    CONTEXT provides meaning — why this matters, what to optimise for
    |
    AI OS provides the engine — Claude Code processes everything
```

**Example flow: Daily Brief generation**

1. **AI OS** runs the brief generation script
2. **Context** tells it what companies you run, what your priorities are, and what metrics matter
3. **Data** provides the actual numbers — yesterday's revenue, team messages, meeting transcripts
4. **Function** synthesises everything into a 9-section intelligence report

Without any one layer, the brief is either generic (no Context), uninformed (no Data), or non-existent (no AI OS).

---

## Build Timeline

There's no fixed timeline — everyone moves at their own pace. But here's a realistic progression:

| Week | Focus | Outcome |
|------|-------|---------|
| 1 | Context layer | All 6 context files populated. AI OS understands your business. |
| 2-3 | Data layer (first sources) | 2-3 highest-priority data sources syncing. |
| 3-4 | First function (Daily Brief) | Morning intelligence report generating from real data. |
| 4-8 | More data + more functions | Additional data sources and function systems. |
| 8+ | Decision Engine + Autonomy | System learning your patterns and earning autonomy. |

The most important thing is to start. The Context layer takes a focused afternoon. Everything else builds on top of it.

---

_This document is your reference. Come back to it when planning new additions to your AI OS._
