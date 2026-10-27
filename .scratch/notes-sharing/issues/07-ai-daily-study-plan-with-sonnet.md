# 07: AI daily study plan with Sonnet 5.5

**What to build:** The Today tab's plan comes from Sonnet 5.5 instead of only the on-device rules. When a student opens Today, the app asks a server function for today's plan. The function reads that student's courses, upcoming assessments (due dates, weights, hurdles), topic levels with reasons, daily study hours, time already studied, and Queensland public holidays. Sonnet returns an ordered list of study blocks, each with a course or assessment, minutes, the topics to focus on, and a one-line reason ("Quiz 2 is in 3 days and your notes on limits are weak"). Today shows it. If the AI plan isn't available (offline, error, not set up), Today shows the current on-device plan, so the tab never breaks.

**Blocked by:** 01 (Deploy the note-analysis pipeline). It reuses the server setup and the Anthropic key. Topic levels make the plan better but don't block it: the word-match levels work as input.

**Status:** built, awaiting deploy (migration `20261022140000_daily_plans.sql` + `plan-day` function) and one live run

- [x] The plan's total minutes never exceed the student's daily study hours, and every block points at a real assessment of theirs (validated on the server; invalid output falls back to the on-device plan)
- [x] Each block shows its reason and focus topics; the student can see why a course got more time
- [x] At most one AI plan per student per day, cached, plus a manual "Re-plan" with its own small daily cap (2), so cost stays bounded
- [x] Uses `claude-sonnet-5-5` with structured output and the server-side refusal fallback; the key stays on the server and the caller's JWT is used, so row-level security applies
- [x] No note text is sent; only topic names, levels and reasons
- [x] Offline or on failure, Today shows the on-device plan with a quiet note
- [x] Plan validation (minutes cap, ids belong to the student) lives in a pure module with a node self-check; tsc and lint are clean
- [ ] Token usage per call is logged without content (done), and the cost of one typical plan is recorded in DECISIONS.md (needs a live run)
