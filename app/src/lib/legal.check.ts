// Run: node src/lib/legal.check.ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { LEGAL_DOCS, legalDoc, legalHtml } from './legal.ts';

// The three documents exist, and the app's routes can find each one.
assert.deepEqual(LEGAL_DOCS.map((d) => d.slug), ['privacy', 'terms', 'data-consent']);
for (const doc of LEGAL_DOCS) {
  assert.equal(legalDoc(doc.slug), doc);
  assert.ok(doc.sections.length > 0, `${doc.slug} has no sections`);
  for (const s of doc.sections) assert.ok(s.paragraphs?.length || s.bullets?.length, `${doc.slug}: "${s.heading}" is empty`);
}
assert.equal(legalDoc('nope'), undefined);

// Text is escaped, so wording can't break the page.
const html = legalHtml({ slug: 'terms', title: 'A <b> & "c"', summary: 's', sections: [{ heading: 'h', paragraphs: ['x < y'] }] });
assert.ok(html.includes('A &lt;b&gt; &amp; &quot;c&quot;'));
assert.ok(html.includes('<p>x &lt; y</p>'));

// The website's copies match legal.ts. If this fails, run: node scripts/legal-pages.mjs
for (const doc of LEGAL_DOCS) {
  const onDisk = readFileSync(new URL(`../../../frontend/${doc.slug}.html`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(onDisk, legalHtml(doc), `frontend/${doc.slug}.html is out of date: run node scripts/legal-pages.mjs`);
}

console.log('legal checks passed');
