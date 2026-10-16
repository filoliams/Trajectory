"""Turn page evidence into a Strong / Okay / Weak footprint per topic.

Four signals per topic, each 0..1:

    coverage  Is the topic in your notes at all? Syllabus topics with no
              pages score 0 and are labelled Weak ("Not in your notes yet").
    depth     How substantial the notes are. Headings count for little,
              worked examples count most; unfinished notes are docked.
    practice  How many problems you've attempted, scaled by how many you got
              right (when they're marked).
    recency   When you last touched it. Halves every three weeks, so last
              week's notes count for more than notes from week 2.

    score = 0.15 coverage + 0.30 depth + 0.35 practice + 0.20 recency

Practice is weighted highest because it's the best evidence you can actually
do the material, not just that you wrote it down. Two guard rails keep the
labels honest:
    - Strong needs real practice (a few problems, mostly right).
    - No practice at all: detailed notes can reach Okay, brief notes stay Weak.
    - Practice that's mostly wrong (3+ marked, under 45% right) is Weak:
      you've tried it and it isn't landing yet.
    - Headings only can never be better than Weak.

All the tuning numbers live in WEIGHTS / THRESHOLDS so they're easy to adjust
once real data comes in.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date

from .models import (
    ContentDepth, CourseFootprint, Level, PageRecord, TopicFootprint,
)

WEIGHTS = {"coverage": 0.15, "depth": 0.30, "practice": 0.35, "recency": 0.20}
THRESHOLDS = {"strong": 0.65, "okay": 0.40}

DEPTH_VALUE = {
    ContentDepth.heading_only: 0.10,
    ContentDepth.brief_notes: 0.40,
    ContentDepth.detailed_notes: 0.75,
    ContentDepth.worked_example: 1.00,
}
DEPTH_FULL_AT = 2.0          # e.g. two detailed pages + an example = full depth
UNFINISHED_PENALTY = 0.15
PRACTICE_FULL_AT = 8         # problems attempted for full practice volume
UNMARKED_ACCURACY = 0.6      # assumed accuracy when nothing is marked
RECENCY_HALF_LIFE_DAYS = 21
STRONG_MIN_PRACTICE = 0.30   # practice score needed for Strong
STRONG_MIN_ACCURACY = 0.60   # of marked problems
OKAY_MIN_DEPTH_NO_PRACTICE = 0.70
FAILING_ACCURACY = 0.45
FAILING_MIN_MARKED = 3

# How much the planner scales a task's priority by footprint level.
# "none" stays 1.0 so courses without notes behave exactly as before Phase 5.
PRIORITY_MULTIPLIER = {
    Level.weak: 1.6, Level.okay: 1.2, Level.strong: 0.85, Level.none: 1.0,
}


def _norm(name: str) -> str:
    return " ".join(name.lower().replace("-", " ").split())


@dataclass
class _Tally:
    name: str
    depth_points: float = 0.0
    best_depth: ContentDepth | None = None
    unfinished: bool = False
    attempted: int = 0
    correct: int = 0
    incorrect: int = 0
    pages: set[tuple[str, int]] = field(default_factory=set)
    last_touched: date | None = None


def _level(score: float) -> Level:
    if score >= THRESHOLDS["strong"]:
        return Level.strong
    if score >= THRESHOLDS["okay"]:
        return Level.okay
    return Level.weak


def _weeks_ago(days: int) -> str:
    if days < 7:
        return "this week"
    weeks = days // 7
    return "last week" if weeks == 1 else f"{weeks} weeks ago"


def _evidence(t: _Tally, level: Level, days_since: int | None) -> str:
    pages = len(t.pages)
    page_txt = f"{pages} page{'s' if pages != 1 else ''}"
    marked = t.correct + t.incorrect

    if pages == 0:
        return "Not in your notes yet"
    if t.best_depth == ContentDepth.heading_only:
        return "Headings only"

    if t.attempted == 0:
        practice_txt = "no practice problems"
    else:
        practice_txt = f"{t.attempted} practice problem{'s' if t.attempted != 1 else ''}"
        if marked:
            ratio = t.correct / marked
            practice_txt += (", mostly right" if ratio >= 0.75
                             else ", about half right" if ratio >= 0.45
                             else ", mostly wrong")

    if t.unfinished and level != Level.strong:
        return f"Notes stop partway through, {practice_txt}"
    if days_since is not None and days_since > 28:
        return f"{page_txt}, {practice_txt}, last touched {_weeks_ago(days_since)}"
    if t.best_depth == ContentDepth.worked_example and t.attempted == 0:
        return f"Worked examples, {practice_txt}"
    return f"{page_txt}, {practice_txt}"


def score_topic(t: _Tally, course_code: str, today: date) -> TopicFootprint:
    covered = len(t.pages) > 0
    coverage = 1.0 if covered else 0.0

    depth = min(1.0, t.depth_points / DEPTH_FULL_AT)
    if t.unfinished:
        depth = max(0.0, depth - UNFINISHED_PENALTY)

    marked = t.correct + t.incorrect
    accuracy = t.correct / marked if marked else UNMARKED_ACCURACY
    volume = min(1.0, t.attempted / PRACTICE_FULL_AT)
    practice = volume * (0.3 + 0.7 * accuracy)

    days_since = (today - t.last_touched).days if t.last_touched else None
    recency = 0.5 ** (max(days_since, 0) / RECENCY_HALF_LIFE_DAYS) if days_since is not None else 0.0

    score = (WEIGHTS["coverage"] * coverage + WEIGHTS["depth"] * depth
             + WEIGHTS["practice"] * practice + WEIGHTS["recency"] * recency)

    level = _level(score)
    if level == Level.strong and (
        practice < STRONG_MIN_PRACTICE or (marked and accuracy < STRONG_MIN_ACCURACY)
    ):
        level = Level.okay
    if t.attempted == 0 and depth < OKAY_MIN_DEPTH_NO_PRACTICE:
        level = Level.weak
    if marked >= FAILING_MIN_MARKED and accuracy < FAILING_ACCURACY:
        level = Level.weak

    return TopicFootprint(
        course_code=course_code, topic=t.name, level=level, score=round(score, 3),
        coverage=coverage, depth=round(depth, 3), practice=round(practice, 3),
        recency=round(recency, 3), pages=len(t.pages),
        practice_attempted=t.attempted, practice_correct=t.correct,
        practice_incorrect=t.incorrect, last_touched=t.last_touched,
        evidence=_evidence(t, level, days_since),
    )


def build_course_footprint(
    course_code: str,
    pages: list[PageRecord],
    syllabus_topics: list[str] | None = None,
    today: date | None = None,
) -> CourseFootprint:
    """Score every topic in a course from all the pages read so far.

    syllabus_topics: topics from the course profile, if known. Any that never
    appear in your notes show up as Weak so gaps aren't invisible.
    """
    today = today or date.today()
    tallies: dict[str, _Tally] = {}
    for name in syllabus_topics or []:
        tallies.setdefault(_norm(name), _Tally(name))

    course_pages = [p for p in pages if p.course_code == course_code]
    order = list(ContentDepth)
    for page in course_pages:
        # Each topic counts its depth once per page, using the deepest entry.
        per_page: dict[str, list] = defaultdict(list)
        for ev in page.reading.topics:
            per_page[_norm(ev.topic)].append(ev)
        for key, evs in per_page.items():
            t = tallies.setdefault(key, _Tally(evs[0].topic))
            deepest = max(evs, key=lambda e: order.index(e.depth)).depth
            t.depth_points += DEPTH_VALUE[deepest]
            if t.best_depth is None or order.index(deepest) > order.index(t.best_depth):
                t.best_depth = deepest
            for ev in evs:
                t.attempted += ev.practice_attempted
                t.correct += ev.practice_correct
                t.incorrect += ev.practice_incorrect
                t.unfinished |= ev.unfinished
            t.pages.add((page.notebook, page.page_index))
            d = page.effective_date
            if t.last_touched is None or d > t.last_touched:
                t.last_touched = d

    # Once a later page finishes a topic, stop calling it unfinished.
    for t in tallies.values():
        if t.unfinished and t.depth_points >= DEPTH_FULL_AT:
            t.unfinished = False

    topics = sorted(
        (score_topic(t, course_code, today) for t in tallies.values()),
        key=lambda f: f.score,
    )

    if not course_pages:
        return CourseFootprint(
            course_code=course_code, level=Level.none, score=None,
            summary="No notes yet", topics=topics,
            weakness_multiplier=PRIORITY_MULTIPLIER[Level.none],
        )

    score = sum(f.score for f in topics) / len(topics)
    level = _level(score)
    weak = [f.topic for f in topics if f.level == Level.weak]
    strong = [f.topic for f in topics if f.level == Level.strong]
    parts = []
    if strong:
        parts.append("solid on " + ", ".join(strong[-2:]))
    if weak:
        parts.append("needs work on " + ", ".join(weak[:2]))
    summary = "; ".join(parts) or "steady across topics"

    return CourseFootprint(
        course_code=course_code, level=level, score=round(score, 3),
        summary=summary[0].upper() + summary[1:], topics=topics,
        weakness_multiplier=PRIORITY_MULTIPLIER[level],
    )


def assessment_multiplier(course: CourseFootprint, covered_topics: list[str] | None) -> float:
    """Weakness factor for one assessment, for the planner's priority formula.

    Uses the topics the assessment covers when known (e.g. "Assignment 3:
    Regression" -> Linear regression, Residual analysis); otherwise the course.
    """
    if not covered_topics:
        return course.weakness_multiplier
    wanted = {_norm(t) for t in covered_topics}
    matched = [f for f in course.topics if _norm(f.topic) in wanted]
    if not matched:
        return course.weakness_multiplier
    return round(sum(PRIORITY_MULTIPLIER[f.level] for f in matched) / len(matched), 3)
