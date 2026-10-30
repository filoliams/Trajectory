# 13: Read topics from PDF course profiles

**What to build:** A course profile saved as a PDF also gives its weekly topics. UQ shows each part of a profile on its own tab, and a printed PDF holds only the open tab, so the Learning activities tab is its own file: "Upload topics" accepts it, and Add course recognises which tab each file is (Assessment → assessments, Learning activities → topics) without one wiping the other.

**Blocked by:** None (can start immediately)

**Status:** built; weekly-row reading checked against the saved-page layout only (the one real PDF, MATH2010, lists no weekly topics)

- [x] The backend reads the Learning activities table from a printed PDF into topic names and weeks; multi-week rows are skipped, as for `.html`
- [x] The browser's print header and footer are stripped (they split an exam's name in the real MATH2010 PDF), and the footer's `#tab` names the tab that was printed
- [x] A wrong tab or a profile with no weekly topics gets a plain sentence naming the tab to save
- [x] A topics-only file never removes a course's imported assessments or its saved semester start
- [x] Backend tests cover trimmed lines from the real MATH2010 Assessment and Learning activities PDFs
- [ ] Check the weekly-row reader against a real profile PDF that has weekly topics
