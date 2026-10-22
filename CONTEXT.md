# CONTEXT.md

## What Trajectory is

Trajectory is a study planner for university students. It knows every course you take and every
assessment in it, reads your notes to work out how well you understand each topic, and tells you
each day what to study first and for how long.

## Who it is for

University students, starting with **University of Queensland** students. The first users are a
handful of beta testers using an iPad, a phone, or the web. Students already keep notes in
GoodNotes, OneNote, Obsidian or plain files, and don't want to retype their course outlines.

## The problem it solves

Students juggle 4+ courses, each with its own deadlines and weightings, buried in course-profile
pages. They don't know which course is slipping until it's too late, and a to-do list doesn't tell
them that their notes on a topic are thin.

## How it works

1. **Sign in and onboard.** Pick your university, then upload or import each course profile.
2. **Course import.** The FastAPI backend (`backend/uq_import.py`) parses a UQ course profile (web
   page, PDF, or pasted table) into the course, its assessments (name, type, weight, due date,
   hurdle) and its weekly topics.
3. **Notes.** The student picks note files. `notes-check` (Supabase Edge Function) hashes them so only
   new or changed files are uploaded. `notes-ingest` sends each file to Claude, which works out the
   course and rates every topic `none / weak / okay / strong` with a one-line reason. The original
   file is deleted once read; note text is never stored.
4. **Levels.** A course's level (Weak / Okay / Strong) comes from its topics' AI levels. If analysis
   hasn't run, it falls back to matching topic names against the notes on the device.
5. **Today.** The Today tab builds a daily plan sized to the student's study hours. Closer deadlines,
   heavier weightings and weaker courses get more time. Queensland public holidays are shown.
6. **Sync.** Data lives in Supabase Postgres with row-level security. The app keeps an offline cache
   and an outbox queue, then syncs and listens for realtime changes across devices.

**Stack:** Expo SDK 57 / React Native / TypeScript app · Supabase (Postgres, Auth, Storage, Edge
Functions on Deno) · FastAPI backend (local, for course import) · Claude `claude-opus-5-5` for note analysis.

## MVP

The MVP is the smallest version a UQ beta tester can use for a full semester.

**In the MVP**

| Feature | Status |
|---|---|
| Email sign-in, onboarding (university + courses) | Done |
| Import a UQ course profile: assessments, weights, due dates, topics | Done |
| Add, edit and complete courses and assessments by hand | Done |
| Today tab: daily plan sized by study hours, deadline countdowns | Done |
| Study timer that logs time per assessment | Done |
| Sync across devices, works offline | Done |
| Import notes from `.md` / `.txt` (word-match levels) | Done |
| AI note analysis: per-topic levels and reasons for `.md`, `.txt`, `.pdf`, images | Built, awaiting deploy |
| Course level chip and plan driven by the AI levels | Built, awaiting deploy |

**MVP is done when** a beta tester can onboard, import their courses, sync a GoodNotes PDF, see
per-topic levels with reasons, and get a Today plan that gives more time to weaker courses, on
iPad and web, with no note text left on the server.

**Not in the MVP (later)**

- Files-app "Sync notes" route (`files-route`)
- OneDrive / OneNote automatic sync (`graph-connector`)
- Native iOS folder sync and share extension (needs an Apple Developer membership)
- Universities other than UQ
- Paid tier or per-user billing for AI analysis
- App Store / Play Store release

## Key constraints

- Notes are private: no note text or original file is kept after analysis.
- The Anthropic key lives only on the server (Supabase secret).
- Limits: 20 MB per file, 25 analyses per user per day, 200 files per check.
- AI cost is paid by the developer for now, so caps matter.

See [SPEC.md](SPEC.md) and [SPEC-ingest-core.md](SPEC-ingest-core.md) for the detailed design.
