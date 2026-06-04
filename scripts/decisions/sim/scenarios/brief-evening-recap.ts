import { installMocks, resetProviders } from '../../../utils/providers.ts';
import { MockSupabase } from '../mock-supabase.ts';
import { mockEmbed, mockEmbedBatch } from '../mock-embeddings.ts';
import { buildEveningRecap } from '../../brief-integration.ts';
import { assertEqual, assertTruthy, assertContains } from '../assertions.ts';
import { makeAiRec } from '../fixtures.ts';

function setup(recs: ReturnType<typeof makeAiRec>[] = []) {
  const db = new MockSupabase();
  for (const r of recs) db.seed('decisions', [r as any]);
  installMocks({ getSupabase: () => db as any, embed: mockEmbed as any, embedBatch: mockEmbedBatch as any });
  return db;
}

export async function runEveningRecapScenarios(): Promise<void> {
  // 1: no pending → clean slate message
  {
    setup([]);
    const recap = await buildEveningRecap();
    assertContains('evening: no pending → clean slate', recap, 'Clean slate');
  }

  // 2: with pending → contains ## Evening Recap
  {
    setup([makeAiRec({ short_id: 'rec_eve1', created_at: new Date().toISOString() })]);
    const recap = await buildEveningRecap();
    assertContains('evening: pending shows heading', recap, 'Evening Recap');
  }

  // 3: contains rec short_id
  {
    setup([makeAiRec({ short_id: 'rec_eve2', created_at: new Date().toISOString() })]);
    const recap = await buildEveningRecap();
    assertContains('evening: contains short_id', recap, 'rec_eve2');
  }

  // 4: contains accept/reject instructions
  {
    setup([makeAiRec({ short_id: 'rec_eve3', created_at: new Date().toISOString() })]);
    const recap = await buildEveningRecap();
    assertContains('evening: contains /decide', recap, '/decide');
  }

  // 5: returns string
  {
    setup([]);
    const recap = await buildEveningRecap();
    assertTruthy('evening: returns string', typeof recap === 'string');
  }

  // 6: multiple pending shows count
  {
    setup([
      makeAiRec({ short_id: 'rec_eve4', created_at: new Date().toISOString() }),
      makeAiRec({ short_id: 'rec_eve5', created_at: new Date().toISOString() }),
    ]);
    const recap = await buildEveningRecap();
    assertContains('evening: multiple pending in output', recap, 'rec_eve4');
  }

  // 7: only today's recs shown (old ones excluded)
  {
    setup([makeAiRec({ short_id: 'rec_old1', created_at: new Date(Date.now() - 2 * 86_400_000).toISOString() })]);
    const recap = await buildEveningRecap();
    assertContains('evening: old pending → clean slate', recap, 'Clean slate');
  }

  resetProviders();
}
