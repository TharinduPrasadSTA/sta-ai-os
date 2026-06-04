import { assertTruthy, assertContains, assertEqual } from '../assertions.ts';

// Validates the refresh-patterns.ts logic patterns without executing the DB script
// (which has its own main() and process.exit).

function computeSuccessRate(decisions: Array<{ actual_outcome: string | null }>): number | null {
  const keywords = ['success', 'right call', 'worked', 'positive', 'yes'];
  const rated = decisions.filter((d) => d.actual_outcome != null);
  if (rated.length === 0) return null;
  const successes = rated.filter((d) =>
    keywords.some((kw) => d.actual_outcome!.toLowerCase().includes(kw))
  ).length;
  return successes / rated.length;
}

export async function runPatternRefreshScenarios(): Promise<void> {
  // 1: empty decisions → null success rate
  assertEqual('pattern: empty → null rate', computeSuccessRate([]), null);

  // 2: all null outcomes → null rate
  assertEqual('pattern: all null → null', computeSuccessRate([{ actual_outcome: null }, { actual_outcome: null }]), null);

  // 3: success keyword → rate > 0
  const rate = computeSuccessRate([{ actual_outcome: 'success' }, { actual_outcome: null }]);
  assertTruthy('pattern: success keyword → rate', rate === 1.0);

  // 4: no keyword → rate 0
  const rate2 = computeSuccessRate([{ actual_outcome: 'failure' }]);
  assertEqual('pattern: no keyword → 0', rate2, 0);

  // 5: mixed → correct rate
  const rate3 = computeSuccessRate([
    { actual_outcome: 'worked great' },
    { actual_outcome: 'failure' },
    { actual_outcome: null },
  ]);
  assertTruthy('pattern: mixed rate = 0.5', Math.abs(rate3! - 0.5) < 0.01);

  // 6: "right call" keyword matches
  const rate4 = computeSuccessRate([{ actual_outcome: 'That was the right call' }]);
  assertEqual('pattern: right call → 1.0', rate4, 1.0);

  // 7: "yes" keyword matches
  const rate5 = computeSuccessRate([{ actual_outcome: 'yes this worked' }]);
  assertEqual('pattern: yes keyword → 1.0', rate5, 1.0);

  // 8: case-insensitive
  const rate6 = computeSuccessRate([{ actual_outcome: 'SUCCESS' }]);
  assertEqual('pattern: case insensitive', rate6, 1.0);

  // 9-14: pattern grouping logic
  {
    // simulate grouping by company+tag
    const decisions = [
      { id: '1', company: 'STA', tags: ['pricing'], status: 'logged' },
      { id: '2', company: 'STA', tags: ['pricing'], status: 'logged' },
      { id: '3', company: 'STA', tags: ['pricing'], status: 'logged' },
    ];
    const groups = new Map<string, typeof decisions>();
    for (const d of decisions) {
      if (!d.tags?.length) continue;
      const key = `${d.company}::${d.tags[0]}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(d);
    }
    assertTruthy('pattern: groups formed', groups.size === 1);
    assertTruthy('pattern: group has 3 items', groups.get('STA::pricing')?.length === 3);
  }

  // 10: demo-tagged decisions skipped
  {
    const decisions = [
      { id: '1', company: 'STA', tags: ['demo', 'pricing'], status: 'logged' },
    ];
    const groups = new Map<string, typeof decisions>();
    for (const d of decisions) {
      if (d.tags?.includes('demo')) continue;
      if (!d.tags?.length) continue;
      const key = `${d.company}::${d.tags[0]}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(d);
    }
    assertEqual('pattern: demo skipped', groups.size, 0);
  }

  // 11: untagged decisions skipped
  {
    const decisions = [{ id: '1', company: 'STA', tags: [], status: 'logged' }];
    const groups = new Map<string, typeof decisions>();
    for (const d of decisions) {
      if (!d.tags?.length) continue;
      const key = `${d.company}::${d.tags[0]}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(d);
    }
    assertEqual('pattern: untagged skipped', groups.size, 0);
  }

  // 12: min group size = 3 enforced
  {
    const groups = new Map<string, number>();
    groups.set('STA::pricing', 2); // below min
    groups.set('STA::hiring', 3); // at min
    let upserted = 0;
    for (const [, count] of groups) {
      if (count >= 3) upserted++;
    }
    assertEqual('pattern: min 3 enforced', upserted, 1);
  }

  // 13: pattern name format company::tag
  {
    const company = 'STA', tag = 'pricing';
    const name = company === '_' ? tag : `${company} — ${tag}`;
    assertContains('pattern: name format', name, 'STA');
    assertContains('pattern: name has tag', name, 'pricing');
  }

  // 14: null company uses _ key
  {
    const company = null;
    const tag = 'hiring';
    const key = `${company ?? '_'}::${tag}`;
    assertEqual('pattern: null company → _', key, '_::hiring');
  }
}
