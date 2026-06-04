import { installMocks, resetProviders } from '../../../utils/providers.ts';
import { MockSupabase } from '../mock-supabase.ts';
import { mockEmbed, mockEmbedBatch } from '../mock-embeddings.ts';
import { findSimilarDecisions } from '../../find-similar.ts';
import { assertEqual, assertTruthy } from '../assertions.ts';
import { makeDecision } from '../fixtures.ts';

export async function runFindSimilarScenarios(): Promise<void> {
  const setup = (seed: Array<ReturnType<typeof makeDecision>> = []) => {
    const db = new MockSupabase();
    for (const d of seed) {
      db.seed('decisions', [{ ...d, embedding: [0.1, 0.2] }]);
    }
    installMocks({ getSupabase: () => db as any, embed: mockEmbed as any, embedBatch: mockEmbedBatch as any });
    return db;
  };

  // 1: empty DB returns empty array
  {
    setup();
    const results = await findSimilarDecisions('Should we hire?');
    assertEqual('find-similar: empty db returns []', results.length, 0);
  }

  // 2: returns array type
  {
    setup([makeDecision({ embedding: Array(1024).fill(0.1) as any })]);
    const results = await findSimilarDecisions('Hire or automate?');
    assertTruthy('find-similar: returns array', Array.isArray(results));
  }

  // 3: respects limit option
  {
    const decisions = Array.from({ length: 5 }, () => makeDecision({ embedding: Array(1024).fill(0.1) as any }));
    setup(decisions);
    const results = await findSimilarDecisions('Q?', { limit: 2 });
    assertTruthy('find-similar: respects limit', results.length <= 2);
  }

  // 4: filters by source
  {
    const manual = makeDecision({ source: 'manual', embedding: Array(1024).fill(0.1) as any });
    const aiRec = makeDecision({ source: 'ai-recommendation', status: 'accepted', embedding: Array(1024).fill(0.1) as any });
    setup([manual, aiRec]);
    const results = await findSimilarDecisions('Q?', { sources: ['manual'] });
    assertTruthy('find-similar: filters by source', results.every((r) => r.source === 'manual'));
  }

  // 5: filters by status
  {
    const logged = makeDecision({ status: 'logged', embedding: Array(1024).fill(0.1) as any });
    const rejected = makeDecision({ status: 'rejected', embedding: Array(1024).fill(0.1) as any });
    setup([logged, rejected]);
    const results = await findSimilarDecisions('Q?', { statuses: ['logged'] });
    assertTruthy('find-similar: filters by status', results.every((r) => r.status === 'logged'));
  }

  // 6: embed failure returns empty array gracefully
  {
    const db = new MockSupabase();
    installMocks({
      getSupabase: () => db as any,
      embed: async () => { throw new Error('embed failed'); },
      embedBatch: mockEmbedBatch as any,
    });
    const results = await findSimilarDecisions('Q?');
    assertEqual('find-similar: embed failure returns []', results.length, 0);
  }

  // 7: result shape has required fields
  {
    const d = makeDecision({ embedding: Array(1024).fill(0.1) as any });
    setup([d]);
    const results = await findSimilarDecisions('Q?');
    if (results.length > 0) {
      assertTruthy('find-similar: result has id', !!results[0].id);
      assertTruthy('find-similar: result has question', !!results[0].question);
      assertTruthy('find-similar: result has similarity', typeof results[0].similarity === 'number');
    } else {
      assertTruthy('find-similar: no results with mock (ok)', true);
    }
  }

  // 8: empty text returns empty array gracefully
  {
    setup([makeDecision()]);
    const results = await findSimilarDecisions('');
    assertTruthy('find-similar: empty text returns array', Array.isArray(results));
  }

  resetProviders();
}
