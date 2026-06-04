import { getSupabase, embed } from '../utils/providers.ts';
import type { DecisionSource, DecisionStatus, SimilarDecision } from './types.ts';

export interface FindSimilarOptions {
  threshold?: number;
  limit?: number;
  company?: string;
  sources?: DecisionSource[];
  statuses?: DecisionStatus[];
}

export async function findSimilarDecisions(
  queryText: string,
  opts?: FindSimilarOptions
): Promise<SimilarDecision[]> {
  const threshold = opts?.threshold ?? 0.5;
  const limit = opts?.limit ?? 10;

  let queryEmbedding: number[];
  try {
    queryEmbedding = await embed(queryText, 'query');
  } catch {
    return [];
  }

  const db = getSupabase();
  const { data, error } = await db.rpc('semantic_search', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: limit * 4,
  });

  if (error || !data) return [];

  const ids = (data as Array<{ source_id: string; similarity: number }>).map((r) => r.source_id);
  if (ids.length === 0) return [];

  let query = db
    .from('decisions')
    .select(
      'id, short_id, question, chosen, rationale, status, source, reason_category, actual_outcome, company, created_at'
    )
    .in('id', ids);

  if (opts?.sources?.length) query = query.in('source', opts.sources);
  if (opts?.statuses?.length) query = query.in('status', opts.statuses);
  if (opts?.company) query = query.eq('company', opts.company);

  const { data: rows, error: rowErr } = await query;
  if (rowErr || !rows) return [];

  const simMap = new Map(
    (data as Array<{ source_id: string; similarity: number }>).map((r) => [r.source_id, r.similarity])
  );

  return (rows as SimilarDecision[])
    .map((r) => ({ ...r, similarity: simMap.get(r.id) ?? 0 }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}
