import { installMocks, resetProviders } from '../../../utils/providers.ts';
import { MockSupabase } from '../mock-supabase.ts';
import { mockEmbed, mockEmbedBatch } from '../mock-embeddings.ts';
import { logDecision } from '../../log-decision.ts';
import { assertEqual, assertNotNull, assertTruthy, assertMatch } from '../assertions.ts';

export async function runLogDecisionScenarios(): Promise<void> {
  const setup = () => {
    const db = new MockSupabase();
    installMocks({ getSupabase: () => db as any, embed: mockEmbed as any, embedBatch: mockEmbedBatch as any });
    return db;
  };

  // 1: manual decision inserts row
  {
    const db = setup();
    const result = await logDecision({ question: 'Should we hire?', source: 'manual' });
    assertNotNull('log: returns id', result.id);
    const rows = db.getRows('decisions');
    assertEqual('log: one row inserted', rows.length, 1);
    assertEqual('log: source is manual', rows[0].source, 'manual');
    assertEqual('log: status is logged', rows[0].status, 'logged');
  }

  // 2: manual decision gets outcome_assessed_at 30 days out
  {
    const db = setup();
    await logDecision({ question: 'Price change?', source: 'manual' });
    const row = db.getRows('decisions')[0];
    assertNotNull('log: outcome_assessed_at set for manual', row.outcome_assessed_at);
    const assessed = new Date(row.outcome_assessed_at as string).getTime();
    const expected = Date.now() + 29 * 86_400_000;
    assertTruthy('log: outcome_assessed_at is ~30 days', assessed > expected);
  }

  // 3: AI rec gets short_id
  {
    const db = setup();
    const result = await logDecision({ question: 'Try cold email?', source: 'ai-recommendation', status: 'pending' });
    assertNotNull('log: ai-rec short_id', result.short_id);
    assertMatch('log: ai-rec short_id format', result.short_id!, /^rec_[0-9A-Za-z]{6}$/);
  }

  // 4: AI rec status is pending
  {
    const db = setup();
    await logDecision({ question: 'Focus on retainers?', source: 'ai-recommendation' });
    const row = db.getRows('decisions')[0];
    assertEqual('log: ai-rec status pending', row.status, 'pending');
  }

  // 5: AI rec has no outcome_assessed_at
  {
    const db = setup();
    await logDecision({ question: 'Add team member?', source: 'ai-recommendation' });
    const row = db.getRows('decisions')[0];
    assertEqual('log: ai-rec outcome_assessed_at null', row.outcome_assessed_at, null);
  }

  // 6: manual decision no short_id
  {
    const db = setup();
    const result = await logDecision({ question: 'Drop client?', source: 'manual' });
    assertEqual('log: manual no short_id', result.short_id, null);
  }

  // 7: stores question
  {
    const db = setup();
    await logDecision({ question: 'Test question?', source: 'manual' });
    const row = db.getRows('decisions')[0];
    assertEqual('log: question stored', row.question, 'Test question?');
  }

  // 8: stores chosen and rationale
  {
    const db = setup();
    await logDecision({ question: 'Q?', chosen: 'Option A', rationale: 'Best fit', source: 'manual' });
    const row = db.getRows('decisions')[0];
    assertEqual('log: chosen stored', row.chosen, 'Option A');
    assertEqual('log: rationale stored', row.rationale, 'Best fit');
  }

  // 9: stores tags
  {
    const db = setup();
    await logDecision({ question: 'Q?', tags: ['pricing', 'strategy'], source: 'manual' });
    const row = db.getRows('decisions')[0];
    assertEqual('log: tags stored', row.tags, ['pricing', 'strategy']);
  }

  // 10: stores company
  {
    const db = setup();
    await logDecision({ question: 'Q?', company: 'STA', source: 'manual' });
    const row = db.getRows('decisions')[0];
    assertEqual('log: company stored', row.company, 'STA');
  }

  // 11: stores issue_signature for AI rec
  {
    const db = setup();
    await logDecision({ question: 'Q?', source: 'ai-recommendation', issue_signature: 'test-sig' });
    const row = db.getRows('decisions')[0];
    assertEqual('log: issue_signature stored', row.issue_signature, 'test-sig');
  }

  // 12: stores module for AI rec
  {
    const db = setup();
    await logDecision({ question: 'Q?', source: 'ai-recommendation', module: 'daily-brief' });
    const row = db.getRows('decisions')[0];
    assertEqual('log: module stored', row.module, 'daily-brief');
  }

  // 13: returns empty matches array when no similar (empty DB)
  {
    setup();
    const result = await logDecision({ question: 'Unique question nobody asked before?', source: 'manual' });
    assertEqual('log: matches is array', Array.isArray(result.matches), true);
  }

  // 14: telegram-capture source sets status logged
  {
    const db = setup();
    await logDecision({ question: 'Q?', source: 'telegram-capture' });
    const row = db.getRows('decisions')[0];
    assertEqual('log: telegram-capture status logged', row.status, 'logged');
  }

  // 15: telegram-capture gets outcome_assessed_at
  {
    const db = setup();
    await logDecision({ question: 'Q?', source: 'telegram-capture' });
    const row = db.getRows('decisions')[0];
    assertNotNull('log: telegram-capture outcome_assessed_at', row.outcome_assessed_at);
  }

  // 16: default source is manual
  {
    const db = setup();
    await logDecision({ question: 'Q?' });
    const row = db.getRows('decisions')[0];
    assertEqual('log: default source manual', row.source, 'manual');
  }

  // 17: options array stored
  {
    const db = setup();
    await logDecision({ question: 'Q?', options: ['A', 'B', 'C'] });
    const row = db.getRows('decisions')[0];
    assertEqual('log: options stored', row.options, ['A', 'B', 'C']);
  }

  // 18: confidence_score stored
  {
    const db = setup();
    await logDecision({ question: 'Q?', confidence_score: 0.75 });
    const row = db.getRows('decisions')[0];
    assertEqual('log: confidence_score stored', row.confidence_score, 0.75);
  }

  // 19: context stored
  {
    const db = setup();
    await logDecision({ question: 'Q?', context: 'Some context' });
    const row = db.getRows('decisions')[0];
    assertEqual('log: context stored', row.context, 'Some context');
  }

  // 20: expected_outcome stored
  {
    const db = setup();
    await logDecision({ question: 'Q?', expected_outcome: 'Revenue up 10%' });
    const row = db.getRows('decisions')[0];
    assertEqual('log: expected_outcome stored', row.expected_outcome, 'Revenue up 10%');
  }

  resetProviders();
}
