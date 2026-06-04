# Plan: Daily Brief — Morning Intelligence Report

**Created:** 2026-06-04
**Status:** Draft
**Layer:** Function
**Request:** Build a daily morning intelligence report that reads context and live data, covers 6 specific sections, and delivers actionable priorities before the working day starts.

---

## Overview

### What This Accomplishes
A TypeScript script (`scripts/run-brief.ts`) runs every morning via GitHub Actions, queries Supabase and context files, calls Claude claude-opus-4-7, and writes a structured markdown brief to `outputs/briefs/YYYY-MM-DD.md`. The brief is committed back to the repo and optionally posted to email. It covers pipeline health, growth signals, delivery risks, team pulse, a data-backed SWOT, and 3–5 ranked daily priorities.

### Why It Matters
STA's strategic priority is transitioning from a custom delivery agency to a productized AI systems company. The brief operationalises that by surfacing the metrics that matter for that transition every morning: deal velocity, retainer ratio, delivery concentration, productization progress — not vanity counts. Tharindu's decision filter is leverage first; the brief is designed to reflect that filter, not just report numbers.

### Layer Dependencies
- **Context (Layer 2):** All 6 context files populated — done.
- **Data (Layer 3):** Supabase with GHL contacts/opportunities, ClickUp tasks, Outlook emails — done. GHL conversations and Teams messages are pending Voyage payment but the brief functions without them; it flags them as data gaps.
- **Anthropic API key:** `ANTHROPIC_API_KEY` must be set in `.env.local` and in GitHub Actions secrets. Currently empty in `.env.local` — must be added before implementation.

---

## Current State

**What exists:**
- `outputs/briefs/` directory (has `.gitkeep`)
- `scripts/utils/db.ts` — Supabase client, reusable
- `package.json` — tsx scripts pattern already established
- `.github/workflows/nightly-sync.yml` — proves the Actions pattern works with Node 22

**What's missing:**
- `scripts/run-brief.ts` — the brief generation script
- `.github/workflows/daily-brief.yml` — the scheduled workflow
- `ANTHROPIC_API_KEY` in `.env.local` and GitHub secrets

**Key data findings from schema exploration:**
- `ghl_opportunities.stage_name` is NULL for all rows — GHL API isn't returning pipeline stages. Pipeline health must be inferred from `status` + `monetary_value` + `updated_at` instead.
- `ghl_opportunities.monetary_value` is $0 for 103 of 105 open opps — only 2 opps have values. Pipeline value queries must account for this and flag it as a data quality problem.
- `clickup_tasks.priority` is NULL for most tasks — priority-based ranking uses `due_date` and `status` instead.
- `clickup_tasks` space names map directly to clients: Getting Along Academy, Defencify Training, Helm Dental Lab, Plynt Tech, Client Support. AI Employees Sales & Partners (373 "to do") is a sales CRM space, not a delivery backlog.
- Seamless imports: 1,699 contacts in the prior 30 days, 414 in the last 30 days — a 75% drop. Primary outbound signal to watch.
- `outlook_emails.received_at` covers ~50 days of email history. Subject lines and sender names are available but body text is truncated to 2,000 chars.

---

## Proposed Changes

### Summary
- Write `scripts/run-brief.ts` — queries Supabase, reads context files, calls Claude, writes the brief
- Write `.github/workflows/daily-brief.yml` — cron at 05:00 UTC (10:30am Sri Lanka / 3:30pm AEST) runs the script
- Add `ANTHROPIC_API_KEY` to `.env.local` (manually by user) and to GitHub Actions secrets

### New Files

| File Path | Purpose |
|-----------|---------|
| `scripts/run-brief.ts` | Main brief generation script |
| `.github/workflows/daily-brief.yml` | Scheduled GitHub Actions workflow |

### Files to Modify

| File Path | Changes |
|-----------|---------|
| `.env.local` | Add `ANTHROPIC_API_KEY=<key>` (user adds manually) |
| `package.json` | Add `"brief": "node --env-file=.env.local --import tsx/esm scripts/run-brief.ts"` to scripts |

---

## Design Decisions

1. **Claude claude-opus-4-7 with prompt caching:** Context files are static day-to-day. Cache them using the Anthropic API's prompt caching feature so the 6 context files (≈8,000 tokens) are only billed once and cached for subsequent runs. Data queries change daily and are not cached. Estimated cost: $0.20–0.60/day.

2. **Single script, not modular:** Each section's SQL query and formatting logic lives inline in `run-brief.ts`. No sub-module. The script is read top-to-bottom and produces one complete prompt in one API call. Simpler to debug, easier to tune prompts.

3. **One Claude call, not six:** All six sections are generated in a single API call with a structured prompt. This is cheaper (one cache hit on context), produces better cross-section reasoning (Claude can see the whole picture), and keeps latency low.

