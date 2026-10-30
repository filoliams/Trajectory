# 12: Show how the AI read a notes file

**What to build:** After Upload notes, the student sees a short "How the AI read <file>" panel, as in the prototype: the courses found (with page ranges), how many topics were located, and how many ratings were dropped for having no location. When another course was also scored, the result line says so.

**Blocked by:** 11 (Put the evidence-first notes analysis live)

**Status:** ready-for-agent

- [ ] The server records, per document, the courses found and the located and dropped counts (no note text)
- [ ] The panel appears after an upload and can be hidden
- [ ] "STAT1201 was updated too" appears when a second course was scored
- [ ] A course found in the notes but with no topics yet is named, with a hint to add its topics and upload again
