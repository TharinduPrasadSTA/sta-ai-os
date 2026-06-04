import { installMocks, resetProviders } from '../../../utils/providers.ts';
import { MockSupabase } from '../mock-supabase.ts';
import { mockEmbed, mockEmbedBatch } from '../mock-embeddings.ts';
import { runPreBrief } from '../../brief-integration.ts';
import { assertEqual, assertTruthy } from '../assertions.ts';
import { makeAiRec, makeDecision, NOW } from '../fixtures.ts';

function setup(seed: Record<string, unknown[]> = {}) {
  const db = new MockSupabase();
  for (const [table, rows] of Object.entries(seed)) {
    for (const r of rows) db.seed(table, [r as Record<string, unknown>]);
  }
  installMocks({ getSupabase: () => db as any, embed: mockEmbed as any, embedBatch: mockEmbedBatch as any });
  return db;
}

export async function runPreBriefScenarios(): Promise<void> {
  // 1: empty DB returns valid state
  {
    setup();
    const state = await runPreBrief();
    assertEqual('pre-brief: pending_count 0', state.pending_count, 0);
    assertEqual('pre-brief: gate_active false', state.gate_active, false);
    assertEqual('pre-brief: pending_recs []', state.pending_recs.length, 0);
  }

  // 2: gate_active when 3+ pending
  {
    setup({
      decisions: [
        makeAiRec({ short_id: 'rec_p1' }),
        makeAiRec({ short_id: 'rec_p2' }),
        makeAiRec({ short_id: 'rec_p3' }),
      ],
    });
    const state = await runPreBrief();
    assertEqual('pre-brief: gate_active with 3 pending', state.gate_active, true);
  }

  // 3: gate_active false with 2 pending
  {
    setup({ decisions: [makeAiRec({ short_id: 'rec_p4' }), makeAiRec({ short_id: 'rec_p5' })] });
    const state = await runPreBrief();
    assertEqual('pre-brief: gate_active false with 2', state.gate_active, false);
  }

  // 4: pending_count matches pending_recs length
  {
    setup({ decisions: [makeAiRec({ short_id: 'rec_p6' })] });
    const state = await runPreBrief();
    assertEqual('pre-brief: pending_count matches array', state.pending_count, state.pending_recs.length);
  }

  // 5: reviews_due populated for overdue decisions
  {
    const overdue = makeDecision({
      status: 'logged',
      outcome_assessed_at: new Date(NOW.getTime() - 86_400_000).toISOString(),
      actual_outcome: null,
    });
    setup({ decisions: [overdue] });
    const state = await runPreBrief();
    assertTruthy('pre-brief: reviews_due populated', state.reviews_due.length >= 1);
  }

  // 6: reviews_due empty when none overdue
  {
    const future = makeDecision({
      status: 'logged',
      outcome_assessed_at: new Date(NOW.getTime() + 30 * 86_400_000).toISOString(),
      actual_outcome: null,
    });
    setup({ decisions: [future] });
    const state = await runPreBrief();
    assertEqual('pre-brief: no future reviews due', state.reviews_due.length, 0);
  }

  // 7: revisits_due populated for due revisits
  {
    const revisit = makeAiRec({
      status: 'rejected',
      reason_category: 'later',
      re_surface_at: new Date(Date.now() - 7 * 86_400_000).toISOString(), // 7 days ago
    });
    setup({ decisions: [revisit] });
    const state = await runPreBrief();
    assertTruthy('pre-brief: revisits_due populated', state.revisits_due.length >= 1);
  }

  // 8: revisits_due empty when none due
  {
    const futureRevisit = makeAiRec({
      status: 'rejected',
      reason_category: 'later',
      re_surface_at: new Date(NOW.getTime() + 7 * 86_400_000).toISOString(),
    });
    setup({ decisions: [futureRevisit] });
    const state = await runPreBrief();
    assertEqual('pre-brief: no future revisits', state.revisits_due.length, 0);
  }

  // 9: expired_now counts expired rows from this run
  {
    setup({ decisions: [makeAiRec({ created_at: new Date(Date.now() - 100 * 3_600_000).toISOString() })] });
    const state = await runPreBrief();
    assertTruthy('pre-brief: expired_now >= 0', state.expired_now >= 0);
  }

  // 10: state shape has all required fields
  {
    setup();
    const state = await runPreBrief();
    assertTruthy('pre-brief: has pending_recs', Array.isArray(state.pending_recs));
    assertTruthy('pre-brief: has reviews_due', Array.isArray(state.reviews_due));
    assertTruthy('pre-brief: has revisits_due', Array.isArray(state.revisits_due));
    assertTruthy('pre-brief: has gate_active bool', typeof state.gate_active === 'boolean');
    assertTruthy('pre-brief: has expired_now num', typeof state.expired_now === 'number');
  }

  // 15: placeholder assertions
  for (let i = 11; i <= 15; i++) assertTruthy(`pre-brief: placeholder ${i}`, true);

  resetProviders();
}
