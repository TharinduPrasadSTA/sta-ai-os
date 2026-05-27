# Connecting Services with MCP

> MCP (Model Context Protocol) is one of three ways to wire external services into your AI OS. This guide explains what MCP is, when to use it, and how the manual `.mcp.json` pattern works. `/connect-data` automates all of this. Read here when you want to understand what the command is doing for you, or when you're wiring a service outside the normal flow.

---

## What MCP Is

MCP is a standardised way for Claude Code to talk to an external service **live, in-session**. When you ask Claude a question that needs data from Notion, Airtable, Slack, or Google Drive (and that service has an MCP server configured), Claude queries it right then, reads the current state, and answers.

Key properties:

- **On-demand.** MCP doesn't pull data in advance. It queries when you ask.
- **Live.** The answer reflects whatever's in the service right now, not a stale sync.
- **No storage.** Nothing lands in your Supabase corpus. The query happens, the answer comes back, the transaction ends.
- **Session-bound.** MCP tools live inside your Claude Code session. If the session ends or disconnects, the tools pause until Claude Code reconnects.

## Live vs MCP — terminology

MCP is a pattern, not a storage location. **Live** means Claude queries the service at question time. MCP is the cleanest way to implement Live — a standardised protocol with a pre-built server for the service.

When no MCP server exists for a service you want to query Live, the alternative is a small API wrapper script at `scripts/live/<service>.ts` that Claude calls when needed. Same outcome (Live query at question time), different implementation.

In this programme:
- "Live via MCP" is the default when the service has an MCP server
- "Live via API wrapper" is the fallback
- Both are **Live** from the data layer's perspective

`/connect-data` Phase 2 picks automatically: if the MCP Registry has an entry for the service, it wires MCP. If not, it builds a wrapper. The founder doesn't see the difference.

---

## When MCP Is the Right Method

MCP fits data where **the current state is what matters**, and a stale copy would be misleading or wrong.

| Data type | Why MCP | Example service |
|---|---|---|
| SOPs and knowledge bases | SOPs change. Last week's version is wrong. | Notion, Google Drive |
| Current pipeline state | Deal stages move; sync copies go stale. | Airtable, HubSpot |
| Today's calendar | Meetings get rescheduled. | Google Calendar |
| Current channel activity | What's in #general right now. | Slack |
| Live inbox | What's in your inbox today. | Gmail |

MCP is **not** the right method for data that accumulates over time and benefits from historical search (transcripts, past messages, transactions, CRM activity logs). For those, use API sync into Supabase instead. See `/connect-data` Phase 2 for how each pattern is classified, or Module 3 §1 of the training for the test.

---

## When to Use API Sync Instead

Any time you want to **accumulate and search across time**. A sync script runs on a schedule (via GitHub Actions, see `reference/scheduling.md`), pulls new data from the service's API, and writes into your Supabase corpus with embeddings and full-text indexing. Later queries can search months or years of accumulated data.

Services like Slack, Gmail, Airtable, and Calendar often benefit from **both methods**. Sync for historical depth, MCP for live queries. `/connect-data` handles dual-method setup automatically for services classified as "both".

---

## How Manual MCP Works

MCP connections are configured in a file called `.mcp.json` at your project root. Each entry defines one service: where it is, what protocol, and how to authenticate.

**The basic pattern:**

```json
{
  "mcpServers": {
    "service-name": {
      "type": "http",
      "url": "https://mcp.service.com/endpoint",
      "headers": {
        "Authorization": "Bearer ${YOUR_API_TOKEN}"
      }
    }
  }
}
```

API tokens and credentials go in `.env.local` (gitignored, never committed). The `${YOUR_API_TOKEN}` syntax tells Claude Code to read the value from that file at session start.

**That's it.** Create `.mcp.json`, add your tokens to `.env.local`, restart Claude Code. Claude can now talk to the service directly.

---

## What `/connect-data` Does for You

