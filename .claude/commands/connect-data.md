---
name: Connect Data
description: Build the Data layer for the AI OS end to end. Single resumable command that provisions Supabase, connects each service in integrations.md (Sync into Supabase for append-only data, Live for ever-changing state), and schedules one consolidated nightly GitHub Actions workflow. State-aware. Safe to re-run; skips what's done. Classifies services automatically using the known-service map and the Data Pattern column populated by /build-context.
---

# Connect Data — Guided Data Layer Builder

> One command. Three phases. Resumable. Mirrors the `/build-context` pattern. Members run it, approve each connection, ask questions. Claude handles everything else.

---

## Philosophy

The Data layer turns the AI OS from a strategy document into a live dashboard. Two jobs:

1. **Accumulate append-only business data** (call transcripts, messages, transactions, CRM activity) into a searchable Supabase corpus
2. **Keep live connections to ever-changing reference** (SOPs, today's calendar, current pipeline records)

The founder listed every tool in `context/integrations.md` during `/build-context`. That file has a `Data Pattern` column (Append-only / Ever-changing / Both) already classified by the wizard. This command reads that file and does the technical work: Supabase provisioning, per-source table design, MCP Registry lookups, sync-script authoring, GitHub Actions workflow scheduling.

State is detected on every invocation. Founders can run this command, stop at any point, come back days later — the command picks up from the first incomplete phase.

---

## Architecture (what this command builds)

**Two data surfaces.** Claude picks automatically at query time based on the question.

- **Supabase** — every synced service gets a typed table matching its actual data shape. Text-bearing tables get `embedding vector(1024)` + `search_tsv tsvector` columns. Structured numeric tables get only typed columns. Claude queries either via the `search()` function (for content) or direct SQL (for numbers and structured records).
- **Live** — ever-changing reference data (SOPs, calendars, current pipeline state). Claude queries the service at question time via MCP (where available) or via a local API wrapper at `scripts/live/<service>.ts`.

**No generic documents+chunks abstraction.** Each service's table matches its own data.

**Reranking is baked in.** The `search()` function does hybrid search (RRF of semantic + keyword) and then passes candidates through Voyage rerank-2 via `pg_net` for final ordering. Claude sees one function; under the hood it's full-quality retrieval.

**Hygiene on every synced row:**
- `source_id TEXT UNIQUE NOT NULL` — service's native record ID. Prevents duplicates via UPSERT.
- `_synced_at timestamptz default now()` — updated on every write. Claude flags stale data when answering.
- `embedding_model TEXT` — on text-bearing tables; enables selective re-embedding when models evolve.

---

## Invocation Forms

| Input | Behaviour |
|---|---|
| `/connect-data` | Auto-detect state. Continue from first incomplete phase. End-to-end unless founder stops. |
| `/connect-data set up supabase` | Phase 1 explicitly (provisions Supabase + search() + reranker) |
| `/connect-data connect my services` or `let's connect integrations` | Phase 2 explicitly |
| `/connect-data connect [SERVICE]` | Phase 2 for one service |
| `/connect-data connect [SERVICE] --deep` or `re-do [SERVICE] with chunking` | Upgrade a service from Summary mode (summary-only) to Deep mode (Contextual Retrieval chunking) |
| `/connect-data schedule syncs` or `automate my syncs` | Phase 3 explicitly |
| `/connect-data status` | Report current state. No changes. |

Parse loosely. If the hint doesn't match, default to auto-detect.

---

## Step 1: Prerequisite Check

Before anything else:

1. Read `context/integrations.md`. If every row in the main integrations table is a template placeholder (contains `[e.g., ...]` in the Service column), stop and tell the founder:
   > *"You haven't listed your integrations yet. Run `/build-context` first — it walks you through `integrations.md` and the other five context files. Come back to `/connect-data` once you have at least one real integration with a Data Pattern set."*
2. Read `context/companies.md`. If template-only, also redirect to `/build-context`.

Continue only if both are populated.

---

## Step 2: State Detection

Three checks:

**Phase 1 — Foundation done if all hold:**
- `.env.local` has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- `.mcp.json` has `supabase` entry
- `pgvector` and `pg_net` extensions enabled in the Supabase project
- `search()` function exists and is callable (returns empty cleanly when no text tables yet)

**Phase 2 — per service:** `integrations.md` Status column shows connected / manual / skipped / empty.

**Phase 3 — per sync script:** file in `scripts/sync/` exists and Status mentions a workflow schedule. A consolidated workflow file exists at `.github/workflows/data-sync.yml` (or per-script workflows).

Build a status table:

```
Data layer status:
  Phase 1 (foundation)            [Done / Partial / Not started]
  Phase 2 (service connections)   X/Y connected
  Phase 3 (sync automation)       X/Y scheduled
```

---

## Step 3: Decide What to Run

- Natural-language hint present → jump to that phase (warn if prerequisites unmet).
- Bare `/connect-data` → run first incomplete phase, continue end-to-end unless founder stops.
- `status` → print the table and stop.
- `connect [SERVICE] --deep` → jump to Phase 2, process only that service, use Deep mode.

---

## Phase 1 — Foundation

### 1.1 Supabase project

Ask: *"Do you already have a Supabase project for your AI OS?"*

- **Yes:** collect URL + service role key, skip to 1.2.
- **No:** walk through:
  1. Go to https://supabase.com and sign up (free tier covers this programme).
  2. Create a new project. Strong database password.
  3. Wait 2–3 minutes for provisioning.
  4. Project Settings → API. Copy Project URL and the `service_role` key.

### 1.2 Credentials to `.env.local`

```
SUPABASE_URL=<url>
SUPABASE_SERVICE_ROLE_KEY=<key>
```

Confirm `.env.local` is in `.gitignore`. Never commit secrets.

(Voyage API key is **not** collected here. Collected in Phase 2 when the first text-bearing table is about to be built.)

### 1.3 Supabase in `.mcp.json`

Add (or merge):

```json
{
  "mcpServers": {
    "supabase": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server",
        "--supabase-url", "${SUPABASE_URL}",
        "--supabase-key", "${SUPABASE_SERVICE_ROLE_KEY}"
      ]
    }
  }
}
```

Founder restarts Claude Code for the MCP to bind.

### 1.4 Enable extensions

Once Supabase MCP is live:

```sql
create extension if not exists vector;
create extension if not exists pg_net;
```

`pgvector` for embeddings. `pg_net` for the reranker HTTP call from inside `search()`.

### 1.5 Create the `search()` function stub

```sql
create or replace function search(
  query_text text,
  query_embedding vector(1024),
  match_limit int default 10
)
returns table (
  source_type text,
  source_id uuid,
  title text,
  content text,
  metadata jsonb,
  rerank_score float,
  synced_at timestamptz
)
language plpgsql
stable
as $$
declare
  voyage_api_key text;
  candidate_json jsonb;
  rerank_response jsonb;
begin
  -- Stage 1: RRF over all text-bearing tables (UNION branches added by /connect-data
  -- each time a new text table comes online; stub returns empty).
  create temp table if not exists candidates (
    source_type text,
    source_id uuid,
    title text,
    content text,
    metadata jsonb,
    rrf_score float,
    synced_at timestamptz
  ) on commit drop;

  delete from candidates;

  -- [UNION branches inserted by /connect-data per text table]
  -- Default: empty.

  if (select count(*) from candidates) = 0 then
    return;
  end if;

  -- Stage 2: rerank via Voyage rerank-2 over pg_net.
  begin
    voyage_api_key := (select decrypted_secret from vault.decrypted_secrets where name = 'voyage_api_key');
    candidate_json := (select jsonb_agg(content) from candidates);

    select content into rerank_response
    from net.http_post(
      url := 'https://api.voyageai.com/v1/rerank',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || voyage_api_key,
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'query', query_text,
        'documents', candidate_json,
        'model', 'rerank-2',
        'top_k', match_limit
      )::text,
      timeout_milliseconds := 2000
    );

    -- Return reranked results. Map reranker indices back to candidate rows.
    return query
    select
      c.source_type, c.source_id, c.title, c.content, c.metadata,
      (item->>'relevance_score')::float as rerank_score,
      c.synced_at
    from jsonb_array_elements(rerank_response->'data') with ordinality r(item, idx)
    join candidates c on c.ctid = (
      select ctid from candidates order by rrf_score desc offset ((item->>'index')::int) limit 1
    )
    order by rerank_score desc
    limit match_limit;
  exception when others then
    -- Rerank failed (timeout, API down, etc.). Return RRF-only top N.
    return query
    select
      c.source_type, c.source_id, c.title, c.content, c.metadata,
      c.rrf_score as rerank_score,
      c.synced_at
    from candidates c
    order by c.rrf_score desc
    limit match_limit;
  end;
end;
$$;
```

Voyage API key is stored in Supabase Vault at a later step when the first text-bearing service is connected. Until then, rerank gracefully fails and the function falls back to RRF-only results (which are still empty during Phase 1 since no text tables exist).

### 1.6 Schema sanity check

Synthetic throwaway test (NOT using `companies.md` or any context file):

1. `create temp table _schema_test (id int);` → expect success
2. `select search('test', array_fill(0::real, ARRAY[1024])::vector, 5);` → expect 0 rows cleanly
3. `drop table _schema_test;`

If all three succeed, Phase 1 is complete.

### 1.7 Report

```
✅ Phase 1 complete. Foundation ready.
   Supabase project:  <url>
   Extensions:        pgvector, pg_net
   Core function:     search() stub (will grow as text tables are added)

Nothing is stored yet. Your data starts flowing in Phase 2.

Continue with /connect-data (end-to-end), or /connect-data connect my services.
```

If bare invocation drove Phase 1, ask: *"Continue to Phase 2 now?"*

---

## Phase 2 — Service Connections

Prerequisite: Phase 1 done.

### 2.1 Parse integrations.md and classify

Read the main integrations table. For each non-placeholder row extract: Service, Category, Purpose, Data Pattern, Connection, Status, Priority, Notes.

For each service determine the method:

- `Data Pattern = Append-only` → **Sync** (short-form or long-form template — see 2.3)
- `Data Pattern = Ever-changing` → **Live**
- `Data Pattern = Both` → **Sync + Live**

If Data Pattern is empty, fall back to `reference/data-classification.md` known-service map. If still unknown, ask the founder in plain-English A/B/C (same prompt `/build-context` uses). Write the answer back to `integrations.md`.

### 2.2 Voyage API key collection (once, up front)

If any service in the approved plan is text-bearing (Sync or Both where the data includes text content), collect the Voyage API key:

1. Ask: *"To embed your text content for semantic search, I need a Voyage API key. It's free to start — sign up at https://www.voyageai.com."*
2. Write to `.env.local` as `VOYAGE_API_KEY`.
3. Store a copy in Supabase Vault for the reranker: `select vault.create_secret('<key>', 'voyage_api_key');`

Skip this step if the approved plan has no text-bearing services.

### 2.3 Present the plan

Show a table:

```
Service          Data Pattern       Method          Notes
──────────────   ──────────────    ──────────────  ──────────────
Otter.ai         Append-only        Sync            Long-form. Pick Summary or Deep mode.
Slack            Both               Sync + Live     Short-form messages + live channel state.
Stripe           Append-only        Sync            Structured numeric.
Xero             Append-only        Sync            Structured numeric.
Notion           Ever-changing      Live            MCP live query.
Google Calendar  Ever-changing      Live            MCP live query.
```

Ask: *"Proceed in priority order? You can say 'skip [service]', 'start with [service]', or 'only connect [list]'."*

### 2.4 Per-service execution

Process in priority order. Skip any service whose Status already shows connected.

For each service, ask: *"Connect [SERVICE] now? (yes / skip / stop)"*

#### Branch A — Sync, short-form text (Slack messages, CRM notes, short emails, Discord, etc.)

Template lookup for common services, else derive via `/create-plan`.

Standard schema shape:

```sql
create table if not exists <service_name> (
  id uuid primary key default gen_random_uuid(),
  source_id text not null unique,
  <service-specific typed columns>,
  text_content text not null,
  metadata jsonb default '{}'::jsonb,
  embedding vector(1024),
  search_tsv tsvector generated always as (to_tsvector('english', coalesce(text_content, ''))) stored,
  embedding_model text default 'voyage-3-large',
  _synced_at timestamptz default now()
);

create index if not exists <service>_embedding_hnsw on <service> using hnsw (embedding vector_cosine_ops);
create index if not exists <service>_tsv_gin on <service> using gin (search_tsv);
create index if not exists <service>_synced_at on <service> (_synced_at desc);
```

Sync script skeleton:

```typescript
// scripts/sync/<service>.ts
// Incremental sync. Uses source_id UNIQUE + UPSERT to stay idempotent.
// Updates _synced_at on every write.

export async function syncService() {
  const lastSync = await getLastSync('<service>');
  const newRecords = await pullFromService({ since: lastSync });

  for (const batch of chunkArray(newRecords, 50)) {
    const embeddings = await embedBatch(batch.map(r => r.text_content));
    for (const [i, record] of batch.entries()) {
      await supabase.from('<service>').upsert({
        source_id: record.id,
        text_content: record.text_content,
        <service-specific fields>,
        metadata: record.metadata,
        embedding: embeddings[i],
        embedding_model: 'voyage-3-large',
        _synced_at: new Date().toISOString(),
      }, { onConflict: 'source_id' });
    }
  }

  await setLastSync('<service>', new Date());
}
```

Then update `search()` function's RRF UNION to include a branch for this table (regenerated automatically by introspecting Supabase schema for tables with an `embedding` column).

Update `integrations.md` Status: `Connected (Sync — scripts/sync/<service>.ts)`.

#### Branch B — Sync, short-form structured (Stripe, Xero, QuickBooks, Meta Ads, YouTube Analytics, etc.)

Same hygiene (`source_id`, `_synced_at`, UPSERT) but NO `embedding` column and NO tsvector. Just typed columns matching the service's data shape.

Stripe example:

```sql
create table if not exists stripe_charges (
  id uuid primary key default gen_random_uuid(),
  source_id text not null unique,
  customer_id text,
  amount_cents bigint,
  currency text,
  status text,
  description text,
  metadata jsonb default '{}'::jsonb,
  charged_at timestamptz,
  _synced_at timestamptz default now()
);

create index if not exists stripe_charges_customer on stripe_charges (customer_id);
create index if not exists stripe_charges_charged_at on stripe_charges (charged_at desc);
```

Sync script pulls incrementally, UPSERTs. No embeddings. Claude queries directly via SQL.

Structured tables don't participate in `search()` — they're not text content.

Update `integrations.md` Status: `Connected (Sync — scripts/sync/<service>.ts)`.

#### Branch C — Sync, long-form text (call transcripts, long emails, long uploads)

Ask the founder the retrieval-depth question:

> *"[SERVICE] holds long-form content. How should we store it?*
>
> *A. Summary-only (default). One row per item with an AI-generated summary + topics + attendees embedded. Cheap. Finds which items touched a topic.*
>
> *B. Full chunking with Contextual Retrieval (~49% better retrieval quality for specific-moment queries). Parent record + chunks table. Each chunk gets an AI context prefix before embedding. Adds about $0.01 per item synced.*
>
> *Most members start with A and upgrade to B if they need moment-level retrieval. Pick A or B."*

Default A.

**Summary mode:**

```sql
create table if not exists <service> (
  id uuid primary key default gen_random_uuid(),
  source_id text not null unique,
  title text,
  occurred_at timestamptz,
  duration_minutes int,
  attendees jsonb default '[]'::jsonb,
  topics jsonb default '[]'::jsonb,
  action_items jsonb default '[]'::jsonb,
  summary text,
  transcript_text text,  -- raw transcript kept for Deep mode upgrade path
  text_content text generated always as (coalesce(summary, '') || E'\n\n' || coalesce(array_to_string(ARRAY(select jsonb_array_elements_text(topics)), ', '), '')) stored,
  metadata jsonb default '{}'::jsonb,
  embedding vector(1024),
  search_tsv tsvector generated always as (to_tsvector('english', coalesce(summary, '') || ' ' || coalesce(transcript_text, ''))) stored,
  embedding_model text default 'voyage-3-large',
  _synced_at timestamptz default now()
);

create index if not exists <service>_embedding_hnsw on <service> using hnsw (embedding vector_cosine_ops);
create index if not exists <service>_tsv_gin on <service> using gin (search_tsv);
create index if not exists <service>_occurred_at on <service> (occurred_at desc);
```

Sync script at ingest:
1. Pull new items since `last_synced_at`
2. For each item: call Sonnet to generate `summary` + `topics` + `action_items` (eager summary-at-sync — the summary IS the retrieval unit)
3. Embed the combined `summary + topics + attendees` via Voyage
4. UPSERT into the table. `transcript_text` stored raw (enables later Deep mode upgrade without re-pulling from source).

**Deep mode — chunked with Contextual Retrieval:**

Parent + chunks split:

```sql
-- Parent table (same as Summary mode schema, minus embedding/search_tsv — those move to chunks)
create table if not exists <service> (
  id uuid primary key default gen_random_uuid(),
  source_id text not null unique,
  title text,
  occurred_at timestamptz,
  duration_minutes int,
  attendees jsonb default '[]'::jsonb,
  topics jsonb default '[]'::jsonb,
  action_items jsonb default '[]'::jsonb,
  summary text,
  transcript_text text,
  metadata jsonb default '{}'::jsonb,
  _synced_at timestamptz default now()
);

-- Chunks table
create table if not exists <service>_chunks (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references <service>(id) on delete cascade,
  source_id text not null,
  chunk_index int not null,
  chunk_text text not null,
  chunk_context text,
  chunk_embedding vector(1024),
  chunk_keywords tsvector generated always as (to_tsvector('english', coalesce(chunk_context, '') || ' ' || chunk_text)) stored,
  embedding_model text default 'voyage-3-large',
  _synced_at timestamptz default now(),
  unique (source_id, chunk_index)
);

create index if not exists <service>_chunks_embedding_hnsw on <service>_chunks using hnsw (chunk_embedding vector_cosine_ops);
create index if not exists <service>_chunks_keywords_gin on <service>_chunks using gin (chunk_keywords);
create index if not exists <service>_chunks_parent on <service>_chunks (parent_id);
```

Sync script at ingest:
1. Pull new items
2. For each item: split `transcript_text` into ~500-word chunks
3. For each chunk, call `chunk_with_context` helper → returns `{chunk_context, chunk_embedding}`
4. UPSERT parent, UPSERT chunks (both on their respective `source_id` unique constraints)

The `chunk_with_context` helper (see `scripts/utils/chunk-with-context.ts` — created on demand the first time any service is Deep mode):

```typescript
// Per Anthropic Sep 2024 Contextual Retrieval.
// One Haiku call per chunk given the full parent document for context, one Voyage call to embed.
export async function chunkWithContext(args: {
  documentTitle: string;
  documentDate: string;
  documentText: string;
  chunkText: string;
}): Promise<{ context: string; embedding: number[] }> {
  // 1. Haiku: "Given this document, generate ~50 tokens of context for this chunk"
  // 2. Voyage: embed `${context}. ${chunkText}`
  // 3. Return both
}
```

**`search()` UNION updates** differ for Summary mode vs Deep mode:
- Summary mode: direct UNION on the service table (same as short-form text)
- Deep mode: UNION on `<service>_chunks` joined back to `<service>` for metadata

Update `integrations.md` Status: `Connected (Sync, Summary mode — scripts/sync/<service>.ts)` or `Connected (Sync, Deep mode — scripts/sync/<service>.ts + chunks)`.

**Upgrade path A → B:**

If the founder later says `/connect-data connect [SERVICE] --deep` or *"re-do Otter with chunking"*:
1. Surface the extra backfill cost (estimated from current row count × 20 chunks × $0.001)
2. Create the chunks table
3. Re-process every row in the parent table through `chunk_with_context`
4. Populate chunks table
5. Update `search()` UNION from Summary mode shape to Deep mode shape
6. Status updates to `Connected (Sync, Deep mode — upgraded from Summary mode on YYYY-MM-DD)`

#### Branch D — Live (via MCP)

Check MCP Registry (https://code.claude.com/docs/en/mcp or latest) for the service.

If MCP server exists:
1. Pull server details (URL, auth, required scopes)
2. Prompt founder for API token; write to `.env.local` under a descriptive key
3. Add to `.mcp.json`
4. Founder restarts Claude Code
5. Test via `/mcp`
6. Update Status: `Live (MCP)`

If no MCP server:
1. Fall back to API wrapper at `scripts/live/<service>.ts`. Simple TypeScript file exposing functions Claude can call from code (via the Bash tool or similar), e.g. `getCurrentCalendarEvents()`, `getLiveSlackChannel(name)`.
2. Founder provides API token; written to `.env.local`
3. Update Status: `Live (API wrapper — scripts/live/<service>.ts)`

#### Branch E — Both (Sync + Live)

Run Branch A (or B/C as appropriate) first for historical accumulation. Then Branch D for live access. Status: `Connected (Sync + Live)`.

### 2.5 Backfill cost surfacing

Before any historical backfill larger than ~100 records, surface the cost:

> *"This service has approximately 1,847 historical records. Backfill will cost around $X.XX in Voyage embeddings plus ~$Y.YY in Sonnet summary generation (for long-form). Proceed with full backfill, limit to last 90 days, or skip backfill (new items only going forward)?"*

Record founder's choice. Apply.

### 2.6 Phase 2 report

```
Phase 2 progress:
  Connected:  N services
  Skipped:    M services
  Failed:     K services

[Table: Service | Method | Pattern | Status]

Ready for Phase 3. Continue with /connect-data or /connect-data schedule syncs.
```

---

## Phase 3 — Automate Syncs

Prerequisite: at least one sync script in `scripts/sync/`. The repo must be pushed to GitHub (workflows live on the default branch).

### 3.1 Consolidated nightly workflow

By default, generate **one** GitHub Actions workflow that runs all sync scripts in sequence at 02:00 UTC (member can override).

Write `.github/workflows/data-sync.yml`:

```yaml
name: Data Sync
on:
  schedule:
    - cron: '0 2 * * *'   # 02:00 UTC nightly — convert to your timezone
  workflow_dispatch:
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - name: Run all sync scripts
        run: |
          for f in scripts/sync/*.ts; do
            echo "=== Running $f ==="
            npx tsx "$f" || echo "FAILED: $f (continuing)"
          done
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          # Add per-service API keys as needed:
          # AIRTABLE_API_KEY: ${{ secrets.AIRTABLE_API_KEY }}
          # SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
```

Why one workflow not N: simpler ops, one log per night, one failure surface, one cron entry. Founder can split specific scripts into their own workflow files later if they need finer-grained scheduling.

### 3.2 Schedule defaults

Ask founder to confirm: *"Run all syncs nightly at 02:00 UTC? (yes / choose another time / split some scripts into more frequent schedules)"*

Note: GitHub Actions cron is UTC-only. Convert from local time explicitly. DST changes don't auto-adjust.

If they want finer-grained scheduling, offer:
- Default (all together, 02:00 UTC)
- Slack/messages (every 6 hours) + everything else (nightly)
- Custom

### 3.3 Commit, push, and add secrets

1. **Commit and push the workflow file:**
   ```bash
   git add .github/workflows/data-sync.yml
   git commit -m "Add data sync workflow"
   git push
   ```

2. **Add secrets in GitHub** (Settings → Secrets and variables → Actions → New repository secret):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - One secret per per-service API key referenced in `scripts/sync/` (e.g. `AIRTABLE_API_KEY`, `SLACK_BOT_TOKEN`, `GMAIL_REFRESH_TOKEN`)

3. **Trigger a manual run** from the Actions tab → pick the workflow → Run workflow. Watch the logs. If everything succeeds, the cron will fire on schedule from this point on.

Update each affected service's `integrations.md` Status: append ` — workflow scheduled nightly 02:00 UTC` (or custom time).

### 3.4 Phase 3 report

```
✅ Phase 3 complete. Syncs automated via GitHub Actions.

[Table: Service | Schedule | Next Run | Workflow file]

Data layer complete. Your AI OS now has:
  - Supabase foundation with hybrid search + reranking
  - N services connected (methods breakdown)
  - M GitHub Actions workflow(s) scheduled

Next: Module 4 builds your first automated output. A Daily Brief that reads
this data every morning and delivers business intelligence.
```

---

## The 17 shipped service templates

`/connect-data` ships with pre-designed schemas + sync-script skeletons for these services. Unknown services fall back to `/create-plan` design.

| Service | Category | Pattern | Template branch |
|---|---|---|---|
| Google Meet | Call recordings | Sync (long-form) | C (Summary mode default) |
| Zoom | Call recordings | Sync (long-form) | C (Summary mode default) |
| Otter.ai | Call transcripts | Sync (long-form) | C (Summary mode default) |
| Fireflies | Call transcripts | Sync (long-form) | C (Summary mode default) |
| Slack | Team comms | Sync + Live | A + D |
| Gmail | Email | Sync + Live | A (short-form) + D |
| Google Calendar | Calendar | Live (+ optional historical Sync) | D (primary) |
| Google Drive | Documents / SOPs | Live | D |
| Notion | Knowledge base / SOPs | Live | D |
| Airtable | CRM / records | Sync + Live | A + D |
| HubSpot | CRM | Sync + Live | A + D |
| GoHighLevel | CRM | Sync + Live | A + D |
| Stripe | Payments | Sync (structured) | B |
| Xero | Accounting | Sync (structured) | B |
| QuickBooks | Accounting | Sync (structured) | B |
| Meta Ads | Marketing data | Sync (structured) | B |
| YouTube Analytics | Marketing / content data | Sync (structured) | B |

Each template carries the typed-column schema plus the sync-script skeleton wired with `source_id` UNIQUE + UPSERT + `_synced_at` + `embedding_model` (for text tables).

---

## Tone

- Conversational, not clinical.
- Move at pace. Show the plan, get approval, do the work.
- Be explicit about what the command is doing, especially during API sync scripting.
- If the founder seems uncertain (short answers, confusion), slow down and explain in plainer terms.
- Never assume. If a service isn't in known mappings, ask how it's used.

---

## Important Rules

- **Never fabricate MCP server URLs.** Check the Registry. If no server, route to API wrapper.
- **Never write tokens inline anywhere except `.env.local`.** Reference as `${ENV_VAR_NAME}` elsewhere.
- **Never skip Phase 1's schema sanity check.** Silent Supabase misconfiguration breaks every downstream sync.
- **Never run `/implement` on a sync script without founder approving the plan first.**
- **Never proceed to Phase 3 without at least one sync script existing.** Report and exit if so.
- **Every Status update in `integrations.md` is a deliberate write.** Don't batch. State is current for resumability.
- **Every synced table has `source_id UNIQUE NOT NULL`, `_synced_at timestamptz default now()`, and (for text tables) `embedding_model text default 'voyage-3-large'`.** No exceptions.
- **Every sync script uses `INSERT ... ON CONFLICT (source_id) DO UPDATE SET ...`.** Never plain INSERT.
- **Every text-bearing table UNION is added to `search()` on creation.** Regenerate the function by introspecting Supabase schema for tables with `embedding` columns.
- **Refuse to run if Context layer incomplete.** Redirect to `/build-context`.
- **Never proceed silently past an error.** Surface exact errors; work them through.
- **Never ingest context files (personal-info.md, companies.md, etc.) into Supabase.** Context and Data layers are separate.
