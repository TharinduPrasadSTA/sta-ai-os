# The Decision Engine

> The mechanism by which your AI OS learns how you think and progressively earns the autonomy to decide on your behalf. This is the conceptual overview. For the exact implementation, see [decision-engine-implementation.md](decision-engine-implementation.md).

---

## Why This Matters

The endgame of your AI OS is not just to present data. It's to think like you. To understand that when you face a particular type of decision, in a particular context, you consistently go a particular way, and to eventually make that call on your behalf.

But the only way to get there is one decision at a time. Every decision you log trains the system. Every outcome you track validates or corrects its understanding. Over months, patterns emerge. The system doesn't just have your data, it has your judgement.

That's not a chatbot. That's a digital chief operating officer.

---

## The 5-Step Loop

```
    ┌──────────────┐
    │  1. DECIDE   │  ← You make a significant business decision
    └──────┬───────┘
           |
    ┌──────┴───────┐
    │   2. LOG     │  ← System records: what, why, options, expected outcome
    └──────┬───────┘
           |
    ┌──────┴───────┐
    │  3. MATCH    │  ← System finds similar past decisions
    └──────┬───────┘
           |
    ┌──────┴───────┐
    │  4. LEARN    │  ← After 30 days: what actually happened?
    └──────┬───────┘
           |
    ┌──────┴───────┐
    │   5. EARN    │  ← System earns autonomy through accuracy
    └──────┬───────┘
           |
           └───────→ (loops back to step 1)
```

---

### Step 1: Decide

You face a significant business decision. Not every decision, just the ones that matter. Hiring, pricing, strategy shifts, tool investments, client decisions, process changes.

**What qualifies as a "significant decision":**
- It affects revenue, team, or client relationships
- You considered multiple options before choosing
- Someone else might have decided differently
- You'd want to remember the reasoning later

---

### Step 2: Log

Use the `/decide` command to capture the decision. The system records question, context, options considered, chosen, rationale, expected outcome, confidence score, tags, and which company it affects.

**The key insight:** capturing *why* is more important than capturing *what*. "I chose to raise prices" is useless. "I chose to raise prices because our close rate is 40% which suggests we're underpriced, and I'd rather have fewer clients at higher margins than more clients stretching the team" — that's what trains the system.

---

### Step 3: Match

When you log a new decision, the system searches your decision history for semantically similar past decisions via vector search (Voyage embeddings + pgvector). Over time this becomes powerful:

- "You made a similar pricing decision 4 months ago. You raised prices by 20% and close rate dropped from 40% to 32%, but revenue per client increased 25%. Net positive."
- "Last time you faced a hiring vs. automation decision, you chose to hire. Outcome: the hire took 3 months to ramp up."
- "You've made 6 decisions about client scope creep. In 5, you chose to have the boundary conversation early. Success rate: 80%."

**Early days:** with few logged decisions, matching returns little. That's fine, the value compounds. After 50+ decisions, the system surfaces genuinely useful patterns.

---

### Step 4: Learn

After 30 days, the `outcome_assessed_at` column surfaces the decision in your Daily Brief. The system prompts you to review:

- What actually happened?
- Was it the right call?
- What surprised you?
- Outcome rating: Success / Partial / Neutral / Negative

This closes the feedback loop. Without it, the system has predictions but no ground truth.

---

### Step 5: Earn

As outcomes accumulate, patterns emerge, tracked in the `decision_patterns` table. These patterns feed into progressive autonomy (see [autonomy-ladder.md](autonomy-ladder.md)).

The system earns autonomy by demonstrating that its recommendations match your actual decisions at a high rate. It doesn't guess, it learns.

---

## Unified Storage Model

All decisions (manual, AI-emitted recommendations, chat-bot captures) live in one `decisions` table. Different row types are distinguished by `source` and `status` columns, not by separate tables.

### Source × Status matrix

| source | status | Purpose |
|---|---|---|
| `manual` | `logged` | You ran `/decide`. Complete. Enters 30-day review. |
| `ai-recommendation` | `pending` | Daily Brief issued this rec. Awaiting accept/reject. |
| `ai-recommendation` | `accepted` | You accepted. Counts as a decision to follow AI. Enters 30-day review. |
| `ai-recommendation` | `rejected` | You rejected. With a `reason_category`. |
| `ai-recommendation` | `expired` | Timed out after 72h unmarked. Neutral in metrics. |
| `telegram-capture` | `logged` | Captured via chat-bot free-text. Same as manual. |

