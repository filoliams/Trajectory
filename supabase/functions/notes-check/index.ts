// POST { provider, device_id, files: [{ path, name, size, content_hash, modified_at? }] }
// → { needed: [{ path, document_id, upload_path }], unchanged: [path] }
// Tells a device which picked files are new or changed, so only those get uploaded and analysed.

import { extensionOf, filesNeeded } from '../_shared/diff.ts';
import { asCaller, json, preflight } from '../_shared/http.ts';

const MAX_FILES = 200;
const LEFTOVER_MS = 24 * 3_600_000;

type FileIn = { path: string; name: string; size: number; content_hash: string; modified_at?: string | null };

function parse(body: unknown): { deviceId: string; files: FileIn[] } | string {
  const b = body as { provider?: unknown; device_id?: unknown; files?: unknown };
  if (b?.provider !== 'files') return 'Only the Files picker can sync from a device.';
  if (typeof b.device_id !== 'string' || !b.device_id || b.device_id.length > 200) return 'Missing device id.';
  if (!Array.isArray(b.files) || b.files.length === 0) return 'No files to check.';
  if (b.files.length > MAX_FILES) return `Sync up to ${MAX_FILES} files at a time.`;
  for (const f of b.files as FileIn[]) {
    const ok =
      typeof f?.path === 'string' && f.path.length > 0 && f.path.length <= 1000 &&
      typeof f.name === 'string' && f.name.length > 0 && f.name.length <= 300 &&
      typeof f.size === 'number' && f.size >= 0 &&
      typeof f.content_hash === 'string' && /^[a-f0-9]{64}$/.test(f.content_hash);
    if (!ok) return 'One of the files was described incorrectly.';
  }
  return { deviceId: b.device_id, files: b.files as FileIn[] };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const caller = await asCaller(req);
  if (!caller) return json({ error: 'Sign in again to sync your notes.' }, 401);
  const { db, user } = caller;

  const input = parse(await req.json().catch(() => null));
  if (typeof input === 'string') return json({ error: input }, 422);

  const { data: connection, error: connError } = await db
    .from('connections')
    .upsert(
      { user_id: user.id, kind: 'device', provider: 'files', device_id: input.deviceId, last_synced_at: new Date().toISOString() },
      { onConflict: 'user_id,provider,device_id' },
    )
    .select('id')
    .single();
  if (connError || !connection) return json({ error: 'Couldn’t start syncing. Try again.' }, 500);

  const { data: known, error: knownError } = await db
    .from('documents')
    .select('id, external_id, analyzed_hash')
    .eq('connection_id', connection.id)
    .in('external_id', input.files.map((f) => f.path));
  if (knownError) return json({ error: 'Couldn’t check your files. Try again.' }, 500);

  const decisions = filesNeeded(
    input.files.map((f) => ({ path: f.path, contentHash: f.content_hash })),
    (known ?? []).map((d) => ({ id: d.id, externalId: d.external_id, analyzedHash: d.analyzed_hash })),
  );
  const byPath = new Map(input.files.map((f) => [f.path, f]));

  const rows = decisions
    .filter((d) => d.need)
    .map((d) => {
      const f = byPath.get(d.path)!;
      return {
        user_id: user.id,
        connection_id: connection.id,
        external_id: f.path,
        path: f.path,
        title: f.name,
        size_bytes: f.size,
        source_modified_at: f.modified_at ?? null,
        content_hash: f.content_hash,
        status: 'pending',
        error: null,
        updated_at: new Date().toISOString(),
      };
    });

  let needed: { path: string; document_id: number; upload_path: string }[] = [];
  if (rows.length) {
    const { data: saved, error: saveError } = await db
      .from('documents')
      .upsert(rows, { onConflict: 'connection_id,external_id' })
      .select('id, external_id, title, content_hash');
    if (saveError || !saved) return json({ error: 'Couldn’t save your files’ details. Try again.' }, 500);
    needed = saved.map((d) => ({
      path: d.external_id,
      document_id: d.id,
      upload_path: `${user.id}/${d.id}/${d.content_hash}.${extensionOf(d.title)}`,
    }));
  }

  // Originals that were uploaded but never read (app closed mid-sync) are removed after a day.
  const cutoff = new Date(Date.now() - LEFTOVER_MS).toISOString();
  const { data: stale } = await db
    .from('documents')
    .select('id, title, content_hash')
    .in('status', ['pending', 'processing'])
    .lt('updated_at', cutoff);
  if (stale?.length) {
    await db.storage.from('notes').remove(stale.map((d) => `${user.id}/${d.id}/${d.content_hash}.${extensionOf(d.title)}`));
  }

  return json({ needed, unchanged: decisions.filter((d) => !d.need).map((d) => d.path) });
});
