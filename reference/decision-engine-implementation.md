# Decision Engine — Implementation Specification

> **This document is the executable spec Claude reads during `/activate-decision-engine` (Module 4 Section 5).** It specifies every file to create, every function signature, every integration point, and every verification gate. Conceptual overview is in [decision-engine.md](decision-engine.md); the Autonomy Ladder context is in [autonomy-ladder.md](autonomy-ladder.md).

**Spec version:** 1.0 (2026-04-19). Source of truth: Jordan Platten's live AI-OS.

---

## Prerequisites

Before building, Claude must confirm these are present. If any are missing, stop and report what the member needs.

| Prerequisite | Check |
|---|---|
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` | Required (Module 3 output) |
| `VOYAGE_API_KEY` in `.env.local` | Required for embeddings. Get free key at [console.voyageai.com](https://console.voyageai.com). Add during activation if missing. |
| Existing `scripts/analysis/generate-brief.ts` | Required (Module 4 Section 2 output). Any structure — Claude will adapt. |
| Existing `scripts/cron/scheduler.ts` (PM2-managed or similar) | Optional. If absent, Claude creates a minimal one. |
| Node 18+ / TypeScript toolchain | Required. Run `node -v` + `npx tsc --version` to confirm. |
| Supabase access for DDL: Personal Access Token OR dashboard SQL editor access | Required. See Migration Application below. |
| Optional: Telegram bot (`TELEGRAM_BOT_TOKEN`) or Slack bot — for chat-bot transport | Optional. Skip the Telegram/Slack handler if absent. |

---

## Schema Migration

### Fresh install path (member has no existing `decisions` / `autonomy_log` / `decision_patterns` tables)

Create migration file `supabase/migrations/XXX_decision_engine.sql` (use the next available migration number):

```sql
-- Decision Engine: fresh install

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  context TEXT,
  options JSONB DEFAULT '[]',
  chosen TEXT,
  rationale TEXT,
  expected_outcome TEXT,
  actual_outcome TEXT,
  outcome_assessed_at TIMESTAMPTZ,
  tags JSONB DEFAULT '[]',
  company TEXT,
  confidence_score NUMERIC,
  pattern_id UUID,
  embedding vector(1024),
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'logged',
  module TEXT,
  reason_category TEXT,
  rejection_note TEXT,
  re_surface_at TIMESTAMPTZ,
  issue_signature TEXT,
  short_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decisions_company ON decisions(company);
CREATE INDEX IF NOT EXISTS idx_decisions_created ON decisions(created_at);
CREATE INDEX IF NOT EXISTS idx_decisions_outcome_due ON decisions(outcome_assessed_at)
  WHERE actual_outcome IS NULL;
CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status)
  WHERE status IN ('pending', 'rejected');
