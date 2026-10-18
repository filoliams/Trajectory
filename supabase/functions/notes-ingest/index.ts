// POST { document_id } → 202. Reads one uploaded note file, works out its course, records how well it
// covers each topic, then deletes the original. Progress shows in documents.status.

import { encodeBase64 } from 'jsr:@std/encoding@1/base64';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0';

import { bestByTopic } from '../_shared/aggregate.ts';
import { EXTRACTOR_VERSION, buildUserText, fileKind, validateResult, type CourseTopics } from '../_shared/analysis.ts';
import { askClaude } from '../_shared/claude.ts';
import { courseFromPath } from '../_shared/course-code.ts';
import { extensionOf } from '../_shared/diff.ts';
import { Friendly, asCaller, json, preflight } from '../_shared/http.ts';

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const MAX_BYTES = 20 * 1024 * 1024;
const DAILY_CAP = 25;

type Doc = { id: number; connection_id: number; path: string; title: string; content_hash: string; course_id: number | null; course_source: string | null };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const caller = await asCaller(req);
  if (!caller) return json({ error: 'Sign in again to sync your notes.' }, 401);
  const { db, user } = caller;

  const body = (await req.json().catch(() => null)) as { document_id?: unknown } | null;
  if (typeof body?.document_id !== 'number') return json({ error: 'Missing document_id.' }, 422);

  const { data: doc } = await db
    .from('documents')
    .select('id, connection_id, path, title, content_hash, course_id, course_source')
    .eq('id', body.document_id)
    .maybeSingle();
  if (!doc) return json({ error: 'That note isn’t yours or no longer exists.' }, 404);

  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const { count } = await db.from('sync_jobs').select('id', { count: 'exact', head: true }).gte('created_at', since);
  if ((count ?? 0) >= DAILY_CAP) {
    const message = `You’ve reached today’s limit of ${DAILY_CAP} note analyses. It resets tomorrow.`;
    await setDoc(db, doc.id, { status: 'failed', error: message });
    return json({ error: message }, 429);
  }

  const { data: job } = await db
    .from('sync_jobs')
    .insert({ user_id: user.id, connection_id: doc.connection_id, document_id: doc.id, status: 'running' })
    .select('id')
    .single();
  await setDoc(db, doc.id, { status: 'processing', error: null });

  EdgeRuntime.waitUntil(ingest(db, user.id, doc as Doc, job?.id ?? null));
  return json({ document_id: doc.id, status: 'processing' }, 202);
});

