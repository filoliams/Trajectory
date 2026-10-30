# Study Tracker

A study tracker app that keeps track of your courses and assessments, reads your notes to gauge progress in each subject, and recommends what to work on first and how much time to spend.

## Features (planned)

- **Onboarding** – pick your university and courses on first launch
- **Assessment import** – pull assessments automatically from online course profiles instead of entering them by hand
- **Notes import** – share notes from GoodNotes, OneNote or Obsidian into the app
- **AI progress analysis** – reads your notes to estimate how far along you are in each subject
- **Study recommendations** – prioritises tasks and allocates more time to subjects that need it

## Getting started

### Prerequisites

- Git, Node 26, Python 3.11 (`py -3.11`)

### Setup on a new Windows machine

GitHub is the source of truth; each computer keeps its own clone **outside OneDrive**
(OneDrive turns `node_modules` and `.venv` into online-only placeholders, which breaks them).

```powershell
git clone https://github.com/filoliams/Trajectory.git C:\dev\Trajectory
cd C:\dev\Trajectory
powershell -ExecutionPolicy Bypass -File scripts\setup-windows.ps1
```

The script installs the npm packages, creates `backend\.venv` and copies `.env` from the old
OneDrive copy if it finds one. `.env` holds the keys and is never in git: copy it between
machines yourself, or start from `.env.example`.

### Moving between machines

Pull when you sit down at a machine; commit and push before you leave it:

```powershell
git pull
git add <files>; git commit -m "..."; git push
```

### Database and local server

Apply the database migrations:

```bash
supabase link --project-ref <your-project-id>
supabase db push
```

Run the server (landing page at http://127.0.0.1:8000, health check at `/health`):

```bash
uvicorn main:app --app-dir backend --reload
```

## Landing page and waitlist

`frontend/index.html` is the public landing page, served by the backend at `/`.
Its sign-up forms post to `POST /api/waitlist`, which stores rows in the
`waitlist` table (see `supabase/migrations/`).

- Emails are lowercased and unique; signing up twice is accepted silently.
- Bots are filtered with a hidden honeypot field and a 5-per-minute per-IP limit.
- The table has row-level security on with no policies, so only the backend
  (using the secret key) can read or write it.
- To see or export sign-ups, open the `waitlist` table in the Supabase
  dashboard (Table Editor > Export to CSV).

## Project structure

```
study-tracker/
├── backend/         # FastAPI app (API + serves the landing page)
├── frontend/        # Landing page (index.html)
├── supabase/        # Supabase config and migrations
├── .env.example     # Template for environment variables
├── .gitignore
└── README.md
```

## Roadmap

- [x] Backend setup
- [x] Landing page and waitlist
- [x] Course and assessment data model
- [x] Frontend / onboarding flow
- [x] Notes import from Markdown and text files (Obsidian vaults, exported notes)
- [ ] Note ingestion ([SPEC.md](SPEC.md)): server pipeline [`ingest-core`](SPEC-ingest-core.md) built, awaiting deploy; "Add notes" from Files next, iOS share sheet once there's an Apple Developer membership
- [x] Study time recommendations (daily plan sized by your study hours; courses with weaker notes get more time)
- [ ] AI progress analysis: built into note ingestion (per-topic levels and reasons from Claude), awaiting deploy
