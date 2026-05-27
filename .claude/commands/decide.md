# /decide — Log or manage a decision

> Unified entry point for manual decision logging, AI recommendation accept/reject, and the 30-day review loop. Works in two modes: **file-based** (pre-activation) and **full engine** (post-activation).

## Variables

input: $ARGUMENTS

---

## Mode detection — do this first

Check if `scripts/decisions/index.ts` exists in the project.

- **Exists** → full engine mode. Follow "Full Engine Mode" below.
- **Does not exist** → file-based fallback. Follow "File-Based Fallback" below.

---

## Full Engine Mode (post-activation)

Dispatch on the first whitespace-separated token of `input`.

Helpers live in `scripts/decisions/index.ts`:

```typescript
import {
  logDecision,
  findSimilarDecisions,
  recordRecommendationResponse,
} from "../scripts/decisions/index.js";
```

### Token routing

| First token | Behaviour |
|---|---|
| `accept` | Accept one or more AI recs |
| `reject` | Reject one AI rec with a category |
| `pending` | List open AI recs |
| `review` | Walk overdue 30-day reviews |
| `patterns` | Show `decision_patterns` rollup |
| `from` | Extract a decision from a file |
| (anything else, or empty) | Log a manual decision |

### Log a manual decision (default / free-text)

If the input doesn't match any keyword, it's either a question or empty.

1. If empty, ask: "What decision are you working through?"
2. Call `findSimilarDecisions(question + any-known-context, { limit: 3 })` — default filters include `source IN (manual, ai-recommendation)` and `status IN (logged, accepted)`, so similarity search sees both manual decisions and accepted AI recs.
3. Show the matches with: question, chosen, actual_outcome (if any), date.
4. Ask the user for:
   - Context (situation/background)
   - Options considered (at least 2)
   - What they chose
   - Rationale (the most important part — capture *why*)
   - Expected outcome
   - Confidence (High / Medium / Low → maps to 0.9 / 0.6 / 0.3)
   - Tags (category keywords)
   - Company affected
5. Call `logDecision({ source: "manual", status: "logged", question, context, options, chosen, rationale, expected_outcome, confidence_score, tags, company })`.
6. Confirm: "Logged. Review window: 30 days from today. The system will surface this in your morning brief when it's time to review the outcome."

### `/decide accept <rec_id> [<rec_id>...]`

1. Parse rec_ids (format `rec_` + 6 alphanumeric).
2. Call `recordRecommendationResponse({ rec_ids, action: "accept" })`.
3. Report: X updated, Y not_found. For each accepted, note the 30-day review date.

### `/decide reject <rec_id> <category> [free text note]`

Category is one of:
- `disagree` — real disagreement, counts against the AI in acceptance rate
- `no-time` — good idea, no capacity; neutral
- `redundant` — already done / already known; Context-layer gap signal
- `wrong-context` — AI missing info; Data-layer gap signal
- `later [N]` — defer N days (default 7); surfaces as Revisit later

1. Parse rec_id, category, optional note or day count.
2. Call `recordRecommendationResponse({ rec_ids: [rec_id], action: "reject", category, note, surface_in_days })`.
3. Confirm with a short explanation of what the category means in context.

### `/decide pending`

Query `decisions WHERE source='ai-recommendation' AND status='pending' ORDER BY created_at ASC`. Render a numbered list with short_id, age, rec text. End with the reply hint: *"Reply: `/decide accept rec_xxxxxx` or `/decide reject rec_xxxxxx <category>`."*

### `/decide review`

Query `decisions WHERE outcome_assessed_at <= now AND actual_outcome IS NULL AND status IN ('logged', 'accepted') ORDER BY outcome_assessed_at ASC LIMIT 5`. Walk through one at a time:
- Show: question, chosen, expected_outcome, days overdue.
- Ask: "What actually happened?" → store as `actual_outcome`.
- Ask: "Was it the right call? (yes / partially / no)"
- Ask: "Anything surprising?"

After the batch: "Reviewed N decisions. Run `/decide review` again next week."

### `/decide patterns`

Query `decision_patterns ORDER BY total_decisions DESC LIMIT 10`. Show: pattern_name, success_rate, total_decisions, last_used_at. If empty: "No patterns yet — patterns refresh weekly (Monday 06:30 cron). Need at least 3 decisions per tag/company group to form a pattern."

### `/decide from <path>`

1. Read the file (typically a meeting transcript or brief reply).
2. Identify decision-like content (chosen action + rationale).
3. Confirm with the user: "I see a decision here: [...]. Log it?"
4. If yes, log via `logDecision({ source: "manual", status: "logged", ...extracted_fields })`.

---

## File-Based Fallback (pre-activation)

Before Module 4 Section 5 activation, the Decision Engine isn't yet wired into Supabase. You can still log decisions — they're saved as Markdown files and will be imported into the unified table when you activate.

Only the basic "log a decision" flow is supported in this mode. `accept`, `reject`, `pending`, `review`, `patterns`, `from` all need the full engine and should respond: *"That requires the full Decision Engine. Run `/activate-decision-engine` (Module 4 Section 5) to activate."*

### Log a decision to `data/decisions/`

1. If input is empty, ask: "What decision are you working through?"
2. Check for similar past decisions by reading files in `data/decisions/`. Share any relevant ones.
3. Ask for: Context, Options (2+), Decision, Rationale, Expected outcome, Category, Companies, Confidence.
4. Save to `data/decisions/YYYY-MM-DD-{descriptive-slug}.md`:

```markdown
# Decision: [One-line summary]

**Date:** YYYY-MM-DD
**Category:** [pricing / hiring / strategy / client / product / process / tool / other]
**Companies affected:** [Company/companies]
**Confidence:** [High / Medium / Low]

## Context
[What situation led to this decision]

## Options Considered
1. **[Option A]** — [Brief description]
2. **[Option B]** — [Brief description]
3. **[Option C]** — [Brief description] (if applicable)

## Decision
[What was chosen and why. Capture the specific reasoning — this is the most valuable part.]

## Expected Outcome
[What the user expects will happen]

---

## Review (30 days)

**Review date:** YYYY-MM-DD (30 days from decision date)
**Actual outcome:** [Filled in at review]
**Right call?** [Yes / Partially / No]
**Surprises:** [Anything unexpected]
**Rating:** [Success / Partial / Neutral / Negative]
**Lesson:** [What to remember for similar future decisions]
```

5. Count the files in `data/decisions/` and confirm: "Decision logged. This is training data point #N. When you reach Module 4 Section 5, run `/activate-decision-engine` to upgrade to the full engine — your existing MD decisions will be imported into Supabase with their history preserved."

---

## When to use which

- **Early (Modules 1-4, pre-activation):** file-based mode. Log decisions as you build your system. Your history stays valid.
- **Module 4 Section 5 onward:** full engine. All sub-args unlocked. MD decisions get imported. Morning briefs start surfacing recommendations.

The `/decide` command automatically picks the right mode. No action required.
