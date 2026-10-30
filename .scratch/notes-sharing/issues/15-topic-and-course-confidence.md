# 15: Topic and course confidence, with the trend bubble

**What to build:** Every topic shows a confidence score that rises with quiz results, a round trend bubble, and the change this week. The bubble is green with ↑ when the latest quiz raised confidence, red with ↓ when it lowered it, and yellow with – when nothing changed; a topic with no quiz has no bubble. After a quiz the row updates in place with a short confirmation of the new score; there is no separate result screen and no legend. The course page shows overall confidence, its change since Monday, and how many topics are Confident, Getting there or Shaky; course cards show "% confident". Merges the earlier 15, 16 and 17.

**Blocked by:** 14 (Quiz me on a topic, scores saved)

**Status:** ready-for-agent

Confidence, decided by the owner 2026-10-30 (from the prototype):

```
notes        none 0 · weak 33 · okay 67 · strong 100
no quiz      notes × 0.6                                  (at most 60%)
one quiz     notes × 0.4 + quiz% × 0.6
two or more  notes × 0.2 + avg(last two quiz%) × 0.8       (Weak notes + full marks reaches Confident)
bands        Confident ≥ 75 · Getting there 40–74 · Shaky < 40
bubble       confidence now vs. before the latest quiz → ↑ / ↓ / –
```

- [ ] Confidence is one pure module with a `*.check.ts` covering no quiz, one quiz, two or more, the bands and the bubble direction
- [ ] Each topic row shows the confidence bar, the bubble (with a spoken label) and "+N this week"
- [ ] After a quiz, the row updates and a short confirmation names the new score; no result screen
- [ ] The course summary and the course card are worked out from the same per-topic numbers
- [ ] Bubble colours meet contrast on the dark theme and don't rely on colour alone (the arrow carries the meaning)
