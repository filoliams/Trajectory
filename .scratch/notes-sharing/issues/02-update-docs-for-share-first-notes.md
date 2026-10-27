# 02: Update the docs for share-first notes

**What to build:** The specs and context describe the new direction. Students send notes from the app they write them in, not through automatic OneDrive or folder syncing. For the MVP that means GoodNotes/OneNote → Share → Save to Files, then pick in Trajectory. A direct "Share to Trajectory" on iOS is parked until there is an Apple Developer membership.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Capability map: the OneDrive/OneNote connector (`graph-connector`) and native folder sync are marked dropped; the Files-picker route is the MVP route; iOS share is listed as parked on the membership
- [x] CONTEXT.md MVP table and "not in the MVP" list match
- [x] DECISIONS.md gets a dated entry: drop automatic folder sync in favour of sharing from the notes app, and why (no background access to students' folders, no Microsoft consent dependency, no membership for the MVP)
- [x] Android is noted as out of scope (no Android beta testers)