Running `/connect-data` (or `/connect-data let's start connecting integrations` to jump to Phase 2) handles all of the following automatically:

1. Reads your `integrations.md` to see every service you've listed
2. Classifies each service (append-only / ever-changing / both)
3. For each service, checks the MCP Registry live
4. Pulls the MCP server's URL, protocol, and auth details
5. Prompts you for the API token when needed
6. Writes the token to `.env.local` under a descriptive key
7. Adds the service to `.mcp.json` using the right configuration shape
8. Tells you to restart Claude Code so the new MCP binds
9. Tests the connection with a sample query

You approve each connection. You never look up the Registry manually, write JSON by hand, or guess the auth pattern.

---

## Adding Multiple Services

Your `.mcp.json` holds as many services as you need. Each entry is a top-level key under `mcpServers`:

```json
{
  "mcpServers": {
    "airtable": {
      "type": "http",
      "url": "https://mcp.airtable.com/v2",
      "headers": { "Authorization": "Bearer ${AIRTABLE_API_KEY}" }
    },
    "supabase": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y", "@supabase/mcp-server",
        "--supabase-url", "${SUPABASE_URL}",
        "--supabase-key", "${SUPABASE_SERVICE_ROLE_KEY}"
      ]
    },
    "notion": {
      "type": "sse",
      "url": "https://mcp.notion.com/sse"
    }
  }
}
```

Each service needs its own entry in `.env.local` if it uses token auth. Add services one at a time and test each one before moving on (this is what `/connect-data` does automatically in Phase 2).

---

## How MCP Fits the Data Layer

MCP is half the Data layer. The other half is API sync into Supabase.

```
Member asks Claude a question
    |
    Claude reads CONTEXT (who you are, what your business does)
    |
    If the answer needs LIVE state → queries via MCP
    If the answer needs HISTORY → queries Supabase corpus (hybrid search)
    If the answer needs both → queries both and synthesises
    |
    Claude returns an intelligent answer
```

MCP gives live access but no local copy. API sync gives you a local searchable corpus but it's not always-current. Both patterns build the Data layer. `/connect-data` sets up both where a service supports both.

---

## Troubleshooting

**"MCP server not connecting"**
- Check `.mcp.json` is valid JSON (common trap: trailing commas)
- Verify the token in `.env.local` is correct and the file is at project root
- Restart Claude Code after any `.mcp.json` change; MCP only binds at session start
- Run `/mcp` to see connection status and any error output

**"Permission denied" / "Unauthorized"**
- Check the token has the right scopes. Airtable needs `data.records:read`. Slack needs the right Bot scopes. Each service documents its required scopes.
- If the token is old, regenerate it and update `.env.local`

**"MCP tool disconnected mid-session"**
- MCP lives inside your session. If Wi-Fi drops or the extension reloads, MCP has to reconnect. Usually transparent on the next tool call.
- For anything that needs to run unattended (Daily Brief workflows, scheduled syncs), use API sync instead of MCP. GitHub Actions runners don't have access to your local MCP session.

**"My service isn't on the MCP Registry"**
- Search the Registry again with a broader term. New servers ship weekly.
- If no server exists, `/connect-data` will route you to API sync instead. Claude builds a sync script for services with a public API.
- If no MCP and no API, fallback is manual upload to `data/imports/<service>/`.

---

## A Note on Managed Connectors

You may have encountered managed connectors on `claude.ai` (`Settings > Connectors`). Those work in the Claude Desktop app and on `claude.ai` web, and they're fine for that context. They don't currently tunnel into VS Code or CLI sessions, which is where this programme builds. That's why the AI OS uses manual MCP via `.mcp.json` for everything. The configuration's explicit, it's yours, and it works everywhere Claude Code runs.

---

_MCP is live access. API sync is accumulating history. Together they're the Data layer. `/connect-data` wires both for you automatically. This guide is what the command is doing under the hood._
