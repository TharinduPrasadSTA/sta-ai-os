import { getSupabase } from '../utils/providers.ts';

const DEFAULT_EXPIRE_HOURS = 72;

export interface ExpireResult {
  expired: number;
}

export async function expirePending(): Promise<ExpireResult> {
  const hours = Number(process.env.REC_EXPIRE_HOURS ?? DEFAULT_EXPIRE_HOURS);
  const cutoff = new Date(Date.now() - hours * 3_600_000).toISOString();

  const db = getSupabase();
  const { data, error } = await db
    .from('decisions')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('source', 'ai-recommendation')
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .select('id');

  if (error) throw new Error(`expirePending failed: ${error.message}`);
  return { expired: (data ?? []).length };
}
