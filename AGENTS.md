# AGENTS.md

Rules and a map for any AI coding agent (Claude Code, Codex, Cursor, etc.) working in this repo.
Read [CONTEXT.md](CONTEXT.md) for what the app is, and [DECISIONS.md](DECISIONS.md) for why it is built this way.
Work inside `app/` also follows [app/AGENTS.md](app/AGENTS.md) (Expo rules).

## Where everything lives

```
Trajectory/
├── app/                         Expo (SDK 57) + React Native 0.86 + TypeScript app: iOS, Android, web
│   ├── app.json                 Expo config (native behaviour goes here, never in ios/ or android/)
│   ├── scripts/                 make-icons.mjs, reset-project.js
│   └── src/
│       ├── app/                 Expo Router screens (every file is a route)
│       │   ├── _layout.tsx      root layout: auth gate, store provider
│       │   ├── sign-in.tsx      Supabase email sign-in
│       │   ├── onboarding.tsx   pick university, upload course profiles
│       │   ├── (tabs)/          index.tsx = Today, courses.tsx, settings.tsx
│       │   ├── course/          [code].tsx detail, add.tsx, manage.tsx
│       │   └── assessment/      [id].tsx edit, new.tsx
│       ├── components/          UI pieces (topic-list, trajectory-view, study-timer, sheet, chips, ...)
│       ├── constants/           trajectory.ts (theme tokens T, fonts), universities.ts
│       ├── data/courses.ts      Course / Assessment / Topic types and row mapping
│       ├── lib/                 logic, no UI
│       │   ├── store.tsx        app state + Supabase reads/writes
│       │   ├── planning.ts      daily plan, countdowns, notesLevel
│       │   ├── levels.ts        course level from analysed topics
│       │   ├── notes-match.ts   offline word-match fallback for notes
│       │   ├── holidays.ts, qld-holidays.ts   QLD public holidays (Nager.Date)
│       │   ├── api.ts           calls to the FastAPI backend
│       │   ├── supabase.ts      Supabase client
│       │   ├── sync/            offline cache, outbox queue, realtime, network status
│       │   └── *.check.ts       self-checks, run with plain `node`
│       └── config.ts            SUPABASE_URL, publishable key, API_URL
├── backend/                     FastAPI (Python), runs locally, course-profile import only
│   ├── main.py                  routes: GET /, GET /health/db, POST /import-file
│   ├── uq_import.py             UQ course-profile parser (HTML, PDF, pasted table)
│   └── tests/                   pytest
├── supabase/
│   ├── migrations/              SQL, run by hand in the Supabase SQL editor
│   ├── functions/
│   │   ├── notes-check/         which note files are new or changed (hash check)
│   │   ├── notes-ingest/        read a note with Claude, map to course, level each topic
│   │   └── _shared/             pure, import-free modules + check.ts self-check; claude.ts, http.ts
│   └── tests/                   live ingest script, local preview script
├── docs/                        setup guides, superseded specs
├── tasks/                       plan.md and todo.md for the current phase
├── SPEC.md                      note-ingestion capability map
├── SPEC-ingest-core.md          spec for the current module
├── CONTEXT.md                   what the app is, who it is for, MVP
└── DECISIONS.md                 dated log of changes and decisions
```

Data lives in Supabase Postgres: `profiles`, `courses`, `assessments`, `topics`, `study_time`,
`connections`, `documents`, `document_topics`, `sync_jobs`, all under row-level security.

## Checks to run before calling a task done

```
App:       cd app; npx tsc --noEmit; npx expo lint; node src/lib/levels.check.ts; node src/lib/notes-match.check.ts; node src/lib/qld-holidays.check.ts
Backend:   cd backend; .venv\Scripts\python -m pytest
Functions: node supabase/functions/_shared/check.ts; npx deno@2 check supabase/functions/notes-*/index.ts
```

## Agents ARE allowed to

- Read anything in the repo.
- Edit code in `app/src/`, `backend/`, `supabase/functions/` and `supabase/tests/`.
- Write new migration files in `supabase/migrations/` (not run them).
- Add or update tests and `*.check.ts` self-checks.
- Run the local checks above, the Expo dev server, and the local backend.
- Install app packages with `npx expo install <pkg>` (never `npm install <pkg>`).
- Update docs: README, specs, `tasks/`, and add an entry to DECISIONS.md for any decision or notable change.
- Make commits on a feature branch.

## Agents must ASK FIRST before

- Running a migration or changing the live database.
- Deploying Edge Functions or setting Supabase secrets.
- Anything that spends API money (live ingest script, Claude evals).
- Changing the Claude model, effort level, or the caps (20 MB per file, 25 analyses per user per day, 200 files per check).
- Adding a new dependency (Python or JS).
- Pushing, merging into `main`, or opening a PR.
- Deleting files, or rewriting git history.

## Agents are NOT allowed to

- Commit `.env` or any real key. Only `.env.example` is tracked.
- Put the Anthropic key, or the Supabase secret / service-role key, in the app.
- Use the service role on a user request path. Use the caller's JWT so row-level security applies.
- Store or log note text. Only metadata and analysis results are kept; originals are deleted after reading.
- Silently truncate a document or notes.
- Create or edit `app/ios/` or `app/android/` by hand.
- Skip git hooks (`--no-verify`) or force-push.
- Show stack traces to users. User-facing errors are plain sentences.

## Code style

- Pure logic in import-free modules that plain Node can test; I/O at the edges.
- Comments explain why, not what.
- App UI uses the `T` tokens from `constants/trajectory.ts`, sentence-case labels and `PressScale` buttons.
- Match the surrounding code before adding a new pattern.
