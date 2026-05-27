# The Autonomy Ladder — Progressive AI Autonomy

> This document explains the 4-phase framework for progressively granting your AI OS more autonomy. The endgame is a system that handles routine operations on your behalf — but trust must be earned, not assumed.

---

## The Vision

The long-term goal of your AI OS is not just to inform you. It's to operate on your behalf. To make the routine decisions that currently consume your time, so you can focus purely on strategy, relationships, and high-leverage activities.

But you don't hand over the keys on day one. Autonomy is earned through demonstrated accuracy over time. The system proves itself at each level before progressing to the next.

---

## The 4 Phases

```
                              +------------------+
                              |   AUTONOMOUS     |  ← System executes within guardrails
                        +-----+                  |
                        |     CONFIRM            |  ← System drafts, you approve
                  +-----+                        |
                  |     RECOMMEND                |  ← System suggests, you decide
            +-----+                              |
            |     INFORM                         |  ← System presents, you act
            +------------------------------------+

            Trust earned through 100+ decisions
```

---

### Phase 1: Inform (Start here)

**What it looks like:** The AI OS collects data, analyses it, and presents findings. You make all decisions and take all actions.

**Examples:**
- Daily Brief arrives with financial position, team health, and recommended priorities — you read it and decide what to act on
- Meeting summary appears with extracted action items — you decide which to pursue
- The system flags that a client hasn't been contacted in 3 weeks — you decide whether to reach out

**When to progress:** When the AI OS consistently provides accurate, useful information and you find yourself agreeing with its implicit recommendations most of the time.

---

### Phase 2: Recommend

**What it looks like:** The AI OS doesn't just present information — it makes specific recommendations with reasoning. You still decide and act.

**Examples:**
- "Based on the last 30 days of data, I recommend focusing on client X's campaign performance — their metrics have dropped 15% and they're up for renewal in 6 weeks. Here's a suggested approach..."
- "Your close rate has dropped from 32% to 24% this month. Looking at the call transcripts, the main objection is pricing. I recommend testing a payment plan option. Here's the data..."
- "You have 3 meetings tomorrow that could be emails. I recommend cancelling the 2pm and 4pm and sending async updates instead. Here's why..."

**When to progress:** When you accept 80%+ of the system's recommendations without significant modification. This means it's learned your thinking patterns well enough to be trusted with drafted actions.

---

### Phase 3: Confirm

**What it looks like:** The AI OS drafts actions and queues them for your approval. You review and tap approve or reject. The system acts on approval.

**Examples:**
- System drafts a follow-up email to a client and sends it to your phone: "Approve / Edit / Reject"
- System reschedules a low-priority meeting and shows you the proposed change: "Confirm?"
- System creates a task list for your team based on yesterday's meeting action items: "Post to Slack? Yes / No"

**When to progress:** When you approve 90%+ of queued actions without editing. This is a high bar — the system should be right almost every time before you grant full autonomy.

---

### Phase 4: Autonomous

**What it looks like:** The AI OS executes routine decisions within defined guardrails. You oversee through periodic reviews (Daily Brief) rather than approving each action.

**Examples:**
- Internal team status updates sent automatically every Monday
- Low-priority meetings rescheduled without asking
- Routine data analysis and metric tracking runs independently
- Standard client reports generated and filed without intervention

**Important:** Phase 4 doesn't mean the system does everything. It means it handles the routine, predictable operations that don't need your creative input or strategic judgement. The high-stakes decisions always stay with you.

---

## Guardrails (Apply at Every Phase)

No matter how much autonomy the system earns, certain actions always require your explicit approval:

### Always Require Approval
- **Financial transactions** — Spending money, invoicing, refunds, pricing changes
- **External client communications** — Emails, messages, or calls to clients and prospects
- **Hiring and firing** — People decisions always stay human
- **Strategic commitments** — Contracts, partnerships, public statements
- **New product/service launches** — Anything that changes what you sell

### Can Graduate to Autonomous
- Internal team updates and routine messages
- Calendar management and meeting scheduling
- Data analysis and report generation
- Task creation and assignment (from meeting action items)
- Content draft generation (but not publishing)
- Metric tracking and alerting

### Always Autonomous (No Approval Needed)
- Reading and analysing data
- Generating internal reports and briefs
- Searching across your data to answer questions
- Logging decisions and tracking outcomes
- Organising and categorising information

---

## Trust Scoring

The system earns autonomy through demonstrated accuracy. Trust is measured from data in the `decisions` table (see [decision-engine.md](decision-engine.md)) and surfaced every Monday in **Section 8 — Weekly Decision Summary** of your morning brief.

### Track These Signals

- **True acceptance rate** — The honest measurement: `accepted / (accepted + disagree)`. Only explicit disagreement counts against the AI. Neutral reject categories (`no-time`, `redundant`, `wrong-context`, `later`, `expired`) are excluded so busy weeks don't punish the AI.
- **Context gap signal** — Count of `redundant` rejections by module. High numbers here mean the AI doesn't know what you already know, strengthen your Context layer.
- **Data gap signal** — Count of `wrong-context` rejections by module. High numbers here mean the AI is missing inputs, strengthen your Data layer.
- **Engagement health** — Proportion of issued recs that got a response (any accept or reject) vs expired unmarked. High expired rate means the system is dying; the evening recap isn't reaching you.

### Progression Thresholds

| Transition | Suggested Threshold |
|-----------|-------------------|
| Inform → Recommend | Consistently useful analysis for 2+ weeks, and members engaging with recs (low expired rate) |
| Recommend → Confirm | True acceptance rate >80% over 50+ recommendations |
| Confirm → Autonomous | True acceptance rate >90% over 100+ queued actions |

Promotion is always a human decision. The Weekly Decision Summary flags when a module crosses a threshold (e.g., *"Daily Brief module is at 82% over 50 recs — eligible to promote to Recommend"*) but you decide when to flip the switch. The point is that autonomy is earned through consistent performance, not granted by default.

---

## Getting Started

You don't need to think about Phases 3 and 4 right now. They're the long game. What matters today:

1. **Build your Context layer** — The system can't earn autonomy if it doesn't understand you
2. **Start logging decisions with `/decide`** — This trains the Decision Engine from day one
3. **Let the AI OS inform you** — Get comfortable with the Daily Brief and analysis functions
4. **Notice when it's right** — Track your own reaction to its outputs. When you consistently think "yes, that's exactly what I would have said," it's ready for more.

The best systems are built patiently. Start with Inform. Let the system prove itself. The autonomy will follow naturally.

---

_This framework is your roadmap. Refer back to it when deciding whether to grant your AI OS more responsibility._
