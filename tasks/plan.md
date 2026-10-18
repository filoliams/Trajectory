# Plan: AI progress analysis

Spec: `docs/SPEC-ai-progress-analysis.md` (approved). Open questions use the spec's defaults:
`claude-opus-5-5` at `low` effort, notes never stored, 20 analyses per user per day, free on the
owner's key. Revisit after the manual eval (task 9).

## Components and dependencies

```
[1] DB migration ──┬──> [3] /analyze-notes endpoint ──> [4] env + setup docs
                   │            ▲
                   │   [2] notes_analysis module (Claude call, schema)
                   │
                   └──> [5] app data model ──> [6] notesLevel from levels
                                         └──> [7] api client ──> [8] Topics UI
                                                                      │
                               [9] manual eval (real API, approval) <─┘
                                                                      │
                                                         [10] docs + roadmap
```

- **Backend first.** Task 2 is pure logic with Claude mocked, so it can be built and tested before
  the migration exists. Task 3 needs task 1's columns and table.
- **App work (5–8) only depends on the API contract** in the spec, not on a running Claude.
  Task 8 can be demonstrated with the backend returning 503 (no key) to exercise the fallback path.
- **Parallel-safe:** tasks 2 and 5–7 touch disjoint files. Run them in sequence in one session
  anyway, because they're small.

## Order

1. Migration SQL.
2. `backend/notes_analysis.py` and its tests.
3. Endpoint, auth, limits and rate limit, with tests.
4. `.env.example` and setup doc.

   **Checkpoint A (backend):**
   - pytest passes.
   - With no key, `curl` returns 503.
   - With a key (ask first), one real call on the test account succeeds.

5. App `Topic` fields and store mapping.
6. Pure level calculation and self-check; `notesLevel` uses it.
7. `analyzeNotes()` API client with the session token.
8. Topics UI: import → word match → analysis, levels and reasons, states.

   **Checkpoint B (app):**
   - In the browser on the test account: the fallback path (backend without a key), then the real
     path (with a key).
   - `tsc` is clean and lint shows no new errors.

9. Manual eval: 5 courses, cost and latency recorded. Costs real money, so it needs approval first.
10. Docs: README roadmap link, spec status set to "implemented", final commit.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| `supabase.auth.get_user(token)` behaves differently on the service-key client | Verify in task 3 with a real token from the test account before relying on it. Fallback: verify the JWT with PyJWT against the project's JWT secret (PyJWT is already installed). |
| Model output is missing topics or has bad ids | Schema validation, then merge: unknown ids dropped, missing ids set to `none` (task 2 tests). |
| Prompt injection in notes | Notes go in delimited user content, the system prompt says they're data, and output is schema-constrained. Manual eval item. |
| Cost runs away | Size cap (413 before any call), per-user daily cap (429), and effort `low`. Cost is logged per call (token usage, never content). |
| Notes leak into logs | No request-body logging. Log only user id, course id, char count, token usage and latency (asserted in a task 3 test). |
| The topics `select` in the store omits the new columns | Check the store's topics query in task 5, and add the columns if it lists fields explicitly. |
| Migration isn't run before app testing | Task 1 ends with you running it in Supabase. The app tolerates missing columns (fields undefined, so it falls back to word matching). |

## Verification commands

```
cd backend; .venv\Scripts\python -m pytest
cd app; npx tsc --noEmit; npx expo lint; node src/lib/notes-match.check.ts; node src/lib/levels.check.ts
```
