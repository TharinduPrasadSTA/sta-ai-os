import { supabase, getLastSync, setLastSync, chunkArray } from '../utils/db.ts';
import { embedBatch } from '../utils/embed.ts';

const GHL_API = 'https://services.leadconnectorhq.com';
const LOCATION_ID = process.env.GHL_LOCATION_ID!;
const GHL_HEADERS = {
  Authorization: `Bearer ${process.env.GHL_API_KEY}`,
  Version: '2021-07-28',
  'Content-Type': 'application/json',
};

async function ghlGet(path: string): Promise<unknown> {
  const response = await fetch(`${GHL_API}${path}`, { headers: GHL_HEADERS });
  if (!response.ok) {
    throw new Error(`GHL API error ${response.status} for ${path}: ${await response.text()}`);
  }
  return response.json();
}

async function syncContacts(): Promise<number> {
  let synced = 0;
  let nextUrl: string | null =
    `${GHL_API}/contacts/?locationId=${LOCATION_ID}&limit=100`;

  while (nextUrl) {
    const response = await fetch(nextUrl, { headers: GHL_HEADERS });
    if (!response.ok) {
      throw new Error(`GHL contacts error ${response.status}: ${await response.text()}`);
    }
    const data = (await response.json()) as {
      contacts: Array<{
        id: string;
        locationId: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        phone?: string;
        tags?: string[];
        source?: string;
        assignedTo?: string;
        dateAdded?: string;
        dateUpdated?: string;
      }>;
      meta?: { total: number; nextPageUrl?: string };
    };

    if (!data.contacts?.length) break;

    const rows = data.contacts.map((c) => ({
      source_id: c.id,
      location_id: c.locationId,
      first_name: c.firstName ?? null,
      last_name: c.lastName ?? null,
      email: c.email ?? null,
      phone: c.phone ?? null,
      tags: c.tags ?? [],
      source: c.source ?? null,
      assigned_to: c.assignedTo ?? null,
      created_at: c.dateAdded ?? null,
      updated_at: c.dateUpdated ?? null,
      _synced_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('ghl_contacts')
      .upsert(rows, { onConflict: 'source_id' });
    if (error) throw error;

    synced += data.contacts.length;
    if (synced % 500 === 0) console.log(`  Contacts: ${synced} synced...`);

    // Follow the full nextPageUrl (requires both startAfter + startAfterId together)
    nextUrl = data.meta?.nextPageUrl ?? null;
  }

  return synced;
}

async function syncOpportunities(): Promise<number> {
  let synced = 0;
  let startAfter: string | null = null;

  while (true) {
    const params = new URLSearchParams({ location_id: LOCATION_ID, limit: '100' });
    if (startAfter) params.set('startAfter', startAfter);

    const data = (await ghlGet(`/opportunities/search?${params}`)) as {
      opportunities: Array<{
        id: string;
        locationId?: string;
        contact?: { id: string; name?: string };
        pipeline?: { id: string; name?: string };
        pipelineStage?: { id: string; name?: string };
        status?: string;
        monetaryValue?: number;
        assignedTo?: string;
        source?: string;
        notes?: string;
        createdAt?: string;
        updatedAt?: string;
        closedDate?: string;
      }>;
      meta?: { total: number; nextPageUrl?: string; startAfter?: string };
    };

    if (!data.opportunities?.length) break;

    const rows = data.opportunities.map((opp) => ({
      source_id: opp.id,
      location_id: opp.locationId ?? LOCATION_ID,
      contact_id: opp.contact?.id ?? null,
      contact_name: opp.contact?.name ?? null,
      pipeline_id: opp.pipeline?.id ?? null,
      pipeline_name: opp.pipeline?.name ?? null,
      stage_id: opp.pipelineStage?.id ?? null,
      stage_name: opp.pipelineStage?.name ?? null,
      status: opp.status ?? null,
      monetary_value: opp.monetaryValue ?? null,
      assigned_to: opp.assignedTo ?? null,
      source: opp.source ?? null,
      notes: opp.notes ?? null,
      created_at: opp.createdAt ?? null,
      updated_at: opp.updatedAt ?? null,
      _synced_at: new Date().toISOString(),
    }));

    await supabase.from('ghl_opportunities').upsert(rows, { onConflict: 'source_id' });

    synced += data.opportunities.length;
    startAfter = data.meta?.startAfter ?? null;
    if (!startAfter || !data.meta?.nextPageUrl) break;
  }

  return synced;
}

async function syncConversations(since: Date | null): Promise<number> {
  let synced = 0;
  let startAfter: string | null = null;

  while (true) {
    const params = new URLSearchParams({ locationId: LOCATION_ID, limit: '20' });
    if (startAfter) params.set('startAfter', startAfter);

    const data = (await ghlGet(`/conversations/?${params}`)) as {
      conversations: Array<{
        id: string;
        locationId?: string;
        contactId?: string;
        fullName?: string;
        lastMessage?: string;
        lastMessageType?: string;
        unreadCount?: number;
        type?: string;
        lastMessageDate?: string;
      }>;
      meta?: { total: number; nextPageUrl?: string; startAfter?: string };
    };

    if (!data.conversations?.length) break;

    // Only embed conversations newer than last sync
    const toProcess = since
      ? data.conversations.filter(
          (c) => !c.lastMessageDate || new Date(c.lastMessageDate) > since
        )
      : data.conversations;

    if (toProcess.length > 0) {
      const texts = toProcess.map((c) =>
        [c.fullName, c.lastMessage].filter(Boolean).join('\n')
      );
      const embeddings = await embedBatch(texts);

      const rows = toProcess.map((conv, i) => ({
        source_id: conv.id,
        location_id: conv.locationId ?? LOCATION_ID,
        contact_id: conv.contactId ?? null,
        contact_name: conv.fullName ?? null,
        last_message: conv.lastMessage ?? null,
        last_message_type: conv.lastMessageType ?? null,
        unread_count: conv.unreadCount ?? 0,
        channel: conv.type ?? null,
        text_content: texts[i],
        last_message_at: conv.lastMessageDate ?? null,
        embedding: embeddings[i] as unknown as string,
        embedding_model: 'voyage-3-large',
        _synced_at: new Date().toISOString(),
      }));

      await supabase.from('ghl_conversations').upsert(rows, { onConflict: 'source_id' });
      synced += toProcess.length;
      console.log(`  Conversations: ${synced} synced...`);
    }

    startAfter = data.meta?.startAfter ?? null;
    if (!startAfter || !data.meta?.nextPageUrl) break;
  }

  return synced;
}

async function main() {
  console.log('Starting GHL sync...');
  const since = await getLastSync('ghl');
  const syncStart = new Date();

  const contacts = await syncContacts();
  console.log(`  Contacts: ${contacts} total`);

  const opportunities = await syncOpportunities();
  console.log(`  Opportunities: ${opportunities} total`);

  const conversations = await syncConversations(since);
  console.log(`  Conversations: ${conversations} total`);

  await setLastSync('ghl', syncStart);
  console.log('GHL sync complete.');
}

main().catch((err) => {
  console.error('GHL sync failed:', err);
  process.exit(1);
});
