import { supabase, getLastSync, setLastSync, chunkArray } from '../utils/db.ts';
import { embedBatch } from '../utils/embed.ts';

const GRAPH_API = 'https://graph.microsoft.com/v1.0';
const MAILBOX = 'tharindu@scalethroughautomation.io';

async function getToken(): Promise<string> {
  const res = await fetch(
    `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        grant_type: 'client_credentials',
        scope: 'https://graph.microsoft.com/.default',
      }),
    }
  );
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error(`MSAL error: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function syncEmails(token: string, since: Date | null): Promise<number> {
  let synced = 0;
  const filter = since
    ? `&$filter=receivedDateTime gt ${since.toISOString()}`
    : '';
  let nextLink: string | null =
    `${GRAPH_API}/users/${MAILBOX}/messages?$top=50&$select=id,subject,from,toRecipients,receivedDateTime,conversationId,isRead,body${filter}&$orderby=receivedDateTime desc`;

  while (nextLink) {
    const res = await fetch(nextLink, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Graph mail error ${res.status}: ${await res.text()}`);

    const data = (await res.json()) as {
      value: Array<{
        id: string;
        subject?: string;
        from?: { emailAddress: { name: string; address: string } };
        toRecipients?: Array<{ emailAddress: { name: string; address: string } }>;
        receivedDateTime?: string;
        conversationId?: string;
        isRead?: boolean;
        body?: { content: string; contentType: string };
      }>;
      '@odata.nextLink'?: string;
    };

    if (!data.value?.length) break;

    const batches = chunkArray(data.value, 20);
    for (const batch of batches) {
      const texts = batch.map((m) => {
        const bodyText = m.body?.contentType === 'html'
          ? m.body.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000)
          : (m.body?.content ?? '').slice(0, 2000);
        return [m.subject, bodyText].filter(Boolean).join('\n\n');
      });

      const embeddings = await embedBatch(texts);

      const rows = batch.map((m, i) => {
        const bodyText = m.body?.contentType === 'html'
          ? m.body.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000)
          : (m.body?.content ?? '').slice(0, 2000);
        return {
          source_id: m.id,
          mailbox: MAILBOX,
          subject: m.subject ?? null,
          from_address: m.from?.emailAddress.address ?? null,
          from_name: m.from?.emailAddress.name ?? null,
          to_addresses: m.toRecipients?.map((r) => r.emailAddress) ?? [],
          received_at: m.receivedDateTime ?? null,
          conversation_id: m.conversationId ?? null,
          is_read: m.isRead ?? false,
          body_text: bodyText,
          embedding: embeddings[i] as unknown as string,
          embedding_model: 'voyage-3-large',
          _synced_at: new Date().toISOString(),
        };
      });

      const { error } = await supabase
        .from('outlook_emails')
        .upsert(rows, { onConflict: 'source_id' });
      if (error) throw error;

      synced += batch.length;
    }

    console.log(`  Emails: ${synced} synced...`);
    nextLink = data['@odata.nextLink'] ?? null;

    // Stop after 2000 emails on first full sync to avoid rate limits
    if (!since && synced >= 2000) break;
  }

  return synced;
}

async function main() {
  console.log('Starting Outlook sync...');
  const since = await getLastSync('outlook');
  const syncStart = new Date();

  const token = await getToken();
  const emails = await syncEmails(token, since);

  await setLastSync('outlook', syncStart);
  console.log(`Outlook sync complete — ${emails} emails synced.`);
}

main().catch((err) => {
  console.error('Outlook sync failed:', err);
  process.exit(1);
});
