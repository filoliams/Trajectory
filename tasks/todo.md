# Tasks: AI progress analysis

Spec: `docs/SPEC-ai-progress-analysis.md` · Plan: `tasks/plan.md`

- [ ] **1. Migration: topic analysis columns and the run log**
  - Acceptance:
    - `topics` has `understanding` (`check in none/weak/okay/strong`, nullable), `understanding_reason` and `analyzed_at`.
    - The new table `analysis_runs(id, user_id default auth.uid(), course_id, created_at)` has row-level security limiting each user to their own rows, and an index on `(user_id, created_at)`.
    - The file is safe to run twice (`if not exists`).
  - Verify:
    - You run it in the Supabase SQL editor and see "Success".
    - `select understanding from topics limit 1` works.
  - Files: `supabase/migrations/20261020000000_topic_analysis.sql`

- [ ] **2. Backend analysis module**
  - Acceptance:
    - `analyze(topics, notes, client) -> list[TopicLevel]` builds the system prompt (rubric, notes-are-data rule) and the user message (topic list, delimited notes).
    - It calls `client.messages.parse` with `claude-opus-5-5`, effort `low`, cached system prompt, and `fallbacks: "default"` with beta `server-side-fallback-2026-07-01`.
    - It checks `stop_reason`, validates against the Pydantic schema, drops unknown ids and fills missing topics with `none`.
    - Reasons are trimmed to one sentence of at most 200 characters.
    - `anthropic` is pinned in `requirements.txt`, using the version that installs.
  - Verify: `pytest backend/tests/test_notes_analysis.py`, with the client mocked:
    - happy path
    - unknown and missing ids
    - refusal raises `AnalysisRefused`
    - malformed output raises `AnalysisFailed`
    - the prompt contains no note text outside the delimited blocks
  - Files: `backend/notes_analysis.py`, `backend/tests/test_notes_analysis.py`, `backend/requirements.txt`

- [ ] **3. `POST /analyze-notes` endpoint**
  - Acceptance:
    - A bearer token is verified, and a missing or invalid one gives 401.
    - The course must belong to the user, otherwise 404.
    - No topics gives 422.
    - More than 200 KB of notes or more than 200 topics gives 413, before any Claude call.
    - More than 20 runs in the last 24 hours gives 429.
    - No key gives 503. Refusal or failure gives 502.
    - On success it upserts `understanding`, `understanding_reason` and `analyzed_at`, inserts into `analysis_runs`, and returns the spec's response shape.
    - Logs contain only ids, sizes, token usage and latency.
  - Verify: `pytest backend/tests/test_analyze_endpoint.py`, with Supabase and analysis mocked, covering every status code above, plus a test that note text never reaches the log records (caplog).
  - Files: `backend/main.py`, `backend/tests/test_analyze_endpoint.py`, `backend/conftest.py` if fixtures need it

- [ ] **4. Configuration and setup doc**
  - Acceptance:
    - `.env.example` documents `ANTHROPIC_API_KEY`, replacing the `AI_API_KEY` placeholder.
    - A setup doc explains getting a key, adding it to `.env`, running the migration, and restarting the backend.
  - Verify: read-through, and a backend restart without a key still starts (503 only on the new endpoint).
  - Files: `.env.example`, `docs/AI_ANALYSIS_SETUP.md`

- [ ] **Checkpoint A (backend)**
  - pytest is all green.
  - `curl` without a token gives 401; with a token and no key gives 503.
  - Ask before the one real call with a key.

- [ ] **5. App data model**
  - Acceptance:
    - `Topic` gains `understanding: Level | null`, `understandingReason: string | null` and `analyzedAt: string | null`.
    - `TopicRow` and `topicFromRow` map them, and undefined columns map to null.
    - The store gets `applyTopicAnalysis(results)`, which updates topics in memory and the cache. It does no outbox write, because the backend already saved the results.
    - The store's topics query includes the new columns.
  - Verify: `npx tsc --noEmit`, and the app loads Courses with the existing data unchanged.
  - Files: `app/src/data/courses.ts`, `app/src/lib/store.tsx`

- [ ] **6. Level from analysis**
  - Acceptance:
    - A pure `courseLevel(topics)` in `lib/levels.ts`, with no imports.
    - If at least half the topics are analysed, it averages them (none = 0 … strong = 3; under 1 is weak, under 2 is okay, otherwise strong). Otherwise it uses the word-match coverage rule.
    - `notesLevel` delegates to it.
  - Verify: `node src/lib/levels.check.ts` (asserts for both branches and the boundaries), and `tsc`.
  - Files: `app/src/lib/levels.ts`, `app/src/lib/levels.check.ts`, `app/src/lib/planning.ts`

- [ ] **7. API client**
  - Acceptance:
    - `analyzeNotes(courseId, notes)` reads the current Supabase session's access token, posts JSON to `${API_URL}/analyze-notes`, and returns typed results.
    - Each non-2xx response becomes an `Error` carrying the server's `detail` message.
  - Verify: `tsc`, then one manual call during Checkpoint B.
  - Files: `app/src/lib/api.ts`

- [ ] **8. Topics UI**
  - Acceptance:
    - Import ticks topics by word matching first, as today, then calls `analyzeNotes`.
    - Each row shows a level chip. Tapping a row shows its reason.
    - The header shows "Analysing…" while running, and the result shows when done.
    - On 502/503 or offline it shows "Deeper analysis didn't run — topics were ticked by matching words".
    - On 413/429 it shows the server's message.
    - "Re-analyse" re-opens the picker.
    - Labels are sentence case and use the existing tokens.
  - Verify: Checkpoint B.
  - Files: `app/src/components/topic-list.tsx`, `app/src/components/chips.tsx` if a level chip variant is needed

- [ ] **Checkpoint B (app)**
  - In the browser on the test account:
    - The fallback message appears without a key.
    - With a key: levels and reasons appear, the course chip changes and Today's hours change.
  - `tsc` is clean, lint shows no new errors, and both node checks pass.

- [ ] **9. Manual eval (costs real money; ask first)**
  - Acceptance:
    - 5 sample courses with hand-graded expected levels.
    - Record agreement, average cost per run (from `usage`), latency, and one injection probe note.
  - Verify: the results table is added to the spec's appendix.
  - Files: `docs/SPEC-ai-progress-analysis.md`

- [ ] **10. Docs and close-out**
  - Acceptance:
    - The README roadmap item is ticked and linked to the spec.
    - The spec status is "implemented", and any decisions changed during the build are written back into it.
  - Verify: read-through, and a final test, typecheck and lint run.
  - Files: `README.md`, `docs/SPEC-ai-progress-analysis.md`
