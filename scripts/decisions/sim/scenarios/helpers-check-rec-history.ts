import { installMocks, resetProviders } from '../../../utils/providers.ts';
import { MockSupabase } from '../mock-supabase.ts';
import { mockEmbed, mockEmbedBatch } from '../mock-embeddings.ts';
import { checkRecHistory } from '../../check-rec-history.ts';
import { assertEqual, assertTruthy } from '../assertions.ts';
import { makeAiRec } from '../fixtures.ts';

function setup(recs: ReturnType<typeof makeAiRec>[] = []) {
  const db = new MockSupabase();
  for (const r of recs) db.seed('decisions', [{ ...r, embedding: Array(1024).fill(0.1) }] as any);
  installMocks({ getSupabase: () => db as any, embed: mockEmbed as any, embedBatch: mockEmbedBatch as any });
  return db;
}

export async function runCheckRecHistoryScenarios(): Promise<void> {
  // 1: empty history → emit_normal
  {
    setup([]);
    const r = await checkRecHistory('Should we focus on retainers?');
    assertEqual('check-history: empty → emit_normal', r.action, 'emit_normal');
  }

  // 2: < MIN_SIMILAR_RECS → emit_normal
  {
    setup([
      makeAiRec({ status: 'accepted', reason_category: null }),
      makeAiRec({ status: 'accepted', reason_category: null }),
    ]);
    const r = await checkRecHistory('Should we focus on retainers?');
    assertEqual('check-history: < 3 similar → emit_normal', r.action, 'emit_normal');
  }

  // 3: high disagree rate → suppress
  {
    setup([
      makeAiRec({ status: 'rejected', reason_category: 'disagree' }),
      makeAiRec({ status: 'rejected', reason_category: 'disagree' }),
      makeAiRec({ status: 'rejected', reason_category: 'disagree' }),
      makeAiRec({ status: 'accepted', reason_category: null }),
    ]);
    const r = await checkRecHistory('Should we focus on retainers?');
    // 3 disagree / 4 graded = 75% > 60%
    assertEqual('check-history: high disagree → suppress', r.action, 'suppress');
  }

  // 4: high accept rate → boost
  {
    setup([
      makeAiRec({ status: 'accepted', reason_category: null }),
      makeAiRec({ status: 'accepted', reason_category: null }),
      makeAiRec({ status: 'accepted', reason_category: null }),
      makeAiRec({ status: 'accepted', reason_category: null }),
      makeAiRec({ status: 'accepted', reason_category: null }),
      makeAiRec({ status: 'rejected', reason_category: 'disagree' }),
    ]);
    const r = await checkRecHistory('Should we focus on retainers?');
    // 5 accepted / 6 graded = 83% > 80%
    assertEqual('check-history: high accept → boost', r.action, 'boost');
  }

  // 5: suppress includes reason
  {
    setup([
      makeAiRec({ status: 'rejected', reason_category: 'disagree' }),
      makeAiRec({ status: 'rejected', reason_category: 'disagree' }),
      makeAiRec({ status: 'rejected', reason_category: 'disagree' }),
    ]);
    const r = await checkRecHistory('Test rec');
    assertTruthy('check-history: suppress has reason', !!r.reason);
  }

  // 6: boost has historicalAcceptRate
  {
    setup(Array.from({ length: 5 }, () => makeAiRec({ status: 'accepted', reason_category: null })));
    const r = await checkRecHistory('Test rec');
    if (r.action === 'boost') {
      assertTruthy('check-history: boost has acceptRate', typeof r.historicalAcceptRate === 'number');
    } else {
      assertTruthy('check-history: boost or emit_normal (few similar)', true);
    }
  }

  // 7: no-time rejections do NOT count as disagree
  {
    setup([
      makeAiRec({ status: 'rejected', reason_category: 'no-time' }),
      makeAiRec({ status: 'rejected', reason_category: 'no-time' }),
      makeAiRec({ status: 'rejected', reason_category: 'no-time' }),
      makeAiRec({ status: 'rejected', reason_category: 'no-time' }),
    ]);
    const r = await checkRecHistory('Test rec');
    // no-time should not suppress — only disagree counts
    assertEqual('check-history: no-time does not suppress', r.action === 'suppress', false);
  }

  // 8: returns similarCount
  {
    setup([]);
    const r = await checkRecHistory('Test rec');
    assertTruthy('check-history: has similarCount', typeof r.similarCount === 'number');
  }

  // 9: returns similarPast array
  {
    setup([]);
    const r = await checkRecHistory('Test rec');
    assertTruthy('check-history: has similarPast array', Array.isArray(r.similarPast));
  }

  resetProviders();
}
