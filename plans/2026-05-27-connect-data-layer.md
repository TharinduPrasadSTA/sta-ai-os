# Plan: Connect the Data Layer

**Created:** 2026-05-27
**Status:** Draft
**Layer:** Data (Layer 3)
**Request:** Connect all five STA data sources into the AI OS so real business data flows into the Daily Brief and Decision Engine.

---

## Overview

### What This Accomplishes
Provisions Supabase as the AI OS's storage and search infrastructure, then connects GoHighLevel, ClickUp, Microsoft Outlook, Microsoft Teams, and Seamless.ai — the five tools STA uses daily. After completion, the AI OS can query real CRM activity, project task data, client emails, internal team messages, and lead intelligence rather than relying on manually updated context files.

### Why It Matters
The Context layer is complete — the AI OS knows who Tharindu is, what STA does, and what success looks like. Without the Data layer, every analysis is still based on the static snapshots in `context/`. With it, the Daily Brief reflects actual pipeline values, actual task completion rates, actual communication patterns, and actual lead flow. This is the difference between a generic assistant and a system that understands the business as it currently stands.

From `context/strategy.md`: the three active priorities are reliable client delivery, productizing AI systems, and scaling client acquisition. All three require real data — delivery throughput from ClickUp, pipeline health from GoHighLevel, and lead volume from Seamless.ai.

### Layer Dependencies
- **Layer 1 (AI OS):** Complete. CLAUDE.md, commands, git all in place.
- **Layer 2 (Context):** Complete. All 6 context files populated as of 2026-05-27.
- **GitHub repository with remote:** Required for Phase 3 (GitHub Actions scheduling). The repo is initialised locally but not yet pushed to GitHub — this is a prerequisite.
- **Supabase account:** Required for Phase 1. Free tier is sufficient.
- **API keys:** Required per service in Phase 2 — see credentials checklist below.

---

## Current State

```
data/decisions/        — empty (only .gitkeep)
scripts/               — only README.md and example files
.env.local             — does not exist yet
.mcp.json              — does not exist yet
Supabase               — not provisioned
GitHub remote          — not configured (local repo only)
```

Five services mapped in `context/integrations.md`, all with status "Not connected":

| Service | Data Pattern | Priority |
|---------|-------------|----------|
| GoHighLevel | Both | High |
| ClickUp | Both | High |
| Microsoft Outlook | Both | High |
| Microsoft Teams | Both | High |
| Seamless.ai | Append-only | Medium |

---

## Proposed Changes

### Summary
- Push project to a GitHub remote repository
- Provision Supabase project with pgvector and the `search()` function
- Create `.env.local` with all API credentials
- Connect each service (sync scripts + MCP where available)
- Create one consolidated GitHub Actions workflow for nightly data syncs
- Update `context/integrations.md` to reflect connected status

### New Files

| File Path | Purpose |
|-----------|---------|
| `.env.local` | API keys and credentials — gitignored, never committed |
| `.mcp.json` | MCP server configuration for live queries |
| `scripts/sync/sync-ghl.ts` | GoHighLevel CRM sync — contacts, pipeline, workflows, activity |
| `scripts/sync/sync-clickup.ts` | ClickUp task and project sync |
| `scripts/sync/sync-outlook.ts` | Outlook email sync |
| `scripts/sync/sync-teams.ts` | Microsoft Teams message sync |
| `scripts/sync/sync-seamless.ts` | Seamless.ai lead record sync |
| `scripts/utils/db.ts` | Shared Supabase client and helpers |
| `scripts/utils/embed.ts` | Voyage embedding helper |
| `.github/workflows/nightly-sync.yml` | Consolidated nightly sync workflow (GitHub Actions) |

### Files to Modify

| File Path | Changes |
|-----------|---------|
| `context/integrations.md` | Update status column to "Connected" per service as each is completed |
| `.gitignore` | Verify `.env.local` is present (already should be from template) |

---

## Design Decisions

1. **GoHighLevel first:** It is STA's system of record — CRM, pipeline, AI agent activity, workflow execution logs all live here. Most valuable for the Daily Brief and the highest-priority connection. Has a pre-built `/connect-data` template (#12).

2. **One consolidated nightly workflow, not per-service workflows:** `/connect-data` Phase 3 creates a single `nightly-sync.yml` that runs all sync scripts in sequence. Simpler to maintain, one place to check if something fails.

3. **Dual-method for GoHighLevel, ClickUp, Outlook, Teams (Both pattern):** Each of these services holds append-only history (activity logs, messages, emails) AND ever-changing current state (pipeline status, task board, current inbox). The sync scripts handle history → Supabase; MCP handles live queries. Seamless.ai is append-only so sync only.

4. **Voyage embeddings on all text-bearing tables:** Every table that stores text (messages, emails, CRM notes, task descriptions) gets an `embedding` column via Voyage AI's embedding model. Combined with `search_tsv` for keyword search, this enables the `search()` function to do hybrid retrieval with reranking across all sources in one query.

