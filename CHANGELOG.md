# Trajectory — Versions & Changelog

Tracks every version of [Trajectory](https://github.com/filoliams/Trajectory) and the changes that went into it.
Times are Brisbane time (AEST, UTC+10). Newest first.

> The repo has no git tags yet, so the version numbers below were assigned from the commit history.
> To lock one in: `git tag v0.5.0 2873a52 && git push --tags`

## Version overview

| Version | Date | Branch | Status | Summary |
|---|---|---|---|---|
| [Unreleased](#unreleased) | — | any | In progress | New commits, added automatically every hour |
| [v0.5.0](#v050--2026-10-18) | 2026-10-18 | `local-uq-import` | Not merged | Sync across devices, offline mode, study timer, topics |
| [v0.4.0](#v040--2026-10-17) | 2026-10-17 | `local-uq-import` | Not merged | Upload course profiles during onboarding |
| [v0.3.0](#v030--2026-10-15) | 2026-10-15 | `local-uq-import` | Not merged | Mobile app + importing profiles inside the app |
| [v0.2.0](#v020--2026-10-15) | 2026-10-15 | `course-profile-import` / `local-uq-import` | Not merged | Import assessments from UQ course profiles |
| [v0.1.0](#v010--2026-10-15) | 2026-10-15 | `main` | Released | Project setup, backend connected to Supabase |
| [Experimental](#experimental--goodnotes-2026-10-16) | 2026-10-16 | `goodnotes-reader`, `goodnotes-footprint` | Not merged | GoodNotes note reading and topic strength scores |

---

## Change log

### Unreleased
New commits are added here automatically. When you cut a version, rename this heading to `### vX.Y.Z — date`.

| When | Branch | Commit | Change |
|---|---|---|---|
| 2026-10-30 15:08 | `main` | [`4e7e4fa`](https://github.com/filoliams/Trajectory/commit/4e7e4fa4866a4f6212c1ae474c84f459e52aab99) | **Merge local-uq-import: Quiz me, confidence, profile tabs, new landing page.** |
| 2026-10-30 15:01 | `local-uq-import`, `main` | [`445d600`](https://github.com/filoliams/Trajectory/commit/445d60034dbfa66a2affb1d62a2b365d8c0bea69) | **Update the landing page to describe what Trajectory does now.** The page described a quiz-first loop. It now walks through what the app does: course profiles (Assessment and Learning activities tabs), notes read topic by topic with page references, Quiz me for confidence, and a daily plan of timed... |
| 2026-10-30 14:56 | `local-uq-import`, `main` | [`2524b1a`](https://github.com/filoliams/Trajectory/commit/2524b1a7152d6e27b271818a1c20ca6361fa5a82) | **Read each course profile tab on its own, including topics from PDFs.** UQ shows a profile's assessments and weekly topics on separate tabs, and a printed PDF holds only the open one. The backend now strips the browser's print header and footer (which split MATH2010's exam name), reads the footer's #tab,... |
| 2026-10-30 14:27 | `local-uq-import`, `main` | [`c531ffc`](https://github.com/filoliams/Trajectory/commit/c531ffc28d7ff5f789816071caa1cc66fe75fcf9) | **Ignore Expo's local state at the repo root and sync deno.lock.** deno.lock now lists the root package.json dev dependencies added in ed7faaf. .expo/ holds machine-local Expo state and is already ignored under app/. |
| 2026-10-30 14:12 | `local-uq-import`, `main` | [`571f253`](https://github.com/filoliams/Trajectory/commit/571f253d4b0df0d6bbae574ac6aac8c4eed0c374) | **Plan the day by confidence instead of notes levels.** plan-day now sends each topic's confidence and band (from notes and quiz scores) instead of its notes level, and the prompt favours low-confidence courses and picks focus topics from the shakiest ones. The server copy of the formula is... |
| 2026-10-30 14:06 | `local-uq-import`, `main` | [`450001a`](https://github.com/filoliams/Trajectory/commit/450001a2879e5d32963060d548cb444407d5fee3) | **Show topic and course confidence with a trend bubble.** Each topic row shows a confidence bar (notes alone up to 60%; notes 40% and quiz 60% after one quiz; notes 20% and the last two quizzes 80% after two), a green/red/yellow bubble for which way the latest quiz moved it, and the change... |
| 2026-10-30 14:03 | `local-uq-import`, `main` | [`3e06c79`](https://github.com/filoliams/Trajectory/commit/3e06c79cc0e792ef8f0b0d47cd5b6ca593f68ebe) | **Add Quiz me: three AI questions per topic, scores saved.** A new quiz-make function asks Haiku 5.5 (low effort) for three questions on a topic, validates the reply, and records the attempt so it counts towards the daily limit (15, set in one place by plan tier). The app shows the quiz one... |
| 2026-10-30 13:55 | `local-uq-import`, `main` | [`a870dda`](https://github.com/filoliams/Trajectory/commit/a870dda05889303a07ce113494b8d25b792ce507) | **Plan the Quiz me feature and list known limitations.** LIMITATIONS.md collects known limits and inconsistencies to resolve later, linked from AGENTS.md. Tickets 14-16 cover Quiz me per topic, topic and course confidence, and the daily plan using confidence, with the owner's decisions logged... |
| 2026-10-30 12:52 | `local-uq-import`, `main` | [`fc74a8c`](https://github.com/filoliams/Trajectory/commit/fc74a8cb1c6d6701db7b473352296adac6e21616) | **Split Topics into "Upload topics" then "Upload notes".** Upload topics offers the saved course profile or typing them in; a profile import now adds topics only and leaves assessments alone. Upload notes stays locked until the course has topics. Today nudges courses without topics, and course... |
| 2026-10-30 12:51 | `local-uq-import`, `main` | [`e4f4dac`](https://github.com/filoliams/Trajectory/commit/e4f4dac3119498a3b08f3be0b93de90eb7922e3b) | **Rate notes only from where each topic appears in them.** Claude now lists which of the student's courses a file contains and, per topic, where it appears (pages or headings) before choosing a level. A rating without a location becomes "none", the location leads the reason, and a notebook... |
| 2026-10-29 15:54 | `local-uq-import`, `main` | [`ed7faaf`](https://github.com/filoliams/Trajectory/commit/ed7faaf950745867846455575bd7319f61b657d7) | **Add root TypeScript dev dependencies, tsconfig and Deno lockfile.** |
| 2026-10-29 11:31 | `local-uq-import`, `main` | [`08c94db`](https://github.com/filoliams/Trajectory/commit/08c94db1e752cb71676f97ba6f294a13dcd91c66) | **Place Expo's scripts and styles in the custom web page shell.** Expo's streaming render now passes the app bundle, styles and fonts to +html.tsx through useServerDocumentContext(). Our shell never put them on the page, so the browser showed the loading screen forever. |
| 2026-10-29 10:20 | `local-uq-import` | [`e3c073c`](https://github.com/filoliams/Trajectory/commit/e3c073c8336e77d20dfd40f7bad17959e5f19e24) | **Log the move from OneDrive to GitHub-synced clones.** |
| 2026-10-29 10:19 | `local-uq-import` | [`c146cac`](https://github.com/filoliams/Trajectory/commit/c146cacc9bcb3641ae2f768858908bf597b47bac) | **Set the repo up to live outside OneDrive, synced through GitHub.** Adds scripts/setup-windows.ps1 for a fresh clone (npm packages, backend venv, expo-env.d.ts, .env from the old OneDrive copy), README steps for setting up and moving between machines, and a decision entry. Also escapes an apostrophe in... |
| 2026-10-28 17:14 | `wip/analyze-note` | [`0f838a1`](https://github.com/filoliams/Trajectory/commit/0f838a1b6eddaf92652804d48a3b6d26475dd25f) | **WIP: analyze-note (from stash; reverted for deno lint errors).** |
| 2026-10-28 17:14 | `local-uq-import` | [`92ab305`](https://github.com/filoliams/Trajectory/commit/92ab3057f54e9421e3e1e4b1e4860c5ec6d5897b) | **Give the store hooks a server snapshot so the web page renders.** Expo's static web output pre-renders on the server, where useSyncExternalStore needs a getServerSnapshot; without it the page returned a 500. Also refresh package-lock.json from a clean install. |
| 2026-10-23 02:32 | `sdk-58` | [`a7b7c38`](https://github.com/filoliams/Trajectory/commit/a7b7c383fe8d29b24336be2bf2e6bbadc2004222) | **Log the SDK 58 upgrade decision.** |
| 2026-10-23 02:32 | `sdk-58` | [`456c8d6`](https://github.com/filoliams/Trajectory/commit/456c8d6888b756ca5820e93272ac525a92f275b8) | **Upgrade to Expo SDK 58.** React Native 0.88, React 19.3, Expo Router 58, Reanimated 4.7. The web page shell now renders the server document's head and body nodes (the page shipped without its script otherwise), useSyncExternalStore passes a server snapshot for... |
| 2026-10-27 14:03 | `local-uq-import`, `main` | [`7ce3052`](https://github.com/filoliams/Trajectory/commit/7ce30529142b86e6dd33ca95e126b94cc3537014) | **Name the operator and contact email in the legal documents.** Replaces the placeholders with Liam Salve and liamsalve@icloud.com and regenerates the website's legal pages. |
| 2026-10-27 13:54 | `local-uq-import`, `main` | [`072574e`](https://github.com/filoliams/Trajectory/commit/072574eda543e729b2de2636a164614ffd27137f) | **Add a Vercel function for waitlist sign-ups.** frontend/api/waitlist.js does what the backend's POST /api/waitlist does (validation, honeypot, per-IP limit, duplicate-safe insert) so the landing page's forms work when frontend/ is deployed to Vercel on its own. It talks to... |
| 2026-10-27 13:41 | `local-uq-import`, `main` | [`521e8e2`](https://github.com/filoliams/Trajectory/commit/521e8e2b741326e45239ceda98a4e943cf9f1a3b) | **Show the legal documents in the app and ask for consent at sign-up.** Adds a legal/[doc] screen (open signed in or out), links from sign-in and a "Privacy & legal" section in Settings. Create account now needs one ticked box agreeing to the Terms, Privacy Policy and Data Consent; the accepted version and... |
| 2026-10-27 13:31 | `local-uq-import`, `main` | [`50e9881`](https://github.com/filoliams/Trajectory/commit/50e9881f40909661a9f8b793274ec88f72a2c3d0) | **Reposition the landing page around quizzes and stakes, and add legal pages.** The landing page now leads with "Tells you exactly what to study next, and proves you've learned it": check-in quizzes measure each topic, priority is weakness x weighting x urgency, steps are specific and time-boxed, and the progress... |
| 2026-10-27 12:18 | `local-uq-import`, `main` | [`346974b`](https://github.com/filoliams/Trajectory/commit/346974b79d3b960eb063e5392844746cfcead742) | **Merge the landing page and waitlist from claude/landing-waitlist.** Brings in frontend/ (landing page and icon), the waitlist migration and the /api/waitlist endpoint, keeping the course-profile import alongside it. |
| 2026-10-27 04:03 | `claude/landing-waitlist`, `local-uq-import`, `main` | [`d269b31`](https://github.com/filoliams/Trajectory/commit/d269b31828b63888540694b2a0f430eebaa052b0) | **Use the new Trajectory icon and restyle the landing page around it.** Adds frontend/icon.svg (vector redraw of the app icon) as the favicon, touch icon and nav logo. The page moves to the icon's palette: a deep teal graph-paper hero and closing band, notebook-cream sections and coral for goals and actions. |
| 2026-10-27 03:49 | `claude/landing-waitlist`, `local-uq-import`, `main` | [`ee6d879`](https://github.com/filoliams/Trajectory/commit/ee6d87933676b37a1c27cf9255935cf6c7759898) | **Restyle landing page to match the app and add animated feature demos.** Uses the app's palette (app/src/constants/trajectory.ts) and the App Screens type: Space Grotesk, IBM Plex Sans and IBM Plex Mono. Adds live demos for assessment import, note reading, re-ranking and time allocation, plus float-up... |
| 2026-10-27 03:36 | `claude/landing-waitlist`, `local-uq-import`, `main` | [`39dc4ae`](https://github.com/filoliams/Trajectory/commit/39dc4aeb13fcb347701f81da9e68ec4eec4a37b8) | **Add landing page and waitlist.** Landing page in frontend/ served by the FastAPI backend at /, with a POST /api/waitlist endpoint backed by a new Supabase waitlist table. |
| 2026-10-23 02:12 | `local-uq-import`, `main` | [`bca2415`](https://github.com/filoliams/Trajectory/commit/bca2415cf16712fc93e104af246c7f05e36db99f) | **Move the study timer to its own Study tab.** Today's plan and the timer now live in a TodayProvider above the tabs, so Today and Study share one clock. Today keeps the dashboard and shows a live 'Studying now' bar; starting a block jumps to the Study tab. |
| 2026-10-23 01:56 | `local-uq-import`, `main` | [`c6a0288`](https://github.com/filoliams/Trajectory/commit/c6a0288a737a8a47409a423c64996bd276c995bd) | **Add course colours, weekly study chart, streak and premium display fonts.** Bricolage Grotesque titles with Instrument Serif italic accents; a big progress ring, tappable seven-day chart and streak on Today; phone quick actions; three columns on large desktops; each course keeps one colour across every screen.... |
| 2026-10-23 01:34 | `local-uq-import`, `main` | [`9abcfe3`](https://github.com/filoliams/Trajectory/commit/9abcfe3665a745d85aaeebfa36db2184766c1210) | **Redesign Today, Courses, course page and Settings as a study dashboard.** Stat cards with animated tick rings, a tappable week strip that filters upcoming deadlines, course filters and a responsive grid, and collapsible plan and assessment details. Styled with NativeWind; no new dependencies. |
| 2026-10-23 00:13 | `local-uq-import`, `main` | [`4203913`](https://github.com/filoliams/Trajectory/commit/4203913fe4d0d79a44e67adf38bcebfffd7e8a87) | **Ignore cloned reference repos and include NativeWind types.** |
| 2026-10-23 00:13 | `local-uq-import`, `main` | [`dfe1d1c`](https://github.com/filoliams/Trajectory/commit/dfe1d1c2eb716dbfbaa6fafa94c583f5d0f6e005) | **Add NativeWind and React Native Reusables for the UI refresh.** Set up NativeWind 4 (Tailwind for React Native) and React Native Reusables (shadcn/ui for React Native) inside the Expo app, themed with Trajectory's existing dark palette and lime accent via CSS variables. Add the base text, button and... |
| 2026-10-22 23:32 | `local-uq-import`, `main` | [`a143f45`](https://github.com/filoliams/Trajectory/commit/a143f45613b9e263b7e45355b0180b513d255c1a) | **Add the AI daily study plan with Sonnet 5.5 (ticket 07).** A new plan-day function asks Sonnet 5.5 for today's study blocks, each tied to one of the student's open assessments with minutes, focus topics and a reason. The server validates the plan (own open assessments only, total within the... |
| 2026-10-22 23:00 | `local-uq-import`, `main` | [`9415b4d`](https://github.com/filoliams/Trajectory/commit/9415b4d99485784c7e097541958617411aea99b8) | **Add notes from Files and get AI topic levels (ticket 03).** Add notes on a course page now sends the picked files through the note pipeline: refuse unsupported or oversized files before upload, hash each file so unchanged ones are skipped, upload the rest, ask notes-ingest to analyse them, and... |
| 2026-10-22 22:47 | `local-uq-import`, `main` | [`cc03a17`](https://github.com/filoliams/Trajectory/commit/cc03a17e34a34d37e8497ead1264ab3e888848cb) | **Tighten AGENTS.md for agents.** Give each pointer its trigger, add the tickets pointer, drop rules agents follow by default, point at the spec for caps instead of repeating them, state guardrails as the behaviour to follow, and add deno lint to the checks. |
| 2026-10-22 22:39 | `local-uq-import`, `main` | [`a685d67`](https://github.com/filoliams/Trajectory/commit/a685d678cb956b335567b6e459bc37570f3a2d8c) | **Use Haiku 5.5 for note analysis.** Note ingestion runs on every file, so move it from Opus 5.5 to Haiku 5.5 at effort low. Haiku has no server-side refusal fallback, so drop that beta; a declined file is marked failed. The preview script prices runs at Haiku rates.... |
| 2026-10-22 19:42 | `local-uq-import`, `main` | [`a443bc4`](https://github.com/filoliams/Trajectory/commit/a443bc475cb57a6c7d730e33b0c24a0a71570ba6) | **Switch note ingestion to share-first in the docs.** Drop the OneDrive/OneNote connector and native folder sync. For the MVP, students share from their notes app with Save to Files and pick the files in Trajectory; a direct iOS share sheet target is parked until there is an Apple... |
| 2026-10-22 17:30 | `local-uq-import`, `main` | [`45858d8`](https://github.com/filoliams/Trajectory/commit/45858d89f2985af6d467a04630e89ae38cd42013) | **Add AGENTS.md, CONTEXT.md and DECISIONS.md.** AGENTS.md maps the repo and sets what agents may, must ask about, and must not do. CONTEXT.md covers what the app does, who it is for, how it works, and the MVP. DECISIONS.md is a dated log of decisions, back-filled from the specs and... |
| 2026-10-19 00:31 | `local-uq-import`, `main` | [`793de82`](https://github.com/filoliams/Trajectory/commit/793de8295947c6b696d5f567d9254b377b4b9e58) | **Show Queensland public holidays from Nager.Date.** Today's date line names a public holiday on the day, and Coming up flags deadlines that fall on one. Free API, no key; cached on the device for 30 days and silent when offline. |
| 2026-10-19 00:25 | `local-uq-import`, `main` | [`26fa0ed`](https://github.com/filoliams/Trajectory/commit/26fa0edd5b13c6dfd1be094851f31768b7dae244) | **Add a local preview script for note analysis.** Runs the same prompt and checks as notes-ingest on files on this PC, using only an Anthropic key; nothing is saved. |
| 2026-10-18 23:54 | `local-uq-import`, `main` | [`55d7efe`](https://github.com/filoliams/Trajectory/commit/55d7efe25a9e828b09290761890cb0c640f88218) | **Add note ingestion core (phase 1): tables, Edge Functions, topic levels.** - SPEC.md capability map and SPEC-ingest-core.md - Migration: connections, documents, document_topics, sync_jobs, topics.understanding*, private notes bucket; row-level security on everything - Edge Functions notes-check (hash check)... |
| 2026-10-18 23:27 | `local-uq-import`, `main` | [`ccf5900`](https://github.com/filoliams/Trajectory/commit/ccf59003c01d82bda11f461ae72703353b2a744a) | **Add implementation plan and tasks for AI progress analysis.** |
| 2026-10-18 23:25 | `local-uq-import`, `main` | [`8742df8`](https://github.com/filoliams/Trajectory/commit/8742df8f5b2ba75ae57366435a69d4c28ca4cc3c) | **Simplify upcoming-deadline and label logic.** - upcoming() and shortCountdown() in planning replace the same list-building and countdown-trimming code in the trajectory view and Coming up - Today's empty state and Settings' sync label use small functions instead of repeated nested... |
| 2026-10-18 23:22 | `local-uq-import`, `main` | [`5829fb0`](https://github.com/filoliams/Trajectory/commit/5829fb011e9597aacc931fa50e208157a67d1dc4) | **Remove unused Expo template code and fix lint.** - Delete template tabs, themed components, theme hooks and constants nothing imported (fixes the /explore type error and the set-state-in-effect lint error at the source) - Typographic apostrophes in UI copy (react/no-unescaped-entities) |
| 2026-10-18 23:01 | `local-uq-import`, `main` | [`adb8b33`](https://github.com/filoliams/Trajectory/commit/adb8b33ab1980f70e37aa03260baca8d449e2a34) | **Add spec for AI progress analysis.** |
| 2026-10-18 22:53 | `local-uq-import`, `main` | [`37e6453`](https://github.com/filoliams/Trajectory/commit/37e645308f87d60305729d9cb8dd3d2685bb21f4) | **Brand the app and finish the redesign audit.** - Trajectory icon, favicon, splash and Android adaptive icons from scripts/make-icons.mjs - App name, page title and description; dark splash and adaptive backgrounds - Branded launch screen, Courses skeletons and a 404 page -... |
| 2026-10-18 22:40 | `local-uq-import`, `main` | [`be5e2bc`](https://github.com/filoliams/Trajectory/commit/be5e2bc53f33c8585168e73be752f3fc31a51b7e) | **Fix React Compiler lint in press feedback.** |
| 2026-10-18 22:39 | `local-uq-import`, `main` | [`10236f1`](https://github.com/filoliams/Trajectory/commit/10236f168e74117c746f2a62d0f37e39ba777a82) | **Wide layouts, 3D semester trajectory, Geist type and motion.** - Two-column Today, Courses grid and course page on wide screens; side rail nav - Your trajectory: upcoming deadlines on a rotating 3D path with a travelling spark - Spring press and hover feedback on buttons and cards; staggered... |
| 2026-10-18 22:12 | `local-uq-import`, `main` | [`ff21d65`](https://github.com/filoliams/Trajectory/commit/ff21d659dd1c690629693d45cc255ea0380e9523) | **Polish UI, fix UX inconsistencies, add settings and notes import.** - Shared type scale and corner radii across every screen - Settings tab: daily study hours, semester, account and sync status - Import Markdown/text notes to tick off course topics - Course level from notes coverage; weaker courses get... |
| 2026-10-18 21:58 | `local-uq-import`, `main` | [`e5d8695`](https://github.com/filoliams/Trajectory/commit/e5d8695f5dda808603a00a2502611acd4a5a84c6) | **Switch app to a dark theme with a lime accent.** |

### v0.5.0 — 2026-10-18
**Branch:** `local-uq-import`

| When | Commit | Change |
|---|---|---|
| 2026-10-18 01:56 | [`2873a52`](https://github.com/filoliams/Trajectory/commit/2873a52a5c7efc44a42684627ee075b5fb1ada23) | **Sync, offline support, study timer and topics.** Data is cached on the device so the app opens instantly without a connection. Edits made offline are queued and sent once you reconnect, and the most recent edit wins. Changes show up live on your other signed-in devices (Supabase Realtime), and you stay signed in while offline. Also adds the Today-tab study timer (daily totals saved to a `study_time` table), course topics and the add-course screen. New migrations: `topics.sql`, `sync.sql`. |

### v0.4.0 — 2026-10-17
**Branch:** `local-uq-import`

| When | Commit | Change |
|---|---|---|
| 2026-10-17 23:32 | [`faa5eef`](https://github.com/filoliams/Trajectory/commit/faa5eef) | **Course profile upload during onboarding.** Students pick their university, then upload each course profile (PDF or saved .html) with a step-by-step guide beside it. The new `/import-file` endpoint works out which course the file is for and rejects profiles from the wrong semester. PDFs are read from the "Assessment details" section. A due-date window like "14/09 - 18/09" now becomes one task due at the end of the window. |

### v0.3.0 — 2026-10-15
**Branch:** `local-uq-import`

| When | Commit | Change |
|---|---|---|
| 2026-10-15 05:24 | [`515a119`](https://github.com/filoliams/Trajectory/commit/515a119) | **Import course profiles from inside the app.** UQ blocks the backend from downloading profiles, so the app opens them in a built-in browser instead and sends the page to a new `/import-html` endpoint. Pasting the table still works as a fallback, and is the only option on web. |
| 2026-10-15 05:17 | [`8ade5bb`](https://github.com/filoliams/Trajectory/commit/8ade5bb) | **Add the mobile app.** Expo / React Native app scaffold with tabs, icons and assets (76 files). |

### v0.2.0 — 2026-10-15
**Branches:** `course-profile-import`, `local-uq-import`

| When | Commit | Change |
|---|---|---|
| 2026-10-15 05:10 | [`e6bfa6b`](https://github.com/filoliams/Trajectory/commit/e6bfa6b) | **Local UQ import code.** Adds `uq_import.py`, tests and the `phase1.sql` migration (on `local-uq-import`). |
| 2026-10-15 04:56 | [`4ce34bd`](https://github.com/filoliams/Trajectory/commit/4ce34bd) | **Import assessments from UQ course profiles.** Scraper that finds a course's profile on programs-courses.uq.edu.au and reads its assessment table. Adds endpoints to preview, import and read assessments, the `course_profiles` and `assessments` tables, and parser tests (on `course-profile-import`). |

### v0.1.0 — 2026-10-15
**Branch:** `main`

| When | Commit | Change |
|---|---|---|
| 2026-10-15 02:51 | [`4144fde`](https://github.com/filoliams/Trajectory/commit/4144fde) | Merged GitHub `main` into local copy. |
| 2026-10-15 02:51 | [`b2aad9b`](https://github.com/filoliams/Trajectory/commit/b2aad9b) | **Backend connected to Supabase.** Updates `backend/main.py`, requirements and `.env.example`. |
| 2026-10-15 02:03 | [`dcb5b2d`](https://github.com/filoliams/Trajectory/commit/dcb5b2d) | Added the `supabase/` project folder and config. |
| 2026-10-15 01:54 | [`584e4cd`](https://github.com/filoliams/Trajectory/commit/584e4cd) | Initial commit: README, `.gitignore`, `.env.example`. |

### Experimental — GoodNotes (2026-10-16)
Two separate attempts at the same feature. Neither is merged, so pick one before merging.

| When | Branch | Commit | Change |
|---|---|---|---|
| 2026-10-16 13:31 | `goodnotes-footprint` | [`8cb8119`](https://github.com/filoliams/Trajectory/commit/8cb8119) | **GoodNotes reader + Strong/Okay/Weak topic footprint.** Reads GoodNotes backup PDFs and sends only changed, non-blank pages to Claude vision. Scores each topic on coverage, depth, practice and recency. Adds `/notes` API routes, a CLI scanner and tests. |
| 2026-10-16 13:13 | `goodnotes-reader` | [`44f591b`](https://github.com/filoliams/Trajectory/commit/44f591b) | **GoodNotes note reader with AI transcription.** Watches the GoodNotes Auto Backup folder, reads typed text and transcribes handwriting with Claude vision (changed pages only). Analyses topics and confidence per notebook and saves the results to Supabase. |

---

## How this file updates

A GitHub Action ([`.github/workflows/changelog.yml`](.github/workflows/changelog.yml)) runs every hour and whenever you push to `main`. It adds any new commit from any branch to **Unreleased**. The description comes from your commit message: the first line becomes the bold title and the first paragraph becomes the description. Clear commit messages give you a clear changelog.

The Action commits to `main`, so run `git pull` before pushing from your computer. To run it right away, go to **Actions → Update changelog → Run workflow** on GitHub.

**Releasing a version:** rename `### Unreleased` to `### vX.Y.Z — date`, delete the "New commits are added here" line under it, add a row for it in the **Version overview** table, then push. The next run starts a fresh Unreleased section.

Version numbers: bump the last number (`0.5.0 → 0.5.1`) for fixes, the middle one (`0.5.0 → 0.6.0`) for new features.
