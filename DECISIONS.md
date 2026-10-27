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

## 2026-10-27: Landing page hosted on Vercel, from main
**Decision:** Vercel serves `frontend/` as a static site (preset Other, root directory `frontend`, no build), with `frontend/api/waitlist.js` as a serverless function that writes sign-ups to Supabase over REST using `SUPABASE_SECRET_KEY` from Vercel's environment variables. `main` was fast-forwarded to `local-uq-import` so Vercel's production branch has the landing page.
**Why:** The FastAPI backend only runs locally, so the page's `/api/waitlist` needs its own server-side endpoint where it's hosted. Plain `fetch` to Supabase's REST API keeps the function dependency-free.
**Alternatives:** Deploying the whole FastAPI backend to Vercel (would also expose the course-import endpoint publicly); setting Vercel's production branch to `local-uq-import` instead of updating `main`.

## 2026-10-27: Privacy Policy, Terms of Use and Data Consent
**Decision:** The three documents live once in `app/src/lib/legal.ts`. The app shows them at `legal/[doc]` (open signed in or out, linked from sign-in and Settings); `app/scripts/legal-pages.mjs` writes the website copies (`frontend/privacy.html`, `terms.html`, `data-consent.html`), and `legal.check.ts` fails if those fall out of date. Create account needs one ticked box agreeing to all three; the accepted `legal_version` and `legal_accepted_at` are saved in the account's Supabase auth metadata. Minimum age 16, younger with a parent's permission; governed by Queensland law; written to the Australian Privacy Principles. Operator name and contact email are placeholders (`OPERATOR`, `CONTACT_EMAIL`) until the owner fills them in.
**Why:** The waitlist collects emails and the app sends note contents to Anthropic, overseas, so students need to be told and to agree before signing up. Auth metadata records consent without a migration. One source stops the app and website wording drifting apart.
**Alternatives:** A `profiles` column for consent (needs a migration); a second checkbox just for AI note analysis (the owner chose one box); 18+ only (would exclude 17-year-old first-years).

## 2026-10-23: Course colours, weekly chart, streak, and new display fonts
**Decision:** Each course gets a fixed colour (its place among the semester's codes, A–Z) used on its rings, bars, plan cards and deadline dots. Today adds a big progress ring, a tappable seven-day study chart, a streak card, phone quick actions, and three columns on large desktops. Past study days are read from `study_time` (last 28 days) on the client, under row-level security. Titles use Bricolage Grotesque, with one word in Instrument Serif italic; body stays Geist, numbers Geist Mono. Added `@expo-google-fonts/bricolage-grotesque` and `@expo-google-fonts/instrument-serif` at the owner's request.
**Why:** The Dribbble e-learning dashboards all tell courses apart by colour and show weekly activity and streaks; the owner asked for distinct, premium fonts.
**Known limit:** offline, past days in the chart read as zero (today is always live).

## 2026-10-23: Dashboard-style redesign of Today, Courses, course page and Settings
**Decision:** Restyle these screens with NativeWind classes in the shape of e-learning student dashboards (Dribbble reference): a row of stat cards with tick-ring progress, a tappable seven-day strip that filters "Coming up", filter pills and a 1/2/3-column grid on Courses, per-assessment weight bars, and collapsible "Why this?" and assessment actions. The shared pieces live in `components/dashboard.tsx`. No new dependencies; the rings are plain Views animated with Reanimated, because the app has no SVG library.
**Why:** The old screens were a single column with spare space on iPad and desktop, and every card showed all its detail at once.

## 2026-10-23: Elevate the UI inside Expo with NativeWind and React Native Reusables
**Decision:** Keep the Expo / React Native app and add NativeWind 4 (Tailwind classes) plus React Native Reusables (shadcn/ui ported to React Native). Its theme variables are Trajectory's existing dark palette and lime accent. Design references (awesome-design-md, react-native-reusables source) are cloned into the git-ignored `reference/`.
**Why:** It's the shadcn/Tailwind ecosystem without rewriting the app, so the iPad app in Expo Go, the web build and the planned iOS share sheet all keep working.
**Alternatives:** A separate browser-only React app (Vite/Next.js + shadcn/ui), rejected because every screen would be rewritten and the iPad app would become a Safari web app.

## 2026-10-22: AI daily plan: assessment blocks, one saved plan a day
**Decision:** The `plan-day` function asks `claude-sonnet-5-5` (effort `medium`, structured output, server-side refusal fallback) for an ordered list of blocks, each tied to one of the student's open assessments, with minutes, up to 3 focus topics and a one-line reason. One plan is saved per student per Brisbane day; it's reused until the student re-plans or changes their study hours, with at most 3 Sonnet calls a day (the plan plus two re-plans). The server picks the day. Plans are validated on the server (own open assessments only, total within the daily hours, blocks of at least 15 minutes) and the app falls back to its on-device plan whenever there's no AI plan.
**Why:** Tying blocks to assessments lets the existing timer, progress and "Completed today" work unchanged. Saving per day keeps cost to a few calls per student per day. Only topic names, levels and one-line reasons are sent, never note text.
**Known limit:** like the note-analysis cap, the re-plan counter lives in a table the student can write to, so a determined user could reset it. Move it behind a security-definer function before a public launch.

## 2026-10-22: Haiku 5.5 reads notes, Sonnet 5.5 plans the day
**Decision:** Note ingestion (reading notes, mapping to a course, levelling topics) moves from Opus 5.5 to `claude-haiku-5-5` at effort `low`. The planned AI daily study planner will use `claude-sonnet-5-5`. Supersedes the 2026-10-18 Opus decision.
**Why:** Ingestion runs on every note, so cost matters most there; Haiku is $0.10 / $0.50 per million tokens (about 40x cheaper than Opus). Planning is one call per day and needs more judgement, so it gets Sonnet.
**Trade-off:** Haiku has no server-side refusal fallback, so a declined file is marked failed instead of retried on another model. Handwriting accuracy still needs checking on a real GoodNotes PDF.

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