5. **`source_id` UPSERT pattern on all tables:** Every sync script uses `INSERT ... ON CONFLICT (source_id) DO UPDATE SET ...` so re-running a sync never creates duplicate rows. Safe to run daily or on-demand.

6. **Push to GitHub before scheduling:** GitHub Actions workflows require the project to be in a GitHub repository. The repo is currently local-only — this must be done before Phase 3.

---

## Prerequisites Checklist

Before executing Phase 1, gather or create the following:

**GitHub:**
- [ ] Create a GitHub repository (can be private)
- [ ] Push this project: `git remote add origin <url>` then `git push -u origin master`

**Supabase:**
- [ ] Create a free Supabase account at supabase.com
- [ ] Create a new project — note the Project URL and service role key

**GoHighLevel API:**
- [ ] In GHL: Settings → Integrations → API Keys → Create API Key
- [ ] Note the API key and your Location ID (Agency sub-account ID)

**ClickUp API:**
- [ ] In ClickUp: Settings → Apps → API Token → Generate
- [ ] Note the API token

**Microsoft (Outlook + Teams):**
- [ ] Register an app in Azure Portal (portal.azure.com → Azure Active Directory → App registrations)
- [ ] Grant permissions: `Mail.Read`, `ChannelMessage.Read.All`, `User.Read`
- [ ] Note: Client ID, Client Secret, Tenant ID

**Seamless.ai:**
- [ ] In Seamless.ai: Settings → Integrations → API → Generate API Key
- [ ] Note the API key

**Anthropic API:**
- [ ] Generate an API key at console.anthropic.com (separate from Pro/Max plan — used by sync scripts and scheduled workflows)

**Voyage AI (for embeddings):**
- [ ] Create account at voyageai.com
- [ ] Generate API key

---

## Step-by-Step Tasks

### Step 1: Push Project to GitHub

This is required before Phase 3. Do it now so the remote is ready when needed.

**Actions:**
- Create a new repository on github.com (name: `sta-ai-os`, private)
- Run locally:
  ```
  git remote add origin https://github.com/<your-username>/sta-ai-os.git
  git push -u origin master
  ```
- Verify the push succeeded and all files appear on GitHub

**Files affected:**
- No file changes — this is a git remote operation

---

### Step 2: Run `/connect-data` — Phase 1 (Supabase Setup)

The `/connect-data` command handles Supabase provisioning automatically. Running it will:
- Create the Supabase schema (pgvector extension, `search()` function, `pg_net` for Voyage reranking)
- Prompt for Supabase URL and service role key
- Write those values to `.env.local`

**Actions:**
- Run: `/connect-data set up supabase`
- When prompted, paste in the Supabase Project URL and service role key
- Confirm the `search()` function is created successfully

**Files affected:**
- `.env.local` (created — stores `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`)

---

### Step 3: Connect GoHighLevel (Highest Priority)

GoHighLevel is the most valuable source — CRM contacts, pipeline deals, workflow execution logs, AI agent activity, appointment bookings.

**Actions:**
- Run: `/connect-data connect GoHighLevel`
- When prompted, provide:
  - `GHL_API_KEY` — from GHL Settings → API Keys
  - `GHL_LOCATION_ID` — your agency sub-account Location ID
- The command will:
  - Check the MCP Registry for a GoHighLevel server
  - Build a sync script for the append-only parts (contacts, activity logs, workflow history)
  - Set up live access for ever-changing state (current pipeline, active sub-accounts)
  - Create the Supabase table schema for GHL data
  - Test the connection with a sample query

**What gets synced:**
- Contacts and CRM records
- Pipeline deals and stages
- Workflow execution logs
- Appointment bookings
- AI agent interaction logs (where accessible via API)

**Files affected:**
- `.env.local` — adds `GHL_API_KEY`, `GHL_LOCATION_ID`
- `.mcp.json` — adds GoHighLevel live connection (if MCP server exists in registry)
- `scripts/sync/sync-ghl.ts` — generated sync script
- `context/integrations.md` — status updated to "Connected"

---

### Step 4: Connect ClickUp

ClickUp holds all delivery data — tasks, projects, assignees, statuses, completion rates. Critical for tracking delivery throughput and team workload.

**Actions:**
- Run: `/connect-data connect ClickUp`
- When prompted, provide:
  - `CLICKUP_API_TOKEN` — from ClickUp Settings → Apps → API Token
- The command will sync task history and set up live queries for the current task board

**What gets synced:**
- Tasks (title, description, status, assignee, due date, completion date)
- Projects and spaces
- Task activity history

**Files affected:**
- `.env.local` — adds `CLICKUP_API_TOKEN`
- `.mcp.json` — adds ClickUp live connection
- `scripts/sync/sync-clickup.ts` — generated sync script
- `context/integrations.md` — status updated to "Connected"

---

### Step 5: Connect Microsoft Outlook

Outlook holds client-facing email communication — the paper trail for every client relationship, delivery update, and escalation.

