import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getLastSync(service: string): Promise<Date | null> {
  const { data } = await supabase
    .from('sync_state')
    .select('last_synced_at')
    .eq('service', service)
    .single();
  return data ? new Date(data.last_synced_at) : null;
}

export async function setLastSync(service: string, date: Date): Promise<void> {
  await supabase
    .from('sync_state')
    .upsert(
      { service, last_synced_at: date.toISOString(), updated_at: new Date().toISOString() },
      { onConflict: 'service' }
    );
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
