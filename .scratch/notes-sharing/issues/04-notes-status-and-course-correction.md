# 04: Notes status and course correction

**What to build:** A list of the student's synced notes. Each note shows its state (uploading, analysing, done, failed, skipped) with a plain-English reason when it didn't work. A failed note can be retried. When Claude chose the course itself (no course code in the file name), the note shows the guessed course and the student can confirm or change it. Changing the course re-runs analysis against the new course's topics.

**Blocked by:** 03 (Pick notes and get AI topic levels)

**Status:** ready-for-agent

- [ ] States update live while a note is processing
- [ ] Failure and skip reasons are full sentences, never stack traces or error codes
- [ ] Retry re-sends the same file without creating a duplicate document
- [ ] AI-chosen courses are visibly marked and can be confirmed or changed; changing re-analyses and updates topic levels
- [ ] Hitting the 25-per-day cap shows when the student can try again
- [ ] Removing a note from the list removes its topic contributions so levels recompute
