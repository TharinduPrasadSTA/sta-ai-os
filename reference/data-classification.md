# Data Classification

> Canonical classification for services members connect to their AI OS. Read by `/build-context` (during Context layer population) and `/connect-data` (during Data layer build). If you add a service not listed here, the commands fall back to asking the founder in plain English.

---

## Known services

| Service | Data Pattern | Typical connection |
|---|---|---|
| Google Meet | Append-only | Sync (long-form template) |
| Zoom | Append-only | Sync (long-form template) |
| Otter.ai | Append-only | Sync (long-form template) |
| Fireflies | Append-only | Sync (long-form template) |
| Loom | Append-only | Sync (long-form template) |
| Gmail | Both | Sync + Live |
| Outlook | Both | Sync + Live |
| Slack | Both | Sync + Live |
| Discord | Both | Sync + Live |
| WhatsApp | Append-only | Sync (via export) or Manual upload |
| Stripe | Append-only | Sync (structured) |
| Xero | Append-only | Sync (structured) |
| QuickBooks | Append-only | Sync (structured) |
| Airtable | Both | Sync + Live |
| HubSpot | Both | Sync + Live |
| Pipedrive | Both | Sync + Live |
| Close | Both | Sync + Live |
| GoHighLevel | Both | Sync + Live |
| Notion | Ever-changing | Live |
| Confluence | Ever-changing | Live |
| Google Drive (SOPs, docs) | Ever-changing | Live |
| Google Calendar | Ever-changing | Live |
| Calendly | Ever-changing | Live |
| ClickUp | Both | Sync + Live |
| Asana | Both | Sync + Live |
| Monday.com | Both | Sync + Live |
| Meta Ads | Append-only | Sync (structured) |
| Google Ads | Append-only | Sync (structured) |
| GA4 (Google Analytics) | Append-only | Sync (structured) |
| YouTube Analytics | Append-only | Sync (structured) |

---

## The 17 shipped templates (pre-designed schemas in `/connect-data`)

| # | Service |
|---|---|
| 1 | Google Meet |
| 2 | Zoom |
| 3 | Otter.ai |
| 4 | Fireflies |
| 5 | Slack |
| 6 | Gmail |
| 7 | Google Calendar |
| 8 | Google Drive |
| 9 | Notion |
| 10 | Airtable |
| 11 | HubSpot |
| 12 | GoHighLevel |
| 13 | Stripe |
| 14 | Xero |
| 15 | QuickBooks |
| 16 | Meta Ads |
| 17 | YouTube Analytics |

Services in the table above but not in the 17 templates still work — `/connect-data` falls back to `/create-plan` to design the schema on the fly.

---

## The classifications explained

- **Append-only:** data written once, never modified. Call transcripts. Sent messages. Completed transactions. These accumulate, and you'll want to search across them over time. Sync into Supabase.
- **Ever-changing:** data revised in place. SOPs. Current pipeline records. Today's calendar. Stale copies are misleading. Query Live at question time.
- **Both:** services that hold both patterns. Slack: messages are append-only; channel status is ever-changing. Airtable: activity history append-only; current record state ever-changing. Dual treatment — sync the append-only parts for historical corpus, keep Live for current state.

---

## Adding a new service

When a founder lists a service not in this table, `/build-context` asks one plain-English question (three options A/B/C) to classify it. No jargon shown to the founder. Whatever answer they give gets written to `integrations.md` Data Pattern column.

If you're a developer extending this Blueprint and want to add permanent known-service entries, add rows above. Both `/build-context` and `/connect-data` read this file at runtime.
