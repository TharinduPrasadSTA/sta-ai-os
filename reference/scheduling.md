# Scheduling — Automating Your AI OS with GitHub Actions

> This guide explains how to make your AI OS run automatically — generating briefs, syncing data, and producing analyses on a schedule, even when your computer is off. As of May 2026, the canonical pattern is **GitHub Actions**.

---

## The Vision

Your AI OS shouldn't need you to be sitting at your computer to work. A Daily Brief should land in your inbox every morning at 7am. Data should sync every hour. Weekly reviews should generate every Monday. All without you lifting a finger.

GitHub Actions makes this possible. You define what you want to happen, when you want it to happen, and the workflow runs on GitHub's runners. Your computer can be off, asleep, or across the world — your AI OS still runs on schedule.

See the official docs: https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions

---

## Why GitHub Actions, Not Routines

If you're coming from earlier guidance that taught Anthropic Routines: those don't work for the patterns this Blueprint teaches. A Routine runs Claude Code in Anthropic's cloud, but it can't reach your Supabase, can't run your sync scripts, and can't execute the TypeScript or Python that does the real work. GitHub Actions does all of it: native cron, encrypted secrets, any code you write, full network access.

If you set up a Routine and it appears to be running, it isn't doing what you think — migrate.

---

## What a GitHub Actions Workflow Is

A workflow is a YAML file in `.github/workflows/` that GitHub runs on a trigger. The runner is a fresh Ubuntu container that clones your repo, installs your dependencies, runs your script, and exits.

**Workflows can be triggered three ways:**

| Trigger | When It Runs | Use Case |
|---------|-------------|----------|
| **Schedule** (cron) | Hourly / daily / weekdays / weekly | Morning briefs, weekly reviews, data syncs |
| **`workflow_dispatch`** | Whenever you click "Run workflow" in the GitHub UI, or via API | Manual reruns, testing, on-demand briefs |
| **Push / pull request** | On commit, PR, or push | Auto-regenerate docs, run tests, post summaries |

A single workflow can run multiple steps in sequence — generate the brief, save the output, post to Slack, send an email — all in one workflow file.

---

## The Three Tiers of Automation

There are still three ways to schedule work, depending on your needs:

| Tier | Runs On | Computer Needed? | Survives Restart? | Min Interval | Best For |
|------|---------|-----------------|-------------------|-------------|----------|
| **GitHub Actions** (cloud) | GitHub's runners | No | Yes | 5 minutes | Daily briefs, weekly reviews, recurring syncs |
| **Local cron** (launchd / systemd) | Your Mac/Linux box | Yes (must be awake) | Yes | 1 minute | Frequent local tasks, file processing |
| **`/loop`** | Your current session | Yes (session open) | No | 1 minute | Quick polling, temporary monitoring |

**For most people, GitHub Actions is the right choice.** Your computer can be off. Your AI OS still runs.

---

## Setting Up a Workflow

### Step 1: Push Your Project to GitHub

Your AI OS needs to be in a GitHub repository. Workflows clone the repo each run — this is how they access your `CLAUDE.md`, context files, and scripts.

```bash
# If you haven't already
git init
git add .
git commit -m "Initial AI OS setup"
git remote add origin https://github.com/your-username/your-ai-os.git
git push -u origin main
```

**Important:** Your `.env.local` file is gitignored (it contains API keys). Workflows get their environment variables from GitHub secrets — see Step 3.

### Step 2: Create the Workflow File

Workflows live in `.github/workflows/`. Create one file per scheduled function. Filename mirrors the function (`daily-brief.yml`, `data-sync.yml`, `weekly-review.yml`).

The canonical Daily Brief workflow:

