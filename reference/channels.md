# Mobile Access to Your AI OS

> This guide explains how to reach your AI OS from anywhere — and how your AI OS reaches you. As of April 2026, there are three paths: a Slack bot, a Telegram bot, and the Claude mobile app with Remote Control. They solve different problems. Most members use two.

---

## The Vision

Your AI OS sits on your computer. But you're not always at your computer. You're in meetings, on the move, or away from your desk when a question hits you:

- "What was the close rate last week?"
- "Give me today's brief."
- "Search my meeting notes for what we discussed about pricing."
- "Log a decision: I'm hiring a second account manager."

You need mobile access. And ideally, your AI OS proactively reaches you too — a morning brief waiting in Slack, a Telegram message when a client needs attention, a push notification when a long task finishes.

**There are two different jobs here:**

| | **Chat-bot UX** (Slack / Telegram) | **Claude-native UX** (Remote Control + mobile app) |
|---|---|---|
| Feels like | A person messaging you | A tool you open |
| Best for | Quick queries, proactive nudges, team-shared access | Building, editing, reviewing diffs, long work |
| Notifications | Native (Slack/Telegram push) | Native (Claude mobile push, v2.1.110+) |
| Setup effort | Medium — webhook + serverless | Low — pair via QR in 60 seconds |
| Always-on compute? | No (serverless webhook or managed connector) | No (Claude Code on the Web) or local Remote Control |
| Shareable with team? | Yes — group chats / channels | No — tied to your account |

**Recommendation: Do both.** Chat-bot for the assistant UX (morning brief, proactive pings, quick on-the-go questions). Claude mobile/Web for the workshop UX (when you actually want to work, not just receive information).

The Daily Brief workflow (see `reference/scheduling.md`) is the seam where the two patterns connect. The workflow generates your brief on a cron. Then it posts to your chat-bot (assistant UX) and optionally sends a Claude mobile push notification (tool UX) if there's something that needs your attention.

---

## Path A: Slack Bot (Recommended for Agency Owners)

If your team already lives in Slack, this is the strongest play. Near-zero backend.

### Why This Wins for Agencies

- Slack is already open in 50+ tabs across your business
- Your team can @mention the AI OS for shared queries
- A Daily Brief workflow posts your brief to a Slack channel via an incoming webhook — one URL, one HTTP call, no token juggling
- The team can see and react to the same brief

### Setup

1. **Create a Slack incoming webhook** for the channel you want the brief posted to. In Slack: **Apps** → **Incoming Webhooks** → **Add to Slack** → pick the channel → copy the URL.
2. **Add the URL as a GitHub secret.** In your repo: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Name it `SLACK_WEBHOOK_URL`.
3. **Wire it into your Daily Brief workflow.** In Claude Code, ask:
   > "Add a step to my Daily Brief workflow that posts the brief headline to Slack via my `SLACK_WEBHOOK_URL` secret."
4. Claude updates the workflow file, you commit and push. The next scheduled run posts to the channel.

### What You Can Do

- Morning brief posted automatically to #daily-brief on the cron you set
- Team can see and discuss the AI OS's output in-channel — organisational learning
- Route different briefs to different channels by adding more webhooks

### Pros & Cons

**Pros:** Slack is already open. Shareable with team/VA. Near-zero backend — just an incoming webhook URL. Free.

**Cons:** Outbound only. For interactive @mention replies, see Path B's serverless pattern adapted for Slack (Slack app + bot token + Cloudflare Worker), which is a separate setup.

---

## Path B: Telegram Bot (Recommended for Non-Slack Workflows)

Universal messaging, works on any phone, shareable. Modern pattern — serverless webhook, not a VPS.

### The Old Way vs The April 2026 Way

**Old pattern:** Python script on a VPS, polling Telegram for messages 24/7. Always-on compute. Fragile.

**Modern pattern:** Telegram webhook → serverless function → Anthropic API → reply. Runs only when a message arrives. Free-tier-friendly.

### Setup

1. **Create a bot** via @BotFather on Telegram. Send `/newbot`, follow the prompts, copy the token.
2. **Deploy a serverless function** (Cloudflare Worker / Vercel / AWS Lambda) that:
   - Receives Telegram webhooks
   - Calls Claude with the incoming message + your CLAUDE.md context
   - Posts the reply back to Telegram via the Telegram API
