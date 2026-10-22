// Run: node src/lib/study-stats.check.ts
import assert from 'node:assert/strict';

import { daysEnding, streak } from './study-stats.ts';

// The last n days, oldest first, ending on the given day; crosses month and year ends.
assert.deepEqual(daysEnding('2026-10-23', 3), ['2026-10-21', '2026-10-22', '2026-10-23']);
assert.deepEqual(daysEnding('2027-01-01', 2), ['2026-12-31', '2027-01-01']);
assert.deepEqual(daysEnding('2028-03-01', 2), ['2028-02-29', '2028-03-01']); // leap year

const days = daysEnding('2026-10-23', 7);
const study = (entries: [string, number][]) => new Map(entries);

// Nothing studied: no streak.
assert.equal(streak(study([]), days), 0);
// Studied today and the two days before.
assert.equal(streak(study([['2026-10-21', 1], ['2026-10-22', 5], ['2026-10-23', 9]]), days), 3);
// Not yet today: yesterday's run still counts, so the streak isn't lost before you start.
assert.equal(streak(study([['2026-10-21', 1], ['2026-10-22', 5]]), days), 2);
// A gap ends the run.
assert.equal(streak(study([['2026-10-19', 1], ['2026-10-21', 1], ['2026-10-22', 1], ['2026-10-23', 1]]), days), 3);
// Missed yesterday and today: broken.
assert.equal(streak(study([['2026-10-21', 1]]), days), 0);
// Zero minutes isn't a study day.
assert.equal(streak(study([['2026-10-22', 0], ['2026-10-23', 4]]), days), 1);

console.log('study-stats: ok');
