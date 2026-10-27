# 03: Pick notes and get AI topic levels

**What to build:** The core note-upload path, end to end. A student taps "Add notes" and picks one or more files from Files (works in Expo Go on iPad and on the web). The app hashes each file, asks `notes-check` which ones it needs, uploads only those to the student's area of the private `notes` bucket, and calls `notes-ingest` for each. When analysis finishes, the course's topics show their level and one-line reason, and the course chip and Today's plan update. The direct-share route (ticket 05) will reuse this path, so it takes a list of files as input and doesn't care where they came from.

**Blocked by:** 01 (Deploy the note-analysis pipeline)

**Status:** built, awaiting live check (needs 01)

- [x] Accepts `.md`, `.txt`, `.pdf` and images (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`); other types are refused with a plain sentence before upload
- [x] Picking the same unchanged file again uploads nothing and triggers no new analysis
- [x] Files over 20 MB are not uploaded and the student is told why
- [x] Topic levels and reasons appear without a manual refresh (realtime on documents/topics)
- [x] If the pipeline can't run (offline, function error, daily cap reached), `.md`/`.txt` notes still tick topics by word matching and the student sees "Deeper analysis didn't run" with the reason
- [x] Note text is never written to the app's local cache or logs
- [x] Hashing and file-type checks live in a pure module with a node self-check; tsc and lint are clean
- [ ] Verified on iPad (Expo Go) with a real GoodNotes PDF saved to Files
