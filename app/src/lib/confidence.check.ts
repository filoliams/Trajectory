// Run: node src/lib/confidence.check.ts
import assert from 'node:assert/strict';

import { band, courseConfidence, topicConfidence, trend, weekChange, weekStart } from './confidence.ts';
import type { Understanding } from './levels.ts';

const quiz = (score: number, at: string) => ({ score, total: 3, at });
const t = (understanding: Understanding | null, quizzes: { score: number; total: number; at: string }[] = [], hasNotes = understanding !== null) => ({
  hasNotes,
  understanding,
  quizzes,
});

// No quiz: notes alone, at most 60%.
assert.equal(topicConfidence(t('strong')), 60);
assert.equal(topicConfidence(t('weak')), 20);
assert.equal(topicConfidence(t(null)), 0);
assert.equal(topicConfidence(t(null, [], true)), 30); // ticked by hand, not analysed
assert.equal(topicConfidence({ hasNotes: false, understanding: null }), 0); // cache from before quizzes

// One quiz: notes 40%, quiz 60%.
assert.equal(topicConfidence(t('okay', [quiz(2, '2026-10-20T10:00:00Z')])), 67); // 26.8 + 40
// Two or more: notes 20%, last two quizzes 80%; weak notes plus full marks reach Confident.
assert.equal(topicConfidence(t('weak', [quiz(3, '2026-10-20T10:00:00Z'), quiz(3, '2026-10-21T10:00:00Z')])), 87);
assert.equal(band(87), 'confident');
// Only the last two quizzes count.
assert.equal(topicConfidence(t('okay', [quiz(0, '2026-10-01T10:00:00Z'), quiz(3, '2026-10-20T10:00:00Z'), quiz(3, '2026-10-21T10:00:00Z')])), 93);

// Bands.
assert.equal(band(75), 'confident');
assert.equal(band(74), 'getting-there');
assert.equal(band(40), 'getting-there');
assert.equal(band(39), 'shaky');

// Bubble: the latest quiz against confidence before it.
assert.equal(trend(t('okay')), null);
assert.equal(trend(t('okay', [quiz(1, '2026-10-18T10:00:00Z'), quiz(2, '2026-10-28T10:00:00Z')])), 'up');
assert.equal(trend(t('okay', [quiz(2, '2026-10-22T10:00:00Z'), quiz(1, '2026-10-27T10:00:00Z')])), 'down');
assert.equal(trend(t('strong', [quiz(3, '2026-10-20T10:00:00Z'), quiz(3, '2026-10-29T10:00:00Z')])), 'same');

// This week: Monday 00:00 local; quizzes from before it set the baseline.
const fri = new Date(2026, 9, 30, 10, 30).getTime(); // Friday 30 October 2026
assert.equal(new Date(weekStart(fri)).getDay(), 1);
assert.equal(new Date(weekStart(fri)).getDate(), 26);
const sunday = new Date(2026, 10, 1, 9).getTime(); // Sunday belongs to the week that started Monday 26th
assert.equal(new Date(weekStart(sunday)).getDate(), 26);
const prob = t('okay', [quiz(1, new Date(2026, 9, 18, 9).toISOString()), quiz(2, new Date(2026, 9, 28, 9).toISOString())]);
assert.equal(weekChange(prob, fri), 6); // 47 → 53
assert.equal(weekChange(t('weak'), fri), 0);

// Course: average of its topics.
assert.equal(courseConfidence([]), null);
assert.equal(courseConfidence([t('strong'), t('weak')]), 40);

console.log('confidence: ok');
