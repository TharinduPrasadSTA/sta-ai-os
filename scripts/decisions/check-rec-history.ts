import { findSimilarDecisions } from './find-similar.ts';

const SIMILARITY_THRESHOLD = 0.65;
const MIN_SIMILAR_RECS = 3;
const SUPPRESS_DISAGREE_RATE = 0.6;
const BOOST_ACCEPT_RATE = 0.8;

export type RecHistoryAction = 'suppress' | 'boost' | 'emit_normal';

export interface RecHistoryResult {
  action: RecHistoryAction;
  reason?: string;
  historicalAcceptRate?: number;
  similarCount: number;
  acceptCount: number;
  disagreeCount: number;
  similarPast: Array<{
    short_id: string | null;
    question: string;
    status: string;
    reason_category: string | null;
    similarity: number;
  }>;
}

export async function checkRecHistory(
  recText: string,
  company?: string
): Promise<RecHistoryResult> {
  const similar = await findSimilarDecisions(recText, {
    threshold: SIMILARITY_THRESHOLD,
    limit: 20,
    sources: ['ai-recommendation'],
    statuses: ['accepted', 'rejected'],
    company,
  });

  const similarPast = similar.map((s) => ({
    short_id: s.short_id,
    question: s.question,
    status: s.status,
    reason_category: s.reason_category,
    similarity: s.similarity,
  }));

  if (similar.length < MIN_SIMILAR_RECS) {
    return { action: 'emit_normal', similarCount: similar.length, acceptCount: 0, disagreeCount: 0, similarPast };
  }

  const accepts = similar.filter((s) => s.status === 'accepted').length;
  // Only 'disagree' counts against rec quality
  const disagrees = similar.filter(
    (s) => s.status === 'rejected' && s.reason_category === 'disagree'
  ).length;
  const graded = accepts + disagrees;

  if (graded < MIN_SIMILAR_RECS) {
    return { action: 'emit_normal', similarCount: similar.length, acceptCount: accepts, disagreeCount: disagrees, similarPast };
  }

  if (disagrees / graded > SUPPRESS_DISAGREE_RATE) {
    return {
      action: 'suppress',
      reason: `Suppressed: ${disagrees}/${graded} similar past recs were rejected (disagree rate ${Math.round(disagrees / graded * 100)}%)`,
      similarCount: similar.length,
      acceptCount: accepts,
      disagreeCount: disagrees,
      similarPast,
    };
  }

  if (accepts / graded > BOOST_ACCEPT_RATE) {
    return {
      action: 'boost',
      historicalAcceptRate: accepts / graded,
      reason: `Boosted: ${accepts}/${graded} similar past recs accepted (${Math.round(accepts / graded * 100)}%)`,
      similarCount: similar.length,
      acceptCount: accepts,
      disagreeCount: disagrees,
      similarPast,
    };
  }

  return { action: 'emit_normal', similarCount: similar.length, acceptCount: accepts, disagreeCount: disagrees, similarPast };
}
