import { getSupabase } from '../utils/providers.ts';
import { expirePending } from './expire-pending.ts';
import { logDecision } from './log-decision.ts';
import { checkRecHistory } from './check-rec-history.ts';
import { mkdirSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { PendingRec, ReviewRow, RevisitRow } from './types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DEBUG_LOG = join(ROOT, 'outputs', 'briefs', 'debug-log.jsonl');

export interface PreBriefState {
  expired_now: number;
  pending_count: number;
  gate_active: boolean;
  pending_recs: PendingRec[];
  reviews_due: ReviewRow[];
  revisits_due: RevisitRow[];
}

export async function runPreBrief(): Promise<PreBriefState> {
  const { expired } = await expirePending();
  const db = getSupabase();

  const [pendingRes, reviewsRes, revisitsRes] = await Promise.all([
    db
      .from('decisions')
      .select('id, short_id, question, rationale, created_at, module')
      .eq('source', 'ai-recommendation')
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
    db
      .from('decisions')
      .select('id, short_id, question, chosen, expected_outcome, outcome_assessed_at')
      .lte('outcome_assessed_at', new Date().toISOString())
      .is('actual_outcome', null)
      .in('status', ['logged', 'accepted'])
      .limit(5),
    db
      .from('decisions')
      .select('id, short_id, question, chosen, re_surface_at')
      .eq('source', 'ai-recommendation')
      .eq('status', 'rejected')
      .eq('reason_category', 'later')
      .lte('re_surface_at', new Date().toISOString())
      .limit(5),
  ]);

  const pending_recs = (pendingRes.data ?? []) as PendingRec[];
  const reviews_due = (reviewsRes.data ?? []) as ReviewRow[];
  const revisits_due = (revisitsRes.data ?? []) as RevisitRow[];

  return {
    expired_now: expired,
    pending_count: pending_recs.length,
    gate_active: pending_recs.length >= 3,
    pending_recs,
    reviews_due,
    revisits_due,
  };
}

export function buildSection7PromptFragment(state: PreBriefState): string {
  if (state.gate_active) return '';
  return `

---

## Section 7 Instructions
Based on the full brief context above, emit 0–3 specific, actionable recommendations for today.
Rules:
- Each rec starts with the literal prefix [REC] on its own line
- Bold the recommendation text: [REC] **<recommendation>** <rationale>
- If no recs are warranted, emit exactly one line: [REC] (none)
- Maximum 3 recs. Be specific to the data you just analysed.
- Recs should be things Tharindu can act on today, not generic advice.`;
}

export interface PostProcessResult {
  brief: string;
  emitted: string[];
  suppressed: string[];
}

export async function postProcessBrief(
  brief: string,
  module?: string
): Promise<PostProcessResult> {
  const lines = brief.split('\n');
  const outputLines: string[] = [];
  const emitted: string[] = [];
  const suppressed: string[] = [];

  for (const line of lines) {
    if (!line.trimStart().startsWith('[REC]')) {
      outputLines.push(line);
      continue;
    }

    const recLine = line.trimStart().slice('[REC]'.length).trim();

    if (recLine === '(none)') continue; // strip silently

    // Parse: **rec text** rationale
    const boldMatch = recLine.match(/^\*\*(.+?)\*\*\s*(.*)?$/);
    const recText = boldMatch ? boldMatch[1].trim() : recLine;
    const rationale = boldMatch ? (boldMatch[2] ?? '').trim() : '';

    const issueSignature = recText.toLowerCase().slice(0, 80).replace(/\s+/g, ' ');

    const history = await checkRecHistory(recText).catch(() => ({
      action: 'emit_normal' as const,
      similarCount: 0,
      acceptCount: 0,
      disagreeCount: 0,
      similarPast: [],
    }));

    if (history.action === 'suppress') {
      suppressed.push(recText);
      try {
        mkdirSync(join(ROOT, 'outputs', 'briefs'), { recursive: true });
        appendFileSync(
          DEBUG_LOG,
          JSON.stringify({ ts: new Date().toISOString(), suppressed: recText, reason: history.reason }) + '\n'
        );
      } catch { /* non-fatal */ }
      continue;
    }

    const { id, short_id } = await logDecision({
      question: recText,
      rationale,
      source: 'ai-recommendation',
      status: 'pending',
      module,
      issue_signature: issueSignature,
    });

    let prefix = `[${short_id ?? id}]`;
    if (history.action === 'boost' && history.historicalAcceptRate != null) {
      prefix = `[${short_id ?? id}, boosted: ${Math.round(history.historicalAcceptRate * 100)}% on ${history.similarCount} similar past]`;
    }

    outputLines.push(`${prefix} **${recText}** ${rationale}`.trimEnd());
    emitted.push(short_id ?? id);
  }

  return { brief: outputLines.join('\n'), emitted, suppressed };
}

export function renderSection7Gated(state: PreBriefState): string {
  const recList = state.pending_recs
    .map((r) => {
      const age = Math.round((Date.now() - new Date(r.created_at).getTime()) / 3_600_000);
      return `- \`${r.short_id ?? r.id}\` — ${r.question} _(${age}h ago)_`;
    })
    .join('\n');
  return `\n## 7. Today's Recommendations\n\n_${state.pending_count} pending recs — clear these before new ones are issued._\n\n${recList}\n\nUse \`/decide accept rec_xxxxxx\` or \`/decide reject rec_xxxxxx <category>\` to respond.`;
}

export function renderReviewsDueBlock(state: PreBriefState): string {
  if (state.reviews_due.length === 0) return '';
  const rows = state.reviews_due
    .map((r) => `- \`${r.short_id ?? r.id}\` — ${r.question} _(expected: ${r.expected_outcome ?? 'not set'})_`)
    .join('\n');
  return `\n### Decisions Due for Review\n\n${rows}\n\nRun \`/decide review\` to log outcomes.`;
}

export function renderRevisitBlock(state: PreBriefState): string {
  if (state.revisits_due.length === 0) return '';
  const rows = state.revisits_due
    .map((r) => `- \`${r.short_id ?? r.id}\` — ${r.question}`)
    .join('\n');
  return `\n### Revisit (Deferred)\n\n${rows}\n\nThese were deferred earlier. Ready to act now?`;
}

export async function markRevisitsSurfaced(state: PreBriefState): Promise<void> {
  if (state.revisits_due.length === 0) return;
  const db = getSupabase();
  const ids = state.revisits_due.map((r) => r.id);
  await db
    .from('decisions')
    .update({ re_surface_at: null, updated_at: new Date().toISOString() })
    .in('id', ids);
}

export async function renderSection8(briefDate: Date): Promise<string> {
  if (briefDate.getUTCDay() !== 1) return ''; // Monday only (UTC-safe)

  const db = getSupabase();
  const sevenDaysAgo = new Date(briefDate.getTime() - 7 * 86_400_000).toISOString();

  const [activityRes, trailingRes, patternsRes] = await Promise.all([
    db
      .from('decisions')
      .select('source, status, reason_category')
      .gte('created_at', sevenDaysAgo),
    db
      .from('decisions')
      .select('status, reason_category, source')
      .eq('source', 'ai-recommendation')
      .in('status', ['accepted', 'rejected', 'expired'])
      .order('created_at', { ascending: false })
      .limit(50),
    db
      .from('decision_patterns')
      .select('pattern_name, success_rate, total_decisions')
      .order('total_decisions', { ascending: false })
      .limit(5),
  ]);

  const activity = activityRes.data ?? [];
  const trailing = trailingRes.data ?? [];
  const patterns = patternsRes.data ?? [];

  const manualLast7 = activity.filter((r) => r.source === 'manual').length;
  const aiRecLast7 = activity.filter((r) => r.source === 'ai-recommendation').length;

  const accepted = trailing.filter((r) => r.status === 'accepted').length;
  const disagreed = trailing.filter((r) => r.status === 'rejected' && r.reason_category === 'disagree').length;
  const trueRate = accepted + disagreed > 0 ? Math.round((accepted / (accepted + disagreed)) * 100) : null;

  const redundant = trailing.filter((r) => r.reason_category === 'redundant').length;
  const wrongCtx = trailing.filter((r) => r.reason_category === 'wrong-context').length;

  const deferred = trailing.filter((r) => r.reason_category === 'later').length;
  const expired = trailing.filter((r) => r.status === 'expired').length;

  const phase =
    trueRate == null ? 'Inform (not enough data)'
    : trueRate >= 90 ? 'Eligible for Confirm (>90%)'
    : trueRate >= 80 ? 'Eligible for Recommend (>80%)'
    : 'Inform';

  const patternLines = patterns.length
    ? patterns.map((p) => `- ${p.pattern_name}: ${p.total_decisions} decisions, ${p.success_rate != null ? Math.round(Number(p.success_rate) * 100) + '% success' : 'unrated'}`).join('\n')
    : '- No patterns yet (need 50+ decisions across tags)';

  return `
## 8. Weekly Decision Summary

**Activity (last 7 days):** ${manualLast7} manual decisions logged, ${aiRecLast7} AI recs issued

**True acceptance rate (trailing 50):** ${trueRate != null ? `${trueRate}% (${accepted} accepted / ${disagreed} disputed)` : 'Not enough data'}

**Gap signals:**
- Context gaps (redundant): ${redundant} — AI didn't know you'd already done this
- Data gaps (wrong-context): ${wrongCtx} — AI was missing information

**Deferred queue:** ${deferred} recs on hold | ${expired} expired without response

**Autonomy Ladder:** ${phase}

**Top patterns:**
${patternLines}`;
}

export async function buildEveningRecap(): Promise<string> {
  const db = getSupabase();
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { data } = await db
    .from('decisions')
    .select('id, short_id, question, rationale')
    .eq('source', 'ai-recommendation')
    .eq('status', 'pending')
    .gte('created_at', todayStart.toISOString())
    .order('created_at', { ascending: true });

  const pending = data ?? [];

  if (pending.length === 0) {
    return 'No open recs from this morning. Clean slate.';
  }

  const lines = (pending as Array<{ id: string; short_id: string | null; question: string; rationale: string | null }>)
    .map((r) => `- \`${r.short_id ?? r.id}\` — **${r.question}**${r.rationale ? `\n  _${r.rationale}_` : ''}`)
    .join('\n');

  return `## Evening Recap — Pending Recommendations

${pending.length} rec${pending.length > 1 ? 's' : ''} from this morning still open:

${lines}

Reply with:
- \`/decide accept rec_xxxxxx\` to act on it
- \`/decide reject rec_xxxxxx disagree|no-time|redundant|wrong-context|later\` to close it`;
}
