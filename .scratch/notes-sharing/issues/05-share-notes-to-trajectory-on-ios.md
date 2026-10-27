# 05: Share notes to Trajectory on iPhone and iPad

**What to build:** Trajectory appears in the iOS share sheet. From GoodNotes, OneNote or Files, the student taps Share → Trajectory and the note goes through the same path as ticket 03, without saving to Files first. If they aren't signed in, they sign in and the share continues.

**Blocked by:** 03 (Pick notes and get AI topic levels); an Apple Developer membership plus an EAS (or Mac) iOS build. A share extension can't run in Expo Go.

**Status:** parked (not in the MVP; unpark when the membership is in place)

- [ ] A development build installs on the owner's iPad
- [ ] Trajectory shows in the share sheet for PDFs, images and text/markdown files
- [ ] A shared GoodNotes PDF ends with topic levels on the right course
- [ ] Sharing several files at once works
- [ ] Sharing while signed out resumes after sign-in, without losing the files
- [ ] Native config lives in `app.json` and config plugins, not in hand-edited `ios/`
