import { supabase, getLastSync, setLastSync, chunkArray } from '../utils/db.ts';
import { embedBatch } from '../utils/embed.ts';

const CLICKUP_API = 'https://api.clickup.com/api/v2';
const TEAM_ID = '90131061870';
const CLICKUP_HEADERS = { Authorization: process.env.CLICKUP_API_TOKEN! };

async function clickupGet(path: string): Promise<unknown> {
  const response = await fetch(`${CLICKUP_API}${path}`, { headers: CLICKUP_HEADERS });
  if (!response.ok) {
    throw new Error(`ClickUp API error ${response.status} for ${path}: ${await response.text()}`);
  }
  return response.json();
}

interface ClickUpTask {
  id: string;
  name: string;
  description?: string;
  status?: { status: string };
  priority?: { priority: string } | null;
  assignees?: Array<{ username: string }>;
  due_date?: string | null;
  date_created?: string;
  date_updated?: string;
  space?: { id: string; name: string };
  folder?: { id: string; name: string; hidden?: boolean };
  list?: { id: string; name: string };
}

async function fetchAllTasks(since: Date | null): Promise<ClickUpTask[]> {
  const tasks: ClickUpTask[] = [];
  let page = 0;

  while (true) {
    const params = new URLSearchParams({
      include_closed: 'true',
      subtasks: 'true',
      page: String(page),
    });
    if (since) {
      params.set('date_updated_gt', String(since.getTime()));
    }

    const data = (await clickupGet(`/team/${TEAM_ID}/task?${params}`)) as {
      tasks: ClickUpTask[];
      last_page: boolean;
    };

    if (!data.tasks?.length) break;
    tasks.push(...data.tasks);
    if (data.last_page) break;
    page++;
  }

  return tasks;
}

async function main() {
  console.log('Starting ClickUp sync...');
  const since = await getLastSync('clickup');
  const syncStart = new Date();

  const tasks = await fetchAllTasks(since);
  console.log(`  Fetched ${tasks.length} tasks from ClickUp`);

  if (tasks.length === 0) {
    console.log('ClickUp sync complete — nothing new.');
    await setLastSync('clickup', syncStart);
    return;
  }

  const batches = chunkArray(tasks, 50);

  for (const batch of batches) {
    const texts = batch.map((t) =>
      [t.name, t.description].filter(Boolean).join('\n\n')
    );
    const embeddings = await embedBatch(texts);

    for (let i = 0; i < batch.length; i++) {
      const task = batch[i];
      const textContent = texts[i];

      await supabase.from('clickup_tasks').upsert(
        {
          source_id: task.id,
          workspace_id: TEAM_ID,
          workspace_name: 'Scale Through Automation',
          space_id: task.space?.id ?? null,
          space_name: task.space?.name ?? null,
          folder_id: (!task.folder?.hidden && task.folder?.id) ? task.folder.id : null,
          folder_name: (!task.folder?.hidden && task.folder?.name) ? task.folder.name : null,
          list_id: task.list?.id ?? null,
          list_name: task.list?.name ?? null,
          name: task.name,
          description: task.description ?? null,
          status: task.status?.status ?? null,
          priority: task.priority?.priority ?? null,
          assignees: task.assignees?.map((a) => a.username) ?? [],
          due_date: task.due_date ? new Date(parseInt(task.due_date)).toISOString() : null,
          created_at: task.date_created ? new Date(parseInt(task.date_created)).toISOString() : null,
          updated_at: task.date_updated ? new Date(parseInt(task.date_updated)).toISOString() : null,
          text_content: textContent,
          embedding: embeddings[i] as unknown as string,
          embedding_model: 'voyage-3-large',
          _synced_at: new Date().toISOString(),
        },
        { onConflict: 'source_id' }
      );
    }

    console.log(`  Upserted batch of ${batch.length} tasks`);
  }

  await setLastSync('clickup', syncStart);
  console.log(`ClickUp sync complete — ${tasks.length} tasks synced.`);
}

main().catch((err) => {
  console.error('ClickUp sync failed:', err);
  process.exit(1);
});