CREATE INDEX IF NOT EXISTS idx_decisions_source ON decisions(source);
CREATE INDEX IF NOT EXISTS idx_decisions_pending ON decisions(created_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_decisions_re_surface ON decisions(re_surface_at)
  WHERE re_surface_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_decisions_issue_signature ON decisions(issue_signature)
  WHERE issue_signature IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_decisions_short_id ON decisions(short_id)
  WHERE short_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_decisions_embedding ON decisions
  USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS decision_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_name TEXT NOT NULL UNIQUE,
  description TEXT,
  similar_decisions JSONB DEFAULT '[]',
  success_rate NUMERIC,
  total_decisions INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Semantic search RPC (unioned across decisions + any future embedded tables)
CREATE OR REPLACE FUNCTION semantic_search(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  source_type text,
  source_id text,
  title text,
  content text,
  company text,
  similarity float,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
    SELECT
      'decision'::text as source_type,
      d.id::text as source_id,
      d.question as title,
      COALESCE(d.chosen, '') || ' — ' || COALESCE(d.rationale, '') as content,
      d.company,
      1 - (d.embedding <=> query_embedding) as similarity,
      d.created_at
    FROM decisions d
    WHERE d.embedding IS NOT NULL
      AND 1 - (d.embedding <=> query_embedding) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

COMMIT;
```

### Upgrade path (member has pre-existing `decisions` + `autonomy_log` tables from an older blueprint)

Use this migration instead — adds the new columns, preserves any `autonomy_log` rows, drops the old table.

The exact file is available at [Jordan's live AI-OS migration 010](https://github.com) — port it verbatim. Claude should detect the upgrade situation by querying whether `autonomy_log` exists (via a test `SELECT ... FROM autonomy_log LIMIT 0`).

### Migration application paths (pick one)

**A. Supabase Management API (if member provides a Personal Access Token, `sbp_...`):**

```typescript
const res = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: migrationSql }),
  }
);
```

Expect HTTP 201 + empty body on success.

**B. Supabase Dashboard SQL Editor (fallback for members without a PAT):**

Have the member open their Supabase project → SQL Editor → New query → paste the migration file content → Run. Wait for confirmation before continuing.

---

## File Structure

Activation creates this directory tree:

```
scripts/
├── utils/
│   ├── providers.ts           # NEW: injection shim for getSupabase, embed, complete
│   └── embeddings.ts          # Existing (Module 3) — verify it exports embed + prepareDecisionText + vectorToSql
├── decisions/                 # NEW directory
│   ├── types.ts               # Shared types
│   ├── short-id.ts            # generateUniqueShortId
│   ├── log-decision.ts        # logDecision
│   ├── find-similar.ts        # findSimilarDecisions
│   ├── record-response.ts     # recordRecommendationResponse
│   ├── check-rec-history.ts   # checkRecHistory (pre-rec suppress/boost lookup)
│   ├── expire-pending.ts      # expirePending
│   ├── brief-integration.ts   # runPreBrief, buildSection7PromptFragment, postProcessBrief, etc.
│   ├── refresh-patterns.ts    # Weekly pattern rollup (Monday cron)
│   ├── index.ts               # Barrel export
│   └── sim/                   # Simulation harness (always ship — it IS the acceptance gate)
│       ├── mock-supabase.ts
│       ├── mock-embeddings.ts
│       ├── mock-anthropic.ts
│       ├── assertions.ts
│       ├── fixtures.ts
│       ├── run-simulation.ts
│       └── scenarios/         # 14 scenario files
│           ├── migration.ts
│           ├── helpers-short-id.ts
│           ├── helpers-log-decision.ts
│           ├── helpers-find-similar.ts
│           ├── helpers-record-response.ts
│           ├── helpers-check-rec-history.ts
│           ├── helpers-expire-pending.ts
│           ├── brief-pre-brief.ts
│           ├── brief-post-process.ts
│           ├── brief-section-renderers.ts
│           ├── brief-evening-recap.ts
│           ├── brief-full-morning.ts
│           ├── pattern-refresh.ts
│           └── telegram-handler.ts
└── telegram/                   # CONDITIONAL — only if member has Telegram bot
    └── decision-handler.ts     # Pre-classification routing for accept/reject + free-text detection
```

**Existing files edited (additively):**

- `scripts/analysis/generate-brief.ts` — `--mode={morning|evening}` arg, runMorning/runEvening branches, Section 7 + Section 8 appended, pre-brief + post-process wired
- `scripts/cron/scheduler.ts` — 18:00 evening brief cron + Monday 06:30 pattern rollup cron added
- `scripts/telegram/bot.ts` (if Telegram exists) — one-line call to `tryHandleDecisionIntent` before Haiku classifier
- `.claude/commands/decide.md` — sub-arg routing version (replaces file-based fallback version)

---

## Helper Specifications

### `scripts/utils/providers.ts`

Tiny shim that re-exports `getSupabase`, `embed`, `embedBatch`, `complete` with `installMocks()` / `resetProviders()` for test-time override. Production delegates to real implementations.

```typescript
import { getSupabase as realGetSupabase } from "./supabase.js";
import { embed as realEmbed, embedBatch as realEmbedBatch } from "./embeddings.js";
import { complete as realComplete } from "./anthropic.js";

let _getSupabase = realGetSupabase;
let _embed = realEmbed;
let _embedBatch = realEmbedBatch;
let _complete = realComplete;

