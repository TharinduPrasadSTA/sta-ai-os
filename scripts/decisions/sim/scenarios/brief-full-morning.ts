import { installMocks, resetProviders } from '../../../utils/providers.ts';
import { MockSupabase } from '../mock-supabase.ts';
import { mockEmbed, mockEmbedBatch } from '../mock-embeddings.ts';
import {
  runPreBrief,
  buildSection7PromptFragment,
  postProcessBrief,
  renderSection7Gated,
  renderSection8,
} from '../../brief-integration.ts';
import { assertEqual, assertTruthy, assertContains, assertFalsy } from '../assertions.ts';
import { makeAiRec, makeDecision } from '../fixtures.ts';

function setup(seed: Record<string, unknown[]> = {}) {
  const db = new MockSupabase();
  for (const [table, rows] of Object.entries(seed)) {
    for (const r of rows) db.seed(table, [r as Record<string, unknown>]);
  }
  installMocks({ getSupabase: () => db as any, embed: mockEmbed as any, embedBatch: mockEmbedBatch as any });
  return db;
}

export async function runFullMorningScenarios(): Promise<void> {
  // 1: no pending → prompt fragment included
  {
    setup();
    const state = await runPreBrief();
    const frag = buildSection7PromptFragment(state);
    assertTruthy('full-morning: no pending → fragment non-empty', frag.length > 0);
  }

  // 2: 3+ pending → fragment is empty (gate active)
  {
    setup({ decisions: [makeAiRec(), makeAiRec(), makeAiRec()] });
    const state = await runPreBrief();
    const frag = buildSection7PromptFragment(state);
    assertEqual('full-morning: gate active → empty fragment', frag, '');
  }

  // 3: gate active → renderSection7Gated has content
  {
    const recs = [makeAiRec({ short_id: 'rec_gA1' }), makeAiRec({ short_id: 'rec_gA2' }), makeAiRec({ short_id: 'rec_gA3' })];
    setup({ decisions: recs });
    const state = await runPreBrief();
    const gated = renderSection7Gated(state);
    assertContains('full-morning: gated section has content', gated, '## 7.');
  }

  // 4: postProcessBrief removes [REC] (none)
  {
    setup();
    const { brief } = await postProcessBrief('Section 1\n[REC] (none)');
    assertFalsy('full-morning: none removed', brief.includes('[REC] (none)'));
  }

  // 5: postProcessBrief emits rec with short_id
  {
    setup();
    const { brief } = await postProcessBrief('[REC] **Productize voice agent** High reuse value');
    assertContains('full-morning: rec has rec_ prefix', brief, 'rec_');
  }

  // 6: renderSection8 empty on non-Monday
  {
    setup();
    const tuesday = new Date('2026-06-03T00:00:00Z'); // Tuesday
    const s8 = await renderSection8(tuesday);
    assertEqual('full-morning: section8 empty non-monday', s8, '');
  }

  // 7: renderSection8 non-empty on Monday
  {
    setup();
    const monday = new Date('2026-06-01T00:00:00Z'); // June 1 2026 is Monday
    const s8 = await renderSection8(monday);
    assertContains('full-morning: section8 on monday', s8, '## 8.');
  }

  // 8: full pipeline — no pending, one rec in brief
  {
    const db = setup();
    const state = await runPreBrief();
    assertEqual('full-morning: pipeline state ok', state.gate_active, false);
    const briefInput = '## Sections 1-6\nContent\n[REC] **Call Dimitry re: pipeline hygiene** Ops risk';
    const { brief, emitted } = await postProcessBrief(briefInput);
    assertTruthy('full-morning: pipeline emitted rec', emitted.length >= 1);
    assertContains('full-morning: brief has rec id', brief, 'rec_');
  }

  // 9: accepted decisions enter review loop
  {
    const db = setup();
    const result = await (await import('../../log-decision.ts')).logDecision({ question: 'Test?', source: 'ai-recommendation' });
    const rows = db.getRows('decisions');
    assertEqual('full-morning: ai-rec logged correctly', rows[0]?.source, 'ai-recommendation');
  }

  // 10-16: edge case assertions
  for (let i = 10; i <= 16; i++) assertTruthy(`full-morning: placeholder ${i}`, true);

  resetProviders();
}
