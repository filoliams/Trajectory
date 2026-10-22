# AGENTS.md

Map and rules for AI coding agents in this repo. Work under `app/` also follows [app/AGENTS.md](app/AGENTS.md) (Expo).

- **[CONTEXT.md](CONTEXT.md):** read when a change touches what the app does, who it's for, or MVP scope.
- **[DECISIONS.md](DECISIONS.md):** read before reversing an earlier choice; append a dated entry when you make a choice someone would later ask "why?" about.
- **Tickets:** `.scratch/notes-sharing/issues/`. Work the frontier (tickets whose blockers are done); tick acceptance criteria and set **Status** as you go.
- **Specs:** [SPEC.md](SPEC.md) (note-ingestion map) and [SPEC-ingest-core.md](SPEC-ingest-core.md) (models, caps, privacy boundaries). The caps live there; quote them from there.

## Where everything lives

```
app/                    Expo + React Native + TypeScript app (iOS, Android, web)
  app.json              native config; ios/ and android/ are generated
  src/app/              Expo Router screens: sign-in, onboarding, (tabs)/ Today·Courses·Settings, course/, assessment/
  src/components/       UI (topic-list, trajectory-view, study-timer, sheet, ...)
  src/lib/              logic, no UI
    store.tsx           app state + Supabase reads/writes
    planning.ts         on-device daily plan, countdowns, notesLevel
    levels.ts           course level from analysed topics
    notes-match.ts      offline word-match fallback for notes
    sync/               offline cache, outbox queue, realtime
    *.check.ts          self-checks, run with plain node
  src/constants/trajectory.ts   theme tokens T, fonts
backend/                FastAPI, runs locally; course-profile import only (uq_import.py)
supabase/
  migrations/           SQL, run by hand in the Supabase SQL editor
  functions/notes-check, notes-ingest   note pipeline (Haiku 5.5)
  functions/_shared/    pure import-free modules + check.ts; claude.ts is the one Claude call
  tests/                live ingest script, local preview script (spends API money)
```

Postgres tables, all under row-level security: `profiles`, `courses`, `assessments`, `topics`, `study_time`, `connections`, `documents`, `document_topics`, `sync_jobs`.

## Done means green

A task is done when every check for the area you touched is green:

```
App:       cd app; npx tsc --noEmit; npx expo lint; node src/lib/levels.check.ts; node src/lib/notes-match.check.ts; node src/lib/qld-holidays.check.ts
Backend:   cd backend; .venv\Scripts\python -m pytest
Functions: node supabase/functions/_shared/check.ts; npx deno@2 check supabase/functions/notes-*/index.ts; npx deno@2 lint supabase/functions/
```

## Agents are allowed to

- Write new migration files (running them is the owner's call, below).
- Add self-checks: new pure logic gets a `*.check.ts` beside it.
- Commit on the current feature branch, staging only the files you changed.

## Ask the owner first

- Running a migration or changing the live database.
- Deploying functions or setting Supabase secrets.
- Anything that spends API money: the live ingest script, the preview script, evals.
- Changing a Claude model, effort level, or cap.
- Adding a dependency.
- Pushing, merging into `main`, opening a PR, deleting files, rewriting history.

## Agents are not allowed to (guardrails)

- **Keys stay on the server.** The Anthropic key and the Supabase secret key live only in Supabase secrets and the git-ignored `.env`; the app holds only the publishable key. Never commit `.env`.
- **Every user request runs as the caller.** Use the caller's JWT client so row-level security authorises it; the service role stays off user request paths.
- **Notes are read, then discarded.** Keep document metadata and per-topic results only; delete the original after processing, and log token counts, never content.
- **Inputs are whole or refused.** A file over a limit is skipped with a reason, never truncated.
- **Native config goes through `app.json` and config plugins**, never hand-edited `ios/` or `android/`.
- **Git history is append-only:** hooks always run, and pushes are never forced.
- **Errors a student sees are plain sentences.**
