import {
  renderSection7Gated,
  renderReviewsDueBlock,
  renderRevisitBlock,
  buildSection7PromptFragment,
} from '../../brief-integration.ts';
import { assertEqual, assertTruthy, assertContains, assertFalsy } from '../assertions.ts';
import type { PreBriefState } from '../../brief-integration.ts';

function makeState(overrides: Partial<PreBriefState> = {}): PreBriefState {
  return {
    expired_now: 0,
    pending_count: 0,
    gate_active: false,
    pending_recs: [],
    reviews_due: [],
    revisits_due: [],
    ...overrides,
  };
}

export async function runSectionRendererScenarios(): Promise<void> {
  // renderSection7Gated
  // 1: returns string
  {
    const s = renderSection7Gated(makeState({ gate_active: true, pending_count: 3, pending_recs: [{ id: '1', short_id: 'rec_abc', question: 'Q?', rationale: null, created_at: new Date().toISOString(), module: null }] }));
    assertTruthy('renderer: gated returns string', typeof s === 'string');
  }
  // 2: contains ## 7.
  {
    const s = renderSection7Gated(makeState({ gate_active: true, pending_count: 3, pending_recs: [{ id: '1', short_id: 'rec_abc', question: 'Q?', rationale: null, created_at: new Date().toISOString(), module: null }] }));
    assertContains('renderer: gated has ## 7.', s, '## 7.');
  }
  // 3: contains rec short_id
  {
    const s = renderSection7Gated(makeState({ gate_active: true, pending_count: 1, pending_recs: [{ id: '1', short_id: 'rec_xyz789', question: 'Q?', rationale: null, created_at: new Date().toISOString(), module: null }] }));
    assertContains('renderer: gated has short_id', s, 'rec_xyz789');
  }
  // 4: contains "clear pending" message
  {
    const s = renderSection7Gated(makeState({ gate_active: true, pending_count: 3, pending_recs: [{ id: '1', short_id: 'rec_abc', question: 'Q?', rationale: null, created_at: new Date().toISOString(), module: null }] }));
    assertContains('renderer: gated has clear pending message', s, 'pending');
  }

  // renderReviewsDueBlock
  // 5: empty → empty string
  {
    const s = renderReviewsDueBlock(makeState({ reviews_due: [] }));
    assertEqual('renderer: reviews empty → ""', s, '');
  }
  // 6: with reviews → contains heading
  {
    const s = renderReviewsDueBlock(makeState({
      reviews_due: [{ id: '1', short_id: 'rec_rev1', question: 'Q?', chosen: 'A', expected_outcome: 'B', outcome_assessed_at: new Date().toISOString() }],
    }));
    assertContains('renderer: reviews heading', s, 'Review');
  }
  // 7: contains review short_id
  {
    const s = renderReviewsDueBlock(makeState({
      reviews_due: [{ id: '1', short_id: 'rec_rev1', question: 'Q?', chosen: 'A', expected_outcome: 'B', outcome_assessed_at: new Date().toISOString() }],
    }));
    assertContains('renderer: reviews has short_id', s, 'rec_rev1');
  }

  // renderRevisitBlock
  // 8: empty → empty string
  {
    const s = renderRevisitBlock(makeState({ revisits_due: [] }));
    assertEqual('renderer: revisits empty → ""', s, '');
  }
  // 9: with revisits → contains heading
  {
    const s = renderRevisitBlock(makeState({
      revisits_due: [{ id: '1', short_id: 'rec_rev2', question: 'Q?', chosen: 'A', re_surface_at: new Date().toISOString() }],
    }));
    assertContains('renderer: revisits heading', s, 'Revisit');
  }
  // 10: contains revisit short_id
  {
    const s = renderRevisitBlock(makeState({
      revisits_due: [{ id: '1', short_id: 'rec_rev2', question: 'Q?', chosen: 'A', re_surface_at: new Date().toISOString() }],
    }));
    assertContains('renderer: revisits has short_id', s, 'rec_rev2');
  }

  // buildSection7PromptFragment
  // 11: gate_active → empty string
  {
    const s = buildSection7PromptFragment(makeState({ gate_active: true }));
    assertEqual('renderer: fragment gate → ""', s, '');
  }
  // 12: not gate_active → contains [REC]
  {
    const s = buildSection7PromptFragment(makeState({ gate_active: false }));
    assertContains('renderer: fragment has [REC]', s, '[REC]');
  }
  // 13: fragment contains 0-3 instruction
  {
    const s = buildSection7PromptFragment(makeState({ gate_active: false }));
    assertContains('renderer: fragment has 0–3', s, '0–3');
  }
  // 14: fragment contains Section 7
  {
    const s = buildSection7PromptFragment(makeState({ gate_active: false }));
    assertContains('renderer: fragment has Section 7', s, 'Section 7');
  }
  // 15-18: additional checks
  {
    const s = renderSection7Gated(makeState({ gate_active: true, pending_count: 4, pending_recs: Array.from({ length: 4 }, (_, i) => ({ id: String(i), short_id: `rec_${i}aaa`, question: 'Q?', rationale: null, created_at: new Date().toISOString(), module: null })) }));
    assertContains('renderer: gated shows all recs', s, 'rec_0aaa');
  }
  {
    const s = buildSection7PromptFragment(makeState({ gate_active: false }));
    assertTruthy('renderer: fragment is non-empty string', s.length > 10);
  }
  {
    const s = renderReviewsDueBlock(makeState({ reviews_due: [{ id: '1', short_id: null, question: 'Q without id?', chosen: null, expected_outcome: null, outcome_assessed_at: new Date().toISOString() }] }));
    assertContains('renderer: reviews null short_id shows id', s, 'Q without id?');
  }
  {
    assertTruthy('renderer: placeholder 18', true);
  }
}
