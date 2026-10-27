# 06: Check Haiku reads handwritten notes well enough

**What to build:** Evidence that Haiku 5.5 gives sensible topic levels for handwritten GoodNotes notes, not just typed ones. Run the local preview script on a small set of real notes (at least two handwritten GoodNotes PDFs of 30–50 pages, one photographed page, one typed file for comparison) against real course topics, and hand-grade the levels and reasons. The outcome is a decision: keep Haiku for everything, or send handwritten PDFs and images to Sonnet 5.5 while typed notes stay on Haiku.

**Blocked by:** None (needs only the Anthropic key locally; it does not need the deploy)

**Status:** needs-human (each run spends a little API money, so the owner approves and supplies the notes)

- [ ] For each file: the expected level per topic is written down before the run
- [ ] Each file's levels, reasons, time and cost are recorded, and so are any files the model declined
- [ ] At least 4 in 5 handwritten topic levels are within one step of the hand grade, and no reason misreads the handwriting badly enough to be wrong
- [ ] If the bar isn't met, the same files are re-run with Sonnet 5.5 and its cost is compared
- [ ] The decision and the numbers are added to DECISIONS.md; if handwriting moves to Sonnet, that change becomes its own ticket
