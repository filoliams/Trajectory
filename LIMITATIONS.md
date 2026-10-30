# LIMITATIONS.md

Known limits and inconsistencies in what Trajectory does today, so they can be resolved deliberately later.
Each entry says what the limit is, why it exists, what it affects, and the likely way out. When one is
resolved, delete it here and log the choice in [DECISIONS.md](DECISIONS.md).

Last reviewed: 2026-10-30.

## Notes and AI analysis

### L1. Notes are deleted after reading, so nothing can reuse them later
- **What:** A note file is read once by `notes-ingest`, then the original is deleted. Only per-topic levels and one-line reasons are kept.
- **Why:** A guardrail in AGENTS.md and SPEC-ingest-core.md: no note text and no original file is kept.
- **Affects:** Any later feature that wants the student's own material. A quiz can only use the course and topic name, not the student's notes. Re-analysing with a better prompt needs the student to upload the file again.
- **Ways out:** (a) Keep generic, topic-name questions (fits the rule). (b) Write questions while the notes are being read and store them; this stores content derived from the notes, so it needs an explicit change to the rule and the privacy wording in `legal.ts`.

### L2. Evidence-first analysis is built but not deployed
- **What:** Version 2 of the analysis (find where each topic appears, then rate; several courses per notebook) is committed but `notes-ingest` hasn't been redeployed.
- **Affects:** Live levels still come from version 1, without page locations. Version 1 results stay until each file is uploaded again.
- **Ways out:** Ticket 11 (deploy plus one real notebook run). Consider a "re-check my notes" prompt for stale results, which needs the file again (see L1).

### L3. One AI call reads a whole notebook
- **What:** Each file is sent to Claude in a single call at `low` effort.
- **Affects:** Very long notebooks may get thinner ratings for later sections. Files over 20 MB are skipped with a reason, never cut short.
- **Ways out:** Split long PDFs into page ranges, one call each. Needs a PDF dependency and uses more of the daily cap. Decide after the ticket 11 test.

### L4. 25 analyses per student per day
- **What:** A fixed cap in `notes-ingest`.
- **Affects:** A student uploading a semester's worth of separate files in one sitting hits it. Any future quiz that shares this cap would make it worse.
- **Ways out:** Give each feature its own cap; revisit the number after the beta.

### L5. The app always tells the AI which course a file was added to
- **What:** Notes uploaded from a course page are filed under that course's code, so the AI never has to guess the course for app uploads. Other courses in the same notebook are found only if the AI chooses to list them.
- **Affects:** Multi-course notebooks rely on the model noticing the second course.
- **Ways out:** Check it during the ticket 11 test; if it misses, ask for courses explicitly per page range.

### L6. Upload notes needs the internet, though word matching works offline
- **What:** The new Upload notes button is disabled offline. Before, adding Markdown or text notes offline still ticked topics by word matching.
- **Affects:** Offline students lose the word-match fallback for text notes. This is an inconsistency introduced with the two-step Topics flow.
- **Ways out:** Enable the button offline for text files only and skip the AI step, with a line saying the full check runs when back online.

### L7. The "How the AI read this file" panel isn't possible yet
- **What:** The server doesn't store which courses were found or how many ratings were dropped for having no location.
- **Ways out:** Ticket 12, after ticket 11.

## Topics and course profiles

### L8. Course profiles can't be fetched by course code
- **What:** UQ's course profile site returns 403 to the backend, so students must save the profile page themselves and upload it.
- **Ways out:** None on our side short of an official UQ data source. Keep the "save the page" guidance clear.

### L9. Only the saved `.html` profile gives topics; PDFs don't
- **What:** The PDF reader extracts assessments only.
- **Affects:** "From course profile" with a PDF always says no topics were found.
- **Ways out:** Ticket 13.

### L10. Profile import needs the local backend
- **What:** Reading a profile (for assessments or topics) goes to the FastAPI backend, which only runs locally (see DECISIONS.md, 2026-10-27).
- **Affects:** Profile uploads only work where the backend is reachable, e.g. your machine during development, not a hosted build.
- **Ways out:** Host the import endpoint (keep it off the public landing site), or move parsing into a Supabase function.

### L11. UQ only
- **What:** The university picked in onboarding isn't stored; the app assumes UQ everywhere profiles are involved.
- **Ways out:** Store the university on the profile and add a parser per university.

### L12. Topic order can collide
- **What:** Imported topics take their position from the profile's order; typed topics go after the current count. Mixing the two can give two topics the same position.
- **Affects:** Order between those topics may look arbitrary.
- **Ways out:** Renumber positions after each import, or add drag-to-reorder.

### L13. Importing topics into a course created offline must wait
- **What:** A course still waiting to sync has a temporary id, and topic import refuses it with "This course is still being saved."
- **Ways out:** Queue the import in the outbox like other offline edits.

## Knowledge checks (not built)

### L14. Levels measure notes coverage, not what the student knows
- **What:** A Strong level means the notes cover the topic well, not that the student has learned it.
- **Ways out:** Decided 2026-10-30: an optional "Quiz me" per topic with a confidence score (tickets 14-16). Until those ship, levels still mean notes coverage only. Quiz questions are generic because of L1.

## Tooling

### L15. Deno checks break with the root `package.json`
- **What:** The root `package.json` (commit ed7faaf) makes Deno expect packages in `node_modules`, so `npx deno@2 check supabase/functions/*/index.ts` fails, and `deno lint` reports 5 inline-import errors.
- **Workaround:** `npx deno@2 check --node-modules-dir=none supabase/functions/*/index.ts`.
- **Ways out:** Remove the root `package.json` if it isn't needed, or add a `deno.json` that sets `nodeModulesDir` and an import map. Then AGENTS.md's "Done means green" command works again.

## Platforms

### L16. No share-to-Trajectory on iOS, no Android
- **What:** The iOS share sheet extension needs an Apple Developer membership and a development build (ticket 05, parked). Android is out of scope (no Android beta testers).
- **Affects:** Students export from GoodNotes or OneNote to Files, then pick the file in the app.
