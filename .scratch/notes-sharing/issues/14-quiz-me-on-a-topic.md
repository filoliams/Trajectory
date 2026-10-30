# 14: Quiz me on a topic, scores saved

**What to build:** On a course page, each topic has a "Quiz me" button. It opens three multiple-choice questions about that topic, written by Claude from the course and topic name (notes are deleted after reading, so they can't be used; see LIMITATIONS.md L1). The student answers in the app, sees right or wrong with a one-line explanation, and the score is saved with its date. The topic row shows "Last quiz 2/3, 3 days ago". Behaviour matches option C in the "Quiz Options Prototype" artifact.

**Blocked by:** None (can start immediately). The owner runs the migration and deploys the new function.

**Status:** built, awaiting the owner: run migration `20261030000000_quiz_attempts.sql` and deploy `quiz-make`, then one live quiz

Decisions (owner, 2026-10-30): model `claude-haiku-5-5` at effort `low`; 15 quizzes per student per day for now.

- [x] A new function writes three questions per quiz with structured output; the reply is validated (wrong shape, fewer than two answers, or an out-of-range correct answer means no quiz and a plain sentence)
- [x] Quiz attempts are saved per topic with score, total and time, under row-level security; no note content and no question text is stored
- [x] The daily limit (15) is read from one place keyed by plan tier, so free and paid tiers can get different limits later without code changes elsewhere
- [x] Reaching the limit shows a plain sentence saying when it resets
- [x] Quiz me is disabled offline with a reason
- [x] The topic row shows the latest score and how long ago it was taken
- [x] Token counts are logged, never question or answer text
