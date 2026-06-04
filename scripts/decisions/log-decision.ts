import { getSupabase, embed } from '../utils/providers.ts';
import { generateUniqueShortId } from './short-id.ts';
import { findSimilarDecisions } from './find-similar.ts';
import type { DecisionSource, DecisionStatus, SimilarDecision } from './types.ts';

export interface LogDecisionInput {
  question: string;
  context?: string;
  options?: string[];
  chosen?: string;
  rationale?: string;
  expected_outcome?: string;
  confidence_score?: number;
  tags?: string[];
  company?: string;
  source?: DecisionSource;
  status?: DecisionStatus;
  module?: string;
  issue_signature?: string;
}

export interface LogDecisionResult {
  id: string;
  short_id: string | null;
  matches: SimilarDecision[];
}

export function prepareDecisionText(input: LogDecisionInput): string {
  return [
    input.question,
    input.chosen ? `Chosen: ${input.chosen}` : '',
    input.rationale ? `Rationale: ${input.rationale}` : '',
    input.context ? `Context: ${input.context}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function logDecision(input: LogDecisionInput): Promise<LogDecisionResult> {
  const source: DecisionSource = input.source ?? 'manual';
  const isAiRec = source === 'ai-recommendation';

  // Find similar decisions (best-effort)
  const matches = await findSimilarDecisions(prepareDecisionText(input), {
    statuses: ['logged', 'accepted'],
  }).catch(() => [] as SimilarDecision[]);

  // Generate short_id for AI recs only
  let short_id: string | null = null;
  if (isAiRec) {
    short_id = await generateUniqueShortId();
  }

  const status: DecisionStatus = input.status ?? (isAiRec ? 'pending' : 'logged');

  // Manual and telegram-capture enter 30-day review immediately
  const outcome_assessed_at =
    status === 'logged' ? new Date(Date.now() + 30 * 86_400_000).toISOString() : null;

  const db = getSupabase();
  const { data, error } = await db
    .from('decisions')
    .insert({
      question: input.question,
      context: input.context ?? null,
      options: input.options ?? [],
      chosen: input.chosen ?? null,
      rationale: input.rationale ?? null,
      expected_outcome: input.expected_outcome ?? null,
      tags: input.tags ?? [],
      company: input.company ?? null,
      confidence_score: input.confidence_score ?? null,
      source,
      status,
      module: input.module ?? null,
      issue_signature: input.issue_signature ?? null,
      short_id,
      outcome_assessed_at,
    })
    .select('id, short_id')
    .single();

  if (error || !data) throw new Error(`logDecision insert failed: ${error?.message}`);

  const { id } = data as { id: string; short_id: string | null };

  // Async embed — non-fatal
  (async () => {
    try {
      const text = prepareDecisionText(input);
      const embedding = await embed(text, 'document');
      await db.from('decisions').update({ embedding }).eq('id', id);
    } catch (err) {
      console.error('[logDecision] embed failed (non-fatal):', err);
    }
  })();

  return { id, short_id, matches };
}