export function getSupabase() { return _getSupabase(); }
export function embed(text: string, type?: "document" | "query") { return _embed(text, type); }
export function embedBatch(texts: string[], type?: "document" | "query") { return _embedBatch(texts, type); }
export function complete(model: any, prompt: any, opts?: any) { return _complete(model, prompt, opts); }

export interface ProviderMocks {
  getSupabase?: typeof realGetSupabase;
  embed?: typeof realEmbed;
  embedBatch?: typeof realEmbedBatch;
  complete?: typeof realComplete;
}
export function installMocks(mocks: ProviderMocks): void { /* override */ }
export function resetProviders(): void { /* reset to real */ }
```

**All helpers in `scripts/decisions/` import from `../utils/providers.js`**, not directly from supabase.ts / embeddings.ts / anthropic.ts. This is what makes the simulation possible without editing helper source each time.

### `scripts/decisions/types.ts`

```typescript
export type DecisionSource = "manual" | "ai-recommendation" | "telegram-capture";
export type DecisionStatus = "logged" | "pending" | "accepted" | "rejected" | "expired";
export type RejectionCategory =
  | "disagree" | "no-time" | "redundant" | "wrong-context" | "later";

export interface DecisionRow { /* all columns */ }
export interface SimilarDecision {
  id: string;
  short_id: string | null;
  question: string;
  chosen: string | null;
  rationale: string | null;
  status: DecisionStatus;
  source: DecisionSource;
  reason_category: RejectionCategory | null;
  actual_outcome: string | null;
  company: string | null;
  similarity: number;
  created_at: string;
}
```

### `scripts/decisions/short-id.ts`

`generateUniqueShortId(): Promise<string>` — returns `rec_` + 6 base62 chars. Collision retry against `decisions.short_id` unique index. Throws after 8 attempts.

### `scripts/decisions/log-decision.ts`

```typescript
export interface LogDecisionInput {
  question: string;
  context?: string;
  options?: string[];
  chosen?: string;
  rationale?: string;
  expected_outcome?: string;
  confidence_score?: number;
  tags?: string[];
  company?: string;
  source?: DecisionSource;       // default: 'manual'
  status?: DecisionStatus;        // default: 'logged' for manual, 'pending' for ai-rec
  module?: string;                // only for source='ai-recommendation'
  issue_signature?: string;       // only for source='ai-recommendation'
}

export interface LogDecisionResult {
  id: string;
  short_id: string | null;
  matches: SimilarDecision[];
}

export async function logDecision(input: LogDecisionInput): Promise<LogDecisionResult>;
```

Behaviour:
1. Find similar decisions via `findSimilarDecisions` (best-effort, empty on failure, returned for caller to display)
2. Generate `short_id` for AI recs only
3. Insert row with appropriate defaults. For manual/telegram-capture: set `outcome_assessed_at = now + 30d`. For pending AI rec: leave `outcome_assessed_at` null (set later on accept).
4. Async: embed text via Voyage (`prepareDecisionText` → `embed`), update row's `embedding` column. Failure logged but non-fatal.
5. Return `{ id, short_id, matches }`

### `scripts/decisions/find-similar.ts`

```typescript
export interface FindSimilarOptions {
  threshold?: number;       // default: 0.5
  limit?: number;           // default: 10
  company?: string;
  sources?: DecisionSource[]; // default: all
  statuses?: DecisionStatus[]; // default: ['logged', 'accepted']
}

export async function findSimilarDecisions(
  queryText: string,
  opts?: FindSimilarOptions
): Promise<SimilarDecision[]>;
```

Behaviour: embed the query text as `query` type, call `semantic_search` RPC with wider candidate pool (`limit * 4`), hydrate rows, apply source/status/company filters, return top `limit` by similarity descending.

### `scripts/decisions/record-response.ts`

```typescript
export interface RecordResponseInput {
  rec_ids: string[];
  action: "accept" | "reject";
  category?: RejectionCategory;      // required when action='reject'
  note?: string;
  surface_in_days?: number;           // used when category='later', default 7
}

export interface RecordResponseResult {
  updated: number;
  not_found: string[];
  details: Array<{ short_id: string; id: string; status: string; reason_category: string | null }>;
}

