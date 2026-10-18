// Run: node src/lib/qld-holidays.check.ts
import assert from 'node:assert/strict';

import { qldHolidays } from './qld-holidays.ts';

const days = qldHolidays([
  { date: '2026-01-26', localName: 'Australia Day', global: true, counties: null },
  { date: '2026-05-04', localName: 'Labour Day', global: false, counties: ['AU-QLD', 'AU-NT'] },
  { date: '2026-03-09', localName: 'Labour Day', global: false, counties: ['AU-VIC'] }, // not Queensland
  { date: '2026-08-12', localName: 'Royal Queensland Show', global: false, counties: null }, // regional, no county list
]);
assert.deepEqual([...days], [
  ['2026-01-26', 'Australia Day'],
  ['2026-05-04', 'Labour Day'],
]);
assert.equal(qldHolidays([]).size, 0);
console.log('qld-holidays: ok');
