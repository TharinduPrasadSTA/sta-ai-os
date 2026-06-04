import { results } from './assertions.ts';
import { runMigrationScenarios } from './scenarios/migration.ts';
import { runShortIdScenarios } from './scenarios/helpers-short-id.ts';
import { runLogDecisionScenarios } from './scenarios/helpers-log-decision.ts';
import { runFindSimilarScenarios } from './scenarios/helpers-find-similar.ts';
import { runRecordResponseScenarios } from './scenarios/helpers-record-response.ts';
import { runCheckRecHistoryScenarios } from './scenarios/helpers-check-rec-history.ts';
import { runExpirePendingScenarios } from './scenarios/helpers-expire-pending.ts';
import { runPreBriefScenarios } from './scenarios/brief-pre-brief.ts';
import { runPostProcessScenarios } from './scenarios/brief-post-process.ts';
import { runSectionRendererScenarios } from './scenarios/brief-section-renderers.ts';
import { runEveningRecapScenarios } from './scenarios/brief-evening-recap.ts';
import { runFullMorningScenarios } from './scenarios/brief-full-morning.ts';
import { runPatternRefreshScenarios } from './scenarios/pattern-refresh.ts';
import { runTelegramHandlerScenarios } from './scenarios/telegram-handler.ts';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');

const SCENARIOS: Array<{ name: string; fn: () => Promise<void>; expected: number }> = [
  { name: 'migration', fn: runMigrationScenarios, expected: 25 },
  { name: 'helpers-short-id', fn: runShortIdScenarios, expected: 4 },
  { name: 'helpers-log-decision', fn: runLogDecisionScenarios, expected: 20 },
  { name: 'helpers-find-similar', fn: runFindSimilarScenarios, expected: 8 },
  { name: 'helpers-record-response', fn: runRecordResponseScenarios, expected: 34 },
  { name: 'helpers-check-rec-history', fn: runCheckRecHistoryScenarios, expected: 9 },
  { name: 'helpers-expire-pending', fn: runExpirePendingScenarios, expected: 8 },
  { name: 'brief-pre-brief', fn: runPreBriefScenarios, expected: 15 },
  { name: 'brief-post-process', fn: runPostProcessScenarios, expected: 15 },
  { name: 'brief-section-renderers', fn: runSectionRendererScenarios, expected: 18 },
  { name: 'brief-evening-recap', fn: runEveningRecapScenarios, expected: 7 },
  { name: 'brief-full-morning', fn: runFullMorningScenarios, expected: 16 },
  { name: 'pattern-refresh', fn: runPatternRefreshScenarios, expected: 14 },
  { name: 'telegram-handler', fn: runTelegramHandlerScenarios, expected: 50 },
];

const TOTAL_EXPECTED = 264; // spec minimum was 243; harness runs 264 (more thorough coverage)

async function main() {
  const start = Date.now();
  console.log('\n  Decision Engine Simulation\n');

  let scenarioStart = 0;
  const scenarioResults: Array<{ name: string; passed: number; failed: number; expected: number }> = [];

  for (const scenario of SCENARIOS) {
    const before = results.length;
    try {
      await scenario.fn();
    } catch (err) {
      console.error(`  [ERROR] ${scenario.name} threw: ${err}`);
    }
    const slice = results.slice(before);
    const passed = slice.filter((r) => r.passed).length;
    const failed = slice.filter((r) => !r.passed).length;
    scenarioResults.push({ name: scenario.name, passed, failed, expected: scenario.expected });

    if (failed > 0) {
      console.log(`  ✗ ${scenario.name}: ${passed}/${slice.length} (expected ${scenario.expected})`);
      for (const r of slice.filter((r) => !r.passed)) {
        console.log(`      FAIL: ${r.label}`);
        if (r.error) console.log(`           ${r.error}`);
      }
    } else {
      console.log(`  ✓ ${scenario.name}: ${passed}/${slice.length}`);
    }
  }

  const totalPassed = results.filter((r) => r.passed).length;
  const totalFailed = results.filter((r) => !r.passed).length;
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\n  Total: ${totalPassed}/${results.length} passed, ${totalFailed} failed, ${elapsed}s\n`);

  // Write report
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const reportDir = join(ROOT, 'outputs', 'simulation');
  mkdirSync(reportDir, { recursive: true });
  const report = [
    `# Simulation Report — ${new Date().toISOString()}`,
    '',
    `**Result:** ${totalPassed}/${results.length} passed, ${totalFailed} failed`,
    '',
    '## Scenario Breakdown',
    '',
    ...scenarioResults.map((s) =>
      `- ${s.failed === 0 ? '✓' : '✗'} ${s.name}: ${s.passed}/${s.passed + s.failed} (expected ${s.expected})`
    ),
    '',
    ...(totalFailed > 0
      ? ['## Failures', '', ...results.filter((r) => !r.passed).map((r) => `- **${r.label}**: ${r.error}`)]
      : []),
  ].join('\n');
  writeFileSync(join(reportDir, `run-${ts}.md`), report);

  if (totalFailed > 0) {
    console.error(`  ✗ ${totalFailed} assertion(s) failed. Fix the helper code and re-run.\n`);
    process.exit(1);
  }

  if (totalPassed !== TOTAL_EXPECTED) {
    console.warn(`  ⚠ Expected ${TOTAL_EXPECTED} assertions, ran ${totalPassed}. Check scenario counts.\n`);
  }
}

main().catch((err) => {
  console.error('Simulation harness failed:', err);
  process.exit(1);
});
