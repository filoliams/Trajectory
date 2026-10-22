// Run: node src/lib/note-files.check.ts
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { courseFromPath } from '../../../supabase/functions/_shared/course-code.ts';
import { checkNoteFile, notePath, sha256Hex, summariseNotes } from './note-files.ts';

const bytes = (s: string) => new TextEncoder().encode(s);

// FIPS 180-2 test vectors.
assert.equal(sha256Hex(bytes('')), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
assert.equal(sha256Hex(bytes('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
assert.equal(
  sha256Hex(bytes('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')),
  '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
);

// Padding boundaries and a multi-block file agree with Node's implementation.
for (const n of [55, 56, 63, 64, 65, 1000, 1_000_003]) {
  const data = new Uint8Array(n).map((_, i) => (i * 31 + 7) & 0xff);
  assert.equal(sha256Hex(data), createHash('sha256').update(data).digest('hex'), `length ${n}`);
}

// Accepted types, with the content type the upload uses.
assert.deepEqual(checkNoteFile('Week 3 Limits.pdf', 1_000), { contentType: 'application/pdf' });
assert.deepEqual(checkNoteFile('lecture.MD', 10), { contentType: 'text/plain' });
assert.deepEqual(checkNoteFile('notes.txt', 10), { contentType: 'text/plain' });
assert.deepEqual(checkNoteFile('page.JPG', 10), { contentType: 'image/jpeg' });
assert.deepEqual(checkNoteFile('page.webp', 10), { contentType: 'image/webp' });

// Refused before upload, each with a sentence the student can act on.
assert.match((checkNoteFile('slides.pptx', 10) as { reason: string }).reason, /PDF/);
assert.match((checkNoteFile('README', 10) as { reason: string }).reason, /PDF/);
assert.match((checkNoteFile('big.pdf', 20 * 1024 * 1024 + 1) as { reason: string }).reason, /20 MB/);
assert.deepEqual(checkNoteFile('exact.pdf', 20 * 1024 * 1024), { contentType: 'application/pdf' });

// The server files a note under the course page it was added from...
const courses = [{ code: 'MATH1051' }, { code: 'CSSE2310' }];
assert.equal(courseFromPath(notePath('MATH1051', 'Week 3 Limits.pdf'), courses)?.code, 'MATH1051');
// ...unless the file name itself names another of the student's courses.
assert.equal(courseFromPath(notePath('MATH1051', 'CSSE2310 pointers.pdf'), courses)?.code, 'CSSE2310');
// A slash in a file name can't move it into another folder.
assert.equal(notePath('MATH1051', 'Week 3/Limits.pdf'), 'MATH1051/Week 3-Limits.pdf');

// What the student is told after adding notes: counts first, then each problem file with its reason.
assert.deepEqual(
  summariseNotes([
    { name: 'a.pdf', status: 'done' },
    { name: 'b.pdf', status: 'done' },
    { name: 'c.md', status: 'unchanged' },
    { name: 'd.pdf', status: 'analysing' },
    { name: 'e.pptx', status: 'skipped', reason: 'Use PDFs.' },
    { name: 'f.pdf', status: 'failed', reason: 'Limit reached.' },
  ]),
  [
    'Analysed 2 files.',
    '1 file unchanged since last time.',
    'Still analysing 1 file. Its levels appear when it’s done.',
    'e.pptx: Use PDFs.',
    'f.pdf: Limit reached.',
  ],
);
assert.deepEqual(summariseNotes([{ name: 'a.pdf', status: 'done' }]), ['Analysed 1 file.']);
assert.deepEqual(summariseNotes([]), []);
assert.deepEqual(summariseNotes([{ name: 'x.pdf', status: 'failed' }]), ['x.pdf: Couldn’t be read. Try adding it again.']);
assert.deepEqual(
  summariseNotes([{ name: 'a.pdf', status: 'analysing' }, { name: 'b.pdf', status: 'analysing' }]),
  ['Still analysing 2 files. Their levels appear when they’re done.'],
);

console.log('note-files: ok');
