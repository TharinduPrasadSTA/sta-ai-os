# Current Data

> This file holds your live metrics, KPIs, and current state information. It gives the AI OS the numbers behind the narrative — turning strategic priorities into measurable reality.

---

## How This Connects

- **personal-info.md** defines what you're responsible for
- **companies.md** describes the businesses these metrics belong to
- **team.md** may track team performance data
- **strategy.md** outlines what you're optimising toward
- **This file** gives Claude the numbers to work with
- **integrations.md** lists where this data comes from (automation potential)

---

## Why This Matters

The AI OS can only analyse what it can see. Without real numbers, recommendations are based on assumptions. With them, the system can spot trends, flag risks, compare against benchmarks, and tell you exactly where to focus. This is the difference between a generic assistant and an intelligent operating system.

Start with whatever numbers you have. Even rough estimates are better than nothing. You can automate data pulling later (see `scripts/README.md`).

---

## Key Metrics

[Fill in the metrics that matter most to your business. Add or remove rows as needed.]

### [Company/Business Name]

| Metric | Current Value | Target | Trend | Notes |
|--------|--------------|--------|-------|-------|
| Monthly revenue | | | | |
| MRR (if subscription) | | | | |
| Active clients | | | | |
| Client churn rate | | | | |
| Sales close rate | | | | |
| Average deal value | | | | |
| Pipeline value | | | | |
| Team utilisation | | | | |
| Profit margin | | | | |

### Personal Brand / Marketing (if applicable)

| Metric | Current Value | Target | Trend | Notes |
|--------|--------------|--------|-------|-------|
| Email list size | | | | |
| Social followers | | | | |
| Content published (weekly) | | | | |
| Inbound leads (monthly) | | | | |

---

## Current State

[Qualitative snapshot — what's happening right now that the numbers don't fully capture?]

- [e.g., Just landed our biggest client yet — onboarding starts next week]
- [e.g., Two team members are at capacity, need to hire or redistribute]
- [e.g., Cash flow is tight due to delayed invoice from [client]]
- [e.g., Testing a new service offering with 3 pilot clients]

---

## Project Statuses

[Any key projects or initiatives currently in flight?]

| Project | Status | Owner | Notes |
|---------|--------|-------|-------|
| [Project name] | [Active/Paused/Planning] | [Who's leading] | [Key context] |
| [Project name] | [Active/Paused/Planning] | [Who's leading] | [Key context] |

---

## Data Sources

[Where does this data come from? Useful for future automation — see `scripts/README.md`.]

| Data Point | Source | Access Method | Automation Status |
|-----------|--------|---------------|-------------------|
| Revenue | [e.g., Stripe / Xero / Spreadsheet] | [e.g., API / Manual export] | [Manual / Automated] |
| Client data | [e.g., CRM / Airtable] | [e.g., API] | [Manual / Automated] |
| Sales data | [e.g., CRM / Call tracking] | [e.g., API / Manual] | [Manual / Automated] |
| Team data | [e.g., Project management tool] | [e.g., API] | [Manual / Automated] |

---

## Automation Note

This file works as a manual snapshot, but every metric here can eventually be pulled automatically. Once your Data layer is built, scripts in `scripts/` can refresh this file from your actual data sources — dashboards, APIs, spreadsheets, CRMs. That's the power of building the layers in order.

---

_Update regularly — stale data limits the AI OS's ability to help you. Even a weekly manual update is valuable until automation is in place._
