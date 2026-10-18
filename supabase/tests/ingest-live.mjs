// Live check of the deployed ingest-core functions. Costs two small Claude calls (a few cents).
//
//   set SUPABASE_URL=https://<ref>.supabase.co
//   set SUPABASE_KEY=<publishable/anon key>
//   set TEST_EMAIL=...   set TEST_PASSWORD=...
//   (optional, for the row-level-security probe) set OTHER_EMAIL=...  set OTHER_PASSWORD=...
//   node supabase/tests/ingest-live.mjs
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';

const { SUPABASE_URL: url, SUPABASE_KEY: key, TEST_EMAIL, TEST_PASSWORD, OTHER_EMAIL, OTHER_PASSWORD } = process.env;
if (!url || !key || !TEST_EMAIL || !TEST_PASSWORD) throw new Error('Set SUPABASE_URL, SUPABASE_KEY, TEST_EMAIL and TEST_PASSWORD.');

async function signIn(email, password) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  assert.ok(res.ok, `sign-in failed: ${JSON.stringify(body)}`);
  return body.access_token;
}

const call = (token, fn, body) =>
  fetch(`${url}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const rest = (token, path) => fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
const sha256 = (text) => createHash('sha256').update(text).digest('hex');

const token = await signIn(TEST_EMAIL, TEST_PASSWORD);
const device = `live-test-${randomUUID()}`;
const notes = [
  { path: 'MATH1051/Limits.md', text: '# Limits\nThe limit of f(x) as x approaches a. Worked example: lim x->2 of (x^2-4)/(x-2) = 4.' },
  { path: 'MATH1051/Derivatives.md', text: '# Derivatives\nProduct rule: (fg)\' = f\'g + fg\'.' },
];
const describe = (n, text = n.text) => ({ path: n.path, name: n.path.split('/').pop(), size: Buffer.byteLength(text), content_hash: sha256(text) });

// 1. Both files are new.
let res = await call(token, 'notes-check', { provider: 'files', device_id: device, files: notes.map((n) => describe(n)) });
let body = await res.json();
assert.equal(res.status, 200, JSON.stringify(body));
assert.equal(body.needed.length, 2, '1. both files should be needed');
console.log('1. notes-check: 2 needed');

// 2. Upload and analyse; wait for done.
for (const need of body.needed) {
  const note = notes.find((n) => n.path === need.path);
  const up = await fetch(`${url}/storage/v1/object/notes/${need.upload_path}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'text/markdown', 'x-upsert': 'true' },
    body: note.text,
  });
  assert.ok(up.ok, `upload failed: ${await up.text()}`);
  const ingest = await call(token, 'notes-ingest', { document_id: need.document_id });
  assert.equal(ingest.status, 202, await ingest.text());
}
for (const need of body.needed) {
  let doc;
  for (let i = 0; i < 60; i++) {
    [doc] = await (await rest(token, `documents?id=eq.${need.document_id}&select=status,error,course_source`)).json();
    if (doc.status === 'done' || doc.status === 'failed' || doc.status === 'skipped') break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  assert.equal(doc.status, 'done', `2. ${need.path}: ${doc.status} ${doc.error ?? ''}`);
  assert.equal(doc.course_source, 'folder', '2. course should come from the MATH1051 folder');
  const readings = await (await rest(token, `document_topics?document_id=eq.${need.document_id}&select=level,reason`)).json();
  console.log(`2. ${need.path}: done, ${readings.length} topic readings`, readings.slice(0, 3));

  // 6. The original is gone once read.
  const object = await fetch(`${url}/storage/v1/object/notes/${need.upload_path}`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
  assert.ok(!object.ok, '6. the uploaded original should be deleted after processing');
}
console.log('6. originals deleted');

// 3. Nothing changed: nothing needed.
res = await call(token, 'notes-check', { provider: 'files', device_id: device, files: notes.map((n) => describe(n)) });
body = await res.json();
assert.equal(body.needed.length, 0, '3. unchanged files should not be needed');
console.log('3. notes-check again: 0 needed');

// 4. One file changed: just that one.
res = await call(token, 'notes-check', { provider: 'files', device_id: device, files: [describe(notes[0], `${notes[0].text}\nMore.`), describe(notes[1])] });
body = await res.json();
assert.deepEqual(body.needed.map((n) => n.path), [notes[0].path], '4. only the changed file should be needed');
console.log('4. changed file: 1 needed');

// 5. Another account sees none of it.
if (OTHER_EMAIL && OTHER_PASSWORD) {
  const other = await signIn(OTHER_EMAIL, OTHER_PASSWORD);
  const theirs = await (await rest(other, `documents?select=id&path=like.MATH1051*`)).json();
  const mine = await (await rest(token, `documents?select=id&path=like.MATH1051*`)).json();
  assert.ok(!theirs.some((d) => mine.some((m) => m.id === d.id)), '5. another user must not see these documents');
  console.log('5. row-level security: other account sees none of them');
} else {
  console.log('5. skipped (set OTHER_EMAIL / OTHER_PASSWORD to probe row-level security)');
}
// 7. Optional: time a real handwritten PDF against the Edge Function wall clock (set PDF_PATH; costs ~$0.30).
if (process.env.PDF_PATH) {
  const { readFile } = await import('node:fs/promises');
  const pdf = await readFile(process.env.PDF_PATH);
  const name = process.env.PDF_PATH.split(/[\\/]/).pop();
  const file = { path: `MATH1051/${name}`, name, size: pdf.length, content_hash: createHash('sha256').update(pdf).digest('hex') };
  const [need] = (await (await call(token, 'notes-check', { provider: 'files', device_id: device, files: [file] })).json()).needed;
  const up = await fetch(`${url}/storage/v1/object/notes/${need.upload_path}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/pdf', 'x-upsert': 'true' },
    body: pdf,
  });
  assert.ok(up.ok, `PDF upload failed: ${await up.text()}`);
  const started = Date.now();
  await call(token, 'notes-ingest', { document_id: need.document_id });
  let doc;
  for (let i = 0; i < 150; i++) {
    [doc] = await (await rest(token, `documents?id=eq.${need.document_id}&select=status,error`)).json();
    if (doc.status !== 'processing' && doc.status !== 'pending') break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  const [job] = await (await rest(token, `sync_jobs?document_id=eq.${need.document_id}&select=status,input_tokens,output_tokens&order=id.desc&limit=1`)).json();
  console.log(`7. ${name} (${(pdf.length / 1e6).toFixed(1)} MB): ${doc.status} in ${((Date.now() - started) / 1000).toFixed(0)}s`, job, doc.error ?? '');
}
console.log('ingest-core live checks: ok');