3. **Set the Telegram webhook** to point at your serverless URL.

Or ask Claude to build it for you:
> "Build me a Telegram bot using Cloudflare Workers that relays messages to my AI OS. My Anthropic API key is in Worker env vars. My Telegram bot token is `TELEGRAM_BOT_TOKEN`."

**Cost:** Roughly $0/month for a solo user — free tiers cover light usage.

### What You Can Do

- Text your AI OS from anywhere with Telegram
- Use it as a personal journal (Claude logs and reflects)
- Share the bot with a VA or team member (`/start` in a group chat)
- Proactive nudges — a scheduled workflow can send messages, not just reply

### Pros & Cons

**Pros:** Feels like an assistant. Works on any phone with Telegram. Shareable. Universal. No always-on compute.

**Cons:** More setup than Slack (30-60 min). Requires a serverless host. No managed connector yet.

---

## Path C: Claude Mobile App + Remote Control (For Actual Work on the Go)

For when you need full Claude Code power on mobile — reviewing diffs, running long tasks, editing context files. This **complements** a chat-bot. It doesn't replace one.

### Setup

1. **Download** the Claude iOS or Android app from the App Store / Play Store.
2. **Pair your session:** in your CLI or VS Code, run `/remote-control`. Scan the QR code with your phone.
3. **Enable push notifications** (v2.1.110+) for long-running tasks.

Your phone now has full access to your AI OS — all MCP connectors, filesystem, env variables.

See the docs: https://code.claude.com/docs/en/remote-control.md

### Alternative: Claude Code on the Web

If you don't want your local machine running as the session host, use **Claude Code on the Web** (https://claude.ai/code). Cloud sessions. No local machine required. Full Claude Code capability in a browser — works from phone or desktop.

### What You Can Do

- Review diffs, approve / reject changes
- Run long workflows and watch their output
- Edit your CLAUDE.md or context files on the go
- Build new skills or prompts while travelling

### Pros & Cons

**Pros:** Full Claude Code capability on mobile. Zero setup beyond the pair. Push notifications for long tasks. Web version needs no local compute.

**Cons:** Separate app (feels like a tool, not an assistant). Tied to your account — not shareable with team.

---

## Which Should I Start With?

| Situation | Recommendation |
|---|---|
| Your team/you already live in Slack | **A (Slack)** — easiest, highest-frequency touch |
| You want an assistant feel, no Slack | **B (Telegram)** — universal, modern pattern |
| You want to actually work on mobile (not just receive updates) | **C (Claude app)** — add alongside A or B |
| You want the assistant UX *and* mobile work | **A or B + C** — the recommended endgame |

**Start with one chat-bot path this week.** Add the Claude mobile app when you next travel or want to work from your phone.

---

## What This Unlocks

With mobile access active, you interact with your AI OS through natural conversation:

- "What's happening across the business today?" → Claude reads your context and data, generates a summary
- "Find all meetings from last week about client onboarding" → Claude searches your meeting data
- "Draft a follow-up email to the team about the pricing decision" → Claude drafts using your communication style from context
- "/decide I'm switching our CRM from HubSpot to Close" → Claude logs the decision with full context

**The power is that Claude has your entire AI OS loaded.** Your context files tell it who you are and what matters. Your MCP connections give it live data. Your decision history gives it your thinking patterns. The response isn't generic — it's tailored to your business.

---

## What to Do Now

Even if you're not ready to set up all three paths today, you can prepare:

1. **Pick one chat-bot path** — Slack (A) if you live in it, Telegram (B) if not. Set it up this week.
2. **Download the Claude mobile app** — Takes 60 seconds. Pair via Remote Control when you're near your laptop.
3. **Build your Context layer** — The better your context files, the better mobile access will be. A well-built AI OS gives intelligent, business-specific responses. A bare one gives generic answers.
4. **Connect data via MCP** — Every MCP connection you set up now is automatically available through mobile access.

---

_Your AI OS on your desktop is powerful. Your AI OS in your pocket is transformational. Start with one path. Add the second when you see what the first unlocks._