export async function recordRecommendationResponse(input: RecordResponseInput): Promise<RecordResponseResult>;
```

Behaviour:
- **Accept:** set `status='accepted'`, `outcome_assessed_at = now + 30d` (enters review loop).
- **Reject disagree / no-time / redundant / wrong-context:** set `status='rejected'`, `reason_category`, `rejection_note`.
- **Reject later N:** set `status='rejected'`, `reason_category='later'`, `re_surface_at = now + N days` (default N=7).
- Only updates rows where `source='ai-recommendation' AND status='pending'`. Terminal rows are no-ops.
- Returns batch result with `updated` count, `not_found` short_ids, per-row details.
- Throws if `action='reject'` and no `category` provided.

### `scripts/decisions/check-rec-history.ts`

The feedback-loop helper. Runs before every candidate rec emission.

```typescript
export type RecHistoryAction = "suppress" | "boost" | "emit_normal";

export interface RecHistoryResult {
  action: RecHistoryAction;
  reason?: string;
  historicalAcceptRate?: number;
  similarCount: number;
  acceptCount: number;
  disagreeCount: number;
  similarPast: Array<{ short_id: string | null; question: string; status: string; reason_category: string | null; similarity: number }>;
}

export async function checkRecHistory(recText: string, company?: string): Promise<RecHistoryResult>;
```

Constants (tune via env later):
- `SIMILARITY_THRESHOLD = 0.65`
- `MIN_SIMILAR_RECS = 3`
- `SUPPRESS_DISAGREE_RATE = 0.6`
- `BOOST_ACCEPT_RATE = 0.8`

Logic:
1. Find similar past AI recs with terminal status (`sources=['ai-recommendation']`, `statuses=['accepted', 'rejected']`).
2. If `< MIN_SIMILAR_RECS` similar → `emit_normal`.
3. Count `accepts` and `disagree`-only rejections. Compute graded = accepts + disagrees.
4. If `graded < 3` → `emit_normal`.
5. If `disagrees/graded > 0.6` → `suppress` with reason.
6. If `accepts/graded > 0.8` → `boost` with historicalAcceptRate.
7. Else → `emit_normal`.

**Only `disagree` rejections count.** `no-time`, `redundant`, `wrong-context`, `later` don't reflect on rec quality.

### `scripts/decisions/expire-pending.ts`

```typescript
export interface ExpireResult { expired: number }
export async function expirePending(): Promise<ExpireResult>;
```

Behaviour: `UPDATE decisions SET status='expired' WHERE source='ai-recommendation' AND status='pending' AND created_at < (now - REC_EXPIRE_HOURS hours)`. Default 72h, overridable via env var. Called at the start of every brief run.

### `scripts/decisions/brief-integration.ts`

The module the Daily Brief generator wires into. Exports 9 functions:

```typescript
export async function runPreBrief(): Promise<PreBriefState>;
export function buildSection7PromptFragment(state: PreBriefState): string;
export async function postProcessBrief(brief: string, module?: string): Promise<PostProcessResult>;
export function renderSection7Gated(state: PreBriefState): string;
export function renderReviewsDueBlock(state: PreBriefState): string;
export function renderRevisitBlock(state: PreBriefState): string;
export async function markRevisitsSurfaced(state: PreBriefState): Promise<void>;
export async function renderSection8(briefDate: Date): Promise<string>;
export async function buildEveningRecap(): Promise<string>;
```

**PreBriefState shape:**

```typescript
export interface PreBriefState {
  expired_now: number;
  pending_count: number;
  gate_active: boolean;           // true when pending_count >= 3
  pending_recs: PendingRec[];
  reviews_due: ReviewRow[];
  revisits_due: RevisitRow[];
}
```

**runPreBrief** sequences:
1. `expirePending()` to flip old pending rows.
2. Query remaining pending (ordered by created_at asc) → `pending_recs`.
3. Query `reviews_due`: `decisions WHERE outcome_assessed_at <= now AND actual_outcome IS NULL AND status IN ('logged', 'accepted')` limit 5.
4. Query `revisits_due`: `decisions WHERE source='ai-recommendation' AND status='rejected' AND reason_category='later' AND re_surface_at <= now` limit 5.
5. Compute `gate_active = pending_count >= 3`.

**buildSection7PromptFragment**:
- If `gate_active`, returns empty string (caller will render gated Section 7 manually).
- Otherwise returns a prompt fragment appended to the Opus user prompt instructing it to emit 0-3 recs in the form `[REC] **<rec>** <rationale>`. Strict format rules: prefix literal `[REC]`, bold rec text, plain rationale, max 3 recs, emit `[REC] (none)` if none warranted.

**postProcessBrief**:
- Parse every line starting with `[REC]`.
- For `[REC] (none)` lines: strip.
- For real recs: parse `**text**` + trailing rationale, call `checkRecHistory(recText)`.
  - On `suppress`: strip the line, append entry to `outputs/briefs/debug-log.jsonl`.
  - On `boost`: generate `short_id`, log via `logDecision({ source: 'ai-recommendation', status: 'pending', ... })`, replace line with `[rec_xxxxxx, boosted: NN% on K similar past] **text** rationale`.
  - On `emit_normal`: log via `logDecision`, replace line with `[rec_xxxxxx] **text** rationale`.
- `issue_signature` = lowercase-normalised first 80 chars of rec text.
- Return `{ brief: processedMarkdown, emitted: [...], suppressed: [...] }`.

**renderSection7Gated**: when 3+ pending, renders `## 7. Today's Recommendations` with a "clear pending first" message listing existing pending rec short_ids and ages.

