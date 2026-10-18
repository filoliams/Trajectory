// Run: node src/lib/levels.check.ts
import assert from 'node:assert/strict';

import { courseLevel, type Understanding } from './levels.ts';

const t = (hasNotes: boolean, understanding: Understanding | null = null) => ({ hasNotes, understanding });

// No topics yet.
assert.equal(courseLevel([]), 'none');

// Fewer than half analysed: notes coverage decides (same thresholds as before).
assert.equal(courseLevel([t(false), t(false), t(true)]), 'weak'); // 33%
assert.equal(courseLevel([t(true), t(true), t(false)]), 'okay'); // 67%
assert.equal(courseLevel([t(true), t(true), t(true), t(false)]), 'strong'); // 75%
assert.equal(courseLevel([t(true, 'strong'), t(false), t(false)]), 'weak'); // 1 of 3 analysed: still coverage

// At least half analysed: average of the analysed levels.
assert.equal(courseLevel([t(true, 'strong'), t(false)]), 'strong'); // exactly half
assert.equal(courseLevel([t(true, 'none'), t(true, 'weak')]), 'weak'); // avg 0.5
assert.equal(courseLevel([t(true, 'weak'), t(true, 'okay')]), 'okay'); // avg 1.5
assert.equal(courseLevel([t(true, 'okay'), t(true, 'strong')]), 'strong'); // avg 2.5
assert.equal(courseLevel([t(true, 'weak'), t(true, 'weak'), t(true, 'strong')]), 'okay'); // avg 1.67
assert.equal(courseLevel([t(true, 'okay'), t(true, 'okay')]), 'strong'); // avg 2.0 boundary

console.log('levels: ok');