This unification means similarity search naturally includes both manual decisions and accepted AI recs. An accepted rec *is* a decision you made (to follow the AI's advice). A rejected rec *is* a decision you made (to override).

---

## The 5 Rejection Categories

When you reject an AI recommendation, you pick one category. Each carries different meaning:

| Category | Meaning | Counts against AI? |
|---|---|---|
| `disagree` | Don't think this is the right call | **Yes** — real rejection |
| `no-time` | Good idea, no capacity today | No — neutral |
| `redundant` | Already done / already knew | No — signals Context-layer gap |
| `wrong-context` | AI is missing info that would change this | No — signals Data-layer gap |
| `later N` | Good idea, not now — resurface in N days | No — deferred (tracked via `re_surface_at`) |

**True acceptance rate formula:**

```
true_acceptance_rate = accepted / (accepted + disagree)
```

Only explicit disagreement counts as a rejection. Everything else (no-time, redundant, wrong-context, later, expired) is excluded from the acceptance-rate math. "No time today" shouldn't punish the AI. "Already done" signals your Context is stale, not that the rec was wrong.

`redundant` and `wrong-context` counts are surfaced separately in the Weekly Decision Summary as **gap signals** — they tell you which layers of your AI OS need strengthening.

---

## The Feedback Loop (Pre-Rec Lookup)

Before the Daily Brief emits a candidate recommendation, it runs one query against past AI recs with the same semantic similarity:

- If ≥3 similar past recs had `disagree` rate >60% → **suppress** the rec. The AI has been wrong here before; don't repeat.
- If ≥3 similar past recs had acceptance rate >80% → **boost** with a confidence marker: `[rec_a7f2k3, boosted: 85% on 5 similar past]`.
- Otherwise → emit normally.

This is the dumb version of self-improvement — one SQL query, no ML — but it's what makes the engine actually learn rather than just accumulate data.

---

## Backlog Prevention

Without these rules, pending recs pile up and the engine dies. Three hard rules:

1. **72h auto-expire.** Pending recs older than 72 hours flip to `status='expired'` (configurable via `REC_EXPIRE_HOURS` env var). Excluded from acceptance math.
2. **Max-3-pending gate.** If 3+ recs are already pending, the morning brief suppresses new recs and emits a "clear pending first" message instead.
3. **Issue-signature dedup.** Each rec gets a short hash of `(topic, entity, action)`. If a new candidate rec shares a signature with an existing pending / recently-expired / deferred row, the new one is skipped.

---

## Brief Integration

The engine integrates **additively** into your existing Daily Brief. Your Section 2-built brief stays intact. The engine adds:

- **Section 7 — Today's Recommendations** (every morning): 0-3 structured recs with `rec_id`s, generated by Opus, post-processed through the suppress/boost filter.
- **Section 8 — Weekly Decision Summary** (Mondays only): Activity, True acceptance rate, Context/Data gap signals, Deferred queue, Autonomy Ladder status per module, 30-day reviews due this week.
- **Evening recap** (18:00 daily): surfaces the morning's pending recs for one-line close-out (`/decide accept rec_xxxxxx` or `/decide reject rec_xxxxxx <category>`).

Everything routes through two helpers (`logDecision`, `recordRecommendationResponse`) so new capture sources (meeting transcripts, Slack replies, Circle posts) can extend the engine with ~20 lines each.

---

## Hard Cap Scope

What's in scope for the Decision Engine v1: storage, similarity matching, categorised accept/reject, backlog prevention, 30-day reviews, pattern clustering, Monday summary, simple pre-rec lookup.

What's **out of scope** (deferred until 3+ months of data):
- AI auto-executes accepted recommendations
- Trust-threshold rec suppression ("you've accepted >95% of pricing recs; I'll stop asking")
- ML-tuned confidence scoring
- Automated outcome inference from action signals

The test: any future layer should be addable as a new helper or scheduled workflow that queries the existing `decisions` table, without schema changes.

---

## Activation

The Decision Engine is dormant in your blueprint by default. `/decide` works in file-based mode (writes Markdown to `data/decisions/`) from day one. When you reach **Module 4 Section 5**, run `/activate-decision-engine` to promote it to the full Supabase + brief-integrated engine.

See [.claude/commands/activate-decision-engine.md](../.claude/commands/activate-decision-engine.md) for the activation flow and [decision-engine-implementation.md](decision-engine-implementation.md) for the exact spec Claude executes.

---

_Log early, log often. Every decision is a training data point for your future AI COO._
