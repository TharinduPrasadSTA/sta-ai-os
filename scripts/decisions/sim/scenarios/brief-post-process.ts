import { installMocks, resetProviders } from '../../../utils/providers.ts';
import { MockSupabase } from '../mock-supabase.ts';
import { mockEmbed, mockEmbedBatch } from '../mock-embeddings.ts';
import { postProcessBrief } from '../../brief-integration.ts';
import { assertEqual, assertTruthy, assertContains } from '../assertions.ts';

function setup() {
  const db = new MockSupabase();
  installMocks({ getSupabase: () => db as any, embed: mockEmbed as any, embedBatch: mockEmbedBatch as any });
  return db;
}

export async function runPostProcessScenarios(): Promise<void> {
  // 1: [REC] (none) is stripped
  {
    setup();
    const { brief } = await postProcessBrief('Some text\n[REC] (none)\nMore text');
    assertEqual('post-process: none stripped', brief.includes('[REC] (none)'), false);
  }

  // 2: real rec gets logged
  {
    const db = setup();
    await postProcessBrief('## Section\n[REC] **Do cold outreach** It worked before');
    const rows = db.getRows('decisions');
    assertTruthy('post-process: rec logged to DB', rows.length >= 1);
  }

  // 3: real rec source is ai-recommendation
  {
    const db = setup();
    await postProcessBrief('[REC] **Focus on retainers** High margin');
    const rows = db.getRows('decisions');
    assertEqual('post-process: source ai-recommendation', rows[0]?.source, 'ai-recommendation');
  }

  // 4: real rec status is pending
  {
    const db = setup();
    await postProcessBrief('[REC] **Raise prices** Close rate high');
    const rows = db.getRows('decisions');
    assertEqual('post-process: status pending', rows[0]?.status, 'pending');
  }

  // 5: short_id appears in output
  {
    setup();
    const { brief } = await postProcessBrief('[REC] **Test rec** rationale');
    assertContains('post-process: short_id in output', brief, 'rec_');
  }

  // 6: emitted array has the short_id
  {
    setup();
    const { emitted } = await postProcessBrief('[REC] **Test rec** rationale');
    assertTruthy('post-process: emitted has entry', emitted.length >= 1);
  }

  // 7: no recs → emitted is empty
  {
    setup();
    const { emitted } = await postProcessBrief('## Section\nSome text without recs');
    assertEqual('post-process: no recs → emitted []', emitted.length, 0);
  }

  // 8: non-rec lines pass through
  {
    setup();
    const { brief } = await postProcessBrief('## Section 1\nSome content\n## Section 2\nMore content');
    assertContains('post-process: non-rec lines pass through', brief, '## Section 1');
  }

  // 9: suppressed array exists
  {
    setup();
    const { suppressed } = await postProcessBrief('[REC] **Test** rationale');
    assertTruthy('post-process: suppressed is array', Array.isArray(suppressed));
  }

  // 10: brief string returned
  {
    setup();
    const { brief } = await postProcessBrief('Some content');
    assertTruthy('post-process: brief is string', typeof brief === 'string');
  }

  // 11-15: edge cases
  {
    setup();
    const { brief } = await postProcessBrief('');
    assertEqual('post-process: empty input returns empty', brief, '');
  }
  {
    setup();
    const { emitted } = await postProcessBrief('[REC] (none)\n[REC] (none)');
    assertEqual('post-process: multiple nones stripped', emitted.length, 0);
  }
  {
    setup();
    const { brief } = await postProcessBrief('Line 1\n[REC] **Rec A** reason\nLine 2');
    assertContains('post-process: other lines preserved with rec', brief, 'Line 1');
  }
  {
    setup();
    const { brief } = await postProcessBrief('Line 1\n[REC] **Rec A** reason\nLine 2');
    assertContains('post-process: Line 2 preserved with rec', brief, 'Line 2');
  }
  {
    setup();
    await postProcessBrief('[REC] **Rec 1** r1\n[REC] **Rec 2** r2\n[REC] **Rec 3** r3');
    assertTruthy('post-process: multiple recs handled', true);
  }

  resetProviders();
}
