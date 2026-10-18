// Run: node src/lib/notes-match.check.ts
import assert from 'node:assert/strict';

import { coveredTopics } from './notes-match.ts';

const topics = [
  { name: 'Hypothesis testing' },
  { name: 'Confidence intervals' },
  { name: 'Linear regression and correlation' },
  { name: 'Probability' },
  { name: 'Bayes' },
  { name: 'Week 3' },
];
const names = (notes: string[]) => coveredTopics(topics, notes).map((t) => t.name);

assert.deepEqual(names(['# Hypothesis Testing\nNull vs alternative']), ['Hypothesis testing']);
assert.deepEqual(names(['Today: testing a hypothesis with a t-test']), ['Hypothesis testing']);
assert.deepEqual(names(['Built a confidence interval for the mean']), ['Confidence intervals']);
assert.deepEqual(names(['regression only']), []); // 1 of 2 keywords isn't enough
assert.deepEqual(names(['Notes on probability spaces']), ['Probability']);
assert.deepEqual(names(['bayesian thinking']), []); // short single words need an exact phrase
assert.deepEqual(names(['## Bayes rule']), ['Bayes']);
assert.deepEqual(names(['week 3 lecture']), ['Week 3']); // exact phrase still counts
assert.deepEqual(names(['']), []);
console.log('notes-match: ok');