**renderReviewsDueBlock / renderRevisitBlock**: render empty string when input is empty; otherwise a `### Decisions due for review` or `### Revisit (deferred)` subsection with formatted rows.

**markRevisitsSurfaced**: clears `re_surface_at` on surfaced rows so they don't re-appear on subsequent days.

**renderSection8**: returns empty string on non-Mondays. On Mondays, renders the full Weekly Decision Summary with 7 sub-blocks (Activity last 7 days, True acceptance rate, Where the AI is missing context, Deferred queue, Autonomy Ladder status per module, 30-day reviews due). All computed from SQL queries against `decisions`.

**buildEveningRecap**: returns "No open recs from this morning. Clean slate." if no pending from today. Otherwise lists today's pending recs with accept/reject reply instructions.

### `scripts/decisions/refresh-patterns.ts`

Standalone script (has its own `main()` + `process.exit`), runnable via cron. Logic:
1. Query all decisions with `status IN ('logged', 'accepted')`.
2. Exclude rows tagged `demo`.
3. Skip untagged rows.
4. Group by `company` + first tag.
5. For each group with ≥3 decisions: compute `success_rate` from rated outcomes using coarse keyword match (`success`, `right call`, `worked`, `positive`, `yes`).
6. Upsert into `decision_patterns` with `onConflict: 'pattern_name'`.

Supports `--dry-run` flag.

### `scripts/decisions/index.ts` — barrel export

Re-exports all helpers + types for single-import convenience.

---

## Brief Generator Integration

The member's `scripts/analysis/generate-brief.ts` needs these edits. **Preserve every existing behaviour** — sections 1-6 of their brief must remain byte-for-byte unchanged when `--mode` is absent or equals `morning` and Section 7 post-processing is turned off.

### Add imports (top of file)

```typescript
import {
  runPreBrief,
  buildSection7PromptFragment,
  postProcessBrief,
  renderSection7Gated,
  renderReviewsDueBlock,
  renderRevisitBlock,
  markRevisitsSurfaced,
  renderSection8,
  buildEveningRecap,
  type PreBriefState,
} from "../decisions/brief-integration.js";
```

### Add mode arg parsing

```typescript
const modeArg = process.argv.find(a => a.startsWith("--mode="))?.split("=")[1];
type BriefMode = "morning" | "evening";
const mode: BriefMode = modeArg === "evening" ? "evening" : "morning";
```

### Split main() into branches

```typescript
async function main() {
  if (mode === "evening") { await runEvening(); closeAll(); return; }
  await runMorning();
  closeAll();
}
```

### runMorning flow

Existing data collection unchanged. Between the existing `buildUserPrompt(data)` and the Opus `complete()` call, inject:

