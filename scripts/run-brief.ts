import Anthropic from '@anthropic-ai/sdk';
import { supabase } from './utils/db.ts';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  runPreBrief,
  buildSection7PromptFragment,
  postProcessBrief,
  renderSection7Gated,
  renderReviewsDueBlock,
  renderRevisitBlock,
  markRevisitsSurfaced,
  renderSection8,
  buildEveningRecap,
  type PreBriefState,
} from './decisions/index.ts';

const modeArg = process.argv.find((a) => a.startsWith('--mode='))?.split('=')[1];
const mode: 'morning' | 'evening' = modeArg === 'evening' ? 'evening' : 'morning';
const noSend = process.argv.includes('--no-send');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Context ─────────────────────────────────────────────────────────────────

function readCtx(file: string): string {
  return readFileSync(join(ROOT, 'context', file), 'utf-8');
}

// ── Data fetching ────────────────────────────────────────────────────────────

async function fetchOpportunities() {
  const { data, error } = await supabase
    .from('ghl_opportunities')
    .select('status, monetary_value, created_at, updated_at, _synced_at');
  if (error) throw error;
  return data ?? [];
}

async function fetchContactSources() {
  const { data, error } = await supabase
    .from('ghl_contacts')
    .select('source, created_at')
    .not('source', 'is', null);
  if (error) throw error;
  return data ?? [];
}

async function fetchRecentTaskActivity() {
  const cutoff = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from('clickup_tasks')
    .select('name, status, space_name, list_name, updated_at, assignees, due_date')
    .gt('updated_at', cutoff)
    .order('updated_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []).filter(
    (t) => !['complete', 'cancelled', 'not applicable', 'meeting recaps',
             'meeting updates', 'meeting report', 'project updates',
             'project update', 'project status', 'update required'].includes(t.status ?? '')
  );
}

async function fetchAllActiveTasks() {
  const { data, error } = await supabase
    .from('clickup_tasks')
    .select('space_name, status, due_date, updated_at, name');
  if (error) throw error;
  return data ?? [];
}

