# Prime — AI OS Session Initialisation

> Load all context, assess system status, and recommend the next action.

## Phase 1: Read Everything

Read the following files in order:

1. `CLAUDE.md` — The AI OS architecture and conventions
2. `context/personal-info.md` — The founder's role, goals, and philosophy
3. `context/companies.md` — Business portfolio
4. `context/team.md` — Team directory
5. `context/strategy.md` — Strategic priorities and decision filters
6. `context/current-data.md` — Metrics and KPIs
7. `context/integrations.md` — Connected services and data sources

## Phase 2: Assess Layer Completion

After reading, evaluate each layer of the AI OS:

### Layer 1: AI OS (Foundation)
- Is CLAUDE.md present and configured? (Should always be yes)
- Are slash commands available?

### Layer 2: Context
For each context file, assess:
- **Empty** — File exists but has only template placeholder text
- **Partial** — Some sections filled in, others still have `[brackets]` or are blank
- **Complete** — All sections populated with real, specific information

### Layer 3: Data
- Are there any files in `data/decisions/`?
- Are there any scripts in `scripts/` (beyond README.md)?
- Are there any database files?
- Is `.env.local` present with configured API keys?

### Layer 4: Function
- Are there any outputs in `outputs/briefs/`?
- Are there any outputs in `outputs/analyses/`?
- Are there any function scripts running?

## Phase 3: Report

Provide a concise summary:

### 1. Context Status
For each of the 6 context files, report: Empty / Partial / Complete

### 2. Data Status
What data sources are connected? What decision logs exist?

### 3. Function Status
What systems are producing outputs?

### 4. Overall Assessment
Which layer should the user focus on next? Follow the "you cannot skip layers" rule:
- If Context is incomplete → recommend `/build-context`
- If Context is complete but Data is empty → recommend planning the Data layer with `/create-plan`
- If Data is flowing but no Functions exist → recommend building the first function (Daily Brief)
- If everything is operational → report status and ask what to work on

### 5. Next Recommended Action
One specific, actionable recommendation for what to do in this session.

---

**Always end with:** "What would you like to work on?"
