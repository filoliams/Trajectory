# Spec: `ingest-core`

Status: **approved** (plan approved 2026-10-18) · Map: [SPEC.md](SPEC.md)

Supersedes the delivery design of `docs/SPEC-ai-progress-analysis.md`, which used a FastAPI
`/analyze-notes` endpoint. That spec's rubric and its `topics.understanding*` columns carry over.

## Objective

A single pipeline that takes a note file from any route, works out which course it belongs to, and
records how well it covers each of that course's topics. Topic levels then drive the course chip and
the daily study plan.

**Users:** a handful of beta testers (UQ students) on iPad, phone and web.

**Acceptance criteria**

1. The hash check returns only new or changed files, so unchanged files are never uploaded or re-analysed.
2. `notes-ingest` handles `.md`, `.txt`, `.pdf` (with a text layer or handwritten) and images
   (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`). HTML is phase 3.
3. Course comes from a course code in the path or filename first, otherwise from Claude choosing among
   the user's courses (`course_source = 'ai'`, with a confidence). A notebook can cover several courses:
   each one found is scored, and the file's `course_id` is the main one (the folder's, else the most confident).
4. Each analysed document stores a level (`none|weak|okay|strong`) and a one-line reason per topic.
   Claude first says where in the notes each topic appears (pages or headings), then rates only that
   evidence; a topic with no location is `none`. The reason starts with the location, e.g. "pp. 12-15 · …".
   `topics.understanding` is the **best** level across that topic's documents.
5. **No note text and no original file is kept after processing.** The storage object is deleted on
   success and on failure. Leftovers (uploaded but never read, e.g. the app closed mid-sync) are
   removed on the user’s next sync once they’re 24 hours old. Storage can only be cleaned through
   the Storage API, not SQL, so this replaces the planned pg_cron sweep.
6. Row-level security on every table and on the bucket: a user can never see or touch another user's rows.
7. Limits:
   - 20 MB per file. A larger file is marked `skipped` with a reason.
   - 25 analyses per user per day. Over the cap, the document is `failed` with a message.
   - At most 200 files per hash check.
8. Errors a student sees are plain sentences, never stack traces.

## Tech stack

- **Supabase:** Postgres, Storage, and Edge Functions on the Deno runtime.
- **Libraries:** `npm:@supabase/supabase-js@2.118.0` and `npm:@anthropic-ai/sdk@0.135.0`.
- **Claude:** `claude-haiku-5-5`, effort `low`, structured output
  (`output_config.format: json_schema`), streaming with `finalMessage()`. Haiku has no server-side
  refusal fallback; a refusal marks the document `failed`.
- **App:** Expo SDK 57 and TypeScript. Phase 1 only displays results.

## Commands

```
Self-checks (pure modules):  node supabase/functions/_shared/check.ts
App checks:                  cd app; npx tsc --noEmit; npx expo lint; node src/lib/levels.check.ts
Link project (once):         npx supabase login; npx supabase link --project-ref <ref>
Secret:                      npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
Deploy:                      npx supabase functions deploy notes-check notes-ingest
Migration:                   paste supabase/migrations/20261021000000_note_ingestion.sql into the SQL editor
```

## Project structure

```
supabase/migrations/20261021000000_note_ingestion.sql   tables, RLS, bucket + policies
supabase/tests/ingest-live.mjs                          live check against the deployed functions
supabase/functions/_shared/                             pure modules (no imports) + check.ts
  diff.ts  course-code.ts  aggregate.ts  analysis.ts     decisions, validation, prompt building
supabase/functions/_shared/supabase.ts                  client bound to the caller's JWT
supabase/functions/_shared/claude.ts                    the one Claude call
supabase/functions/notes-check/index.ts
supabase/functions/notes-ingest/index.ts
app/src/lib/levels.ts (+ levels.check.ts)               course level from analysed topics
```

## Code style

Pure logic lives in import-free modules so plain Node can test it. I/O lives in the function entry
points. Comments say why, and user-facing errors are full sentences.

```ts
/** Which picked files the server still needs: new, or changed since they were last analysed. */
export function filesNeeded(files: PickedFile[], known: Map<string, KnownDoc>): Decision[] {
  return files.map((f) => {
    const doc = known.get(f.path);
    return { path: f.path, need: !doc || doc.analyzedHash !== f.contentHash, documentId: doc?.id ?? null };
  });
}
```

## Testing strategy

- **`_shared/check.ts`** asserts the pure modules:
  - hash-check decisions
  - course code from path or filename
  - best-level aggregation
  - validation of Claude's reply: unknown topic ids dropped, missing topics set to `none`, a course
    outside the user's list rejected
  - prompt building keeps note text inside delimited blocks
- **`app/src/lib/levels.check.ts`:** the course level, both from analysed topics and from the
  word-match fallback.
- **Live checks after deploying** (needs your Supabase login and an Anthropic key):
  - the six-step script in the plan's verification section
  - one real 30–50 page GoodNotes PDF, to record the time and token cost against the Edge Function wall clock

## Boundaries

- **Always:**
  - Use the caller's JWT client, so row-level security authorises every read and write.
  - Delete the original after processing.
  - Log token usage, never content.
  - Validate Claude's output.
- **Ask first:**
  - Running the migration.
  - Deploying functions.
  - Setting secrets.
  - Any run that spends API money.
  - Changing the model or the caps.
- **Never:**
  - Store note text.
  - Use the service role on a user request path.
  - Put the Anthropic key in the app.
  - Silently truncate a document.

## Success criteria

The plan's phase 1 verification passes:
- the self-checks
- the app's tsc, lint and checks
- the six-step live script, including a row-level-security probe with a second account and "object deleted after processing"
- MATH1051 topics show level chips and reasons in the app

## Open questions (defaults in use)

1. **Model:** settled 2026-10-22: Haiku 5.5 at effort `low`. Check handwriting quality on the real GoodNotes PDF.
2. **Daily cap:** 25 analyses per user per day.
3. **Deployment:** the CLI and the SQL editor (not the GitHub integration).