async function fetchRecentEmails() {
  const cutoff = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from('outlook_emails')
    .select('subject, from_name, from_address, received_at, is_read')
    .gt('received_at', cutoff)
    .order('received_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

async function fetchSyncState() {
  const { data } = await supabase.from('sync_state').select('service, last_synced_at');
  return data ?? [];
}

// ── Aggregation ──────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}

function aggregateOpportunities(opps: Awaited<ReturnType<typeof fetchOpportunities>>) {
  const now = new Date();
  const d30 = daysAgo(30);
  const d7 = daysAgo(7);

  const open = opps.filter((o) => o.status === 'open');
  const won  = opps.filter((o) => o.status === 'won');
  const lost = opps.filter((o) => o.status === 'abandoned');
  const withValue = open.filter((o) => (o.monetary_value ?? 0) > 0);

  return {
    openCount: open.length,
    wonCount:  won.length,
    lostCount: lost.length,
    openPipelineValue: open.reduce((s, o) => s + (o.monetary_value ?? 0), 0),
    oppsWithValue: withValue.length,
    oppsWithoutValue: open.length - withValue.length,
    avgValuedOpp: withValue.length
      ? withValue.reduce((s, o) => s + (o.monetary_value ?? 0), 0) / withValue.length
      : 0,
    newLast30d: opps.filter((o) => new Date(o.created_at!) > d30).length,
    newLast7d:  opps.filter((o) => new Date(o.created_at!) > d7).length,
    movedLast7d: open.filter((o) => new Date(o.updated_at!) > d7).length,
    lastSynced: opps.reduce((max, o) => (o._synced_at! > max ? o._synced_at! : max), ''),
  };
}

function aggregateContactSources(contacts: Awaited<ReturnType<typeof fetchContactSources>>) {
  const d30 = daysAgo(30);
  const d60 = daysAgo(60);

  const map: Record<string, { total: number; last30d: number; prior30d: number }> = {};
  for (const c of contacts) {
    const src = c.source ?? 'Unknown';
    if (!map[src]) map[src] = { total: 0, last30d: 0, prior30d: 0 };
    map[src].total++;
    const created = new Date(c.created_at!);
    if (created > d30) map[src].last30d++;
    else if (created > d60) map[src].prior30d++;
  }

  return Object.entries(map)
    .sort((a, b) => b[1].last30d - a[1].last30d || b[1].total - a[1].total)
    .slice(0, 10)
    .map(([source, counts]) => ({ source, ...counts }));
}

function aggregateTasksBySpace(tasks: Awaited<ReturnType<typeof fetchAllActiveTasks>>) {
  // AI Employees Sales & Partners is a sales CRM tracking space, not delivery
  const salesSpaces = new Set(['AI Employees Sales & Partners']);
  const now = new Date();
  const d7 = daysAgo(7);

  const map: Record<string, { inProgress: number; toDo: number; overdue: number; movedThisWeek: number }> = {};

  for (const t of tasks) {
    if (!t.space_name || salesSpaces.has(t.space_name)) continue;
    if (['complete', 'cancelled', 'not applicable'].includes(t.status ?? '')) continue;

    const sp = t.space_name;
    if (!map[sp]) map[sp] = { inProgress: 0, toDo: 0, overdue: 0, movedThisWeek: 0 };

    if (t.status === 'in progress') map[sp].inProgress++;
    if (t.status === 'to do') map[sp].toDo++;
    if (t.due_date && new Date(t.due_date) < now) map[sp].overdue++;
    if (new Date(t.updated_at!) > d7) map[sp].movedThisWeek++;
  }

  return Object.entries(map)
    .sort((a, b) => b[1].inProgress - a[1].inProgress || b[1].overdue - a[1].overdue)
    .map(([space, counts]) => ({ space, ...counts }));
}

// ── Prompt data blocks ────────────────────────────────────────────────────────

function formatS1(o: ReturnType<typeof aggregateOpportunities>): string {
  return [
    `Open pipeline: ${o.openCount} opportunities | Total stated value: $${o.openPipelineValue.toLocaleString()}`,
    `  - ${o.oppsWithValue} of ${o.openCount} opps have a monetary value assigned (avg $${Math.round(o.avgValuedOpp).toLocaleString()})`,
    `  - ${o.oppsWithoutValue} opps have $0 — pipeline value is understated`,
    `New this week: ${o.newLast7d} opps | New this month: ${o.newLast30d} opps`,
    `Pipeline movement: ${o.movedLast7d} open opps updated in the last 7 days (velocity signal)`,
    `Won: ${o.wonCount} | Abandoned: ${o.lostCount}`,
    `NOTE: GHL pipeline stage names are null (API sync gap). Status-based only.`,
    `NOTE: MRR (~$25K/month) is from context file — no billing system is connected.`,
  ].join('\n');
}

function formatS2(
  sources: ReturnType<typeof aggregateContactSources>,
  o: ReturnType<typeof aggregateOpportunities>
): string {
  const rows = sources
    .map((s) => {
      const trend = s.prior30d > 0 ? ((s.last30d - s.prior30d) / s.prior30d * 100).toFixed(0) : 'n/a';
      const trendStr = s.prior30d > 0 ? ` (${Number(trend) >= 0 ? '+' : ''}${trend}% vs prior 30d)` : '';
      return `  - ${s.source}: ${s.last30d} new${trendStr} | ${s.total} total`;
    })
    .join('\n');

  return [
    `Lead source breakdown (last 30d vs prior 30d):`,
    rows,
    ``,
    `Opportunity creation rate: ${o.newLast30d} new opps in 30 days (${o.newLast7d} this week)`,
    `Pipeline velocity: ${o.movedLast7d} opps moved in last 7 days out of ${o.openCount} open`,
  ].join('\n');
}

function formatS3(
  tasks: Awaited<ReturnType<typeof fetchRecentTaskActivity>>,
  emails: Awaited<ReturnType<typeof fetchRecentEmails>>
): string {
  const taskLines = tasks.length
    ? tasks.slice(0, 15).map((t) =>
        `  - [${t.space_name ?? 'General'}] "${t.name}" → ${t.status} (${new Date(t.updated_at!).toLocaleDateString('en-GB')})`
      ).join('\n')
    : '  - No task activity in last 48 hours';

  const emailLines = emails.length
    ? emails.map((e) =>
        `  - ${e.from_name ?? e.from_address}: "${e.subject}"${e.is_read ? '' : ' [UNREAD]'}`
      ).join('\n')
    : '  - No emails in last 48 hours';

  return [
    `Tasks updated (last 48h):`,
    taskLines,
    ``,
    `Emails received (last 48h):`,
    emailLines,
  ].join('\n');
}

function formatS4(
  tasksBySpace: ReturnType<typeof aggregateTasksBySpace>,
  emails: Awaited<ReturnType<typeof fetchRecentEmails>>
): string {
  const spaceLines = tasksBySpace
    .map((s) => {
      const overdueFlag = s.overdue > 0 ? ` ⚠️ ${s.overdue} OVERDUE` : '';
      return `  - ${s.space}: ${s.inProgress} in-progress, ${s.toDo} to-do${overdueFlag}, ${s.movedThisWeek} moved this week`;
    })
    .join('\n');

  const tier1 = [
    { name: 'Dimitry Ortiz (PM)', keywords: ['dimitry'] },
    { name: 'Stanley Motinda (GHL Mgr)', keywords: ['stanley'] },
    { name: 'Pamuditha (Dev)', keywords: ['pamuditha'] },
    { name: 'Wilton Rogers (CEO)', keywords: ['wilton'] },
  ];

  const contactLines = tier1.map(({ name, keywords }) => {
    const matches = emails.filter((e) =>
      keywords.some((k) =>
        (e.from_name ?? '').toLowerCase().includes(k) ||
        (e.from_address ?? '').toLowerCase().includes(k)
      )
    );
    return `  - ${name}: ${matches.length > 0 ? `${matches.length} email(s) in last 48h` : 'no recent email (verify not > 3 days)'
    }`;
  }).join('\n');

  return [
    `Client delivery workload by space:`,
    spaceLines || '  - No active tasks found',
    ``,
    `Tier 1 contact activity (last 48h from email):`,
    contactLines,
  ].join('\n');
}

// ── Teams delivery ────────────────────────────────────────────────────────────

async function postToTeams(webhookUrl: string, title: string, body: string): Promise<void> {
  const payload = {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    themeColor: '0078D7',
    summary: title,
    sections: [
      {
        activityTitle: `**${title}**`,
        text: body
          .replace(/^#+\s*/gm, '**')     // convert markdown headers to bold
          .replace(/\*\*/g, (m, i, s) => {  // close opened bolds
            return m;
          })
          .slice(0, 4000),               // Teams card text limit
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Teams POST failed ${res.status}: ${text}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function runMorning(): Promise<void> {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const dayName = today.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  console.log(`Generating Daily Brief for ${dateStr}...`);

  // Load context files
  const context = [
    readCtx('personal-info.md'),
    readCtx('companies.md'),
    readCtx('strategy.md'),
    readCtx('team.md'),
    readCtx('current-data.md'),
  ].join('\n\n---\n\n');

  // Fetch all data in parallel
  const [oppsRaw, contactsRaw, recentTasks, allTasks, recentEmails, syncState] =
    await Promise.all([
      fetchOpportunities(),
      fetchContactSources(),
      fetchRecentTaskActivity(),
      fetchAllActiveTasks(),
      fetchRecentEmails(),
      fetchSyncState(),
    ]);

  // Aggregate
  const opps       = aggregateOpportunities(oppsRaw);
  const sources    = aggregateContactSources(contactsRaw);
  const bySpace    = aggregateTasksBySpace(allTasks);

  // Staleness check (warn if sync > 36 hours old)
  const staleWarnings = (syncState as Array<{ service: string; last_synced_at: string }>)
    .filter(({ last_synced_at: at }) => at && Date.now() - new Date(at).getTime() > 36 * 3600_000)
    .map(({ service }) => service);

  const dataSection = `
## Section 1 — Revenue and Cash Position
${formatS1(opps)}

## Section 2 — Growth Signals
${formatS2(sources, opps)}

## Section 3 — Yesterday's Activity
${formatS3(recentTasks, recentEmails)}

## Section 4 — Team and Client Pulse
${formatS4(bySpace, recentEmails)}

${staleWarnings.length ? `⚠️ STALE DATA: ${staleWarnings.join(', ')} sync is >36h old — data may not reflect today.` : ''}
`.trim();

  // Decision Engine — pre-brief state
  let preBrief: PreBriefState | null = null;
  try { preBrief = await runPreBrief(); } catch (err) { console.warn('pre-brief failed (non-fatal):', err); }
  const section7Fragment = preBrief ? buildSection7PromptFragment(preBrief) : '';

  // Build and call Claude
  const anthropic = new Anthropic();

  console.log('Calling Claude claude-opus-4-7...');

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 2048,
    system: [
      {
        type: 'text',
        text: `You are Tharindu's AI Operating System, generating his daily intelligence brief for Scale Through Automation (STA).

Write the way Tharindu thinks: direct, action-first, no filler, structured only when it improves clarity.
Surface what matters today and what signals risk in 2–3 weeks — not everything.
Prioritise leverage over volume. Show rates over raw counts.
End every section with exactly one line: **Implication:** [one sentence on what this means for today].
Keep the full brief under 800 words. Every sentence earns its place.

Business context:`,
        cache_control: { type: 'ephemeral' },
      },
      {
        type: 'text',
        text: context,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Today is ${dayName}. Generate the Daily Brief from the data below.

Lead each section with the most important insight. Map upstream signals to downstream risks in 2–3 weeks.
End each section with **Implication:** — one sentence, what this means for today.
Close with a **Data Gaps** section: what's missing that would improve the next version.

${dataSection}

---
Do not include a top-level # heading. Start directly with ## 1.

Sections:
1. Revenue and Cash Position
2. Growth Signals (leads, pipeline trends)
3. Yesterday's Decisions and Actions
4. Team and Client Pulse (workload concentration, relationship health)
5. SWOT — daily, specific, data-backed
6. Today's Focus: 3–5 priorities ranked by leverage
${section7Fragment}`,
      },
    ],
  });

  let briefBody = response.content[0].type === 'text' ? response.content[0].text : '';
  const title = `Daily Brief — ${dayName}`;
  const usage = response.usage as { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number };

  console.log(
    `Tokens: ${usage.input_tokens} input (${usage.cache_read_input_tokens ?? 0} cached), ${usage.output_tokens} output`
  );

  // Decision Engine — post-process (inject rec ids, suppress/boost)
  if (preBrief) {
    try {
      if (!preBrief.gate_active) {
        const { brief: processed } = await postProcessBrief(briefBody, 'daily-brief');
        briefBody = processed;
      } else {
        briefBody = briefBody + '\n' + renderSection7Gated(preBrief);
      }
      const reviews = renderReviewsDueBlock(preBrief);
      const revisits = renderRevisitBlock(preBrief);
      if (reviews) briefBody += '\n' + reviews;
      if (revisits) briefBody += '\n' + revisits;
      if (preBrief.revisits_due.length > 0) await markRevisitsSurfaced(preBrief);
    } catch (err) { console.warn('Decision Engine post-process failed (non-fatal):', err); }

    try {
      const section8 = await renderSection8(new Date());
      if (section8) briefBody += '\n' + section8;
    } catch (err) { console.warn('Section 8 render failed (non-fatal):', err); }
  }

  // Write to file
  const outputDir = join(ROOT, 'outputs', 'briefs');
  mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, `${dateStr}.md`);
  const fullBrief = `# ${title}\n_${new Date().toUTCString()} · claude-opus-4-7_\n\n${briefBody}`;
  writeFileSync(outputPath, fullBrief, 'utf-8');
  console.log(`Brief written → outputs/briefs/${dateStr}.md`);

  // Teams delivery (optional — set TEAMS_WEBHOOK_URL to enable)
  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await postToTeams(webhookUrl, title, briefBody);
      console.log('Brief posted to Teams.');
    } catch (err) {
      console.warn('Teams delivery failed (brief still saved to file):', (err as Error).message);
    }
  }
} // end runMorning

async function runEvening(): Promise<void> {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  console.log(`Generating Evening Recap for ${dateStr}...`);

  const recap = await buildEveningRecap();
  const outputDir = join(ROOT, 'outputs', 'briefs');
  mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, `${dateStr}-evening.md`);
  writeFileSync(outputPath, `# Evening Recap — ${dateStr}\n_${new Date().toUTCString()}_\n\n${recap}`, 'utf-8');
  console.log(`Evening recap written → outputs/briefs/${dateStr}-evening.md`);
  console.log(recap);

  if (!noSend) {
    const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await postToTeams(webhookUrl, `Evening Recap — ${dateStr}`, recap);
        console.log('Evening recap posted to Teams.');
      } catch (err) {
        console.warn('Teams delivery failed (recap still saved to file):', (err as Error).message);
      }
    }
  }
}

async function main() {
  if (mode === 'evening') { await runEvening(); return; }
  await runMorning();
}

main().catch((err) => {
  console.error('Brief generation failed:', err);
  process.exit(1);
});
