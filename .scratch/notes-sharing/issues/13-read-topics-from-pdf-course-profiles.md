# 13: Read topics from PDF course profiles

**What to build:** A course profile saved as a PDF also gives its weekly topics, so "From course profile" works whichever format the student downloaded. Today only the saved `.html` page yields topics.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The backend reads the learning-activities table from a real UQ profile PDF into topic names and weeks
- [ ] A backend test covers one real profile PDF (checked into the test fixtures if its licence allows, else a trimmed sample)
- [ ] Multi-week rows are skipped, as for `.html`