4. **Output committed to repo:** The workflow commits `outputs/briefs/YYYY-MM-DD.md` back to the repo using `git commit + git push`. This means briefs accumulate as a searchable history. The workflow uses `GITHUB_TOKEN` (auto-provided by Actions) — no extra secrets needed for the commit.

5. **Delivery: file only (v1):** No email or Slack in v1. The brief lands in the repo. If Tharindu wants mobile delivery, that's a v2 addition (add a `SLACK_WEBHOOK_URL` step or email step to the workflow).

6. **Cascade effect reasoning baked into the prompt:** Rather than computing cascades in code, the brief prompt instructs Claude to reason about upstream signals and their downstream timing. Claude has the full data context and the strategy/context files to do this accurately.

7. **Data freshness check:** The script checks `max(_synced_at)` for each table before querying. If any table is stale by more than 36 hours, that staleness is flagged inline in the relevant section rather than silently presenting outdated data.

8. **Graceful degradation for missing data:** GHL conversations (0 rows) and Teams messages (0 rows) are noted in the brief's data gaps section, not treated as errors. The brief runs cleanly on available data.

---

## Step-by-Step Tasks

### Step 1: Add Anthropic API Key

The script calls `@anthropic-ai/sdk`. The key must exist in `.env.local` before local testing.

**Actions:**
- User: Go to console.anthropic.com → API Keys → Create new key
- Add to `.env.local`: `ANTHROPIC_API_KEY=sk-ant-...`
- Add `ANTHROPIC_API_KEY` as a GitHub Actions secret at github.com/TharinduPrasadSTA/sta-ai-os → Settings → Secrets

**Files affected:**
- `.env.local` (manual, gitignored)

---

### Step 2: Add npm script to package.json

Add the brief run command alongside the existing sync scripts.

**Actions:**
- Edit `package.json`, add to `"scripts"`:
  ```json
  "brief": "node --env-file=.env.local --import tsx/esm scripts/run-brief.ts"
  ```

**Files affected:**
- `package.json`

---

### Step 3: Write `scripts/run-brief.ts`

The main script. Structure:

```
1. Import @anthropic-ai/sdk and supabase client
2. Define CONTEXT_DIR path
3. Read all 6 context files from filesystem (personal-info.md, companies.md, strategy.md, team.md, current-data.md, integrations.md)
4. Run 6 SQL queries (one per section) — see Section Queries below
5. Build the prompt (system + user) with context + data
6. Call claude-opus-4-7 with prompt caching on context blocks
7. Write output to outputs/briefs/YYYY-MM-DD.md
8. Print "Brief written to outputs/briefs/YYYY-MM-DD.md"
```

**Section Queries (exact SQL):**

**S1 — Revenue and Cash Position:**
```sql
SELECT
  count(*) FILTER (WHERE status = 'open') as open_opps,
  count(*) FILTER (WHERE status = 'won') as won_opps,
  count(*) FILTER (WHERE status = 'abandoned') as lost_opps,
  sum(monetary_value) FILTER (WHERE status = 'open') as open_pipeline_value,
  sum(monetary_value) FILTER (WHERE status = 'won') as won_value_total,
  count(*) FILTER (WHERE status = 'open' AND monetary_value > 0) as opps_with_value,
  count(*) FILTER (WHERE status = 'open' AND monetary_value = 0) as opps_without_value,
  avg(monetary_value) FILTER (WHERE status = 'open' AND monetary_value > 0) as avg_valued_opp,
  count(*) FILTER (WHERE created_at > now() - interval '30 days') as new_last_30d,
  count(*) FILTER (WHERE updated_at > now() - interval '7 days' AND status = 'open') as moved_last_7d,
  count(*) FILTER (WHERE created_at > now() - interval '7 days') as new_last_7d,
  max(_synced_at) as last_synced
FROM ghl_opportunities
```

**S2 — Growth Signals:**
```sql
SELECT source,
  count(*) as total,
  count(*) FILTER (WHERE created_at > now() - interval '30 days') as last_30d,
  count(*) FILTER (WHERE created_at BETWEEN now() - interval '60 days' AND now() - interval '30 days') as prior_30d
FROM ghl_contacts
WHERE source IS NOT NULL
GROUP BY source
ORDER BY last_30d DESC, total DESC
LIMIT 12
```

Plus a second query for opportunity velocity:
```sql
SELECT
  date_trunc('week', created_at) as week,
  count(*) as new_opps,
  sum(monetary_value) as new_value
FROM ghl_opportunities
WHERE created_at > now() - interval '8 weeks'
GROUP BY week
ORDER BY week DESC
```

