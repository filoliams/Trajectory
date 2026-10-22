# Trajectory note ingestion: capability map

Status: **approved** (2026-10-18), **revised 2026-10-22: share-first**. Each module gets its own
`SPEC-<module>.md` when work on it starts.

Students send their notes to Trajectory from the app they write them in (GoodNotes, OneNote, Files).
Trajectory does not reach into their OneDrive or folders. It judges per-topic progress with AI, and
feeds that into course levels and the daily study plan. **It is not a backup service:** it stores document metadata and the analysis, never the note text. Originals are uploaded only
temporarily and deleted once they've been read.

| Module id | Responsibility | Depends on | Spec |
|---|---|---|---|
| `ingest-core` | Tables and row-level security, the transient `notes` bucket, `notes-check` (hash check), `notes-ingest` (extract + course mapping + analysis in one Claude pass), topic aggregation | none | [SPEC-ingest-core.md](SPEC-ingest-core.md) |
| `files-route` **(MVP)** | App "Add notes": the student shares from their notes app with *Save to Files*, then picks the files in Trajectory (Expo Go and web). On-device hashing, upload only what changed, status list, confirm or correct course | `ingest-core` | when reached |
| `ios-share` *(parked)* | "Share → Trajectory" from the iOS share sheet, feeding the same path as `files-route` | `files-route`, an Apple Developer membership | when unparked |
| ~~`graph-connector`~~ *(dropped)* | OneDrive/OneNote background sync. Dropped 2026-10-22, see [DECISIONS.md](DECISIONS.md) | | |
| ~~`native-folder`~~ *(dropped)* | Folder bookmarks and background refresh. Dropped 2026-10-22 | | |

**Build order:** `ingest-core` → `files-route`, then `ios-share` once there is a membership.
Android is out of scope (no Android beta testers).

## Decisions that differ from the original brief

- **No stored text.** No `doc_text`, chunks or embeddings. Re-analysis means re-reading the source.
- **No native iOS code** (no Apple Developer membership), so the device route is the Files picker in
  Expo Go and on the web.
- **Share-first, no background sync** (2026-10-22). The student chooses what to send; Trajectory never
  holds OneDrive tokens or folder access.
- **Ingestion runs on Supabase Edge Functions.** The FastAPI backend stays local, for course-profile import.

## Interfaces between modules

`ingest-core` owns the contract that the other modules call:

- `POST notes-check`: `{ provider, device_id, files: [{ path, name, size, content_hash, modified_at? }] }`
  → `{ needed: [{ path, document_id, upload_path }], unchanged: [path] }`
- Upload the original to Storage at `notes/{user_id}/{document_id}/{content_hash}.{ext}`.
- `POST notes-ingest`: `{ document_id }` → `202`. Progress is then shown through `documents.status`
  (realtime).

`ios-share` hands its files to the same `files-route` path, so it calls nothing new.
