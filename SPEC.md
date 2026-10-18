# Trajectory note ingestion: capability map

Status: **approved** (2026-10-18). Each module gets its own `SPEC-<module>.md` when work on it starts.

Trajectory reads students' notes from wherever they already keep them, judges per-topic progress
with AI, and feeds that into course levels and the daily study plan. **It is not a backup service:**
it stores document metadata and the analysis, never the note text. Originals are uploaded only
temporarily and deleted once they've been read.

| Module id | Responsibility | Depends on | Spec |
|---|---|---|---|
| `ingest-core` | Tables and row-level security, the transient `notes` bucket, `notes-check` (hash check), `notes-ingest` (extract + course mapping + analysis in one Claude pass), topic aggregation | none | [SPEC-ingest-core.md](SPEC-ingest-core.md) |
| `files-route` | App "Sync notes": iOS Files picker (iCloud Drive, GoodNotes backups, the uni OneDrive app), on-device hashing, upload only what changed, status list, confirm or correct course | `ingest-core` | when reached |
| `graph-connector` | Azure app plus a UQ consent test, OAuth into Vault, delta sync on a pg_cron schedule, OneNote HTML to markdown; blocked consent falls back to `files-route` | `ingest-core` | when reached |
| `native-folder` *(parked)* | Folder bookmarks, background refresh, share extension | an Apple Developer membership | not planned |

**Build order:** `ingest-core` → `files-route` → `graph-connector`.

## Decisions that differ from the original brief

- **No stored text.** No `doc_text`, chunks or embeddings. Re-analysis means re-reading the source.
- **No native iOS code** (no Apple Developer membership), so the device route is the Files picker in
  Expo Go and on the web.
- **Ingestion runs on Supabase Edge Functions.** The FastAPI backend stays local, for course-profile import.

## Interfaces between modules

`ingest-core` owns the contract that the other modules call:

- `POST notes-check`: `{ provider, device_id, files: [{ path, name, size, content_hash, modified_at? }] }`
  → `{ needed: [{ path, document_id, upload_path }], unchanged: [path] }`
- Upload the original to Storage at `notes/{user_id}/{document_id}/{content_hash}.{ext}`.
- `POST notes-ingest`: `{ document_id }` → `202`. Progress is then shown through `documents.status`
  (realtime).

Server connectors (`graph-connector`) write `documents` rows and objects with the same shapes, then call
the same `notes-ingest`.