**S3 — Yesterday's Decisions and Actions:**
```sql
SELECT name, status, space_name, list_name, assignees, updated_at
FROM clickup_tasks
WHERE updated_at > now() - interval '48 hours'
  AND status NOT IN ('meeting recaps', 'meeting updates', 'meeting report', 'project updates', 'project update', 'project status', 'update required')
ORDER BY updated_at DESC
LIMIT 25
```

Plus email query:
```sql
SELECT subject, from_name, from_address, received_at, is_read
FROM outlook_emails
WHERE received_at > now() - interval '48 hours'
ORDER BY received_at DESC
LIMIT 20
```

**S4 — Team and Community Pulse:**
```sql
-- Active task load by client space
SELECT
  space_name,
  count(*) FILTER (WHERE status IN ('in progress')) as in_progress,
  count(*) FILTER (WHERE status = 'to do') as to_do,
  count(*) FILTER (WHERE due_date < now() AND status NOT IN ('complete', 'cancelled', 'not applicable')) as overdue,
  count(*) FILTER (WHERE updated_at > now() - interval '7 days') as moved_this_week
FROM clickup_tasks
WHERE space_name NOT IN ('AI Employees Sales & Partners')  -- exclude sales CRM space
  AND space_name IS NOT NULL
GROUP BY space_name
ORDER BY in_progress DESC, overdue DESC
```

Plus Tier 1 contact recency from email:
```sql
-- Last email from/to each Tier 1 team member
SELECT
  CASE
    WHEN from_address ILIKE '%dimitry%' OR from_name ILIKE '%dimitry%' THEN 'Dimitry Ortiz (PM)'
    WHEN from_address ILIKE '%stanley%' OR from_name ILIKE '%stanley%' THEN 'Stanley Motinda (GHL Manager)'
    WHEN from_address ILIKE '%pamuditha%' OR from_name ILIKE '%pamuditha%' THEN 'Pamuditha Wijerathne (Dev)'
    WHEN from_address ILIKE '%wilton%' OR from_name ILIKE '%wilton%' THEN 'Wilton Rogers (CEO)'
    ELSE NULL
  END as person,
  max(received_at) as last_contact,
  now() - max(received_at) as days_since
FROM outlook_emails
WHERE (from_address ILIKE '%dimitry%' OR from_name ILIKE '%dimitry%'
    OR from_address ILIKE '%stanley%' OR from_name ILIKE '%stanley%'
    OR from_address ILIKE '%pamuditha%' OR from_name ILIKE '%pamuditha%'
    OR from_address ILIKE '%wilton%' OR from_name ILIKE '%wilton%')
GROUP BY person
```

**S5 — SWOT:** No additional query. Claude reasons from S1–S4 data plus strategy.md and current-data.md context.

**S6 — Today's Focus:** Derived from:
```sql
-- Highest-urgency tasks: overdue or due today, high-value spaces
SELECT name, status, space_name, list_name, due_date, assignees
FROM clickup_tasks
WHERE status NOT IN ('complete', 'cancelled', 'not applicable', 'meeting recaps', 'meeting updates', 'meeting report')
  AND (due_date <= now() + interval '1 day' OR priority = 'high' OR priority = 'urgent')
ORDER BY due_date ASC NULLS LAST
LIMIT 20
```

**Prompt structure:**

```
SYSTEM:
You are Tharindu's AI Operating System. You generate his daily intelligence brief.
You write the way Tharindu thinks: direct, action-first, no filler, structured only when it improves clarity.
Your job is to surface what matters today and what signals risk tomorrow — not to report everything.
Prioritise leverage over volume. Show rates over raw counts. Map upstream signals to downstream risk.
End every section with one Implication line that tells Tharindu what to do, not just what the data shows.

[CONTEXT BLOCK — prompt-cached]
<personal-info.md content>
<companies.md content>
<strategy.md content>
<team.md content>
<current-data.md content>
<integrations.md content>

USER:
Today is {date}. Generate the Daily Brief using the data below.
For each section: lead with the most important insight, not a preamble.
Map cascade effects where an upstream metric shift signals a downstream risk in 2–3 weeks.
End each section with: **Implication:** one sentence telling me what this means for today.
Close with a **Data Gaps** section listing what's missing that would improve this brief.

[DATA BLOCK — not cached]
## Section 1 Data — Revenue and Cash Position
{S1 query results as formatted text}

## Section 2 Data — Growth Signals
{S2 query results}

## Section 3 Data — Yesterday's Activity
{S3 query results}

## Section 4 Data — Team and Client Pulse
{S4 query results}

---
Generate sections in this order:
1. Revenue and Cash Position
2. Growth Signals (content, leads, pipeline trends)
3. Yesterday's Decisions and Actions
4. Team and Community Pulse
5. SWOT — daily, specific, data-backed
6. Today's Focus: 3–5 priorities ranked by leverage

Keep the full brief under 800 words. Every sentence must earn its place.
```

