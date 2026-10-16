# Study Tracker

A study tracker app that keeps track of your courses and assessments, reads your notes to gauge progress in each subject, and recommends what to work on first and how much time to spend.

## Features (planned)

- **Onboarding** – pick your university and courses on first launch
- **Assessment import** – pull assessments automatically from online course profiles instead of entering them by hand
- **Notes import** – connect notes from GoodNotes, Obsidian and OneNote
- **AI progress analysis** – reads your notes to estimate how far along you are in each subject
- **Study recommendations** – prioritises tasks and allocates more time to subjects that need it

## Getting started

### Prerequisites

- Git
- _Add your runtime here (e.g. Python 3.12 or Node 20)_

### Setup

```bash
git clone https://github.com/<your-username>/study-tracker.git
cd study-tracker
```

Copy the example environment file and fill in your own keys:

```bash
copy .env.example .env
```

Install and run the backend:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r backend/requirements.txt
supabase db push            # creates the notes tables
uvicorn backend.main:app --reload
```

## Reading GoodNotes notes

GoodNotes has no public API, so Trajectory reads the PDFs that GoodNotes'
**Auto Backup** writes to cloud storage:

1. On your iPad: GoodNotes → Settings → **Auto Backup** → on, choose
   **OneDrive** (or Google Drive / Dropbox), file format **PDF** (or PDF and Goodnotes Document).
2. Make sure that cloud folder syncs to your PC (OneDrive is built into Windows;
   Google Drive needs *Google Drive for desktop*).
3. Set `GOODNOTES_DIR` and `ANTHROPIC_API_KEY` in `.env`.

While the server runs it checks the folder every 5 minutes. For each new or
changed notebook it:

- reads the PDF text layer (typed text, imported slides);
- renders pages with handwriting to images and has Claude transcribe them
  (maths as LaTeX, diagrams described, your `???`/crossed-out working kept) —
  only pages that changed since last time are sent again;
- has Claude assess the notebook: topics, depth (copied → practised → understood),
  confidence per topic, struggle points and gaps;
- saves it to Supabase (`note_documents`, `note_pages`, `note_analyses`; the
  `note_topic_confidence` view gives the latest confidence per topic).

Course codes come from folder names (`ENGG1100/...`), or Claude's guess.

Try it without touching the database:

```bash
python backend/read_goodnotes.py --dry-run --folder "C:\Users\<you>\OneDrive\Goodnotes\ENGG1100"
```

API: `POST /notes/goodnotes/sync` (sync now; `?wait=true` to get the report),
`GET /notes`, `GET /notes/{id}`.

## Project structure

```
study-tracker/
├── backend/
│   ├── main.py            # FastAPI app
│   ├── read_goodnotes.py  # CLI: sync / watch / dry-run
│   └── notes/             # notes reader (scan → extract → transcribe → analyse → store)
├── supabase/migrations/   # database schema
├── tests/
├── .env.example     # Template for environment variables
├── .gitignore
└── README.md
```

## Roadmap

- [ ] Backend setup
- [ ] Course and assessment data model
- [x] Notes import: GoodNotes (Auto Backup PDFs)
- [ ] Notes import: Obsidian, OneNote
- [ ] AI progress analysis
- [ ] Study time recommendations
- [ ] Frontend / onboarding flow
