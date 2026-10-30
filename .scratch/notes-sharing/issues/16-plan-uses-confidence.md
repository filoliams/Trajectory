# 16: The daily plan uses confidence

**What to build:** The AI daily plan receives each topic's confidence and uses it: shaky topics in courses with close or heavy deadlines get more time and become the block's focus topics. The first plan card's "Why this?" names the topic that improved most this week and the shakiest topic, with a Quiz me shortcut. See the "Daily Plan Confidence" artifact for how it behaves.

**Blocked by:** 15 (Topic and course confidence)

**Status:** built, awaiting the owner: redeploy `plan-day` (after ticket 14 is live)

- [x] Plan input sends each topic's confidence and band instead of its notes level (confidence already includes the notes level, so the plan has one number to weigh); decided by the owner 2026-10-30
- [x] The plan prompt talks about confidence, not notes coverage: favour courses and topics with low confidence, and choose focus topics from the lowest-confidence ones, skipping Confident ones; existing checks (total minutes, 15-minute minimum, at most three topics, own assessments only) still hold
- [x] The first plan card's "Why this?" names the biggest improver this week (if any) and the shakiest topic with its %, with a Quiz me button
- [x] The on-device fallback plan uses the same confidence numbers when the AI plan isn't available
- [x] `_shared/check.ts` covers the new plan input
