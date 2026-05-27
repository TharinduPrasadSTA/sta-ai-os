# Activate Decision Engine

> Upgrade your AI OS with the full Decision Engine: Decide → Log → Match → Learn → Earn loop, structured recommendations in your morning brief, evening recap, and weekly Autonomy Ladder summary. Run this in Module 4 Section 5 after your Daily Brief is live.

---

## Prerequisites (check before activating)

- **Module 3 (Data) complete** — Supabase connected, `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`
- **Module 4 Section 2 complete** — you have a working `scripts/analysis/generate-brief.ts` producing a daily brief
- **Voyage API key** — add `VOYAGE_API_KEY=...` to `.env.local` if missing ([console.voyageai.com](https://console.voyageai.com))
- **Supabase DDL access** — either:
  - A Supabase Personal Access Token (`sbp_...`) from [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens), stored as `SUPABASE_ACCESS_TOKEN`, OR
  - Willingness to paste SQL into the Supabase Dashboard SQL Editor manually
- **Node 18+ and a working TypeScript toolchain**

If any prerequisite is missing, stop and tell the user what's needed.

---

## Instructions for Claude

1. **Read the spec end-to-end:** [reference/decision-engine-implementation.md](../../reference/decision-engine-implementation.md). This is the exhaustive contract — every file to create, every function signature, every integration point. Do not skip sections.

2. **Read the concepts:** [reference/decision-engine.md](../../reference/decision-engine.md) and [reference/autonomy-ladder.md](../../reference/autonomy-ladder.md) for the mental model.

3. **Read the user's existing files:**
   - `scripts/analysis/generate-brief.ts` (their Module 4 Section 2 work)
   - `scripts/cron/scheduler.ts` (if present)
   - `scripts/telegram/bot.ts` and `.env.local` Telegram token (if present)
   - `scripts/utils/supabase.ts`, `scripts/utils/embeddings.ts`, `scripts/utils/anthropic.ts` (from Module 3) — verify they export the expected functions.

4. **Check prerequisites.** If any are missing, stop and report.

5. **Detect fresh-install vs upgrade:**
   - Fresh install: `decisions` table doesn't exist, or exists without the new columns (no `source`, no `status`).
   - Upgrade: `autonomy_log` table exists (legacy blueprint). Use the upgrade-path migration.

6. **Check for existing `scripts/decisions/` directory.**
   - If present: offer to re-run the simulation first to confirm the current state before making changes.
   - If absent: proceed to build.

7. **Use `/create-plan`** to design the activation tailored to this specific setup. The plan must cover: migration approach, every new file, every integration point (brief generator edits, scheduler additions, Telegram handler if applicable), the simulation harness, the optional MD-decision import, and the verification gates.

8. **Present the plan to the user. Wait for explicit approval** (via `/implement` or equivalent).

9. **On approval, execute in order:**
   1. **Apply the schema migration.**
      - If `SUPABASE_ACCESS_TOKEN` is present: POST the migration SQL to `https://api.supabase.com/v1/projects/{ref}/database/query` (extract ref from `SUPABASE_URL`).
      - Otherwise: generate the migration file at `supabase/migrations/XXX_decision_engine.sql`, then pause and instruct the user to run it in their Supabase Dashboard SQL Editor. Wait for them to confirm before proceeding.
      - Verify post-apply: query `information_schema.columns` to confirm all new columns exist.
   2. **Create all files under `scripts/decisions/`** per the spec, including the full `sim/` subdirectory (all 14 scenario files + harness).
   3. **Create `scripts/utils/providers.ts`** (the injection shim).
   4. **Patch `scripts/analysis/generate-brief.ts`** additively per the spec. Preserve the existing 6-section output byte-for-byte when `--mode` defaults to `morning`.
   5. **Patch `scripts/cron/scheduler.ts`** to add the two new crons. If no scheduler exists, ask the user whether to create a minimal one.
   6. **Patch `scripts/telegram/bot.ts` + create `decision-handler.ts`** — only if a Telegram bot is configured.
   7. **Rewrite `.claude/commands/decide.md`** to the sub-arg version (drops the file-based fallback since the full engine is now active).
   8. **Optionally import pre-existing `data/decisions/*.md`** files into the unified table. Ask the user before importing; keep the MD files in place as archive.

10. **Run the simulation:** `npx tsx scripts/decisions/sim/run-simulation.ts`. **Target: 243/243 assertions pass.** If any fail, STOP. Fix the underlying code (not the test) and re-run.

11. **Type-check:** `npx tsc --noEmit` must be clean.

12. **Run post-migration smoke queries** (5 read-only queries per the spec) — verify pending recs, reviews due, revisits, trailing-50 acceptance, and decision_patterns are all queryable without error.

13. **Dry-run the evening brief:** `npx tsx scripts/analysis/generate-brief.ts --mode=evening --no-send`. Should produce either a "Clean slate" message (if no pending) or a recap.

14. **Restart the scheduler:** `pm2 restart <name>` (or equivalent). Confirm PM2 logs show the two new cron registrations: `Scheduled: Evening Brief (18:00 UK)` and `Scheduled: Decision Pattern Rollup (Monday 06:30 UK)`.

15. **Verify base brief is unchanged:** diff the first few sections of a generated morning brief against a pre-activation saved brief. Sections 1-6 must be byte-for-byte identical.

---

## Acceptance Gates — Activation is NOT COMPLETE until all pass

- [ ] Migration applied, all new columns present on `decisions`
- [ ] `decision_patterns.pattern_name` has UNIQUE constraint (test: second insert of same pattern_name returns error)
- [ ] `npx tsc --noEmit` clean
- [ ] Simulation: **243/243 passed, 0 failed**
- [ ] 5 post-migration smoke queries return without error
- [ ] `--mode=evening --no-send` dry-run succeeds
- [ ] Scheduler restarted, new crons logged on startup
- [ ] Existing Section 1-6 morning brief output unchanged from baseline

---

## If something fails

Stop. Do not leave the user's system in a half-activated state.

1. **Small, obviously-correct fix** (e.g., a typo, missing import): fix and re-verify.
2. **Simulation assertion fails**: read the failure, diagnose against the spec, fix the helper code (not the test), re-run. The test is the contract.
3. **Infrastructure failure** (migration rejected, PM2 won't restart, Voyage key invalid): report the specific error to the user, roll back any partial changes, ask them to resolve before re-running activation.

**Rollback** (if needed):
1. `rm -rf scripts/decisions/ scripts/utils/providers.ts scripts/telegram/decision-handler.ts`
2. `git checkout scripts/analysis/generate-brief.ts scripts/cron/scheduler.ts scripts/telegram/bot.ts .claude/commands/decide.md`
3. Optionally drop the new columns via the rollback SQL in the spec.
4. `pm2 restart <name>` to unload the new cron registrations.
5. Report what failed and what you rolled back.

---

## After successful activation

Tell the user:

- "Decision Engine is live. From tomorrow's 07:00 morning brief, you'll see a new `## 7. Today's Recommendations` section with 0-3 structured recs."
- "Evening recap runs at 18:00 daily — surfaces pending morning recs for accept/reject."
- "Mondays: additional `## 8. Weekly Decision Summary` appended to the morning brief, showing true acceptance rate, Context/Data gap signals, Autonomy Ladder status."
- "From anywhere Claude Code runs: `/decide accept rec_xxxxxx`, `/decide reject rec_xxxxxx <category>`, `/decide pending`, `/decide review`, `/decide patterns`."
- "Your existing manual decisions (MD files in `data/decisions/`) have been archived — they remain on disk but the engine now reads from Supabase. If you chose to import them, they're in the `decisions` table as `source='manual'`."

Point them at [reference/decision-engine.md](../../reference/decision-engine.md) for the conceptual model and [reference/autonomy-ladder.md](../../reference/autonomy-ladder.md) for how the system earns autonomy over time.
