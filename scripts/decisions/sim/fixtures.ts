import type { DecisionRow } from '../types.ts';

export const NOW = new Date('2026-06-04T10:00:00Z');

export function makeDecision(overrides: Partial<DecisionRow> = {}): DecisionRow {
  return {
    id: crypto.randomUUID(),
    question: 'Should we raise prices?',
    context: 'Close rate is high at 45%',
    options: ['Raise by 20%', 'Keep same', 'Lower by 10%'],
    chosen: 'Raise by 20%',
    rationale: 'High close rate signals underpricing',
    expected_outcome: 'Slightly lower close rate but higher revenue per client',
    actual_outcome: null,
    outcome_assessed_at: new Date(NOW.getTime() + 30 * 86400000).toISOString(),
    tags: ['pricing'],
    company: 'STA',
    confidence_score: 0.8,
    pattern_id: null,
    embedding: null,
    source: 'manual',
    status: 'logged',
    module: null,
    reason_category: null,
    rejection_note: null,
    re_surface_at: null,
    issue_signature: null,
    short_id: null,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

export function makeAiRec(overrides: Partial<DecisionRow> = {}): DecisionRow {
  return makeDecision({
    source: 'ai-recommendation',
    status: 'pending',
    short_id: 'rec_abc123',
    outcome_assessed_at: null,
    module: 'daily-brief',
    ...overrides,
  });
}
