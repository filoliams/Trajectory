# Plan: note ingestion

Map: [SPEC.md](../SPEC.md) · Current module: [SPEC-ingest-core.md](../SPEC-ingest-core.md)

This replaces the earlier FastAPI `/analyze-notes` plan. That analysis now runs inside `notes-ingest`
(see `docs/SPEC-ai-progress-analysis.md`, now marked superseded).

## Order

1. **`ingest-core`** (phase 1): migration, Edge Functions `notes-check` and `notes-ingest`, pure
   modules with self-checks, app display of topic levels. Live verification needs your Supabase
   login and an Anthropic key (`docs/NOTES_INGESTION_SETUP.md`).
2. **`files-route`** (phase 2): the "Sync notes" Files picker in Expo Go and on the web, with on-device
   hashing, uploading only what changed, a status list, and course confirmation. Gets its own spec first.
3. **`graph-connector`** (phase 3): the UQ consent test first, then OAuth through Vault, delta sync on
   pg_cron, and OneNote. Gets its own spec first.

## Risks being tracked

- **Edge Function wall clock on long handwritten PDFs:** measured by `ingest-live.mjs` with `PDF_PATH`.
- **Gateway JWT verification and the anon key variable on the new key system:** fallbacks are documented in the setup guide.
- **Model cost:** Opus 5.5 at effort `low`. Revisit after the PDF measurement.
