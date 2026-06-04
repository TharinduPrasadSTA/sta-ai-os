import { getSupabase } from '../utils/providers.ts';
import type { RejectionCategory } from './types.ts';

export interface RecordResponseInput {
  rec_ids: string[];
  action: 'accept' | 'reject';
  category?: RejectionCategory;
  note?: string;
  surface_in_days?: number;
}

export interface RecordResponseResult {
  updated: number;
  not_found: string[];
  details: Array<{
    short_id: string;
    id: string;
    status: string;
    reason_category: string | null;
  }>;
}

export async function recordRecommendationResponse(
  input: RecordResponseInput
): Promise<RecordResponseResult> {
  if (input.action === 'reject' && !input.category) {
    throw new Error('recordRecommendationResponse: category is required when action=reject');
  }

  const db = getSupabase();

  // Fetch matching pending AI recs by short_id
  const { data: rows, error: fetchErr } = await db
    .from('decisions')
    .select('id, short_id, status, source')
    .in('short_id', input.rec_ids)
    .eq('source', 'ai-recommendation')
    .eq('status', 'pending');

  if (fetchErr) throw new Error(`recordRecommendationResponse fetch failed: ${fetchErr.message}`);

  const found = (rows ?? []) as Array<{ id: string; short_id: string; status: string; source: string }>;
  const foundIds = new Set(found.map((r) => r.short_id));
  const not_found = input.rec_ids.filter((id) => !foundIds.has(id));

  if (found.length === 0) {
    return { updated: 0, not_found, details: [] };
  }

  let updatePayload: Record<string, unknown>;

  if (input.action === 'accept') {
    updatePayload = {
      status: 'accepted',
      outcome_assessed_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      updated_at: new Date().toISOString(),
    };
  } else {
    const isLater = input.category === 'later';
    const surfaceDays = input.surface_in_days ?? 7;
    updatePayload = {
      status: 'rejected',
      reason_category: input.category,
      rejection_note: input.note ?? null,
      re_surface_at: isLater
        ? new Date(Date.now() + surfaceDays * 86_400_000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    };
  }

  const ids = found.map((r) => r.id);
  const { error: updateErr } = await db
    .from('decisions')
    .update(updatePayload)
    .in('id', ids);

  if (updateErr) throw new Error(`recordRecommendationResponse update failed: ${updateErr.message}`);

  const details = found.map((r) => ({
    short_id: r.short_id,
    id: r.id,
    status: input.action === 'accept' ? 'accepted' : 'rejected',
    reason_category: input.action === 'reject' ? (input.category ?? null) : null,
  }));

  return { updated: found.length, not_found, details };
}
