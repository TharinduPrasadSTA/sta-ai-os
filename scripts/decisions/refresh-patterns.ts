import { getSupabase } from '../utils/providers.ts';

const SUCCESS_KEYWORDS = ['success', 'right call', 'worked', 'positive', 'yes'];
const MIN_GROUP_SIZE = 3;

const dryRun = process.argv.includes('--dry-run');

function computeSuccessRate(decisions: Array<{ actual_outcome: string | null }>): number | null {
  const rated = decisions.filter((d) => d.actual_outcome != null);
  if (rated.length === 0) return null;
  const successes = rated.filter((d) =>
    SUCCESS_KEYWORDS.some((kw) => d.actual_outcome!.toLowerCase().includes(kw))
  ).length;
  return successes / rated.length;
}

async function main() {
  console.log(`Running decision pattern rollup${dryRun ? ' (dry run)' : ''}...`);
  const db = getSupabase();

  const { data, error } = await db
    .from('decisions')
    .select('id, company, tags, actual_outcome, status')
    .in('status', ['logged', 'accepted']);

  if (error) throw error;
  const rows = (data ?? []) as Array<{
    id: string;
    company: string | null;
    tags: string[];
    actual_outcome: string | null;
    status: string;
  }>;

  // Group by company + first tag; skip demo-tagged and untagged
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    if (row.tags?.includes('demo')) continue;
    if (!row.tags?.length) continue;
    const key = `${row.company ?? '_'}::${row.tags[0]}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  let upserted = 0;
  for (const [key, group] of groups) {
    if (group.length < MIN_GROUP_SIZE) continue;
    const [company, tag] = key.split('::');
    const patternName = company === '_' ? tag : `${company} — ${tag}`;
    const successRate = computeSuccessRate(group);

    if (dryRun) {
      console.log(`  Would upsert: "${patternName}" — ${group.length} decisions, ${successRate != null ? Math.round(successRate * 100) + '% success' : 'unrated'}`);
      continue;
    }

    const { error: upsertErr } = await db.from('decision_patterns').upsert(
      {
        pattern_name: patternName,
        description: `Auto-clustered from ${group.length} decisions tagged "${tag}"${company !== '_' ? ` for ${company}` : ''}`,
        similar_decisions: group.map((r) => r.id),
        success_rate: successRate,
        total_decisions: group.length,
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'pattern_name' }
    );
    if (upsertErr) console.error(`  Failed to upsert "${patternName}":`, upsertErr.message);
    else upserted++;
  }

  console.log(dryRun ? 'Dry run complete.' : `Pattern rollup complete — ${upserted} pattern(s) upserted.`);
}

main().catch((err) => {
  console.error('Pattern rollup failed:', err);
  process.exit(1);
});
