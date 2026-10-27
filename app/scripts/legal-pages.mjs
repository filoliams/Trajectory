// Writes the landing page's legal pages (frontend/privacy.html, terms.html, data-consent.html)
// from src/lib/legal.ts, so the website and the app show the same wording.
// Run after editing legal.ts: node scripts/legal-pages.mjs
import { writeFileSync } from 'node:fs';

import { LEGAL_DOCS, legalHtml } from '../src/lib/legal.ts';

for (const doc of LEGAL_DOCS) {
  const file = new URL(`../../frontend/${doc.slug}.html`, import.meta.url);
  writeFileSync(file, legalHtml(doc));
  console.log(`wrote frontend/${doc.slug}.html`);
}
