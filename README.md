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

_Add install and run commands here once the backend is set up._

## Project structure

```
study-tracker/
├── .env.example     # Template for environment variables
├── .gitignore
└── README.md
```

## Notes reading (GoodNotes)

Trajectory reads your GoodNotes notebooks and rates every topic **Strong**, **Okay** or **Weak**. Weak topics push their assessments up the study plan.

**1. Turn on GoodNotes auto-backup.** In GoodNotes: Settings > Auto-Backup > on, format **PDF**, and pick OneDrive (or Google Drive / Dropbox with its desktop app installed). Name notebooks with the course code, e.g. `STAT2201 Lectures`, or keep one folder per course.

**2. Add your AI key** to `.env`: `AI_API_KEY=...`

**3. Try it from the backend folder:**

```powershell
pip install -r requirements.txt
python -m notes.scan "C:\Users\liams\OneDrive\Apps\GoodNotes 5\GoodNotes" --dry-run
python -m notes.scan "C:\Users\liams\OneDrive\Apps\GoodNotes 5\GoodNotes" --course STAT2201 --max-reads 20
```

The dry run is free and shows how many pages would be read. Later runs only read pages that changed.

**How a topic is rated** (`backend/notes/footprint.py`): coverage, depth, practice (problems attempted and how many were right) and recency combine into a 0-1 score. Strong needs practice that's mostly right; brief notes with no practice stay Weak; practice that's mostly wrong is Weak.

**Database:** run `supabase db push` to create the `note_pages`, `course_topics`, `course_footprints` and `topic_footprints` tables.

**API:** `POST /notes/goodnotes/scan`, `GET /notes/footprint`, `GET /notes/footprint/{course}`, `PUT /notes/syllabus/{course}`.

**Tests:** `python -m pytest` from the backend folder.

## Roadmap

- [ ] Backend setup
- [ ] Course and assessment data model
- [ ] Notes import (Obsidian first, then OneNote and GoodNotes)
- [ ] AI progress analysis
- [ ] Study time recommendations
- [ ] Frontend / onboarding flow
