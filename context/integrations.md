# Integrations

> Every external service, tool, and data source STA uses. The roadmap for the Data layer — read by `/connect-data` to plan and execute service connections.

---

## Integration Status

| Service | Category | Purpose | Data Pattern | Connection | Status | Priority | Notes |
|---------|----------|---------|--------------|------------|--------|----------|-------|
| GoHighLevel | CRM / Platform | Central platform: CRM, pipeline, sub-accounts, AI agents, workflows, funnels, appointment booking, communication automation | Both | API + MCP | Connected (Sync — scripts/sync/sync-ghl.ts) | High | 6,460 contacts + 104 opportunities synced. Conversations pending. |
| ClickUp | Project Management | Task tracking, project planning, delivery visibility, client/project organisation | Both | API + MCP | Connected (Sync — scripts/sync/sync-clickup.ts) | High | 1,124 tasks synced across 15 spaces (Scale Through Automation workspace). |
| Microsoft Outlook | Communication | Client email, formal correspondence, shared business email workflows | Both | API + MCP | Connected (Sync — scripts/sync/sync-outlook.ts) | High | Initial sync in progress. App-only auth via Azure AD. |
| Microsoft Teams | Communication | Internal team communication, project coordination, operational alignment | Both | API + MCP | Connected (Sync — scripts/sync/sync-teams.ts) | High | 5 teams detected. Initial sync pending. |
| Seamless.ai | Lead Intelligence | Lead enrichment, prospecting, outbound list building, CRM data quality before GHL import | Append-only | API | Not connected | Medium | API key not yet available. |

---

## AI & Automation Ecosystem

| Service | Category | Purpose | Data Pattern | Connection | Status | Priority | Notes |
|---------|----------|---------|--------------|------------|--------|----------|-------|
| Claude Code | AI Development | AI development and operations partner (this project) | — | Native | Active | High | Core AI OS tool — already live |
| GHL AI Agents (voice + chat) | AI / Automation | AI voice and chat agents running inside GoHighLevel sub-accounts | Both | Via GHL connection | Not connected separately | High | Covered under GoHighLevel connection |
| GHL Workflows / Automation Engine | Automation | Trigger-based logic, lead routing, communication automation inside GHL | Both | Via GHL connection | Not connected separately | High | Covered under GoHighLevel connection |

---

## Connection Priority Order

1. **GoHighLevel** — Mission-critical. CRM, pipeline, AI agent activity, workflow logs, communication history all live here. Most valuable data for the Daily Brief and decision engine. Pre-built template available.
2. **ClickUp** — Daily execution visibility. Task completion rates, project statuses, delivery throughput — key for operational health tracking.
3. **Microsoft Outlook** — Client communication history. Email threads with clients provide context for relationship health and delivery status.
4. **Microsoft Teams** — Internal team communication. Captures operational conversations, decisions, and coordination between PM, dev, and marketing.
5. **Seamless.ai** — Lead intelligence. Exported lead records feed pipeline analysis and outbound tracking.

---

## Integration Flows

Key data flows between systems:

- **Seamless.ai → GoHighLevel** — Lead enrichment data exported, imported as contacts/leads into GHL CRM
- **GoHighLevel → Email/SMS** — Communication automation triggers for lead follow-ups and client workflows
- **GoHighLevel → Calendar/Booking** — Appointment booking automation via GHL's built-in scheduler
- **ClickUp ↔ GoHighLevel** — Task and execution alignment for client project delivery
- **APIs / Webhooks** — Custom integration logic connecting GHL to external tools as needed

---

## Environment Variables

Store credentials in `.env.local` in the project root (gitignored, never committed):

```bash
# GoHighLevel
GHL_API_KEY=
GHL_LOCATION_ID=

# ClickUp
CLICKUP_API_TOKEN=

# Microsoft (Outlook + Teams)
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=

# Seamless.ai
SEAMLESS_API_KEY=

# AI
ANTHROPIC_API_KEY=

# Database (when ready)
# SUPABASE_URL=
# SUPABASE_SERVICE_ROLE_KEY=
```

---

_Update as tools are added or changed. Run `/connect-data` to begin building the Data layer from this file._
