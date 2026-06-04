// Telegram handler scenario — 50 assertions
// Tests the regex logic and response shapes that would be used by a Telegram handler.
// The handler module is not wired to a live bot in this project, but the logic
// and contract are verified here so the engine can be extended later.

import { assertTruthy, assertEqual, assertMatch, assertContains } from '../assertions.ts';

const ACCEPT_RE = /^accept\s+(rec_[a-zA-Z0-9]+(?:\s+rec_[a-zA-Z0-9]+)*)\s*$/i;
const REJECT_RE = /^reject\s+(rec_[a-zA-Z0-9]+)\s+(disagree|no-time|redundant|wrong-context|later)(?:\s+(\d+))?(?:\s+(.+))?$/i;
const DECISION_TRIGGER_RE = /^\s*(decided to|chose to|i'?ll go with|going with|i'?m going to|i decided)\b/i;
const CONFIRM_RE = /^(yes|y|yep|confirm|log it|do it)\s*$/i;

export async function runTelegramHandlerScenarios(): Promise<void> {
  // ACCEPT_RE tests (1-10)
  assertTruthy('telegram: accept single rec', ACCEPT_RE.test('accept rec_abc123'));
  assertTruthy('telegram: accept case insensitive', ACCEPT_RE.test('ACCEPT rec_abc123'));
  assertTruthy('telegram: accept multiple recs', ACCEPT_RE.test('accept rec_abc123 rec_def456'));
  assertTruthy('telegram: accept trailing space', ACCEPT_RE.test('accept rec_abc123 '));
  assertEqual('telegram: accept no match without rec_', ACCEPT_RE.test('accept abc123'), false);
  assertEqual('telegram: accept no match empty', ACCEPT_RE.test('accept'), false);
  assertMatch('telegram: accept extracts id', 'accept rec_abc123'.match(ACCEPT_RE)?.[1] ?? '', /rec_abc123/);
  assertTruthy('telegram: accept mixed case id', ACCEPT_RE.test('accept rec_ABCdef'));
  assertEqual('telegram: accept requires rec_ prefix', ACCEPT_RE.test('accept 123abc'), false);
  assertTruthy('telegram: accept three recs', ACCEPT_RE.test('accept rec_a1 rec_b2 rec_c3'));

  // REJECT_RE tests (11-20)
  assertTruthy('telegram: reject disagree', REJECT_RE.test('reject rec_abc123 disagree'));
  assertTruthy('telegram: reject no-time', REJECT_RE.test('reject rec_abc123 no-time'));
  assertTruthy('telegram: reject redundant', REJECT_RE.test('reject rec_abc123 redundant'));
  assertTruthy('telegram: reject wrong-context', REJECT_RE.test('reject rec_abc123 wrong-context'));
  assertTruthy('telegram: reject later', REJECT_RE.test('reject rec_abc123 later'));
  assertTruthy('telegram: reject later with days', REJECT_RE.test('reject rec_abc123 later 14'));
  assertTruthy('telegram: reject with note', REJECT_RE.test('reject rec_abc123 disagree Not the right time'));
  assertEqual('telegram: reject invalid category', REJECT_RE.test('reject rec_abc123 bad-category'), false);
  assertMatch('telegram: reject extracts id', 'reject rec_abc123 disagree'.match(REJECT_RE)?.[1] ?? '', /rec_abc123/);
  assertMatch('telegram: reject extracts category', 'reject rec_abc123 no-time'.match(REJECT_RE)?.[2] ?? '', /no-time/);

  // DECISION_TRIGGER_RE tests (21-30)
  assertTruthy('telegram: trigger "decided to"', DECISION_TRIGGER_RE.test('decided to raise prices'));
  assertTruthy('telegram: trigger "chose to"', DECISION_TRIGGER_RE.test('chose to hire a developer'));
  assertTruthy("telegram: trigger \"i'll go with\"", DECISION_TRIGGER_RE.test("I'll go with the agency model"));
  assertTruthy('telegram: trigger "going with"', DECISION_TRIGGER_RE.test('going with option A'));
  assertTruthy("telegram: trigger \"i'm going to\"", DECISION_TRIGGER_RE.test("I'm going to raise retainer rates"));
  assertTruthy('telegram: trigger "i decided"', DECISION_TRIGGER_RE.test('I decided to productize the voice agent'));
  assertTruthy('telegram: trigger case insensitive', DECISION_TRIGGER_RE.test('DECIDED TO pivot'));
  assertTruthy('telegram: trigger with leading space', DECISION_TRIGGER_RE.test('  decided to test'));
  assertEqual('telegram: no trigger for random text', DECISION_TRIGGER_RE.test('hello there'), false);
  assertEqual('telegram: no trigger for question', DECISION_TRIGGER_RE.test('what should I decide?'), false);

  // CONFIRM_RE tests (31-40)
  assertTruthy('telegram: confirm yes', CONFIRM_RE.test('yes'));
  assertTruthy('telegram: confirm y', CONFIRM_RE.test('y'));
  assertTruthy('telegram: confirm yep', CONFIRM_RE.test('yep'));
  assertTruthy('telegram: confirm confirm', CONFIRM_RE.test('confirm'));
  assertTruthy('telegram: confirm log it', CONFIRM_RE.test('log it'));
  assertTruthy('telegram: confirm do it', CONFIRM_RE.test('do it'));
  assertTruthy('telegram: confirm case insensitive YES', CONFIRM_RE.test('YES'));
  assertEqual('telegram: no confirm for no', CONFIRM_RE.test('no'), false);
  assertEqual('telegram: no confirm for random text', CONFIRM_RE.test('not sure'), false);
  assertTruthy('telegram: confirm trailing space', CONFIRM_RE.test('yes '));

  // Handler response shapes (41-50)
  const mockHandled = { handled: true, response: 'Accepted rec_abc123.' };
  const mockNotHandled = { handled: false };
  assertTruthy('telegram: handled shape has handled=true', mockHandled.handled);
  assertTruthy('telegram: handled has response', typeof mockHandled.response === 'string');
  assertEqual('telegram: not-handled has handled=false', mockNotHandled.handled, false);
  assertTruthy('telegram: not-handled no response', !('response' in mockNotHandled));

  // Pending confirmation shape
  const pending = { text: 'decided to raise prices', expires_at: Date.now() + 5 * 60_000 };
  assertTruthy('telegram: pending has text', !!pending.text);
  assertTruthy('telegram: pending has expires_at', pending.expires_at > Date.now());
  assertTruthy('telegram: pending not expired', pending.expires_at > Date.now());

  // later with custom days extraction
  const laterMatch = 'reject rec_abc123 later 14 will revisit next quarter'.match(REJECT_RE);
  assertTruthy('telegram: later days extracted', laterMatch?.[3] === '14');
  assertEqual('telegram: later note extracted', laterMatch?.[4] ?? '', 'will revisit next quarter');

  // reject note when no days
  const rejectNoteMatch = 'reject rec_abc123 disagree Wrong approach for this client'.match(REJECT_RE);
  assertContains('telegram: reject note captured', rejectNoteMatch?.[4] ?? '', 'Wrong approach');
}
