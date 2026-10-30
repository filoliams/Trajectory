# 08: Import topics from a saved course profile

**What to build:** On a course page, a student uploads the course profile page they saved from the UQ site and its weekly topics are added to that course. Only topics change: the course's assessments are left as they are. UQ's site refuses automatic downloads, so the student saves the page themselves.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] A saved `.html` profile adds every weekly topic the course doesn't have yet; existing topics keep their notes status
- [x] Importing never replaces or removes assessments
- [x] A profile for a different course is refused with a plain sentence naming both codes
- [x] A profile with no readable topics (any PDF today) says so and points to the `.html` page or typing
- [x] Needs the network, and says so when offline
