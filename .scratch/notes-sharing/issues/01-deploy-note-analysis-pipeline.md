# 01: Deploy the note-analysis pipeline

**What to build:** The server side of note ingestion goes live, so the app can send notes for AI analysis. This is a human task: running migrations, setting secrets and deploying all need the owner's go-ahead, and the live check spends API money.

**Blocked by:** None (can start immediately)

**Status:** done (closed by the owner 2026-10-22, with the follow-ups below)

- [x] Note-ingestion migration run (tables, topic columns, `notes` bucket, 8 row-level-security policies confirmed)
- [x] Project linked with the Supabase CLI and the Anthropic key set as a Supabase secret (never in the app)
- [x] `notes-check` and `notes-ingest` deployed (both ACTIVE)
- [ ] Live ingest script passes. **Partial:** step 1 (hash check) passed; both test notes uploaded, were read by Haiku (~870 in / 30 out tokens each) and their originals were deleted (bucket empty afterwards). The run stopped at the course check because the test account has no MATH1051 (only CSSE2010, with no topics), so the notes were correctly left unmatched. Steps 3–5 and the second-account RLS probe were not run.
- [ ] Time and token cost of one real 30–50 page GoodNotes PDF: moved to ticket 06, which records cost per file.

**Follow-up:** re-run `node supabase/tests/ingest-live.mjs` with the account that owns MATH1051 (plus `OTHER_EMAIL`/`OTHER_PASSWORD` for the RLS probe) before beta testers use note sync.
