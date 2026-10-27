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