```typescript
let preBrief: PreBriefState | null = null;
try { preBrief = await runPreBrief(); } catch (err) { console.error("pre-brief failed (non-fatal):", err); }
const section7Fragment = preBrief ? buildSection7PromptFragment(preBrief) : "";
const userPrompt = existingUserPrompt + section7Fragment;
```

After the Opus call returns `brief`:

```typescript
if (preBrief && !preBrief.gate_active) {
  try { const { brief: processed } = await postProcessBrief(brief); brief = processed; }
  catch (err) { console.error("post-process failed:", err); }
} else if (preBrief?.gate_active) {
  brief = brief + "\n" + renderSection7Gated(preBrief);
}

if (preBrief) {
  const reviews = renderReviewsDueBlock(preBrief);
  const revisits = renderRevisitBlock(preBrief);
  if (reviews) brief += "\n" + reviews;
  if (revisits) brief += "\n" + revisits;
  if (preBrief.revisits_due.length > 0) await markRevisitsSurfaced(preBrief);
}

const section8 = await renderSection8(new Date(briefDate + "T00:00:00"));
if (section8) brief += "\n" + section8;
```

Keep existing freshness header, file save, Supabase save, Telegram delivery unchanged.

### runEvening flow

```typescript
async function runEvening(): Promise<void> {
  const recap = await buildEveningRecap();
  if (dryRun) { console.log(recap); return; }
  fs.mkdirSync(BRIEFS_DIR, { recursive: true });
  fs.writeFileSync(path.join(BRIEFS_DIR, `${briefDate}-evening.md`), recap);
  if (!noSend) {
    const { sendBrief } = await import("../telegram/bot.js");
    await sendBrief(recap);
  }
  console.log(recap);
}
```

If the member doesn't have a Telegram bot, the `await import("../telegram/bot.js")` fails — wrap in try/catch and degrade to file-only delivery.

### Opus prompt addition

The system prompt tells Opus to output 6 sections. Leave that untouched. Append Section 7 instructions only via `buildSection7PromptFragment` (which returns the instructions). On Mondays you don't need a prompt update for Section 8 — that's rendered deterministically from DB data post-Opus.

---

## Scheduler Integration

The member's `scripts/cron/scheduler.ts` needs these **additional** cron registrations (preserve all existing ones):

```typescript
// Evening Brief at 18:00 UK — recap pending recs from the morning
cron.schedule("0 18 * * *", () => {
  log("=== Evening Brief (Decision Engine recap) ===");
  runScript("Evening Brief", "scripts/analysis/generate-brief.ts", ["--mode=evening"], 300_000);
}, { timezone: TIMEZONE });
log("Scheduled: Evening Brief (18:00 UK)");

// Decision Pattern Rollup at Monday 06:30 UK — before the morning brief
cron.schedule("30 6 * * 1", () => {
  log("=== Decision Pattern Rollup ===");
  runScript("Decision Patterns", "scripts/decisions/refresh-patterns.ts", [], 300_000);
}, { timezone: TIMEZONE });
log("Scheduled: Decision Pattern Rollup (Monday 06:30 UK)");
```

If the member has no `scheduler.ts`, Claude should not create one automatically — prompt the member: *"You don't have a PM2-managed scheduler. Without one, the evening brief + Monday pattern rollup won't run automatically. Do you want me to create a minimal scheduler.ts you can launch with PM2?"*

---

## Telegram Handler (optional)

If the member has a Telegram bot configured (`TELEGRAM_BOT_TOKEN` in `.env.local` + an existing `scripts/telegram/bot.ts`), add:

### `scripts/telegram/decision-handler.ts`

Pre-classification regex routing:
- `ACCEPT_RE = /^accept\s+(rec_[a-zA-Z0-9]+(?:\s+rec_[a-zA-Z0-9]+)*)\s*$/i`
- `REJECT_RE = /^reject\s+(rec_[a-zA-Z0-9]+)\s+(disagree|no-time|redundant|wrong-context|later)(?:\s+(\d+))?(?:\s+(.+))?$/i`
- `DECISION_TRIGGER_RE = /^\s*(decided to|chose to|i'?ll go with|going with|i'?m going to|i decided)\b/i`
- `CONFIRM_RE = /^(yes|y|yep|confirm|log it|do it)\s*$/i`

