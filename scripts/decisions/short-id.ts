import { getSupabase } from '../utils/providers.ts';

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const SHORT_ID_LENGTH = 6;
const MAX_ATTEMPTS = 8;

function randomBase62(len: number): string {
  let result = '';
  for (let i = 0; i < len; i++) {
    result += BASE62[Math.floor(Math.random() * BASE62.length)];
  }
  return result;
}

export async function generateUniqueShortId(): Promise<string> {
  const db = getSupabase();
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const candidate = 'rec_' + randomBase62(SHORT_ID_LENGTH);
    const { data, error } = await db
      .from('decisions')
      .select('id')
      .eq('short_id', candidate)
      .limit(1);
    if (error) throw new Error(`short_id check failed: ${error.message}`);
    if (!data || data.length === 0) return candidate;
  }
  throw new Error(`generateUniqueShortId: failed after ${MAX_ATTEMPTS} attempts`);
}
