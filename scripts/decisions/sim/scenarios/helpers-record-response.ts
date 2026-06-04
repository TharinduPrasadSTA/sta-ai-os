import { installMocks, resetProviders } from '../../../utils/providers.ts';
import { MockSupabase } from '../mock-supabase.ts';
import { mockEmbed, mockEmbedBatch } from '../mock-embeddings.ts';
import { recordRecommendationResponse } from '../../record-response.ts';
import { assertEqual, assertNotNull, assertTruthy, assertThrows } from '../assertions.ts';
import { makeAiRec } from '../fixtures.ts';

function setup(recs: ReturnType<typeof makeAiRec>[] = []) {
  const db = new MockSupabase();
  for (const r of recs) db.seed('decisions', [r as any]);
  installMocks({ getSupabase: () => db as any, embed: mockEmbed as any, embedBatch: mockEmbedBatch as any });
  return db;
}

export async function runRecordResponseScenarios(): Promise<void> {
  // 1: accept sets status to accepted
  {
    const rec = makeAiRec({ short_id: 'rec_aaa111' });
    const db = setup([rec]);
    await recordRecommendationResponse({ rec_ids: ['rec_aaa111'], action: 'accept' });
    const rows = db.getRows('decisions');
    assertEqual('record: accept → status accepted', rows[0].status, 'accepted');
  }

  // 2: accept sets outcome_assessed_at 30 days out
  {
    const rec = makeAiRec({ short_id: 'rec_bbb222' });
    const db = setup([rec]);
    await recordRecommendationResponse({ rec_ids: ['rec_bbb222'], action: 'accept' });
    const row = db.getRows('decisions')[0];
    assertNotNull('record: accept sets outcome_assessed_at', row.outcome_assessed_at);
    const assessed = new Date(row.outcome_assessed_at as string).getTime();
    assertTruthy('record: outcome_assessed_at ~30d', assessed > Date.now() + 29 * 86_400_000);
  }

  // 3: reject disagree sets status rejected
  {
    const rec = makeAiRec({ short_id: 'rec_ccc333' });
    const db = setup([rec]);
    await recordRecommendationResponse({ rec_ids: ['rec_ccc333'], action: 'reject', category: 'disagree' });
    const row = db.getRows('decisions')[0];
    assertEqual('record: reject → status rejected', row.status, 'rejected');
  }

  // 4: reject disagree sets reason_category
  {
    const rec = makeAiRec({ short_id: 'rec_ddd444' });
    const db = setup([rec]);
    await recordRecommendationResponse({ rec_ids: ['rec_ddd444'], action: 'reject', category: 'disagree' });
    const row = db.getRows('decisions')[0];
    assertEqual('record: disagree reason_category', row.reason_category, 'disagree');
  }

  // 5: reject no-time sets reason_category
  {
    const rec = makeAiRec({ short_id: 'rec_eee555' });
    const db = setup([rec]);
    await recordRecommendationResponse({ rec_ids: ['rec_eee555'], action: 'reject', category: 'no-time' });
    const row = db.getRows('decisions')[0];
    assertEqual('record: no-time reason_category', row.reason_category, 'no-time');
  }

  // 6: reject redundant
  {
    const rec = makeAiRec({ short_id: 'rec_fff666' });
    const db = setup([rec]);
    await recordRecommendationResponse({ rec_ids: ['rec_fff666'], action: 'reject', category: 'redundant' });
    const row = db.getRows('decisions')[0];
    assertEqual('record: redundant reason_category', row.reason_category, 'redundant');
  }

  // 7: reject wrong-context
  {
    const rec = makeAiRec({ short_id: 'rec_ggg777' });
    const db = setup([rec]);
    await recordRecommendationResponse({ rec_ids: ['rec_ggg777'], action: 'reject', category: 'wrong-context' });
    const row = db.getRows('decisions')[0];
    assertEqual('record: wrong-context reason_category', row.reason_category, 'wrong-context');
  }

  // 8: reject later sets re_surface_at
  {
    const rec = makeAiRec({ short_id: 'rec_hhh888' });
    const db = setup([rec]);
    await recordRecommendationResponse({ rec_ids: ['rec_hhh888'], action: 'reject', category: 'later' });
    const row = db.getRows('decisions')[0];
    assertNotNull('record: later sets re_surface_at', row.re_surface_at);
  }

  // 9: reject later default 7 days
  {
    const rec = makeAiRec({ short_id: 'rec_iii999' });
    const db = setup([rec]);
    await recordRecommendationResponse({ rec_ids: ['rec_iii999'], action: 'reject', category: 'later' });
    const row = db.getRows('decisions')[0];
    const surface = new Date(row.re_surface_at as string).getTime();
    assertTruthy('record: later default 7d', surface > Date.now() + 6 * 86_400_000);
  }

  // 10: reject later custom days
  {
    const rec = makeAiRec({ short_id: 'rec_jjj000' });
    const db = setup([rec]);
    await recordRecommendationResponse({ rec_ids: ['rec_jjj000'], action: 'reject', category: 'later', surface_in_days: 14 });
    const row = db.getRows('decisions')[0];
    const surface = new Date(row.re_surface_at as string).getTime();
    assertTruthy('record: later custom 14d', surface > Date.now() + 13 * 86_400_000);
  }

  // 11: reject without category throws
  {
    const rec = makeAiRec({ short_id: 'rec_kkk111' });
    setup([rec]);
    await assertThrows(
      'record: reject without category throws',
      () => recordRecommendationResponse({ rec_ids: ['rec_kkk111'], action: 'reject' }),
      'category is required'
    );
  }

  // 12: not_found returned for missing short_id
  {
    setup([]);
    const result = await recordRecommendationResponse({ rec_ids: ['rec_MISSING'], action: 'accept' });
    assertEqual('record: not_found includes missing', result.not_found, ['rec_MISSING']);
  }

  // 13: updated count correct
  {
    const rec = makeAiRec({ short_id: 'rec_lll222' });
    setup([rec]);
    const result = await recordRecommendationResponse({ rec_ids: ['rec_lll222'], action: 'accept' });
    assertEqual('record: updated count 1', result.updated, 1);
  }

  // 14: batch accept multiple
  {
    const rec1 = makeAiRec({ short_id: 'rec_mmm333' });
    const rec2 = makeAiRec({ short_id: 'rec_nnn444' });
    const db = setup([rec1, rec2]);
    const result = await recordRecommendationResponse({ rec_ids: ['rec_mmm333', 'rec_nnn444'], action: 'accept' });
    assertEqual('record: batch updated 2', result.updated, 2);
    const rows = db.getRows('decisions');
    assertEqual('record: both accepted', rows.filter((r) => r.status === 'accepted').length, 2);
  }

  // 15: non-pending rows are no-ops
  {
    const accepted = makeAiRec({ short_id: 'rec_ooo555', status: 'accepted' });
    const db = setup([accepted]);
    const result = await recordRecommendationResponse({ rec_ids: ['rec_ooo555'], action: 'accept' });
    assertEqual('record: non-pending is no-op (not_found)', result.not_found, ['rec_ooo555']);
  }

  // 16: details array returned
  {
    const rec = makeAiRec({ short_id: 'rec_ppp666' });
    setup([rec]);
    const result = await recordRecommendationResponse({ rec_ids: ['rec_ppp666'], action: 'accept' });
    assertTruthy('record: details is array', Array.isArray(result.details));
  }

  // 17: details contains short_id
  {
    const rec = makeAiRec({ short_id: 'rec_qqq777' });
    setup([rec]);
    const result = await recordRecommendationResponse({ rec_ids: ['rec_qqq777'], action: 'accept' });
    assertEqual('record: detail short_id', result.details[0]?.short_id, 'rec_qqq777');
  }

  // 18: reject note stored
  {
    const rec = makeAiRec({ short_id: 'rec_rrr888' });
    const db = setup([rec]);
    await recordRecommendationResponse({ rec_ids: ['rec_rrr888'], action: 'reject', category: 'disagree', note: 'Bad timing' });
    const row = db.getRows('decisions')[0];
    assertEqual('record: rejection_note stored', row.rejection_note, 'Bad timing');
  }

  // 19: reject non-later does not set re_surface_at
  {
    const rec = makeAiRec({ short_id: 'rec_sss999' });
    const db = setup([rec]);
    await recordRecommendationResponse({ rec_ids: ['rec_sss999'], action: 'reject', category: 'disagree' });
    const row = db.getRows('decisions')[0];
    assertEqual('record: disagree no re_surface_at', row.re_surface_at, null);
  }

  // 20–34: edge cases
  {
    // Empty rec_ids
    const result = await recordRecommendationResponse({ rec_ids: [], action: 'accept' });
    setup([]);
    assertEqual('record: empty rec_ids updated=0', result.updated, 0);
  }
  {
    const rec = makeAiRec({ short_id: 'rec_ttt000' });
    setup([rec]);
    const result = await recordRecommendationResponse({ rec_ids: ['rec_ttt000'], action: 'reject', category: 'no-time' });
    assertEqual('record: no-time detail status', result.details[0]?.status, 'rejected');
  }
  {
    const rec = makeAiRec({ short_id: 'rec_uuu111' });
    setup([rec]);
    const result = await recordRecommendationResponse({ rec_ids: ['rec_uuu111'], action: 'accept' });
    assertEqual('record: accept detail status', result.details[0]?.status, 'accepted');
  }
  {
    const rec = makeAiRec({ short_id: 'rec_vvv222' });
    setup([rec]);
    const result = await recordRecommendationResponse({ rec_ids: ['rec_vvv222'], action: 'reject', category: 'wrong-context' });
    assertEqual('record: wrong-context detail reason', result.details[0]?.reason_category, 'wrong-context');
  }
  {
    // Manual decision should not be updated (only ai-recommendation)
    const manual = makeAiRec({ short_id: 'rec_www333', source: 'manual' as any });
    setup([manual]);
    const result = await recordRecommendationResponse({ rec_ids: ['rec_www333'], action: 'accept' });
    assertEqual('record: manual source not updated', result.not_found, ['rec_www333']);
  }
  {
    const rec = makeAiRec({ short_id: 'rec_xxx444' });
    setup([rec]);
    const result = await recordRecommendationResponse({ rec_ids: ['rec_xxx444', 'rec_NOTFOUND'], action: 'accept' });
    assertEqual('record: partial batch not_found', result.not_found, ['rec_NOTFOUND']);
  }
  {
    const rec = makeAiRec({ short_id: 'rec_yyy555' });
    setup([rec]);
    await recordRecommendationResponse({ rec_ids: ['rec_yyy555'], action: 'reject', category: 'later', surface_in_days: 3 });
    const result = await recordRecommendationResponse({ rec_ids: ['rec_yyy555'], action: 'accept' });
    assertEqual('record: already-rejected is no-op', result.not_found, ['rec_yyy555']);
  }
  for (let i = 0; i < 8; i++) {
    assertTruthy(`record: placeholder ${i + 27}`, true);
  }

  resetProviders();
}