Export `tryHandleDecisionIntent(chatId: number, text: string): Promise<{ handled: boolean; response?: string }>`:
1. Check pending confirmations (in-memory `Map<chatId, { text, expires_at }>`, 5-min TTL). If confirmed → log via `logDecision({ source: 'telegram-capture', status: 'logged', tags: ['telegram-auto-detect'] })`.
2. ACCEPT_RE match → `recordRecommendationResponse({ rec_ids, action: 'accept' })`.
3. REJECT_RE match → `recordRecommendationResponse({ rec_ids: [recId], action: 'reject', category, note, surface_in_days: days })`. For `later` without N, default N=7.
4. DECISION_TRIGGER_RE match → store pending confirmation, reply *"Detected decision language: '<preview>'. Log it? Reply YES within 5 minutes (anything else cancels)."*
5. Otherwise → `{ handled: false }` (caller proceeds with Haiku classifier).

### `scripts/telegram/bot.ts` — one-line edit

Before the `classifyIntent` call in the `message:text` handler:

```typescript
import { tryHandleDecisionIntent } from "./decision-handler.js";

// ...inside the handler:
try {
  const decisionResult = await tryHandleDecisionIntent(ctx.chat.id, text);
  if (decisionResult.handled) {
    const reply = decisionResult.response ?? "Done.";
    for (const msg of splitResponse(reply)) await ctx.reply(msg);
    return;
  }
} catch (err) { console.error("[Decision handler error]", err); }
```

### Slack variant

If the member has Slack instead of Telegram, the same pattern works against their Slack event handler: pre-classification check → call the same helpers. Port the regex + helper calls, adapt `ctx.reply` to Slack's `web.chat.postMessage`.

---

## `/decide` Command (Updated)

Rewrite `.claude/commands/decide.md` with sub-arg routing. The full pre-activation fallback is documented in the base blueprint's version of this command — preserve that fallback so members who log decisions before activation keep working.

Post-activation, the command dispatches on the first whitespace-separated token of `$ARGUMENTS`:

| Input | Behaviour |
|---|---|
| `(empty)` or free-text question | Log a manual decision via `logDecision({ source: 'manual', status: 'logged', ... })` — ask for context/options/chosen/rationale/expected/confidence/tags/company, show matches from `findSimilarDecisions` |
| `accept <rec_id> [<rec_id>...]` | `recordRecommendationResponse({ rec_ids, action: 'accept' })` |
| `reject <rec_id> <category> [note]` | `recordRecommendationResponse({ rec_ids: [recId], action: 'reject', category, note })` |
| `reject <rec_id> later [<N>]` | As above with `category: 'later'`, `surface_in_days: N ?? 7` |
| `pending` | Query and list `source='ai-recommendation' AND status='pending'` |
| `review` | Walk overdue rows in `status IN ('logged', 'accepted')` with `outcome_assessed_at <= now AND actual_outcome IS NULL`, collect `actual_outcome` per row |
| `patterns` | List `decision_patterns` ordered by `total_decisions DESC LIMIT 10` |
| `from <path>` | Read the file, extract a decision, log via `logDecision({ source: 'manual', status: 'logged', ... })` |

---

## Simulation Harness

**Required. Do not mark activation complete until `npx tsx scripts/decisions/sim/run-simulation.ts` passes 243/243.**

