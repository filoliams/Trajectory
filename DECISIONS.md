# DECISIONS.md

A dated log of changes and the decisions behind them. Newest first.
Add an entry whenever you make a decision someone would later ask "why?" about.

Format:

```
## YYYY-MM-DD: Short title
**Decision:** what was decided or changed.
**Why:** the reason.
**Alternatives:** what else was considered (optional).
```

---

## 2026-10-22: Notes are shared from the student's app, not synced from their folders
**Decision:** Drop the OneDrive/OneNote connector (`graph-connector`) and native folder sync. For the MVP, students use *Share → Save to Files* in GoodNotes/OneNote and pick the files in Trajectory. A direct "Share → Trajectory" on iOS is parked until there's an Apple Developer membership. Android is out of scope.
**Why:** The student decides exactly what Trajectory sees, so there are no stored OneDrive tokens or background folder access. It also removes the dependency on UQ approving a Microsoft app, and the Files picker works in Expo Go today without a membership.
**Alternatives:** Microsoft Graph delta sync (needs UQ consent, token storage, pg_cron); an iOS share extension now (needs the $99/yr membership and an EAS build).

## 2026-10-22: Add AGENTS.md, CONTEXT.md and DECISIONS.md
**Decision:** Repo-level docs for AI agents (map + rules), app context and MVP, and this decision log.
**Why:** Agents and new contributors need one place for where code lives, what they may touch, and why things are the way they are.

## 2026-10-19: Queensland public holidays from Nager.Date
**Decision:** Show QLD public holidays in the app, fetched from the free Nager.Date API.
**Why:** Study plans should account for days off; no API key needed.

## 2026-10-19: Local preview script for note analysis
**Decision:** `supabase/tests/preview-notes.ts` runs the analysis prompt locally.
**Why:** Tune the prompt and check output before deploying the Edge Functions.

## 2026-10-18: Note ingestion runs on Supabase Edge Functions, not FastAPI
**Decision:** `notes-check` and `notes-ingest` Edge Functions replace the planned `/analyze-notes` FastAPI endpoint. The FastAPI backend stays local, for course-profile import only.
**Why:** The functions need to be reachable from any device and run next to Storage and row-level security; the FastAPI backend only runs on the dev machine.
**Alternatives:** FastAPI `/analyze-notes` ([superseded spec](docs/SPEC-ai-progress-analysis.md)).

## 2026-10-18: Never store note text
**Decision:** Store only document metadata and per-topic levels. Originals are uploaded to a private bucket and deleted after reading; leftovers older than 24 h are cleaned on the next sync.
**Why:** Notes are private; Trajectory is not a backup service. Re-analysis means re-reading the source.
**Alternatives:** Storing text or embeddings for re-analysis without re-upload (rejected).

## 2026-10-18: Claude Opus 5.5 at effort `low`, with caps
**Decision:** `claude-opus-5-5`, effort `low`, structured JSON output, server-side fallbacks. Caps: 20 MB per file, 25 analyses per user per day, 200 files per hash check.
**Why:** Judging notes is close to classification, so low effort is enough; caps bound cost while the developer pays.
**Alternatives:** Sonnet 5.5 at about half the cost. Revisit after measuring real cost.

## 2026-10-18: Topic level is the best level across documents
**Decision:** `topics.understanding` is the strongest level any of the student's documents shows for that topic. Word matching stays as the offline fallback.
**Why:** A topic covered well in one file shouldn't be dragged down by a passing mention in another.

## 2026-10-18: No native iOS code
**Decision:** The note route is the Files picker in Expo Go and on the web; native folder sync is parked.
**Why:** No Apple Developer membership.

## 2026-10-18: Build order for note ingestion
**Decision:** `ingest-core` → `files-route` → `graph-connector` (OneDrive/OneNote).
**Why:** Every route depends on the core pipeline; the Graph connector needs a UQ consent test first.

## 2026-10-18: Dark theme with a lime accent, Geist type, 3D semester trajectory
**Decision:** Rebrand the app with a dark theme, Geist font, motion, and a 3D view of the semester.
**Why:** Give the app its own identity and make the semester's shape visible at a glance.

## 2026-10-18: Sync across devices with offline support
**Decision:** Local cache plus an outbox queue for offline writes, Supabase realtime for changes, `updated_at` on every table.
**Why:** Students switch between iPad, phone and laptop, often with poor connectivity on campus.

## 2026-10-17: Upload course profiles during onboarding
**Decision:** Onboarding asks for course profiles (PDF or page) instead of manual entry.
**Why:** Typing in every assessment is the main reason students drop planners.

## 2026-10-15: Parse UQ course profiles in a Python backend
**Decision:** FastAPI + BeautifulSoup/PDF parsing in `backend/uq_import.py`, behind `POST /import-file`.
**Why:** Python's HTML/PDF tooling is the easiest way to parse profiles; UQ first because the beta testers are UQ students.

## 2026-10-15: Expo + Supabase stack
**Decision:** Expo/React Native app (iOS, Android, web from one codebase) with Supabase for auth, Postgres and row-level security.
**Why:** One codebase for iPad, phone and web; Supabase gives auth and per-user security without running a server.
