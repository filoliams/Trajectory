# Tasks: note ingestion, phase 1 (`ingest-core`)

Spec: [SPEC-ingest-core.md](../SPEC-ingest-core.md) · Plan: [plan.md](plan.md)

- [x] **Specs:** `SPEC.md` (capability map) and `SPEC-ingest-core.md`.
- [x] **Pure modules:** `supabase/functions/_shared/{diff,course-code,aggregate,analysis}.ts`.
  - Verify: `node supabase/functions/_shared/check.ts` → `ingest-core checks: ok`
- [x] **Migration:** `supabase/migrations/20261021000000_note_ingestion.sql`. Covers the tables, row-level security on every table, the private `notes` bucket with per-user path policies, and the `topics.understanding*` columns.
- [x] **Edge Functions:** `notes-check` and `notes-ingest`, plus `_shared/http.ts` and `_shared/claude.ts`.
  - Verify: `npx deno@2 check supabase/functions/notes-*/index.ts` is clean.
- [x] **App:**
  - `Topic.understanding` and `understandingReason`.
  - The topics query uses `select('*')`, so the app works before and after the migration.
  - `lib/levels.ts` and its self-check; `notesLevel` delegates to it.
  - Level chips with a tap-to-show reason in `topic-list.tsx`.
  - Verify: `tsc` and lint are clean, and `node src/lib/levels.check.ts` passes.
- [x] **Docs:**
  - `docs/NOTES_INGESTION_SETUP.md` written.
  - The old AI-analysis spec is marked superseded.
  - The README roadmap is updated.
- [ ] **You:** run the migration, `supabase link`, set the secret, deploy (setup steps 1–4).
- [ ] **Live check:** `node supabase/tests/ingest-live.mjs`, with `OTHER_EMAIL`/`OTHER_PASSWORD` and `PDF_PATH`.
  - Costs API money; run it when ready.
- [ ] **iPad (Expo Go):** open MATH1051. Topics show level chips, tapping one shows its reason, and
  the course chip and Today's hours change.