**Actions:**
- Run: `/connect-data connect Microsoft Outlook`
- When prompted, provide:
  - `MICROSOFT_CLIENT_ID`
  - `MICROSOFT_CLIENT_SECRET`
  - `MICROSOFT_TENANT_ID`
  (All from the Azure app registration)
- The command will sync email history and set up live inbox queries

**What gets synced:**
- Sent and received emails (subject, body, sender, recipient, timestamp)
- Email threads relevant to client communication

**Files affected:**
- `.env.local` — adds Microsoft credentials
- `.mcp.json` — adds Outlook live connection
- `scripts/sync/sync-outlook.ts` — generated sync script
- `context/integrations.md` — status updated to "Connected"

---

### Step 6: Connect Microsoft Teams

Teams holds all internal team communication — project coordination, technical discussions, escalations between Dimitry, Stanley, Pamuditha, and Tharindu.

**Actions:**
- Run: `/connect-data connect Microsoft Teams`
- Reuses the Microsoft credentials from Step 5 (same Azure app registration, additional Teams permissions required: `ChannelMessage.Read.All`)
- The command will sync message history and set up live channel queries

**What gets synced:**
- Channel messages (content, sender, timestamp, channel)
- Direct messages (where permissions allow)
- Team activity patterns

**Files affected:**
- `.env.local` — no new credentials if Outlook already connected (same Microsoft app)
- `.mcp.json` — adds Teams live connection
- `scripts/sync/sync-teams.ts` — generated sync script
- `context/integrations.md` — status updated to "Connected"

---

### Step 7: Connect Seamless.ai

Seamless.ai provides lead intelligence — enriched contact records and prospect lists that feed the GHL pipeline.

**Actions:**
- Run: `/connect-data connect Seamless.ai`
- When prompted, provide:
  - `SEAMLESS_API_KEY`
- Append-only connection only (no live queries needed — exported lead records don't change)

**What gets synced:**
- Exported lead records (name, company, email, phone, title, enrichment data)
- Prospecting lists

**Files affected:**
- `.env.local` — adds `SEAMLESS_API_KEY`
- `scripts/sync/sync-seamless.ts` — generated sync script
- `context/integrations.md` — status updated to "Connected"

---

### Step 8: Run `/connect-data` — Phase 3 (Schedule Syncs)

Once all services are connected, schedule the sync scripts to run automatically every night so data stays fresh without manual intervention.

**Actions:**
- Run: `/connect-data schedule syncs`
- The command will create `.github/workflows/nightly-sync.yml`
- In GitHub repository: Settings → Secrets and variables → Actions → add all API keys as repository secrets (same values as `.env.local`)
- Push the workflow file:
  ```
  git add .github/workflows/nightly-sync.yml
  git commit -m "Add nightly data sync workflow"
  git push
  ```
- Trigger a manual test run from GitHub → Actions tab to confirm all syncs succeed

**What the workflow does:**
- Runs at 02:00 UTC nightly
- Executes all scripts in `scripts/sync/` in sequence
- Writes results to Supabase
- Emails the repo owner if any sync fails

**Files affected:**
- `.github/workflows/nightly-sync.yml` — consolidated sync workflow

---

### Step 9: Verify End-to-End

Confirm the data layer is functioning before declaring complete.

**Actions:**
- Ask Claude: *"What's the current state of my GoHighLevel pipeline? How many active clients do we have?"*
- Ask Claude: *"What tasks are open in ClickUp right now?"*
- Ask Claude: *"Show me the most recent client emails from Outlook."*
- Check `max(_synced_at)` for each table to confirm freshness
- Confirm the nightly workflow ran successfully in GitHub Actions

---

## Validation Checklist

- [ ] Project pushed to GitHub with a remote configured
- [ ] Supabase project created and `search()` function verified
- [ ] `.env.local` present with all five service credentials
- [ ] GoHighLevel connected — sample query returns real CRM data
- [ ] ClickUp connected — sample query returns real task data
- [ ] Outlook connected — sample query returns recent emails
- [ ] Teams connected — sample query returns recent messages
- [ ] Seamless.ai connected — lead records accessible
- [ ] Nightly sync workflow created and tested in GitHub Actions
- [ ] `context/integrations.md` updated to show all five services as "Connected"
- [ ] `max(_synced_at)` for each table shows data synced within last 24 hours

---

## Success Criteria

1. Claude can answer "What's in our GoHighLevel pipeline right now?" from real CRM data — not the manual snapshot in `current-data.md`
2. Claude can answer "What's the team working on today?" from live ClickUp task data
3. Claude can answer "What were the most recent client emails about?" from synced Outlook data
4. Nightly sync runs automatically at 02:00 UTC without manual intervention
5. The AI OS is ready to generate a Daily Brief from real data — the next logical step after this plan is executed

---

## What Comes Next

Once this plan is executed, the Data layer is live. The logical next step is:

**Build the Daily Brief** — a morning intelligence report that reads GoHighLevel pipeline health, ClickUp delivery status, and team communication patterns, then produces a structured daily brief automatically via GitHub Actions.

Run: `/create-plan build daily brief`