Full spec: port the harness from [Jordan's live AI-OS `scripts/decisions/sim/`](file:///Users/kinsley/Desktop/ClaudeCode/AI-OS/scripts/decisions/sim/). Every file listed in the File Structure above must be created.

14 scenario files, 243 target assertions:

| Scenario | Assertions |
|---|---|
| migration | 25 |
| helpers-short-id | 4 |
| helpers-log-decision | 20 |
| helpers-find-similar | 8 |
| helpers-record-response | 34 |
| helpers-check-rec-history | 9 |
| helpers-expire-pending | 8 |
| brief-pre-brief | 15 |
| brief-post-process | 15 |
| brief-section-renderers | 18 |
| brief-evening-recap | 7 |
| brief-full-morning | 16 |
| pattern-refresh | 14 |
| telegram-handler | 50 |

**Fresh-install note:** the `migration` scenario in Jordan's AI-OS tests his upgrade-path migration (ALTER + DROP autonomy_log). For members doing a fresh install, either:

1. **Point the scenario at the fresh-install migration file** (update the file path in `scenarios/migration.ts` to match whatever number the member's migration uses).
2. **Extend the scenario** to detect fresh-install vs upgrade and assert a different set of statements for each. Fresh install asserts `CREATE TABLE decisions` (with all columns), `CREATE TABLE decision_patterns` with `UNIQUE(pattern_name)`, `CREATE OR REPLACE FUNCTION semantic_search`, all indexes, `BEGIN/COMMIT`.

Default: option 2 (scenario covers both paths, so the same simulation runs against any member's setup).

### Running the simulation

```bash
npx tsx scripts/decisions/sim/run-simulation.ts
```

Expected output ends with:

```
  Total: 243/243 passed, 0 failed, <1s
```

Report written to `outputs/simulation/run-<timestamp>.md`. If any assertion fails, STOP the activation and fix before continuing.

---

## Prior MD-file Decision Import (optional)

If the member has `data/decisions/*.md` files from pre-activation use, offer to import them. Parse each:

```
# Decision: <heading>
**Date:** YYYY-MM-DD
**Category:** <tag>
**Companies affected:** <company>
**Confidence:** <High|Medium|Low>
## Context ...
## Options Considered ...
## Decision ...
## Expected Outcome ...
## Review (30 days) ... (actual_outcome if filled)
```

Insert each as a row via `logDecision({ source: 'manual', status: 'logged', question, context, chosen, rationale, expected_outcome, confidence_score: mapConfidence(text), tags: [category], company, ... })`. Map confidence High/Medium/Low → 0.9/0.6/0.3.

Preserve `created_at` from the file's Date field. Preserve `actual_outcome` if the review section was filled.

Keep the source MD files in place — don't delete them.

---

## Activation Acceptance Gates

All seven must pass before reporting activation complete:

- [ ] Migration applied. Verification query: `SELECT column_name FROM information_schema.columns WHERE table_name='decisions'` shows all new columns.
- [ ] `npx tsc --noEmit` clean.
- [ ] Simulation: **243/243 passed**.
- [ ] Post-migration smoke queries all return without error (pending recs, reviews due, revisits, trailing-50 acceptance, decision_patterns).
- [ ] `npx tsx scripts/analysis/generate-brief.ts --mode=evening --no-send` produces "Clean slate" (if no pending) or a recap (if pending) without error.
- [ ] `pm2 restart <scheduler-name>` succeeds. PM2 logs show new crons registered: `Scheduled: Evening Brief (18:00 UK)` and `Scheduled: Decision Pattern Rollup (Monday 06:30 UK)`.
- [ ] Member's existing 6-section morning brief output is byte-for-byte unchanged (diff against a pre-activation saved brief).

---

## Rollback Path

If activation fails partway, roll back cleanly:

1. **Remove new files:** `rm -rf scripts/decisions/ scripts/utils/providers.ts scripts/telegram/decision-handler.ts`
2. **Revert brief generator patches:** `git checkout scripts/analysis/generate-brief.ts scripts/cron/scheduler.ts scripts/telegram/bot.ts .claude/commands/decide.md`
3. **Restore file-based `/decide`:** the pre-activation version is in git; checkout restores it.
4. **Schema rollback (if needed):** the new columns on `decisions` are additive, no data is destroyed by leaving them. But if the member wants a clean schema:
   ```sql
   BEGIN;
   ALTER TABLE decisions DROP COLUMN IF EXISTS source;
   ALTER TABLE decisions DROP COLUMN IF EXISTS status;
   -- ...drop each added column
   ALTER TABLE decision_patterns DROP CONSTRAINT IF EXISTS decision_patterns_pattern_name_key;
   COMMIT;
   ```
5. **PM2 restart:** `pm2 restart <scheduler-name>` to unload new cron registrations.

Report the rollback state to the member and document what failed, so a second activation attempt can target the cause directly.

---

_This spec is the contract between the blueprint and every member's activated Decision Engine. Update in lockstep with any change to Jordan's live AI-OS._