async function ingest(db: SupabaseClient, userId: string, doc: Doc, jobId: number | null) {
  const objectPath = `${userId}/${doc.id}/${doc.content_hash}.${extensionOf(doc.title)}`;
  try {
    const type = fileKind(extensionOf(doc.title));
    if (!type) throw new Skip('This file type isn’t supported yet. Use PDFs, images, Markdown or text files.');

    const { data: blob, error: downloadError } = await db.storage.from('notes').download(objectPath);
    if (downloadError || !blob) throw new Friendly('The uploaded file couldn’t be found. Sync it again.');
    if (blob.size > MAX_BYTES) throw new Skip('This file is over 20 MB. Split it into smaller files.');
    const bytes = new Uint8Array(await blob.arrayBuffer());

    const courses = await coursesWithTopics(db, userId);
    if (!courses.length) throw new Skip('Add your courses first, then sync your notes.');
    // A course the student picked by hand wins, then a course code in the path, then Claude.
    const pinned = doc.course_source === 'user' ? courses.find((c) => c.id === doc.course_id) ?? null : null;
    const fromPath = pinned ?? courseFromPath(doc.path, courses);

    const noteText = type.kind === 'text' ? new TextDecoder().decode(bytes) : null;
    const content = [];
    if (type.kind === 'pdf') content.push({ type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: encodeBase64(bytes) } });
    if (type.kind === 'image') content.push({ type: 'image' as const, source: { type: 'base64' as const, media_type: type.mediaType as 'image/png', data: encodeBase64(bytes) } });
    content.push({ type: 'text' as const, text: buildUserText({ fileName: doc.title, courses, knownCode: fromPath?.code ?? null, noteText }) });

    const reply = await askClaude(content, courses.map((c) => c.code));
    const analysis = validateResult(reply.raw, courses, fromPath?.code ?? null);

    await db.from('document_topics').delete().eq('document_id', doc.id);
    if (analysis.readings.length) {
      const { error } = await db.from('document_topics').insert(
        analysis.readings.map((r) => ({ user_id: userId, document_id: doc.id, topic_id: r.topicId, level: r.level, reason: r.reason })),
      );
      if (error) throw new Error(`document_topics insert: ${error.message}`);
    }

    const source = pinned ? 'user' : fromPath ? 'folder' : analysis.course ? 'ai' : null;
    await setDoc(db, doc.id, {
      course_id: analysis.course?.id ?? null,
      course_source: source,
      course_confidence: analysis.course ? analysis.confidence : null,
      analyzed_hash: doc.content_hash,
      extractor_version: EXTRACTOR_VERSION,
      status: 'done',
      error: analysis.course ? null : 'Couldn’t tell which course this file belongs to. Choose one to include it.',
    });

    // Re-score the course this file now belongs to, and the one it used to belong to.
    for (const courseId of new Set([analysis.course?.id, doc.course_id].filter((id): id is number => id != null))) {
      await reaggregate(db, courseId, courses);
    }
    await finishJob(db, jobId, { status: 'done', input_tokens: reply.inputTokens, output_tokens: reply.outputTokens });
    console.log(JSON.stringify({ event: 'ingested', document_id: doc.id, kind: type.kind, bytes: bytes.length, input_tokens: reply.inputTokens, output_tokens: reply.outputTokens }));
  } catch (e) {
    const skipped = e instanceof Skip;
    const message = e instanceof Friendly || skipped ? e.message : 'Something went wrong reading this file. Try syncing it again.';
    await setDoc(db, doc.id, { status: skipped ? 'skipped' : 'failed', error: message });
    await finishJob(db, jobId, { status: 'failed', error: e instanceof Error ? e.message.slice(0, 500) : 'unknown error' });
    console.error(JSON.stringify({ event: 'ingest_failed', document_id: doc.id, error: e instanceof Error ? e.message.slice(0, 500) : String(e) }));
  } finally {
    // Not a backup service: the original goes whether or not it was read.
    await db.storage.from('notes').remove([objectPath]);
  }
}

/** A file that can't be read for a reason the student can fix; not counted as an error. */
class Skip extends Friendly {}

async function coursesWithTopics(db: SupabaseClient, userId: string): Promise<CourseTopics[]> {
  const { data: profile } = await db.from('profiles').select('semester').eq('id', userId).single();
  let query = db.from('courses').select('id, code, name');
  if (profile?.semester) query = query.eq('semester', profile.semester);
  const { data: courses } = await query;
  if (!courses?.length) return [];
  const { data: topics } = await db
    .from('topics')
    .select('id, course_id, name, week')
    .in('course_id', courses.map((c) => c.id))
    .order('position');
  return courses.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name ?? '',
    topics: (topics ?? []).filter((t) => t.course_id === c.id).map((t) => ({ id: t.id, name: t.name, week: t.week })),
  }));
}

/** Each topic's level becomes the best level any of its documents shows. */
async function reaggregate(db: SupabaseClient, courseId: number, courses: CourseTopics[]) {
  const topicIds = courses.find((c) => c.id === courseId)?.topics.map((t) => t.id) ?? [];
  if (!topicIds.length) return;
  const { data: rows } = await db.from('document_topics').select('topic_id, level, reason').in('topic_id', topicIds);
  const best = bestByTopic((rows ?? []).map((r) => ({ topicId: r.topic_id, level: r.level, reason: r.reason })));
  const now = new Date().toISOString();
  for (const topicId of topicIds) {
    const reading = best.get(topicId);
    await db
      .from('topics')
      .update(reading ? { understanding: reading.level, understanding_reason: reading.reason, analyzed_at: now } : { understanding: null, understanding_reason: null, analyzed_at: null })
      .eq('id', topicId);
  }
}

function setDoc(db: SupabaseClient, id: number, fields: Record<string, unknown>) {
  return db.from('documents').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id);
}

function finishJob(db: SupabaseClient, id: number | null, fields: Record<string, unknown>) {
  if (id === null) return Promise.resolve();
  return db.from('sync_jobs').update({ ...fields, finished_at: new Date().toISOString() }).eq('id', id);
}