**Output format:**
```markdown
# Daily Brief — {Day, Month DD YYYY}
_Generated at {time} UTC | Data as of {last_synced_at}_

## 1. Revenue and Cash Position
...
**Implication:** ...

## 2. Growth Signals
...
**Implication:** ...

[... sections 3-6 ...]

---
## Data Gaps
- ...
```

**Files affected:**
- `scripts/run-brief.ts` (new)

---

### Step 4: Write `.github/workflows/daily-brief.yml`

```yaml
name: Daily Brief

on:
  schedule:
    - cron: '0 5 * * *'   # 05:00 UTC = 10:30am Sri Lanka / 3:00pm AEST
  workflow_dispatch:

jobs:
  brief:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: write        # needed to commit the brief back to repo

    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm install

      - name: Generate Daily Brief
        run: npx tsx scripts/run-brief.ts
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}

      - name: Commit brief to repo
        run: |
          git config user.name "STA AI OS"
          git config user.email "tharindu@scalethroughautomation.io"
          git add outputs/briefs/
          git diff --staged --quiet || git commit -m "brief: $(date -u +%Y-%m-%d)"
          git push
```

**Files affected:**
- `.github/workflows/daily-brief.yml` (new)

---

### Step 5: Verify locally before pushing

```bash
npm run brief
```

Expected: `outputs/briefs/2026-06-04.md` created with all 6 sections. Review for data accuracy and tone. Adjust the prompt in `run-brief.ts` if any section is too generic or too verbose.

**Files affected:**
- `outputs/briefs/YYYY-MM-DD.md` (generated, not committed during local test)

---

### Step 6: Push and trigger manual Actions run

```bash
git add scripts/run-brief.ts .github/workflows/daily-brief.yml package.json
git commit -m "feat: add Daily Brief script and workflow"
git push
```

Then: GitHub → Actions → Daily Brief → Run workflow.

Confirm the generated brief appears in `outputs/briefs/` as a committed file in the repo.

---

## Validation Checklist

- [ ] `ANTHROPIC_API_KEY` added to `.env.local`
- [ ] `ANTHROPIC_API_KEY` added to GitHub Actions secrets
- [ ] `npm run brief` runs locally without errors
- [ ] Brief output has all 6 sections
- [ ] Section 1 correctly shows pipeline data and flags the $0-value opp issue
- [ ] Section 2 correctly flags the Seamless import rate drop (1,699 → 414)
- [ ] Section 4 correctly identifies Getting Along Academy as the highest-concentration client (68 in-progress tasks)
- [ ] Section 4 flags Defencify Training overdue tasks
- [ ] Section 6 (Today's Focus) produces exactly 3–5 priorities, ranked
- [ ] Each section ends with an **Implication:** line
- [ ] Data Gaps section lists: GHL conversations, Teams messages, revenue/MRR system, GHL pipeline stage data
- [ ] GitHub Actions workflow completes without error
- [ ] Brief is committed back to repo by the workflow
- [ ] Prompt caching is verified (check API response for `cache_read_input_tokens > 0` on second run)

---

## Success Criteria

1. A brief file appears in `outputs/briefs/` every morning without manual intervention
2. Section 1 surfaces pipeline velocity and the data quality gap (most opps have $0 value) — not just a raw count
3. Section 2 flags the Seamless import rate drop as an outbound signal risk within 2–3 weeks
4. Section 4 flags Getting Along Academy task concentration as a bandwidth risk and Defencify Training overdue tasks as a delivery risk
5. Section 6 gives 3–5 priorities Tharindu can act on within the first hour of the day
6. Brief reads in under 3 minutes
7. API cost per brief is under $1.00

---

## Data Gaps — What Would Make v2 Better

These are the gaps the brief itself should flag every day until they're closed:

| Gap | Impact | How to Close |
|-----|--------|-------------|
| No revenue/MRR system connected | Section 1 has no actual cash position — only pipeline proxies | Connect Stripe, Xero, or manual weekly input to `current-data.md` |
| GHL pipeline stage data is NULL | Can't track stage-by-stage conversion or velocity | Investigate GHL API — stage data should be in the `pipelineStage` field; may need a different endpoint or API version |
| GHL monetary values mostly $0 | Pipeline value is unreliable ($5,432 across 105 opps) | Requires GHL data cleanup: assign values to open opps in GHL CRM |
| GHL conversations (0 rows) | No SMS/chat history with prospects or clients | Add Voyage payment method; next nightly sync will fill this |
| Teams messages (0 rows) | No internal team communication context | Same fix as above |
| No Seamless.ai connection | Can't see what lists are being built or targeted | Add Seamless API key when available |
| ClickUp priority field is NULL | Can't rank tasks by priority — falls back to due date | Fix in ClickUp: assign priority to active tasks |

---

_Run `/implement plans/2026-06-04-daily-brief.md` to build this._