```yaml
name: Daily Brief
on:
  schedule:
    - cron: '0 6 * * *'   # 06:00 UTC daily — convert to your timezone
  workflow_dispatch:        # allows manual trigger from GitHub UI
jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: npx tsx scripts/run-brief.ts
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

A working example template ships in this Blueprint at `.github/workflows/daily-brief.yml.example`. The script it runs has a starter at `scripts/run-brief.ts.example`. Copy, rename (drop `.example`), customise.

### Step 3: Add Secrets in GitHub

Your API keys and tokens live in GitHub repository secrets, not in your local `.env.local` (the workflow runner can't see your local files).

1. Go to your repo on github.com
2. **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each variable your workflow needs:
   - `ANTHROPIC_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SLACK_WEBHOOK_URL` (or `TELEGRAM_BOT_TOKEN`, etc.)

Secrets are encrypted at rest and only decrypted into the runner's environment for the duration of a workflow run.

### Step 4: Push and Verify

Commit the workflow file and push:

```bash
git add .github/workflows/daily-brief.yml
git commit -m "Add Daily Brief workflow"
git push
```

Then trigger a manual run to confirm it works before waiting for the cron:

1. Go to your repo on github.com
2. **Actions** tab
3. Pick your workflow on the left
4. Click **Run workflow** → **Run workflow** (uses `workflow_dispatch`)
5. Click into the run to watch the logs

If it succeeds, the cron will fire on schedule from this point on. If it fails, GitHub emails the repo owner by default — open the run, expand the failed step, fix.

---

## A Note on Cost

Two cost lines split out cleanly with GitHub Actions:

> **💡 What scheduled workflows cost.**
>
> - A Daily Brief averages roughly $0.30 to $1.00 per day in Anthropic API tokens, depending on context size and model.
> - GitHub Actions free tier covers 2,000 minutes/month for private repos. A daily 5-minute job uses about 150 minutes/month, well inside the free tier.
> - You'll need an Anthropic API key separate from your Pro/Max plan. Generate one at https://console.anthropic.com. The Pro/Max plan covers your interactive Claude Code sessions; the API key covers your scheduled workflow runs.

---

## What to Automate First

Start with the highest-value automations:

### 1. Daily Brief (Recommended First)

Your morning intelligence report, generated automatically before you wake up.

The workflow runs `scripts/run-brief.ts`. The script:
1. Reads your `context/` files from the cloned repo.
2. Queries Supabase for yesterday's activity.
3. Calls the Anthropic API with the assembled prompt.
4. Writes the brief to `outputs/briefs/<date>.md` (and commits it back if you want history in the repo).
5. Posts the headline to Slack via webhook.

### 2. Weekly Review

A deeper strategic analysis, generated every Monday morning. Same shape as the Daily Brief, different cron (`0 7 * * 1` for 07:00 UTC Monday).

### 3. Data Syncs

One consolidated nightly workflow that runs every script in `scripts/sync/` against your services and writes the results into Supabase. This is what `/connect-data` Phase 3 sets up. Schedule defaults to 02:00 UTC.

---

## How This Connects to the Function Layer

GitHub Actions workflows are the execution engine for your Function layer:

```
You BUILD a function (e.g., Daily Brief generation script in scripts/run-brief.ts)
    |
    You SCHEDULE it as a workflow (e.g., daily at 06:00 UTC via .github/workflows/daily-brief.yml)
    |
    It RUNS automatically on GitHub's runners, reading your Context + Data
    |
    Output lands in outputs/ (committed back) or your inbox, Slack, Notion, etc.
```

Without scheduled workflows, your functions only run when you manually trigger them. With them, your AI OS works while you sleep.

---

## Limitations to Know

**GitHub Actions:**
- Each run is a fresh Ubuntu container. No memory of previous runs. State lives in your repo (commit outputs back) or in external services (Supabase, Slack, etc.).
- Minimum cron interval is 5 minutes. For more frequent tasks, use local cron or `/loop`.
- Free tier: 2,000 minutes/month for private repos, unlimited for public. A daily 5-minute job is ~150 min/month.
- Workflow files must be in `.github/workflows/` on the default branch.
- Cron schedules are UTC. Convert from your timezone explicitly. DST changes don't auto-adjust.

**Local cron (launchd / systemd):**
- Your computer must be on and awake. If it sleeps, tasks are skipped.
- Configured in your OS, not in this project.

**`/loop` Tasks:**
- Only run while your current Claude Code session is open.
- Disappear when you end the session.
- Best for temporary monitoring, not long-term automation.

---

## Getting Started

1. **Push your project to GitHub** if you haven't already.
2. **Copy the example workflow** from `.github/workflows/daily-brief.yml.example` and customise.
3. **Copy the example script** from `scripts/run-brief.ts.example` and customise.
4. **Add your secrets** in GitHub Settings → Secrets and variables → Actions.
5. **Push and test** with a manual `workflow_dispatch` run.
6. **Review the outputs** — refine your prompt and script based on what you get.

The first time your Daily Brief lands in Slack without you doing anything, you'll understand why this matters. That's the Function layer working autonomously.

---

_Automation turns your AI OS from a tool you use into a system that works for you. Start with one workflow. Expand from there._
