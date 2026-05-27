import { supabase, getLastSync, setLastSync, chunkArray } from '../utils/db.ts';
import { embedBatch } from '../utils/embed.ts';

const GRAPH_API = 'https://graph.microsoft.com/v1.0';

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
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error(`MSAL error: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function graphGet(token: string, url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Graph error ${res.status} ${url}: ${await res.text()}`);
  return res.json();
}

interface GraphTeam { id: string; displayName: string }
interface GraphChannel { id: string; displayName: string }
interface GraphMessage {
  id: string;
  messageType?: string;
  createdDateTime?: string;
  from?: { user?: { displayName: string; userPrincipalName?: string } };
  body?: { content: string; contentType: string };
}

async function syncTeams(token: string, since: Date | null): Promise<number> {
  let totalSynced = 0;

  const teamsData = (await graphGet(token, `${GRAPH_API}/teams?$top=50&$select=id,displayName`)) as {
    value: GraphTeam[];
  };

  for (const team of teamsData.value ?? []) {
    console.log(`  Processing team: ${team.displayName}`);

    let channelsData: { value: GraphChannel[] };
    try {
      channelsData = (await graphGet(
        token,
        `${GRAPH_API}/teams/${team.id}/channels?$select=id,displayName`
      )) as { value: GraphChannel[] };
    } catch {
      console.log(`  Skipping ${team.displayName} — no channel access`);
      continue;
    }

    for (const channel of channelsData.value ?? []) {
      const sinceFilter = since
        ? `&$filter=lastModifiedDateTime gt ${since.toISOString()}`
        : '';
      let nextLink: string | null =
        `${GRAPH_API}/teams/${team.id}/channels/${channel.id}/messages?$top=50${sinceFilter}`;

      while (nextLink) {
        let messagesData: { value: GraphMessage[]; '@odata.nextLink'?: string };
        try {
          messagesData = (await graphGet(token, nextLink)) as typeof messagesData;
        } catch {
          break;
        }

        if (!messagesData.value?.length) break;

        const textMessages = messagesData.value.filter(
          (m) => m.messageType === 'message' && m.body?.content
        );

        if (textMessages.length > 0) {
          const batches = chunkArray(textMessages, 25);
          for (const batch of batches) {
            const texts = batch.map((m) => {
              const body = m.body?.contentType === 'html'
                ? m.body.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1000)
                : (m.body?.content ?? '').slice(0, 1000);
              return body;
            });

            const embeddings = await embedBatch(texts.filter(Boolean));
            let embIdx = 0;

            const rows = batch
              .filter((_, i) => texts[i])
              .map((m) => ({
                source_id: m.id,
                team_id: team.id,
                team_name: team.displayName,
                channel_id: channel.id,
                channel_name: channel.displayName,
                sender_name: m.from?.user?.displayName ?? null,
                sender_email: m.from?.user?.userPrincipalName ?? null,
                body_text: texts[batch.indexOf(m)],
                message_type: m.messageType ?? null,
                sent_at: m.createdDateTime ?? null,
                embedding: embeddings[embIdx++] as unknown as string,
                embedding_model: 'voyage-3-large',
                _synced_at: new Date().toISOString(),
              }));

            const { error } = await supabase
              .from('teams_messages')
              .upsert(rows, { onConflict: 'source_id' });
            if (error) throw error;

            totalSynced += rows.length;
          }
        }

        nextLink = messagesData['@odata.nextLink'] ?? null;

        // Cap per channel on first full sync
        if (!since && totalSynced >= 5000) { nextLink = null; break; }
      }
    }
  }

  return totalSynced;
}

async function main() {
  console.log('Starting Teams sync...');
  const since = await getLastSync('teams');
  const syncStart = new Date();

  const token = await getToken();
  const messages = await syncTeams(token, since);

  await setLastSync('teams', syncStart);
  console.log(`Teams sync complete — ${messages} messages synced.`);
}

main().catch((err) => {
  console.error('Teams sync failed:', err);
  process.exit(1);
});
