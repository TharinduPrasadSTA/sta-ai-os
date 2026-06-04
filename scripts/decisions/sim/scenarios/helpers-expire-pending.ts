import { installMocks, resetProviders } from '../../../utils/providers.ts';
import { MockSupabase } from '../mock-supabase.ts';
import { mockEmbed, mockEmbedBatch } from '../mock-embeddings.ts';
import { expirePending } from '../../expire-pending.ts';
import { assertEqual, assertTruthy } from '../assertions.ts';
import { makeAiRec } from '../fixtures.ts';

function setup(recs: ReturnType<typeof makeAiRec>[] = []) {
  const db = new MockSupabase();
  for (const r of recs) db.seed('decisions', [r as any]);
  installMocks({ getSupabase: () => db as any, embed: mockEmbed as any, embedBatch: mockEmbedBatch as any });
  return db;
}

function old(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000 - 1000).toISOString();
}

export async function runExpirePendingScenarios(): Promise<void> {
  // 1: empty DB returns expired=0
  {
    setup([]);
    const result = await expirePending();
    assertEqual('expire: empty db → 0', result.expired, 0);
  }

  // 2: pending rec older than 72h gets expired
  {
    const db = setup([makeAiRec({ created_at: old(73) })]);
    const result = await expirePending();
    assertTruthy('expire: old pending expired', result.expired >= 1);
    const rows = db.getRows('decisions');
    assertTruthy('expire: status is expired', rows.some((r) => r.status === 'expired'));
  }

  // 3: pending rec newer than 72h is NOT expired
  {
    const db = setup([makeAiRec({ created_at: new Date().toISOString() })]);
    await expirePending();
    const rows = db.getRows('decisions');
    assertEqual('expire: new pending not expired', rows[0].status, 'pending');
  }

  // 4: accepted rec is NOT expired
  {
    const db = setup([makeAiRec({ status: 'accepted', created_at: old(100) })]);
    await expirePending();
    const rows = db.getRows('decisions');
    assertEqual('expire: accepted not expired', rows[0].status, 'accepted');
  }

  // 5: rejected rec is NOT expired
  {
    const db = setup([makeAiRec({ status: 'rejected', reason_category: 'disagree', created_at: old(100) })]);
    await expirePending();
    const rows = db.getRows('decisions');
    assertEqual('expire: rejected not expired', rows[0].status, 'rejected');
  }

  // 6: manual decision is NOT expired
  {
    const db = setup([{ ...makeAiRec({ created_at: old(100) }), source: 'manual', status: 'logged' } as any]);
    await expirePending();
    const rows = db.getRows('decisions');
    assertEqual('expire: manual not expired', rows[0].status, 'logged');
  }

  // 7: returns correct count
  {
    const db = setup([
      makeAiRec({ created_at: old(80) }),
      makeAiRec({ created_at: old(90) }),
      makeAiRec({ created_at: new Date().toISOString() }),
    ]);
    const result = await expirePending();
    assertEqual('expire: count = 2', result.expired, 2);
  }

  // 8: result shape has expired property
  {
    setup([]);
    const result = await expirePending();
    assertTruthy('expire: result has expired prop', 'expired' in result);
  }

  resetProviders();
}
